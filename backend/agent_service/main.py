"""Unified System Revamp Agent service."""

from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from cloud_core.patch_orchestrator import PatchInstallResult, PatchOrchestrator
from common.api import (
    allowed_origins_from_env,
    apply_standard_api_controls,
    configure_logger,
    health_payload,
    success_payload,
)
from common.metrics import install_metrics, observe_scan_duration
from common.offline_packages import (
    apply_offline_package as apply_offline_package_bytes,
    create_offline_package,
    list_offline_packages,
)
from scanner_service.scanner import get_installed_apps
from system_monitor_service.cloud_agent import CloudAgentUploader
from system_monitor_service.event_engine import SecurityEventEngine
from system_monitor_service.fast_scanner import FastScanner
from system_monitor_service.metrics_monitor import MetricsMonitor
from system_monitor_service.system_info import collect_system_info
from version_service.version_checker import load_latest_versions

SERVICE_NAME = "agent_service"
LOGGER = configure_logger(f"{SERVICE_NAME}.main")

app = FastAPI(title="System Revamp Agent", version="10.0.0")

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
EVENT_ENGINE = SecurityEventEngine(max_events=2000)
PATCH_ORCHESTRATOR = PatchOrchestrator()
AGENT_UPLOAD_INTERVAL_SECONDS = max(30, int(os.getenv("CLOUD_AGENT_UPLOAD_INTERVAL_SECONDS", "60")))
COMMAND_POLL_INTERVAL_SECONDS = max(5, int(os.getenv("AGENT_COMMAND_POLL_INTERVAL_SECONDS", "10")))
CLOUD_AGENT = CloudAgentUploader(
    fast_scanner=FAST_SCANNER,
    metrics_monitor=METRICS_MONITOR,
    event_engine=EVENT_ENGINE,
    upload_interval_seconds=AGENT_UPLOAD_INTERVAL_SECONDS,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
OFFLINE_PACKAGE_DIR = Path(
    os.getenv("AGENT_OFFLINE_PACKAGE_DIR", str(BACKEND_ROOT / "cache" / "offline_packages"))
)
LATEST_VERSION_DB_PATH = Path(
    os.getenv("AGENT_LATEST_VERSION_DB_PATH", str(BACKEND_ROOT / "version_service" / "latest_versions.json"))
)
APPLIED_OFFLINE_METADATA_PATH = Path(
    os.getenv(
        "AGENT_APPLIED_OFFLINE_METADATA_PATH",
        str(BACKEND_ROOT / "cache" / "offline_packages" / "last_applied_manifest.json"),
    )
)
SCHEDULED_UPDATES_PATH = Path(
    os.getenv(
        "AGENT_SCHEDULED_UPDATES_PATH",
        str(BACKEND_ROOT / "cache" / "offline_packages" / "scheduled_updates.json"),
    )
)

DETECTION_TASK: asyncio.Task | None = None
CLOUD_UPLOAD_TASK: asyncio.Task | None = None
COMMAND_TASK: asyncio.Task | None = None


class AutoPatchRequest(BaseModel):
    software: list[str] = Field(default_factory=list)


def _load_scheduled_updates() -> list[dict[str, Any]]:
    if not SCHEDULED_UPDATES_PATH.exists():
        return []
    try:
        payload = json.loads(SCHEDULED_UPDATES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    rows = payload.get("scheduled_updates", [])
    return rows if isinstance(rows, list) else []


def _scheduled_targets() -> list[str]:
    return [str(item.get("name", "")).strip() for item in _load_scheduled_updates() if str(item.get("name", "")).strip()]


async def _auto_detection_loop() -> None:
    tick = 0
    while True:
        try:
            metrics = await METRICS_MONITOR.latest()
            EVENT_ENGINE.ingest_metrics(metrics)
            if tick % 3 == 0:
                scan = await FAST_SCANNER.fast_scan()
                EVENT_ENGINE.ingest_scan(scan)
            tick += 1
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LOGGER.exception("Agent detection loop error: %s", exc)
            await asyncio.sleep(3)


async def _cloud_upload_loop() -> None:
    while True:
        try:
            await CLOUD_AGENT.upload_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LOGGER.exception("Cloud upload loop error: %s", exc)
        await asyncio.sleep(AGENT_UPLOAD_INTERVAL_SECONDS)


async def _execute_patch_command(payload: dict[str, Any]) -> tuple[str, dict[str, Any], str | None]:
    software = str(payload.get("software", "")).strip()
    patch_all = bool(payload.get("patch_all"))

    if patch_all or not software:
        targets = None
        patch_summary = await asyncio.to_thread(PATCH_ORCHESTRATOR.auto_patch, targets)
        result = {
            "software": "all_packages",
            "patched": [item["software"] for item in patch_summary["patched"]],
            "failed": [item["software"] for item in patch_summary["failed"]],
            "provider": PATCH_ORCHESTRATOR.provider_name(),
        }
        status_value = "completed" if not patch_summary["failed"] else ("completed" if patch_summary["patched"] else "failed")
        error = None if status_value == "completed" else "Automatic patch run failed"
        return status_value, result, error

    patch_result: PatchInstallResult = await asyncio.to_thread(PATCH_ORCHESTRATOR.install_patch, software)
    result = {
        "software": patch_result.software,
        "new_version": patch_result.new_version,
        "provider": patch_result.provider,
        "command": patch_result.command,
        "package_id": patch_result.package_id,
    }
    if patch_result.status == "patch_installed":
        return "completed", result, None
    return "failed", result, patch_result.stderr or "Patch installation failed"


async def _command_loop() -> None:
    while True:
        try:
            command = await CLOUD_AGENT.fetch_next_command()
            if not command:
                await asyncio.sleep(COMMAND_POLL_INTERVAL_SECONDS)
                continue

            command_id = str(command.get("id", "")).strip()
            command_type = str(command.get("command_type", "")).strip().lower()
            payload = command.get("payload", {})
            if not command_id or not isinstance(payload, dict):
                await asyncio.sleep(COMMAND_POLL_INTERVAL_SECONDS)
                continue

            status_value = "failed"
            result: dict[str, Any] = {}
            error: str | None = None

            if command_type == "scan":
                force_full = bool(payload.get("force_full", True))
                upload_result = await CLOUD_AGENT.upload_once(force_full=force_full)
                status_value = "completed" if upload_result else "failed"
                result = {
                    "software": "manual_scan",
                    "force_full": force_full,
                    "uploaded": bool(upload_result),
                }
                error = None if upload_result else "Scan upload failed"
            elif command_type == "patch":
                status_value, result, error = await _execute_patch_command(payload)
                await CLOUD_AGENT.upload_once(force_full=True)
            else:
                error = f"Unsupported command type: {command_type}"

            await CLOUD_AGENT.report_command_result(command_id, status_value, result, error)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LOGGER.exception("Agent command loop error: %s", exc)
            await asyncio.sleep(2)


@app.on_event("startup")
async def startup_event() -> None:
    global DETECTION_TASK, CLOUD_UPLOAD_TASK, COMMAND_TASK
    await METRICS_MONITOR.start()
    DETECTION_TASK = asyncio.create_task(_auto_detection_loop(), name="agent-detection-loop")
    if CLOUD_AGENT.enabled:
        CLOUD_UPLOAD_TASK = asyncio.create_task(_cloud_upload_loop(), name="agent-cloud-upload-loop")
        COMMAND_TASK = asyncio.create_task(_command_loop(), name="agent-command-loop")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global DETECTION_TASK, CLOUD_UPLOAD_TASK, COMMAND_TASK
    for task_name in ("COMMAND_TASK", "CLOUD_UPLOAD_TASK", "DETECTION_TASK"):
        task = globals().get(task_name)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            globals()[task_name] = None
    CLOUD_AGENT.close()
    await METRICS_MONITOR.stop()
    FAST_SCANNER.shutdown()


@app.get("/")
def root(request: Request) -> dict[str, Any]:
    return success_payload(
        SERVICE_NAME,
        {"message": "System Revamp Agent running"},
        request_id=getattr(request.state, "request_id", ""),
    )


@app.get("/health")
def health() -> dict[str, Any]:
    database_status = {"status": "ok" if LATEST_VERSION_DB_PATH.exists() else "degraded", "type": "file_database"}
    cache_status = {"status": "ok" if OFFLINE_PACKAGE_DIR.exists() or OFFLINE_PACKAGE_DIR.parent.exists() else "degraded", "type": "filesystem"}
    api_status = {"status": "not_configured"}

    if CLOUD_AGENT.enabled:
        try:
            response = requests.get(f"{os.getenv('CLOUD_CORE_URL', 'http://localhost:9000').rstrip('/')}/health", timeout=5)
            api_status = {"status": "ok" if response.ok else "degraded", "type": "cloud_core"}
        except Exception:
            api_status = {"status": "degraded", "type": "cloud_core"}

    return health_payload(
        SERVICE_NAME,
        database=database_status,
        cache=cache_status,
        api=api_status,
        details={
            "registered_machine_id": CLOUD_AGENT.machine_id,
            "cloud_enabled": CLOUD_AGENT.enabled,
        },
    )


@app.get("/scan")
async def scan(request: Request, force_full: bool = Query(default=False)) -> dict[str, Any]:
    started_at = time.perf_counter()
    scan_result = await FAST_SCANNER.fast_scan(force_full=force_full)
    observe_scan_duration(SERVICE_NAME, "fast_forced" if force_full else "fast", time.perf_counter() - started_at)
    EVENT_ENGINE.ingest_scan(scan_result)
    metrics = await METRICS_MONITOR.latest()
    recent_events = EVENT_ENGINE.list_events(limit=25)
    payload = {
        "scan": scan_result,
        "metrics": metrics,
        "risk_score": EVENT_ENGINE.risk_score(metrics=metrics, recent_events=recent_events),
        "events": recent_events,
    }
    return success_payload(
        SERVICE_NAME,
        payload,
        request_id=getattr(request.state, "request_id", ""),
        **payload,
    )


@app.get("/events")
async def events(request: Request, limit: int = Query(default=100, ge=1, le=500)) -> dict[str, Any]:
    rows = EVENT_ENGINE.list_events(limit=limit)
    metrics = await METRICS_MONITOR.latest()
    payload = {
        "events": rows,
        "count": len(rows),
        "risk_score": EVENT_ENGINE.risk_score(metrics=metrics, recent_events=rows),
    }
    return success_payload(
        SERVICE_NAME,
        payload,
        request_id=getattr(request.state, "request_id", ""),
        **payload,
    )


@app.get("/offline-packages")
def offline_packages(request: Request) -> dict[str, Any]:
    packages = list_offline_packages(OFFLINE_PACKAGE_DIR)
    payload = {"count": len(packages), "items": packages}
    return success_payload(
        SERVICE_NAME,
        payload,
        request_id=getattr(request.state, "request_id", ""),
        **payload,
    )


@app.get("/pending-patches")
def pending_patches(request: Request) -> dict[str, Any]:
    scheduled = _load_scheduled_updates()
    payload = {"count": len(scheduled), "items": scheduled}
    return success_payload(
        SERVICE_NAME,
        payload,
        request_id=getattr(request.state, "request_id", ""),
        **payload,
    )


@app.get("/generate-offline-package")
def generate_offline_package(mode: str = Query(default="full")) -> StreamingResponse:
    scan_mode = mode.strip().lower()
    if scan_mode not in {"full", "delta"}:
        scan_mode = "full"

    latest_versions = load_latest_versions(LATEST_VERSION_DB_PATH)
    installed_apps = get_installed_apps()
    try:
        patch_metadata = PATCH_ORCHESTRATOR.export_patch_metadata()
    except Exception:
        patch_metadata = []

    package = create_offline_package(
        latest_versions=latest_versions,
        installed_apps=installed_apps,
        patch_metadata=patch_metadata,
        source_service=SERVICE_NAME,
        mode=scan_mode,
        package_dir=OFFLINE_PACKAGE_DIR,
    )
    return StreamingResponse(
        iter([package.content]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{package.filename}"'},
    )


@app.post("/apply-offline-package")
async def apply_offline_package(file: UploadFile = File(...)) -> dict[str, Any]:
    package_bytes = await file.read()
    if not package_bytes:
        raise HTTPException(status_code=400, detail="Offline package is empty.")

    installed_apps = get_installed_apps()
    result = apply_offline_package_bytes(
        package_bytes=package_bytes,
        installed_apps=installed_apps,
        latest_versions_path=LATEST_VERSION_DB_PATH,
        applied_metadata_path=APPLIED_OFFLINE_METADATA_PATH,
        scheduled_updates_path=SCHEDULED_UPDATES_PATH,
    )
    return {
        "status": result["status"],
        "updates_available": result["updates_available"],
    }


@app.post("/auto-patch")
async def auto_patch(payload: AutoPatchRequest | None = None) -> dict[str, Any]:
    requested_targets = payload.software if payload is not None else []
    targets = requested_targets or _scheduled_targets() or None
    summary = await asyncio.to_thread(PATCH_ORCHESTRATOR.auto_patch, targets)
    await CLOUD_AGENT.upload_once(force_full=True)
    return {
        "patched": [item["software"] for item in summary["patched"]],
        "failed": [item["software"] for item in summary["failed"]],
    }


@app.get("/system-info")
def system_info(request: Request) -> dict[str, Any]:
    payload = collect_system_info()
    return success_payload(
        SERVICE_NAME,
        payload,
        request_id=getattr(request.state, "request_id", ""),
        **payload,
    )
