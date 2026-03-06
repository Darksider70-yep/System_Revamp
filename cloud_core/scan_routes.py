"""Scan upload and dashboard routes."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_admin, get_machine_api_key, verify_machine_api_key
from .database import get_db
from .models import App, Driver, Machine, ScanResult, SecurityEvent
from .schemas import (
    AppRecord,
    DashboardOverviewResponse,
    DriverRecord,
    MachineDetailResponse,
    MachineListResponse,
    MachineSummary,
    MetricsPoint,
    ScanUploadRequest,
    ScanUploadResponse,
    SecurityEventRecord,
)

router = APIRouter(tags=["scans"])

ONLINE_WINDOW_SECONDS = max(30, int(os.getenv("CLOUD_MACHINE_ONLINE_SECONDS", "120")))
CACHE_TTL_OVERVIEW = max(5, int(os.getenv("CLOUD_CACHE_TTL_OVERVIEW", "15")))
CACHE_TTL_MACHINES = max(5, int(os.getenv("CLOUD_CACHE_TTL_MACHINES", "15")))
CACHE_TTL_MACHINE_DETAIL = max(5, int(os.getenv("CLOUD_CACHE_TTL_MACHINE_DETAIL", "20")))


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _is_online(last_seen_at: datetime | None) -> bool:
    if last_seen_at is None:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=ONLINE_WINDOW_SECONDS)
    return _to_utc(last_seen_at) >= cutoff


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return str(value)


async def _cache_get(redis_client: object | None, key: str) -> dict[str, Any] | None:
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
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        return None
    return None


async def _cache_set(redis_client: object | None, key: str, payload: dict[str, Any], ttl_seconds: int) -> None:
    if redis_client is None:
        return
    try:
        await redis_client.set(key, json.dumps(payload, default=_json_default), ex=ttl_seconds)
    except Exception:
        return


async def _invalidate_cache(redis_client: object | None, machine_id: UUID | None = None) -> None:
    if redis_client is None:
        return

    try:
        keys: set[str] = {"dashboard:overview"}
        async for key in redis_client.scan_iter(match="dashboard:machines:*"):
            keys.add(str(key))

        if machine_id is not None:
            pattern = f"dashboard:machine:{machine_id}:*"
            async for key in redis_client.scan_iter(match=pattern):
                keys.add(str(key))

        if keys:
            await redis_client.delete(*list(keys))
    except Exception:
        return


def _latest_scan_ids_subquery() -> Any:
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


def _is_outdated(app: AppRecord) -> bool:
    if app.latest_version.strip().lower() in {"unknown", "n/a"}:
        return False
    return app.current_version.strip() != app.latest_version.strip()


@router.post("/upload-scan", response_model=ScanUploadResponse)
async def upload_scan(
    payload: ScanUploadRequest,
    request: Request,
    api_key: str = Depends(get_machine_api_key),
    db: AsyncSession = Depends(get_db),
) -> ScanUploadResponse:
    machine = await db.get(Machine, payload.machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    if not verify_machine_api_key(api_key, machine.api_key_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid machine API key.")

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

        for app in payload.apps:
            db.add(
                App(
                    scan_id=scan.id,
                    name=app.name.strip(),
                    current_version=app.current_version.strip(),
                    latest_version=app.latest_version.strip(),
                    risk_level=app.risk_level.strip().title(),
                )
            )

        for driver in payload.drivers:
            db.add(
                Driver(
                    scan_id=scan.id,
                    driver_name=driver.driver_name.strip(),
                    status=driver.status.strip().title(),
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

        machine.last_seen_at = scan_timestamp
        machine.last_risk_score = payload.risk_score

        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to store scan data.") from exc

    redis_client = getattr(request.app.state, "redis", None)
    await _invalidate_cache(redis_client, machine_id=machine.id)

    hub = getattr(request.app.state, "live_hub", None)
    if hub is not None:
        await hub.publish(
            {
                "type": "new_scan",
                "machine_id": str(machine.id),
                "hostname": machine.hostname,
                "risk_score": payload.risk_score,
                "timestamp": scan_timestamp,
            }
        )

        if previous_risk is not None and previous_risk != payload.risk_score:
            await hub.publish(
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
            await hub.publish(
                {
                    "type": "security_event",
                    "machine_id": str(machine.id),
                    "hostname": machine.hostname,
                    "count": len(payload.security_events),
                    "timestamp": scan_timestamp,
                }
            )

    return ScanUploadResponse(scan_id=int(scan.id), status="accepted")


@router.get("/dashboard/overview", response_model=DashboardOverviewResponse)
async def dashboard_overview(
    request: Request,
    _: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> DashboardOverviewResponse:
    cache_key = "dashboard:overview"
    redis_client = getattr(request.app.state, "redis", None)
    cached = await _cache_get(redis_client, cache_key)
    if cached is not None:
        return DashboardOverviewResponse(**cached)

    total_machines = int((await db.scalar(select(func.count(Machine.id)))) or 0)

    online_cutoff = datetime.now(timezone.utc) - timedelta(seconds=ONLINE_WINDOW_SECONDS)
    machines_online = int(
        (
            await db.scalar(
                select(func.count(Machine.id)).where(
                    Machine.last_seen_at.is_not(None),
                    Machine.last_seen_at >= online_cutoff,
                )
            )
        )
        or 0
    )

    average_risk_score = float(
        (
            await db.scalar(
                select(func.coalesce(func.avg(Machine.last_risk_score), 0.0)).where(
                    Machine.last_risk_score.is_not(None)
                )
            )
        )
        or 0.0
    )

    latest_scan_ids = _latest_scan_ids_subquery()

    app_vulnerability_count = int(
        (
            await db.scalar(
                select(func.count(App.id)).where(
                    App.scan_id.in_(select(latest_scan_ids.c.scan_id)),
                    func.lower(App.risk_level).in_(["high", "medium"]),
                )
            )
        )
        or 0
    )

    driver_vulnerability_count = int(
        (
            await db.scalar(
                select(func.count(Driver.id)).where(
                    Driver.scan_id.in_(select(latest_scan_ids.c.scan_id)),
                    func.lower(Driver.status) != "installed",
                )
            )
        )
        or 0
    )

    payload = DashboardOverviewResponse(
        total_machines=total_machines,
        machines_online=machines_online,
        total_vulnerabilities=app_vulnerability_count + driver_vulnerability_count,
        average_risk_score=round(average_risk_score, 2),
        last_updated=datetime.now(timezone.utc),
    )

    encoded = payload.model_dump(mode="json")
    await _cache_set(redis_client, cache_key, encoded, ttl_seconds=CACHE_TTL_OVERVIEW)
    return payload


@router.get("/dashboard/machines", response_model=MachineListResponse)
async def list_machines(
    request: Request,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    _: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> MachineListResponse:
    cache_key = f"dashboard:machines:{limit}:{offset}"
    redis_client = getattr(request.app.state, "redis", None)
    cached = await _cache_get(redis_client, cache_key)
    if cached is not None:
        return MachineListResponse(**cached)

    total = int((await db.scalar(select(func.count(Machine.id)))) or 0)

    event_cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    alerts_subquery = (
        select(
            SecurityEvent.machine_id.label("machine_id"),
            func.count(SecurityEvent.id).label("alerts"),
        )
        .where(SecurityEvent.timestamp >= event_cutoff)
        .group_by(SecurityEvent.machine_id)
        .subquery()
    )

    rows = (
        (
            await db.execute(
                select(
                    Machine.id,
                    Machine.hostname,
                    Machine.os,
                    Machine.last_seen_at,
                    Machine.last_risk_score,
                    func.coalesce(alerts_subquery.c.alerts, 0).label("alerts"),
                )
                .outerjoin(alerts_subquery, alerts_subquery.c.machine_id == Machine.id)
                .order_by(Machine.last_seen_at.desc(), Machine.registered_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .all()
    )

    items = [
        MachineSummary(
            id=row.id,
            hostname=row.hostname,
            os=row.os,
            last_scan=row.last_seen_at,
            risk_score=row.last_risk_score,
            alerts=int(row.alerts or 0),
            online=_is_online(row.last_seen_at),
        )
        for row in rows
    ]

    payload = MachineListResponse(total=total, items=items)
    encoded = payload.model_dump(mode="json")
    await _cache_set(redis_client, cache_key, encoded, ttl_seconds=CACHE_TTL_MACHINES)
    return payload


@router.get("/dashboard/machines/{machine_id}", response_model=MachineDetailResponse)
async def machine_detail(
    machine_id: UUID,
    request: Request,
    events_limit: int = Query(default=100, ge=10, le=1000),
    history_points: int = Query(default=120, ge=20, le=1000),
    _: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> MachineDetailResponse:
    cache_key = f"dashboard:machine:{machine_id}:{events_limit}:{history_points}"
    redis_client = getattr(request.app.state, "redis", None)
    cached = await _cache_get(redis_client, cache_key)
    if cached is not None:
        return MachineDetailResponse(**cached)

    machine = await db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    latest_scan = (
        (
            await db.execute(
                select(ScanResult)
                .where(ScanResult.machine_id == machine.id)
                .order_by(ScanResult.timestamp.desc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )

    latest_apps: list[AppRecord] = []
    latest_drivers: list[DriverRecord] = []
    if latest_scan is not None:
        apps = (
            (await db.execute(select(App).where(App.scan_id == latest_scan.id).order_by(App.name.asc())))
            .scalars()
            .all()
        )
        latest_apps = [
            AppRecord(
                name=item.name,
                current_version=item.current_version,
                latest_version=item.latest_version,
                risk_level=item.risk_level,
            )
            for item in apps
        ]

        drivers = (
            (
                await db.execute(
                    select(Driver)
                    .where(Driver.scan_id == latest_scan.id)
                    .order_by(Driver.driver_name.asc())
                )
            )
            .scalars()
            .all()
        )
        latest_drivers = [
            DriverRecord(driver_name=item.driver_name, status=item.status)
            for item in drivers
            if item.status.strip().lower() != "installed"
        ]

    events = (
        (
            await db.execute(
                select(SecurityEvent)
                .where(SecurityEvent.machine_id == machine.id)
                .order_by(SecurityEvent.timestamp.desc())
                .limit(events_limit)
            )
        )
        .scalars()
        .all()
    )

    security_events = [
        SecurityEventRecord(
            event_type=item.event_type,
            risk_level=item.risk_level,
            timestamp=item.timestamp,
            details=item.details,
        )
        for item in events
    ]

    metric_rows = (
        (
            await db.execute(
                select(
                    ScanResult.timestamp,
                    ScanResult.cpu_usage,
                    ScanResult.ram_usage,
                    ScanResult.disk_usage,
                    ScanResult.risk_score,
                )
                .where(ScanResult.machine_id == machine.id)
                .order_by(ScanResult.timestamp.desc())
                .limit(history_points)
            )
        )
        .all()
    )

    metrics_points = [
        MetricsPoint(
            timestamp=row.timestamp,
            cpu_usage=float(row.cpu_usage),
            ram_usage=float(row.ram_usage),
            disk_usage=float(row.disk_usage),
            risk_score=int(row.risk_score),
        )
        for row in reversed(metric_rows)
    ]

    alerts = int(
        (
            await db.scalar(
                select(func.count(SecurityEvent.id)).where(
                    SecurityEvent.machine_id == machine.id,
                    SecurityEvent.timestamp >= (datetime.now(timezone.utc) - timedelta(hours=24)),
                )
            )
        )
        or 0
    )

    payload = MachineDetailResponse(
        id=machine.id,
        hostname=machine.hostname,
        os=machine.os,
        os_version=machine.os_version,
        cpu=machine.cpu,
        ram_gb=machine.ram_gb,
        registered_at=machine.registered_at,
        last_scan=machine.last_seen_at,
        risk_score=machine.last_risk_score,
        alerts=alerts,
        online=_is_online(machine.last_seen_at),
        installed_apps=latest_apps,
        outdated_software=[app for app in latest_apps if _is_outdated(app)],
        driver_issues=latest_drivers,
        security_events=security_events,
        system_metrics=metrics_points,
    )

    encoded = payload.model_dump(mode="json")
    await _cache_set(redis_client, cache_key, encoded, ttl_seconds=CACHE_TTL_MACHINE_DETAIL)
    return payload
