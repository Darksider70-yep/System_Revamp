"""Cloud agent uploader for sending local machine security data to Cloud Security Core."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping

import requests

from .event_engine import SecurityEventEngine
from .fast_scanner import FastScanner
from .metrics_monitor import MetricsMonitor
from .system_info import collect_system_info

LOGGER = logging.getLogger("system_monitor_service.cloud_agent")


class CloudAgentUploader:
    """Registers the local machine and uploads scans on a fixed interval."""

    def __init__(
        self,
        fast_scanner: FastScanner,
        metrics_monitor: MetricsMonitor,
        event_engine: SecurityEventEngine,
        upload_interval_seconds: int = 60,
    ) -> None:
        self._fast_scanner = fast_scanner
        self._metrics_monitor = metrics_monitor
        self._event_engine = event_engine

        self._enabled = os.getenv("CLOUD_AGENT_ENABLED", "1").strip().lower() in {"1", "true", "yes"}
        self._cloud_base_url = os.getenv("CLOUD_CORE_URL", "http://localhost:9000").rstrip("/")
        self._timeout = max(5, int(os.getenv("CLOUD_AGENT_TIMEOUT_SECONDS", "20")))
        self._upload_interval_seconds = max(30, int(upload_interval_seconds))

        default_identity_path = Path(__file__).resolve().parents[1] / "cache" / "cloud_agent_identity.json"
        configured_identity_path = os.getenv("CLOUD_AGENT_IDENTITY_PATH", str(default_identity_path))
        self._identity_path = Path(configured_identity_path)

        self._machine_id: str | None = None
        self._api_key: str | None = None
        self._last_uploaded_event_ts: datetime | None = None

        self._session = requests.Session()

    @property
    def enabled(self) -> bool:
        return self._enabled

    async def run_forever(self) -> None:
        if not self._enabled:
            LOGGER.info("Cloud agent uploader disabled via CLOUD_AGENT_ENABLED")
            return

        while True:
            try:
                await self.upload_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                LOGGER.exception("Cloud upload cycle failed")

            await asyncio.sleep(self._upload_interval_seconds)

    async def upload_once(self) -> None:
        if not self._enabled:
            return

        await self._ensure_registered()
        if not self._machine_id or not self._api_key:
            LOGGER.warning("Cloud agent has no machine identity; skipping upload")
            return

        scan = await self._fast_scanner.fast_scan()
        metrics = await self._metrics_monitor.latest()

        recent_events = self._event_engine.list_events(limit=20)
        risk_score = int(self._event_engine.risk_score(metrics=metrics, recent_events=recent_events))

        payload = {
            "machine_id": self._machine_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "apps": self._normalize_apps(scan),
            "drivers": self._normalize_drivers(scan),
            "system_metrics": self._normalize_metrics(metrics),
            "risk_score": risk_score,
            "security_events": self._collect_new_events(recent_events),
        }

        headers = {"X-API-Key": self._api_key}
        response = await asyncio.to_thread(
            self._session.post,
            f"{self._cloud_base_url}/upload-scan",
            json=payload,
            headers=headers,
            timeout=self._timeout,
        )

        if response.status_code == 401:
            LOGGER.warning("Cloud API rejected API key. Re-registering machine identity.")
            self._machine_id = None
            self._api_key = None
            self._identity_path.unlink(missing_ok=True)
            return

        if response.status_code == 404:
            LOGGER.warning("Cloud machine record not found. Re-registering machine identity.")
            self._machine_id = None
            self._api_key = None
            self._identity_path.unlink(missing_ok=True)
            return

        if response.status_code >= 400:
            LOGGER.warning("Cloud upload failed (%s): %s", response.status_code, response.text)
            return

        LOGGER.info("Cloud scan upload succeeded for machine %s", self._machine_id)

    async def _ensure_registered(self) -> None:
        if self._machine_id and self._api_key:
            return

        if not self._load_identity_file():
            await self._register_machine()

    def _load_identity_file(self) -> bool:
        if not self._identity_path.exists():
            return False

        try:
            payload = json.loads(self._identity_path.read_text(encoding="utf-8"))
        except Exception:
            LOGGER.warning("Failed to parse cloud agent identity file. Re-registering.")
            return False

        machine_id = str(payload.get("machine_id", "")).strip()
        api_key = str(payload.get("api_key", "")).strip()
        if not machine_id or not api_key:
            return False

        self._machine_id = machine_id
        self._api_key = api_key
        return True

    async def _register_machine(self) -> None:
        system_info = collect_system_info()
        payload = {
            "hostname": str(system_info.get("hostname", "unknown-host")).strip() or "unknown-host",
            "os": str(system_info.get("os", "unknown-os")).strip() or "unknown-os",
            "os_version": str(system_info.get("os_version", "unknown-version")).strip() or "unknown-version",
            "cpu": str(system_info.get("cpu", "unknown-cpu")).strip() or "unknown-cpu",
            "ram_gb": max(1, int(round(float(system_info.get("ram_gb", 1))))),
        }

        response = await asyncio.to_thread(
            self._session.post,
            f"{self._cloud_base_url}/register-machine",
            json=payload,
            timeout=self._timeout,
        )

        if response.status_code >= 400:
            LOGGER.warning("Machine registration failed (%s): %s", response.status_code, response.text)
            return

        data = response.json() if response.content else {}
        machine_id = str(data.get("machine_id", "")).strip()
        api_key = str(data.get("api_key", "")).strip()

        if not machine_id or not api_key:
            LOGGER.warning("Machine registration returned incomplete credentials")
            return

        self._machine_id = machine_id
        self._api_key = api_key
        self._persist_identity_file(machine_id=machine_id, api_key=api_key)

    def _persist_identity_file(self, machine_id: str, api_key: str) -> None:
        try:
            self._identity_path.parent.mkdir(parents=True, exist_ok=True)
            self._identity_path.write_text(
                json.dumps({"machine_id": machine_id, "api_key": api_key}, indent=2),
                encoding="utf-8",
            )
        except Exception:
            LOGGER.exception("Unable to persist cloud agent identity file")

    def _normalize_apps(self, scan: Mapping[str, Any]) -> List[Dict[str, str]]:
        rows = scan.get("apps", []) if isinstance(scan, Mapping) else []
        if not isinstance(rows, list):
            return []

        normalized: List[Dict[str, str]] = []
        for item in rows:
            if not isinstance(item, Mapping):
                continue

            name = str(item.get("name", "")).strip()
            if not name:
                continue

            current = str(item.get("current", item.get("version", "Unknown"))).strip() or "Unknown"
            latest = str(item.get("latest", "Unknown")).strip() or "Unknown"
            risk_level = str(item.get("riskLevel", item.get("risk_level", "Unknown"))).strip() or "Unknown"

            normalized.append(
                {
                    "name": name,
                    "current_version": current,
                    "latest_version": latest,
                    "risk_level": risk_level,
                }
            )

        return normalized

    def _normalize_drivers(self, scan: Mapping[str, Any]) -> List[Dict[str, str]]:
        payload = scan.get("drivers", {}) if isinstance(scan, Mapping) else {}
        if not isinstance(payload, Mapping):
            return []

        results: List[Dict[str, str]] = []

        def append_driver_rows(rows: Any, default_status: str) -> None:
            if not isinstance(rows, list):
                return
            for item in rows:
                if not isinstance(item, Mapping):
                    continue
                name = str(item.get("Driver Name", item.get("driver_name", ""))).strip()
                if not name:
                    continue
                status = str(item.get("Status", item.get("status", default_status))).strip() or default_status
                results.append({"driver_name": name, "status": status})

        append_driver_rows(payload.get("installedDrivers", []), "Installed")
        append_driver_rows(payload.get("missingDrivers", []), "Missing")
        return results

    def _normalize_metrics(self, metrics: Mapping[str, Any]) -> Dict[str, Any]:
        return {
            "cpu_usage": float(metrics.get("cpu_usage", 0) or 0),
            "ram_usage": float(metrics.get("ram_usage", 0) or 0),
            "disk_usage": float(metrics.get("disk_usage", 0) or 0),
            "network_activity": str(metrics.get("network_activity", "low") or "low"),
            "network_bytes_per_second": int(metrics.get("network_bytes_per_second", 0) or 0),
        }

    def _collect_new_events(self, events: Iterable[Mapping[str, Any]]) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        max_timestamp: datetime | None = self._last_uploaded_event_ts

        for item in events:
            if not isinstance(item, Mapping):
                continue

            event_timestamp = self._parse_datetime(item.get("timestamp"))
            if event_timestamp is None:
                continue
            if self._last_uploaded_event_ts and event_timestamp <= self._last_uploaded_event_ts:
                continue

            event_type = str(item.get("event", item.get("event_type", ""))).strip()
            if not event_type:
                continue

            details_parts = []
            details_value = str(item.get("details", "")).strip()
            software_value = str(item.get("software", "")).strip()
            if details_value:
                details_parts.append(details_value)
            if software_value:
                details_parts.append(f"software={software_value}")

            normalized.append(
                {
                    "event_type": event_type,
                    "risk_level": str(item.get("riskLevel", item.get("risk_level", "Unknown"))).strip() or "Unknown",
                    "timestamp": event_timestamp.isoformat(),
                    "details": " | ".join(details_parts) if details_parts else None,
                }
            )

            if max_timestamp is None or event_timestamp > max_timestamp:
                max_timestamp = event_timestamp

        self._last_uploaded_event_ts = max_timestamp
        return normalized

    def _parse_datetime(self, value: Any) -> datetime | None:
        raw = str(value or "").strip()
        if not raw:
            return None
        candidate = raw.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(candidate)
        except ValueError:
            return None

        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)

    def close(self) -> None:
        self._session.close()
