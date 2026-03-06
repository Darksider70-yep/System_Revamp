"""FastAPI entrypoint for real-time system monitoring service (port 8003)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .event_engine import SecurityEventEngine
from .fast_scanner import FastScanner
from .metrics_monitor import MetricsMonitor
from .system_info import collect_system_info

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
LOGGER = logging.getLogger("system_monitor_service.main")

app = FastAPI(title="System Monitor Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

METRICS_MONITOR = MetricsMonitor(interval_seconds=10)
FAST_SCANNER = FastScanner(max_workers=4)
EVENT_ENGINE = SecurityEventEngine(max_events=1000)
DETECTION_TASK: Optional[asyncio.Task] = None


async def _auto_detection_loop() -> None:
    tick = 0
    while True:
        try:
            metrics = await METRICS_MONITOR.latest()
            EVENT_ENGINE.ingest_metrics(metrics)

            # Run fast incremental scan every 30 seconds for automatic triggers.
            if tick % 3 == 0:
                scan = await FAST_SCANNER.fast_scan()
                EVENT_ENGINE.ingest_scan(scan)

            tick += 1
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LOGGER.exception("Detection loop error: %s", exc)
            await asyncio.sleep(3)


@app.on_event("startup")
async def startup_event() -> None:
    global DETECTION_TASK
    await METRICS_MONITOR.start()
    DETECTION_TASK = asyncio.create_task(_auto_detection_loop(), name="system-monitor-detection-loop")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global DETECTION_TASK
    if DETECTION_TASK:
        DETECTION_TASK.cancel()
        try:
            await DETECTION_TASK
        except asyncio.CancelledError:
            pass
        DETECTION_TASK = None
    await METRICS_MONITOR.stop()
    FAST_SCANNER.shutdown()


@app.get("/")
async def root() -> Dict[str, str]:
    return {"message": "System Monitor Service running"}


@app.get("/system-info")
async def system_info() -> Dict[str, Any]:
    return collect_system_info()


@app.get("/system-metrics")
async def system_metrics() -> Dict[str, Any]:
    metrics = await METRICS_MONITOR.latest()
    return {
        "cpu_usage": metrics.get("cpu_usage", 0),
        "ram_usage": metrics.get("ram_usage", 0),
        "disk_usage": metrics.get("disk_usage", 0),
        "network_activity": metrics.get("network_activity", "low"),
        "network_bytes_per_second": metrics.get("network_bytes_per_second", 0),
        "timestamp": metrics.get("timestamp"),
    }


@app.get("/fast-scan")
async def fast_scan(force_full: bool = Query(default=False)) -> Dict[str, Any]:
    scan = await FAST_SCANNER.fast_scan(force_full=force_full)
    EVENT_ENGINE.ingest_scan(scan)
    return scan


@app.get("/security-events")
async def security_events(limit: int = Query(default=50, ge=1, le=500)) -> Dict[str, Any]:
    events = EVENT_ENGINE.list_events(limit=limit)
    metrics = await METRICS_MONITOR.latest()
    return {
        "count": len(events),
        "events": events,
        "riskScore": EVENT_ENGINE.risk_score(metrics=metrics, recent_events=events[:10]),
    }


@app.websocket("/live-monitor")
async def live_monitor(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            metrics = await METRICS_MONITOR.latest()
            recent_events = EVENT_ENGINE.list_events(limit=5)
            payload = {
                "cpu": metrics.get("cpu_usage", 0),
                "ram": metrics.get("ram_usage", 0),
                "disk": metrics.get("disk_usage", 0),
                "alerts": len(recent_events),
                "riskScore": EVENT_ENGINE.risk_score(metrics=metrics, recent_events=recent_events),
                "securityAlerts": recent_events,
                "networkActivity": metrics.get("network_activity", "low"),
                "timestamp": metrics.get("timestamp"),
            }
            await websocket.send_json(payload)
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return
