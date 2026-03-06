"""Incremental fast scanner with cached full-scan results."""

from __future__ import annotations

import asyncio
import platform
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Mapping, Optional, Set

from packaging.version import InvalidVersion, Version

from drivers_service.drivers_api import get_drivers
from scanner_service.scanner import get_installed_apps
from version_service.version_checker import load_latest_versions


@dataclass(frozen=True)
class ChangeMarkers:
    """System marker snapshot used for incremental scan invalidation."""

    platform: str
    apps_marker: float
    drivers_marker: float


def _safe_mtime(path: Path) -> float:
    try:
        if path.exists():
            return float(path.stat().st_mtime)
    except OSError:
        pass
    return 0.0


def _app_marker_path() -> Path:
    system = platform.system()
    if system == "Windows":
        return Path("C:/ProgramData/Microsoft/Windows/Start Menu/Programs")
    if system == "Linux":
        return Path("/var/lib/dpkg/status")
    if system == "Darwin":
        return Path("/Applications")
    return Path("/")


def _driver_marker_path() -> Path:
    system = platform.system()
    if system == "Windows":
        return Path("C:/Windows/INF")
    if system == "Linux":
        return Path("/lib/modules")
    if system == "Darwin":
        return Path("/Library/Extensions")
    return Path("/")


