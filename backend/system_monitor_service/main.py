"""FastAPI entrypoint for real-time system monitoring service (port 8003)."""

from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any, Dict, Optional

import requests
from fastapi import FastAPI, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from common.api import (
    allowed_origins_from_env,
    apply_standard_api_controls,
    configure_logger,
    health_payload,
    success_payload,
)
from common.metrics import install_metrics, observe_scan_duration
from .cloud_agent import CloudAgentUploader
from .event_engine import SecurityEventEngine
from .fast_scanner import FastScanner
from .metrics_monitor import MetricsMonitor
from .system_info import collect_system_info

SERVICE_NAME = "monitor_service"
LOGGER = configure_logger(f"{SERVICE_NAME}.main")

app = FastAPI(title="System Monitor Service", version="1.0.0")

origins = allowed_origins_from_env()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
apply_standard_api_controls(app, SERVICE_NAME)
install_metrics(app, SERVICE_NAME)

METRICS_MONITOR = MetricsMonitor(interval_seconds=10)
FAST_SCANNER = FastScanner(max_workers=4)
EVENT_ENGINE = SecurityEventEngine(max_events=1000)
AGENT_UPLOAD_INTERVAL_SECONDS = max(30, int(os.getenv("CLOUD_AGENT_UPLOAD_INTERVAL_SECONDS", "60")))
CLOUD_AGENT_UPLOADER = CloudAgentUploader(
    fast_scanner=FAST_SCANNER,
    metrics_monitor=METRICS_MONITOR,
    event_engine=EVENT_ENGINE,
    upload_interval_seconds=AGENT_UPLOAD_INTERVAL_SECONDS,
)
DETECTION_TASK: Optional[asyncio.Task] = None
CLOUD_UPLOAD_TASK: Optional[asyncio.Task] = None


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
    global DETECTION_TASK, CLOUD_UPLOAD_TASK
    await METRICS_MONITOR.start()
    DETECTION_TASK = asyncio.create_task(_auto_detection_loop(), name="system-monitor-detection-loop")
    if CLOUD_AGENT_UPLOADER.enabled:
        CLOUD_UPLOAD_TASK = asyncio.create_task(
            CLOUD_AGENT_UPLOADER.run_forever(),
            name="cloud-agent-uploader-loop",
        )


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global DETECTION_TASK, CLOUD_UPLOAD_TASK
    if CLOUD_UPLOAD_TASK:
        CLOUD_UPLOAD_TASK.cancel()
        try:
            await CLOUD_UPLOAD_TASK
        except asyncio.CancelledError:
            pass
        CLOUD_UPLOAD_TASK = None

    if DETECTION_TASK:
        DETECTION_TASK.cancel()
        try:
            await DETECTION_TASK
        except asyncio.CancelledError:
            pass
        DETECTION_TASK = None
    CLOUD_AGENT_UPLOADER.close()
    await METRICS_MONITOR.stop()
    FAST_SCANNER.shutdown()


@app.get("/")
async def root(request: Request) -> Dict[str, Any]:
    return success_payload(
        SERVICE_NAME,
        {"message": "System Monitor Service running"},
        request_id=getattr(request.state, "request_id", ""),
    )


@app.get("/health")
async def health() -> Dict[str, Any]:
    cloud_status = {"status": "not_configured"}
    if CLOUD_AGENT_UPLOADER.enabled:
        try:
            response = requests.get(f"{os.getenv('CLOUD_CORE_URL', 'http://localhost:9000').rstrip('/')}/health", timeout=5)
            cloud_status = {"status": "ok" if response.ok else "degraded", "type": "cloud_core"}
        except Exception:
            cloud_status = {"status": "degraded", "type": "cloud_core"}

    return health_payload(
        SERVICE_NAME,
        database={"status": "not_configured"},
        cache={"status": "ok", "type": "memory"},
        api=cloud_status if CLOUD_AGENT_UPLOADER.enabled else {"status": "ok"},
        details={"cloud_agent_enabled": CLOUD_AGENT_UPLOADER.enabled},
    )


@app.get("/system-info")
async def system_info(request: Request) -> Dict[str, Any]:
    payload = collect_system_info()
    return success_payload(
        SERVICE_NAME,
        payload,
        request_id=getattr(request.state, "request_id", ""),
        **payload,
    )


@app.get("/system-metrics")
async def system_metrics(request: Request) -> Dict[str, Any]:
    metrics = await METRICS_MONITOR.latest()
    payload = {
        "cpu_usage": metrics.get("cpu_usage", 0),
        "ram_usage": metrics.get("ram_usage", 0),
        "disk_usage": metrics.get("disk_usage", 0),
        "network_activity": metrics.get("network_activity", "low"),
        "network_bytes_per_second": metrics.get("network_bytes_per_second", 0),
        "timestamp": metrics.get("timestamp"),
    }
    return success_payload(
        SERVICE_NAME,
        payload,
        request_id=getattr(request.state, "request_id", ""),
        **payload,
    )


@app.get("/fast-scan")
async def fast_scan(request: Request, force_full: bool = Query(default=False)) -> Dict[str, Any]:
    started_at = time.perf_counter()
    scan = await FAST_SCANNER.fast_scan(force_full=force_full)
    observe_scan_duration(SERVICE_NAME, "fast_forced" if force_full else "fast", time.perf_counter() - started_at)
    EVENT_ENGINE.ingest_scan(scan)
    return success_payload(
        SERVICE_NAME,
        scan,
        request_id=getattr(request.state, "request_id", ""),
        **scan,
    )


@app.get("/security-events")
async def security_events(request: Request, limit: int = Query(default=50, ge=1, le=500)) -> Dict[str, Any]:
    events = EVENT_ENGINE.list_events(limit=limit)
    metrics = await METRICS_MONITOR.latest()
    payload = {
        "count": len(events),
        "events": events,
        "riskScore": EVENT_ENGINE.risk_score(metrics=metrics, recent_events=events[:10]),
    }
    return success_payload(
        SERVICE_NAME,
        payload,
        request_id=getattr(request.state, "request_id", ""),
        **payload,
    )


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
