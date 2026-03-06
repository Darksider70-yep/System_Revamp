"""Security event detection and in-memory event storage."""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
import os
from threading import Lock
from typing import Any, Deque, Dict, Iterable, List, Mapping, Optional

import psutil


class SecurityEventEngine:
    """Evaluates simple rules and stores generated events."""

    def __init__(self, max_events: int = 1000) -> None:
        self._events: Deque[Dict[str, Any]] = deque(maxlen=max(50, int(max_events)))
        self._lock = Lock()
        self._recent_keys: Dict[str, float] = {}
        self._dedupe_window_seconds = 45.0
        self._last_process_scan_epoch = 0.0
        self._process_scan_interval_seconds = max(30, int(os.getenv("MONITOR_PROCESS_SCAN_INTERVAL_SECONDS", "60")))
        self._suspicious_tokens = {
            "mimikatz",
            "metasploit",
            "nmap",
            "wireshark",
            "netcat",
            "nc.exe",
            "psexec",
            "hydra",
        }
        self._safe_high_cpu_processes = {
            "system",
            "idle",
            "python",
            "python3",
            "chrome",
            "firefox",
            "msedge",
            "java",
        }

    def _event_timestamp(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _severity_weight(self, risk_level: str) -> int:
        level = str(risk_level).strip().lower()
        if level == "high":
            return 20
        if level == "medium":
            return 12
        if level == "low":
            return 6
        return 3

    def _emit(self, event: str, risk_level: str, software: Optional[str] = None, details: Optional[str] = None) -> None:
        key = f"{event}|{software or '-'}|{risk_level}|{details or '-'}"
        now_epoch = datetime.now(timezone.utc).timestamp()

        with self._lock:
            previous = self._recent_keys.get(key)
            if previous and (now_epoch - previous) < self._dedupe_window_seconds:
                return
            self._recent_keys[key] = now_epoch

            payload: Dict[str, Any] = {
                "timestamp": self._event_timestamp(),
                "event": event,
                "riskLevel": risk_level,
            }
            if software:
                payload["software"] = software
            if details:
                payload["details"] = details
            self._events.appendleft(payload)

    def ingest_metrics(self, metrics: Mapping[str, Any]) -> None:
        cpu_usage = float(metrics.get("cpu_usage", 0) or 0)
        ram_usage = float(metrics.get("ram_usage", 0) or 0)
        disk_usage = float(metrics.get("disk_usage", 0) or 0)
        network_activity = str(metrics.get("network_activity", "low")).strip().lower()

        if cpu_usage >= 90:
            self._emit(
                event="High CPU Spike",
                risk_level="High",
                details=f"CPU usage at {cpu_usage:.1f}%",
            )
        if ram_usage >= 92:
            self._emit(
                event="High Memory Pressure",
                risk_level="Medium",
                details=f"RAM usage at {ram_usage:.1f}%",
            )
        if disk_usage >= 95:
            self._emit(
                event="Critical Disk Utilization",
                risk_level="Medium",
                details=f"Disk usage at {disk_usage:.1f}%",
            )
        if network_activity == "high":
            self._emit(
                event="Unusual Network Activity",
                risk_level="Medium",
                details="Network throughput exceeded normal baseline",
            )

        self._scan_process_activity()

    def ingest_scan(self, scan_result: Mapping[str, Any]) -> None:
        for app_name in scan_result.get("new_unknown_apps", []) or []:
            self._emit(
                event="New Application Installed",
                software=str(app_name),
                risk_level="Medium",
            )

        for driver_name in scan_result.get("removed_drivers", []) or []:
            self._emit(
                event="Driver Removed",
                software=str(driver_name),
                risk_level="High",
            )

        for app_name in scan_result.get("critical_outdated_apps", []) or []:
            self._emit(
                event="Critical Vulnerability Exposure",
                software=str(app_name),
                risk_level="High",
            )

    def _scan_process_activity(self) -> None:
        now_epoch = datetime.now(timezone.utc).timestamp()
        if (now_epoch - self._last_process_scan_epoch) < self._process_scan_interval_seconds:
            return
        self._last_process_scan_epoch = now_epoch

        try:
            for proc in psutil.process_iter(attrs=["name", "cpu_percent", "cmdline"]):
                info = proc.info
                name = str(info.get("name") or "").strip().lower()
                cpu_percent = float(info.get("cpu_percent") or 0)
                cmdline_raw = info.get("cmdline") or []
                cmdline = " ".join(str(part).lower() for part in cmdline_raw if str(part).strip())

                if not name:
                    continue

                if any(token in name or token in cmdline for token in self._suspicious_tokens):
                    self._emit(
                        event="Unknown Process Activity",
                        risk_level="High",
                        software=name,
                        details="Suspicious process signature detected",
                    )
                    continue

                # Flag unusually high CPU processes if they are not common platform processes.
                if cpu_percent >= 85 and name not in self._safe_high_cpu_processes:
                    self._emit(
                        event="Suspicious CPU Spike",
                        risk_level="Medium",
                        software=name,
                        details=f"Process CPU usage reached {cpu_percent:.1f}%",
                    )
        except Exception:
            # Keep monitoring resilient against process list races/permissions.
            return

    def list_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        safe_limit = max(1, min(int(limit), 500))
        with self._lock:
            return list(self._events)[:safe_limit]

    def alert_count(self, window: int = 20) -> int:
        return len(self.list_events(limit=window))

    def risk_score(self, metrics: Mapping[str, Any], recent_events: Optional[Iterable[Mapping[str, Any]]] = None) -> int:
        cpu = float(metrics.get("cpu_usage", 0) or 0)
        ram = float(metrics.get("ram_usage", 0) or 0)
        disk = float(metrics.get("disk_usage", 0) or 0)

        baseline = (cpu * 0.35) + (ram * 0.3) + (disk * 0.15)
        security_weight = 0
        events = list(recent_events) if recent_events is not None else self.list_events(limit=10)
        for item in events:
            security_weight += self._severity_weight(str(item.get("riskLevel", "Low")))
        score = int(min(100, baseline + min(security_weight, 40)))
        return max(0, score)