class FastScanner:
    """Runs full scans only when system change markers move."""

    def __init__(self, max_workers: int = 4) -> None:
        self._executor = ThreadPoolExecutor(max_workers=max(2, int(max_workers)))
        self._lock = Lock()
        self._cached_result: Optional[Dict[str, Any]] = None
        self._cached_markers: Optional[ChangeMarkers] = None
        self._previous_apps: Set[str] = set()
        self._previous_missing_drivers: Set[str] = set()
        self._latest_db_cache: Dict[str, str] = {}
        self._latest_db_loaded_at = 0.0
        self._latest_db_ttl_seconds = 300.0

    def _normalize_name(self, value: str) -> str:
        return " ".join(str(value).strip().lower().split())

    def _safe_parse_version(self, value: str) -> Optional[Version]:
        try:
            return Version(str(value).strip())
        except (InvalidVersion, TypeError, ValueError):
            return None

    def _status_and_risk(self, current: str, latest: str) -> tuple[str, str]:
        current_parsed = self._safe_parse_version(current)
        latest_parsed = self._safe_parse_version(latest)
        if current_parsed is None or latest_parsed is None:
            return "Unknown", "Unknown"
        if current_parsed >= latest_parsed:
            return "Up-to-date", "Low"
        if latest_parsed.major > current_parsed.major:
            return "Update Available", "High"
        if latest_parsed.minor > current_parsed.minor:
            return "Update Available", "Medium"
        return "Update Available", "Low"

    def _latest_db(self) -> Dict[str, str]:
        now = time.time()
        if (now - self._latest_db_loaded_at) < self._latest_db_ttl_seconds and self._latest_db_cache:
            return self._latest_db_cache
        self._latest_db_cache = load_latest_versions()
        self._latest_db_loaded_at = now
        return self._latest_db_cache

    def _lookup_latest_local(self, app_name: str, latest_db: Mapping[str, str]) -> str:
        normalized = self._normalize_name(app_name)
        direct = latest_db.get(normalized)
        if direct:
            return direct

        for known_name, known_version in latest_db.items():
            if normalized in known_name or known_name in normalized:
                return known_version
        return "Unknown"

    def _build_version_results(self, installed_map: Mapping[str, str]) -> list[Dict[str, str]]:
        latest_db = self._latest_db()
        results: list[Dict[str, str]] = []
        for app_name, current_version in installed_map.items():
            latest = self._lookup_latest_local(app_name, latest_db)
            status, risk_level = self._status_and_risk(current_version, latest)
            results.append(
                {
                    "name": app_name,
                    "current": current_version,
                    "latest": latest,
                    "status": status,
                    "riskLevel": risk_level,
                }
            )
        return results

    def _current_markers(self) -> ChangeMarkers:
        return ChangeMarkers(
            platform=platform.system(),
            apps_marker=_safe_mtime(_app_marker_path()),
            drivers_marker=_safe_mtime(_driver_marker_path()),
        )

    def _extract_driver_names(self, payload: Mapping[str, Any], field: str) -> Set[str]:
        raw = payload.get(field, [])
        if not isinstance(raw, list):
            return set()
        names: Set[str] = set()
        for item in raw:
            if not isinstance(item, Mapping):
                continue
            name = str(item.get("Driver Name", "")).strip().lower()
            if name:
                names.add(name)
        return names

    def _extract_driver_label_map(self, payload: Mapping[str, Any], field: str) -> Dict[str, str]:
        raw = payload.get(field, [])
        if not isinstance(raw, list):
            return {}
        labels: Dict[str, str] = {}
        for item in raw:
            if not isinstance(item, Mapping):
                continue
            raw_name = str(item.get("Driver Name", "")).strip()
            normalized = raw_name.lower()
            if normalized:
                labels[normalized] = raw_name
        return labels

    def _run_full_scan(self, markers: ChangeMarkers) -> Dict[str, Any]:
        started = time.perf_counter()

        apps_future = self._executor.submit(get_installed_apps)
        drivers_future = self._executor.submit(get_drivers)

        apps = apps_future.result()
        drivers_payload = drivers_future.result()

        installed_map = {
            str(item.get("name", "")).strip(): str(item.get("version", "Unknown")).strip() or "Unknown"
            for item in apps
            if str(item.get("name", "")).strip()
        }
        version_results = self._build_version_results(installed_map)

        current_apps = {name.lower() for name in installed_map}
        new_app_names = current_apps - self._previous_apps
        lowercase_to_original = {name.lower(): name for name in installed_map}

        missing_driver_labels = self._extract_driver_label_map(drivers_payload, "missingDrivers")
        missing_drivers_now = set(missing_driver_labels.keys())
        newly_missing_drivers = sorted(
            missing_driver_labels.get(name, name) for name in (missing_drivers_now - self._previous_missing_drivers)
        )

        unknown_new_apps = sorted(
            item["name"]
            for item in version_results
            if str(item.get("name", "")).strip().lower() in new_app_names and str(item.get("latest")) == "Unknown"
        )

        critical_outdated_apps = sorted(
            item["name"]
            for item in version_results
            if str(item.get("status")) == "Update Available" and str(item.get("riskLevel")) == "High"
        )

        self._previous_apps = current_apps
        self._previous_missing_drivers = missing_drivers_now

        elapsed_ms = (time.perf_counter() - started) * 1000.0
        return {
            "mode": "full_scan",
            "changed": True,
            "duration_ms": round(elapsed_ms, 2),
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "apps": version_results,
            "drivers": drivers_payload,
            "new_apps": sorted(lowercase_to_original[name] for name in new_app_names if name in lowercase_to_original),
            "new_unknown_apps": unknown_new_apps,
            "removed_drivers": newly_missing_drivers,
            "critical_outdated_apps": critical_outdated_apps,
            "totals": {
                "apps": len(version_results),
                "missing_drivers": len(self._extract_driver_names(drivers_payload, "missingDrivers")),
                "installed_drivers": len(self._extract_driver_names(drivers_payload, "installedDrivers")),
            },
            "change_markers": {
                "platform": markers.platform,
                "apps_marker": markers.apps_marker,
                "drivers_marker": markers.drivers_marker,
            },
        }

    def fast_scan_sync(self, force_full: bool = False) -> Dict[str, Any]:
        markers = self._current_markers()
        started = time.perf_counter()

        with self._lock:
            if (not force_full) and self._cached_result is not None and self._cached_markers == markers:
                cached = dict(self._cached_result)
                cached["mode"] = "cached"
                cached["changed"] = False
                cached["duration_ms"] = round((time.perf_counter() - started) * 1000.0, 2)
                return cached

        fresh_result = self._run_full_scan(markers)
        with self._lock:
            self._cached_result = dict(fresh_result)
            self._cached_markers = markers
        return fresh_result

    async def fast_scan(self, force_full: bool = False) -> Dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self.fast_scan_sync(force_full=force_full))

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
