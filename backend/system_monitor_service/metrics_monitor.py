"""Background system metrics monitor."""

from __future__ import annotations

import asyncio
import platform
import time
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, Optional

import psutil


class MetricsMonitor:
    """Continuously captures host performance metrics in memory."""

    def __init__(self, interval_seconds: int = 10, history_size: int = 720) -> None:
        self._interval_seconds = max(1, int(interval_seconds))
        self._history: Deque[Dict[str, object]] = deque(maxlen=max(10, int(history_size)))
        self._latest: Dict[str, object] = {}
        self._latest_lock = asyncio.Lock()
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._previous_total_network_bytes: Optional[int] = None

    def _disk_path(self) -> str:
        if platform.system() == "Windows":
            return "C:\\"
        return "/"

    def _network_activity(self, bytes_per_second: float) -> str:
        if bytes_per_second >= 5_000_000:
            return "high"
        if bytes_per_second >= 150_000:
            return "normal"
        return "low"

    def _capture_snapshot_sync(self) -> Dict[str, object]:
        cpu_usage = float(psutil.cpu_percent(interval=None))
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage(self._disk_path())
        net = psutil.net_io_counters()
        total_network_bytes = int(net.bytes_sent + net.bytes_recv)

        if self._previous_total_network_bytes is None:
            bytes_per_second = 0.0
        else:
            delta = max(0, total_network_bytes - self._previous_total_network_bytes)
            bytes_per_second = delta / float(self._interval_seconds)
        self._previous_total_network_bytes = total_network_bytes

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cpu_usage": round(cpu_usage, 2),
            "ram_usage": round(float(memory.percent), 2),
            "disk_usage": round(float(disk.percent), 2),
            "network_activity": self._network_activity(bytes_per_second),
            "network_bytes_per_second": int(bytes_per_second),
        }

    async def _store_snapshot(self, snapshot: Dict[str, object]) -> None:
        async with self._latest_lock:
            self._latest = dict(snapshot)
            self._history.append(dict(snapshot))

    async def capture_now(self) -> Dict[str, object]:
        snapshot = self._capture_snapshot_sync()
        await self._store_snapshot(snapshot)
        return snapshot

    async def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self.capture_now()
            except Exception:
                # Keep monitoring loop resilient against transient psutil failures.
                pass
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval_seconds)
            except asyncio.TimeoutError:
                continue

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        await self.capture_now()
        self._task = asyncio.create_task(self._run(), name="metrics-monitor-loop")

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def latest(self) -> Dict[str, object]:
        async with self._latest_lock:
            if self._latest:
                return dict(self._latest)
        return await self.capture_now()

    async def history(self, limit: int = 60) -> Dict[str, object]:
        safe_limit = max(1, min(int(limit), 720))
        async with self._latest_lock:
            items = list(self._history)[-safe_limit:]
        return {"samples": items, "count": len(items)}

