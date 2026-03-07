"""Scan upload, machine command, and dashboard routes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import get_current_admin, get_machine_api_key, verify_machine_api_key
from .database import get_db
from .models import App, Driver, Machine, MachineCommand, ScanResult, SecurityEvent
from .platform_ops import (
    CACHE_TTL_MACHINE_DETAIL,
    CACHE_TTL_MACHINES,
    CACHE_TTL_OVERVIEW,
    ONLINE_WINDOW_SECONDS,
    cache_get,
    cache_set,
    calculate_risk_breakdown,
    complete_machine_command,
    enqueue_machine_command,
    enqueue_scan,
    invalidate_dashboard_cache,
    is_online,
    latest_scan_ids_subquery,
    persist_scan_payload,
    pop_machine_command,
    risk_score_formula,
    serialize_command,
)
from .schemas import (
    AppRecord,
    DashboardOverviewResponse,
    DriverRecord,
    MachineCommandPollResponse,
    MachineCommandQueueResponse,
    MachineCommandResultRequest,
    MachineDetailResponse,
    MachineListResponse,
    MachinePatchCommandRequest,
    MachineSummary,
    ManualScanCommandRequest,
    MetricsPoint,
    PatchInstallRequest,
    PatchInstallResponse,
    PatchStatusItem,
    PatchStatusResponse,
    RiskScoreResponse,
    ScanUploadRequest,
    ScanUploadResponse,
    SecurityEventRecord,
    SecurityEventsResponse,
)

router = APIRouter(tags=["scans"])


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

    accepted_at = datetime.now(timezone.utc)
    redis_client = getattr(request.app.state, "redis", None)
    queue_id = await enqueue_scan(redis_client, payload)
    if queue_id:
        return ScanUploadResponse(status="accepted", queue_id=queue_id, accepted_at=accepted_at)

    await persist_scan_payload(payload, request.app)
    return ScanUploadResponse(status="stored", queue_id=None, accepted_at=accepted_at)


@router.get("/dashboard/overview", response_model=DashboardOverviewResponse)
async def dashboard_overview(
    request: Request,
    _: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> DashboardOverviewResponse:
    cache_key = "dashboard:overview"
    redis_client = getattr(request.app.state, "redis", None)
    cached = await cache_get(redis_client, cache_key)
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

    latest_scan_ids = latest_scan_ids_subquery()
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
    await cache_set(redis_client, cache_key, payload.model_dump(mode="json"), ttl_seconds=CACHE_TTL_OVERVIEW)
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
    cached = await cache_get(redis_client, cache_key)
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
            online=is_online(row.last_seen_at),
        )
        for row in rows
    ]

    payload = MachineListResponse(total=total, items=items)
    await cache_set(redis_client, cache_key, payload.model_dump(mode="json"), ttl_seconds=CACHE_TTL_MACHINES)
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
    cached = await cache_get(redis_client, cache_key)
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
                    select(Driver).where(Driver.scan_id == latest_scan.id).order_by(Driver.driver_name.asc())
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
        online=is_online(machine.last_seen_at),
        installed_apps=latest_apps,
        outdated_software=[app for app in latest_apps if _is_outdated(app)],
        driver_issues=latest_drivers,
        security_events=security_events,
        system_metrics=metrics_points,
    )

    await cache_set(redis_client, cache_key, payload.model_dump(mode="json"), ttl_seconds=CACHE_TTL_MACHINE_DETAIL)
    return payload


@router.get("/risk-score/{machine_id}", response_model=RiskScoreResponse)
async def machine_risk_score(
    machine_id: UUID,
    _: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> RiskScoreResponse:
    machine = await db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    breakdown = await calculate_risk_breakdown(db, machine_id)
    score = risk_score_formula(
        outdated_apps=breakdown.outdated_apps,
        missing_drivers=breakdown.missing_drivers,
        cpu_spikes=breakdown.cpu_spikes,
        security_events=breakdown.security_events,
    )
    return RiskScoreResponse(machine_id=machine_id, risk_score=score, breakdown=breakdown)


@router.get("/events/{machine_id}", response_model=SecurityEventsResponse)
@router.get("/machines/{machine_id}/events", response_model=SecurityEventsResponse)
async def machine_events(
    machine_id: UUID,
    limit: int = Query(default=300, ge=1, le=2000),
    _: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> SecurityEventsResponse:
    machine = await db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    rows = (
        (
            await db.execute(
                select(SecurityEvent)
                .where(SecurityEvent.machine_id == machine_id)
                .order_by(SecurityEvent.timestamp.asc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    events = [
        SecurityEventRecord(
            event_type=item.event_type,
            risk_level=item.risk_level,
            timestamp=item.timestamp,
            details=item.details,
        )
        for item in rows
    ]
    return SecurityEventsResponse(machine_id=machine_id, count=len(events), events=events)


async def _queue_command(
    machine_id: UUID,
    command_type: str,
    command_payload: dict[str, Any],
    request: Request,
    admin_subject: str,
    db: AsyncSession,
) -> MachineCommandQueueResponse:
    machine = await db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    redis_client = getattr(request.app.state, "redis", None)
    command = await enqueue_machine_command(
        db,
        redis_client,
        machine_id=machine.id,
        command_type=command_type,
        payload=command_payload,
        requested_by=admin_subject,
    )
    await invalidate_dashboard_cache(redis_client, machine_id=machine.id)
    return MachineCommandQueueResponse(
        status="queued",
        command_id=command.id,
        machine_id=machine.id,
        command_type=command.command_type,
        queued_at=command.created_at,
    )


@router.post("/machines/{machine_id}/scan", response_model=MachineCommandQueueResponse)
async def queue_manual_scan(
    machine_id: UUID,
    payload: ManualScanCommandRequest,
    request: Request,
    admin_subject: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> MachineCommandQueueResponse:
    return await _queue_command(
        machine_id,
        "scan",
        {"force_full": payload.force_full},
        request,
        admin_subject,
        db,
    )


@router.post("/machines/{machine_id}/patch", response_model=MachineCommandQueueResponse)
async def queue_machine_patch(
    machine_id: UUID,
    payload: MachinePatchCommandRequest,
    request: Request,
    admin_subject: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> MachineCommandQueueResponse:
    command_payload = {
        "software": payload.software,
        "patch_all": payload.patch_all or not bool(payload.software),
    }
    return await _queue_command(machine_id, "patch", command_payload, request, admin_subject, db)


@router.post("/install-patch", response_model=PatchInstallResponse)
async def install_patch(
    payload: PatchInstallRequest,
    request: Request,
    admin_subject: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> PatchInstallResponse:
    queued = await _queue_command(
        payload.machine_id,
        "patch",
        {"software": payload.software, "patch_all": False},
        request,
        admin_subject,
        db,
    )
    return PatchInstallResponse(
        status=queued.status,
        command_id=queued.command_id,
        command_type=queued.command_type,
        machine_id=queued.machine_id,
    )


@router.get("/patch-status/{machine_id}", response_model=PatchStatusResponse)
async def patch_status(
    machine_id: UUID,
    limit: int = Query(default=50, ge=1, le=500),
    _: str = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> PatchStatusResponse:
    machine = await db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    rows = (
        (
            await db.execute(
                select(MachineCommand)
                .where(
                    MachineCommand.machine_id == machine_id,
                    MachineCommand.command_type == "patch",
                )
                .order_by(MachineCommand.created_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )

    items = [
        PatchStatusItem(
            command_id=row.id,
            software=str((row.result or row.payload or {}).get("software", "all_packages")),
            status="patch_installed" if row.status == "completed" else ("patch_failed" if row.status == "failed" else row.status),
            provider=str((row.result or {}).get("provider", "pending")),
            timestamp=row.completed_at or row.updated_at or row.created_at,
            new_version=(row.result or {}).get("new_version"),
        )
        for row in rows
    ]
    return PatchStatusResponse(machine_id=machine_id, count=len(items), items=items)


@router.get("/agent/commands/next", response_model=MachineCommandPollResponse)
async def next_agent_command(
    machine_id: UUID,
    request: Request,
    api_key: str = Depends(get_machine_api_key),
    db: AsyncSession = Depends(get_db),
) -> MachineCommandPollResponse:
    machine = await db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")
    if not verify_machine_api_key(api_key, machine.api_key_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid machine API key.")

    command = await pop_machine_command(db, getattr(request.app.state, "redis", None), machine_id)
    return MachineCommandPollResponse(
        machine_id=machine_id,
        command=serialize_command(command) if command is not None else None,
    )


@router.post("/agent/commands/{command_id}/result", response_model=MachineCommandPollResponse)
async def record_agent_command_result(
    command_id: UUID,
    payload: MachineCommandResultRequest,
    api_key: str = Depends(get_machine_api_key),
    db: AsyncSession = Depends(get_db),
) -> MachineCommandPollResponse:
    command = await db.get(MachineCommand, command_id)
    if command is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Command not found.")
    machine = await db.get(Machine, command.machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")
    if not verify_machine_api_key(api_key, machine.api_key_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid machine API key.")

    updated = await complete_machine_command(db, command_id, payload.status, payload.result, payload.error)
    return MachineCommandPollResponse(machine_id=updated.machine_id, command=serialize_command(updated))
