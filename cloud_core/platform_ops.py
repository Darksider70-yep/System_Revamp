"""Cloud platform operational helpers for queues, persistence, and risk analysis."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import FastAPI, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .audit import write_audit_log
from .database import SessionLocal
from .models import App, Driver, Machine, MachineCommand, ScanResult, SecurityEvent
from .schemas import MachineCommandItem, RiskScoreBreakdown, ScanUploadRequest

LOGGER = logging.getLogger("cloud_core.platform_ops")

ONLINE_WINDOW_SECONDS = max(30, int(os.getenv("CLOUD_MACHINE_ONLINE_SECONDS", "120")))
CACHE_TTL_OVERVIEW = max(5, int(os.getenv("CLOUD_CACHE_TTL_OVERVIEW", "15")))
CACHE_TTL_MACHINES = max(5, int(os.getenv("CLOUD_CACHE_TTL_MACHINES", "15")))
CACHE_TTL_MACHINE_DETAIL = max(5, int(os.getenv("CLOUD_CACHE_TTL_MACHINE_DETAIL", "20")))

SCAN_QUEUE_NAME = "system_revamp:scan_ingestion"


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def is_online(last_seen_at: datetime | None) -> bool:
    if last_seen_at is None:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=ONLINE_WINDOW_SECONDS)
    return _to_utc(last_seen_at) >= cutoff


def json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return str(value)


async def cache_get(redis_client: object | None, key: str) -> dict[str, Any] | None:
    if redis_client is None:
        return None
    try:
        raw = await redis_client.get(key)
    except Exception:
        return None
    if not raw:
        return None
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


async def cache_set(redis_client: object | None, key: str, payload: dict[str, Any], ttl_seconds: int) -> None:
    if redis_client is None:
        return
    try:
        await redis_client.set(key, json.dumps(payload, default=json_default), ex=ttl_seconds)
    except Exception:
        return


async def invalidate_dashboard_cache(redis_client: object | None, machine_id: UUID | None = None) -> None:
    if redis_client is None:
        return

    try:
        keys: set[str] = {"dashboard:overview"}
        async for key in redis_client.scan_iter(match="dashboard:machines:*"):
            keys.add(str(key))
        if machine_id is not None:
            async for key in redis_client.scan_iter(match=f"dashboard:machine:{machine_id}:*"):
                keys.add(str(key))
        if keys:
            await redis_client.delete(*list(keys))
    except Exception:
        return


def latest_scan_ids_subquery() -> Any:
    latest_scan_time_subquery = (
        select(
            ScanResult.machine_id.label("machine_id"),
            func.max(ScanResult.timestamp).label("latest_timestamp"),
        )
        .group_by(ScanResult.machine_id)
        .subquery()
    )
    return (
        select(ScanResult.id.label("scan_id"))
        .join(
            latest_scan_time_subquery,
            and_(
                ScanResult.machine_id == latest_scan_time_subquery.c.machine_id,
                ScanResult.timestamp == latest_scan_time_subquery.c.latest_timestamp,
            ),
        )
        .subquery()
    )


def risk_score_formula(outdated_apps: int, missing_drivers: int, cpu_spikes: int, security_events: int) -> int:
    raw = (outdated_apps * 10) + (missing_drivers * 15) + (cpu_spikes * 5) + (security_events * 20)
    return max(0, min(100, int(raw)))


async def calculate_risk_breakdown(db: AsyncSession, machine_id: UUID) -> RiskScoreBreakdown:
    latest_scan = (
        (
            await db.execute(
                select(ScanResult)
                .where(ScanResult.machine_id == machine_id)
                .order_by(ScanResult.timestamp.desc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )

    outdated_apps = 0
    missing_drivers = 0
    if latest_scan is not None:
        outdated_apps = int(
            (
                await db.scalar(
                    select(func.count(App.id)).where(
                        App.scan_id == latest_scan.id,
                        App.latest_version.is_not(None),
                        func.lower(App.latest_version) != "unknown",
                        App.current_version != App.latest_version,
                    )
                )
            )
            or 0
        )
        missing_drivers = int(
            (
                await db.scalar(
                    select(func.count(Driver.id)).where(
                        Driver.scan_id == latest_scan.id,
                        func.lower(Driver.status) != "installed",
                    )
                )
            )
            or 0
        )

    cpu_spikes = int(
        (
            await db.scalar(
                select(func.count(ScanResult.id)).where(
                    ScanResult.machine_id == machine_id,
                    ScanResult.timestamp >= (datetime.now(timezone.utc) - timedelta(hours=1)),
                    ScanResult.cpu_usage >= 90,
                )
            )
        )
        or 0
    )

    security_events = int(
        (
            await db.scalar(
                select(func.count(SecurityEvent.id)).where(
                    SecurityEvent.machine_id == machine_id,
                    SecurityEvent.timestamp >= (datetime.now(timezone.utc) - timedelta(hours=24)),
                )
            )
        )
        or 0
    )

    return RiskScoreBreakdown(
        outdated_apps=outdated_apps,
        missing_drivers=missing_drivers,
        cpu_spikes=cpu_spikes,
        security_events=security_events,
    )


async def enqueue_scan(redis_client: object | None, payload: ScanUploadRequest) -> str | None:
    if redis_client is None:
        return None
    queue_id = str(uuid.uuid4())
    envelope = {
        "queue_id": queue_id,
        "payload": payload.model_dump(mode="json"),
    }
    await redis_client.lpush(SCAN_QUEUE_NAME, json.dumps(envelope, default=json_default))
    return queue_id


async def persist_scan_payload(payload: ScanUploadRequest, app: FastAPI, queue_id: str | None = None) -> dict[str, Any]:
    async with SessionLocal() as db:
        machine = await db.get(Machine, payload.machine_id)
        if machine is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

        scan_timestamp = _to_utc(payload.timestamp)
        previous_risk = machine.last_risk_score
        metrics = payload.system_metrics

        scan = ScanResult(
            machine_id=machine.id,
            timestamp=scan_timestamp,
            risk_score=payload.risk_score,
            cpu_usage=float(metrics.cpu_usage),
            ram_usage=float(metrics.ram_usage),
            disk_usage=float(metrics.disk_usage),
            network_activity=metrics.network_activity,
            metrics_raw=metrics.model_dump(mode="json"),
        )
        db.add(scan)

        try:
            await db.flush()

            for item in payload.apps:
                db.add(
                    App(
                        scan_id=scan.id,
                        name=item.name.strip(),
                        current_version=item.current_version.strip(),
                        latest_version=item.latest_version.strip(),
                        risk_level=item.risk_level.strip().title(),
                    )
                )

            for item in payload.drivers:
                db.add(
                    Driver(
                        scan_id=scan.id,
                        driver_name=item.driver_name.strip(),
                        status=item.status.strip().title(),
                    )
                )

            for event in payload.security_events:
                db.add(
                    SecurityEvent(
                        machine_id=machine.id,
                        event_type=event.event_type.strip(),
                        risk_level=event.risk_level.strip().title(),
                        timestamp=_to_utc(event.timestamp),
                        details=event.details.strip() if event.details else None,
                    )
                )

            if payload.risk_score > 80:
                db.add(
                    SecurityEvent(
                        machine_id=machine.id,
                        event_type="High Risk Score",
                        risk_level="High",
                        timestamp=scan_timestamp,
                        details=f"Risk score crossed alert threshold: {payload.risk_score}",
                    )
                )

            machine.last_seen_at = scan_timestamp
            machine.last_risk_score = payload.risk_score

            await write_audit_log(
                db,
                action_type="scan_upload",
                machine_id=machine.id,
                details={
                    "queue_id": queue_id,
                    "scan_id": scan.id,
                    "risk_score": payload.risk_score,
                    "apps_count": len(payload.apps),
                    "drivers_count": len(payload.drivers),
                    "events_count": len(payload.security_events),
                },
            )
            await db.commit()
        except SQLAlchemyError:
            await db.rollback()
            raise

        redis_client = getattr(app.state, "redis", None)
        await invalidate_dashboard_cache(redis_client, machine_id=machine.id)

        live_hub = getattr(app.state, "live_hub", None)
        if live_hub is not None:
            await live_hub.publish(
                {
                    "type": "new_scan",
                    "machine_id": str(machine.id),
                    "hostname": machine.hostname,
                    "risk_score": payload.risk_score,
                    "timestamp": scan_timestamp,
                }
            )
            if previous_risk is not None and previous_risk != payload.risk_score:
                await live_hub.publish(
                    {
                        "type": "risk_score_changed",
                        "machine_id": str(machine.id),
                        "hostname": machine.hostname,
                        "previous_risk_score": previous_risk,
                        "new_risk_score": payload.risk_score,
                        "timestamp": scan_timestamp,
                    }
                )
            if payload.security_events:
                await live_hub.publish(
                    {
                        "type": "security_event",
                        "machine_id": str(machine.id),
                        "hostname": machine.hostname,
                        "count": len(payload.security_events),
                        "timestamp": scan_timestamp,
                    }
                )

        if payload.risk_score > 80:
            alert_payload = {
                "type": "security_alert",
                "machine_id": str(machine.id),
                "hostname": machine.hostname,
                "risk_score": payload.risk_score,
                "severity": "critical",
                "message": f"Risk score exceeded threshold ({payload.risk_score})",
                "timestamp": scan_timestamp,
            }
            alert_hub = getattr(app.state, "alert_hub", None)
            if alert_hub is not None:
                await alert_hub.publish(alert_payload)

            async with SessionLocal() as alert_db:
                async with alert_db.begin():
                    await write_audit_log(
                        alert_db,
                        action_type="security_alert",
                        machine_id=machine.id,
                        details=alert_payload,
                    )

        return {"scan_id": int(scan.id), "machine_id": machine.id, "timestamp": scan_timestamp}


def machine_queue_key(machine_id: UUID) -> str:
    return f"system_revamp:machine:{machine_id}:commands"


async def enqueue_machine_command(
    db: AsyncSession,
    redis_client: object | None,
    machine_id: UUID,
    command_type: str,
    payload: dict[str, Any] | None,
    requested_by: str,
) -> MachineCommand:
    command = MachineCommand(
        machine_id=machine_id,
        command_type=command_type.strip().lower(),
        status="queued",
        payload=payload or {},
        requested_by=requested_by.strip() or "system",
    )
    db.add(command)
    await db.flush()
    await write_audit_log(
        db,
        action_type="command_queued",
        machine_id=machine_id,
        details={
            "command_id": str(command.id),
            "command_type": command.command_type,
            "payload": command.payload,
            "requested_by": command.requested_by,
        },
    )
    await db.commit()
    await db.refresh(command)

    if redis_client is not None:
        try:
            await redis_client.lpush(machine_queue_key(machine_id), str(command.id))
        except Exception:
            LOGGER.exception("Failed to enqueue machine command in Redis")
    return command


def serialize_command(command: MachineCommand) -> MachineCommandItem:
    return MachineCommandItem(
        id=command.id,
        machine_id=command.machine_id,
        command_type=command.command_type,
        status=command.status,
        payload=command.payload or {},
        result=command.result,
        created_at=command.created_at,
        updated_at=command.updated_at,
        dispatched_at=command.dispatched_at,
        completed_at=command.completed_at,
    )


async def pop_machine_command(
    db: AsyncSession,
    redis_client: object | None,
    machine_id: UUID,
) -> MachineCommand | None:
    command_id: str | None = None
    if redis_client is not None:
        try:
            raw = await redis_client.rpop(machine_queue_key(machine_id))
            command_id = str(raw).strip() if raw else None
        except Exception:
            LOGGER.exception("Failed to read machine command queue from Redis")

    if command_id:
        command = await db.get(MachineCommand, UUID(command_id))
        if command is not None and command.status == "queued":
            command.status = "dispatched"
            command.dispatched_at = datetime.now(timezone.utc)
            command.updated_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(command)
            return command

    command = (
        (
            await db.execute(
                select(MachineCommand)
                .where(
                    MachineCommand.machine_id == machine_id,
                    MachineCommand.status == "queued",
                )
                .order_by(MachineCommand.created_at.asc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )
    if command is None:
        return None

    command.status = "dispatched"
    command.dispatched_at = datetime.now(timezone.utc)
    command.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(command)
    return command


async def complete_machine_command(
    db: AsyncSession,
    command_id: UUID,
    status_value: str,
    result: dict[str, Any],
    error: str | None = None,
) -> MachineCommand:
    command = await db.get(MachineCommand, command_id)
    if command is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found.")

    final_status = status_value.strip().lower()
    if final_status not in {"completed", "failed"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid command status.")

    command.status = final_status
    command.result = {**result, **({"error": error} if error else {})}
    command.updated_at = datetime.now(timezone.utc)
    command.completed_at = datetime.now(timezone.utc)

    await write_audit_log(
        db,
        action_type=f"command_{final_status}",
        machine_id=command.machine_id,
        details={
            "command_id": str(command.id),
            "command_type": command.command_type,
            "result": command.result,
        },
    )
    await db.commit()
    await db.refresh(command)
    return command


class CloudPipelineWorker:
    """Background worker consuming queued scan uploads from Redis."""

    def __init__(self, app: FastAPI) -> None:
        self._app = app
        self._redis = getattr(app.state, "redis", None)
        self._task: asyncio.Task | None = None

    async def start(self) -> None:
        if self._redis is None:
            return
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._run(), name="cloud-scan-ingestion-worker")

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run(self) -> None:
        while True:
            try:
                item = await self._redis.brpop(SCAN_QUEUE_NAME, timeout=5)
                if not item:
                    continue
                _, raw_payload = item
                envelope = json.loads(raw_payload)
                payload = ScanUploadRequest.model_validate(envelope.get("payload", {}))
                await persist_scan_payload(payload, self._app, queue_id=str(envelope.get("queue_id", "")))
            except asyncio.CancelledError:
                raise
            except Exception:
                LOGGER.exception("Scan ingestion worker failed")
                await asyncio.sleep(1)
