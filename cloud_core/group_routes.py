"""Enterprise fleet grouping and policy routes."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from .audit import write_audit_log
from .auth import require_roles
from .database import get_db
from .models import Machine, MachineGroup, MachineGroupMembership
from .platform_ops import enqueue_machine_command, invalidate_dashboard_cache
from .schemas import (
    GroupAddMachineRequest,
    GroupCommandResponse,
    GroupCreateRequest,
    GroupListResponse,
    GroupMachineRecord,
    GroupPolicyUpdateRequest,
    GroupResponse,
    GroupScanRequest,
)

router = APIRouter(tags=["groups"])


async def _load_group_members(
    db: AsyncSession,
    group_id: UUID,
) -> list[GroupMachineRecord]:
    rows = (
        (
            await db.execute(
                select(
                    Machine.id,
                    Machine.hostname,
                    Machine.os,
                    Machine.last_seen_at,
                    Machine.last_risk_score,
                )
                .join(MachineGroupMembership, MachineGroupMembership.machine_id == Machine.id)
                .where(MachineGroupMembership.group_id == group_id)
                .order_by(Machine.hostname.asc())
            )
        )
        .all()
    )
    return [
        GroupMachineRecord(
            machine_id=row.id,
            hostname=row.hostname,
            os=row.os,
            last_seen_at=row.last_seen_at,
            risk_score=row.last_risk_score,
        )
        for row in rows
    ]


async def _serialize_group(db: AsyncSession, group: MachineGroup) -> GroupResponse:
    members = await _load_group_members(db, group.id)
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        policy=group.policy or {},
        scan_schedule_cron=group.scan_schedule_cron,
        patch_window_start=group.patch_window_start,
        patch_window_end=group.patch_window_end,
        timezone=group.timezone,
        machine_count=len(members),
        machines=members,
        created_at=group.created_at,
    )


@router.post("/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    payload: GroupCreateRequest,
    _: str = Depends(require_roles("admin", "operator")),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    group = MachineGroup(
        name=payload.name.strip(),
        description=(payload.description or "").strip() or None,
        policy=(payload.policy.model_dump(mode="json") if payload.policy else {}),
        scan_schedule_cron=(payload.scan_schedule_cron or "").strip() or None,
        patch_window_start=(payload.patch_window_start or "").strip() or None,
        patch_window_end=(payload.patch_window_end or "").strip() or None,
        timezone=(payload.timezone or "").strip() or None,
    )
    db.add(group)
    try:
        await db.flush()
        await write_audit_log(
            db,
            action_type="group_created",
            details={
                "group_id": str(group.id),
                "name": group.name,
                "policy": group.policy or {},
            },
        )
        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create group.") from exc

    await db.refresh(group)
    return await _serialize_group(db, group)


@router.get("/groups", response_model=GroupListResponse)
async def list_groups(
    _: str = Depends(require_roles("admin", "analyst", "operator")),
    db: AsyncSession = Depends(get_db),
) -> GroupListResponse:
    groups = (await db.execute(select(MachineGroup).order_by(MachineGroup.created_at.desc()))).scalars().all()
    items = [await _serialize_group(db, group) for group in groups]
    return GroupListResponse(total=len(items), items=items)


@router.post("/groups/{group_id}/policy", response_model=GroupResponse)
async def update_group_policy(
    group_id: UUID,
    payload: GroupPolicyUpdateRequest,
    _: str = Depends(require_roles("admin", "operator")),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    group = await db.get(MachineGroup, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")

    group.policy = payload.policy.model_dump(mode="json")
    group.scan_schedule_cron = (payload.scan_schedule_cron or "").strip() or group.scan_schedule_cron
    group.patch_window_start = (payload.patch_window_start or "").strip() or group.patch_window_start
    group.patch_window_end = (payload.patch_window_end or "").strip() or group.patch_window_end
    group.timezone = (payload.timezone or "").strip() or group.timezone
    await write_audit_log(
        db,
        action_type="group_policy_updated",
        details={"group_id": str(group.id), "policy": group.policy or {}},
    )
    await db.commit()
    await db.refresh(group)
    return await _serialize_group(db, group)


@router.post("/groups/{group_id}/add-machine", response_model=GroupResponse)
async def add_machine_to_group(
    group_id: UUID,
    payload: GroupAddMachineRequest,
    _: str = Depends(require_roles("admin", "operator")),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    group = await db.get(MachineGroup, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")
    machine = await db.get(Machine, payload.machine_id)
    if machine is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Machine not found.")

    existing = await db.get(MachineGroupMembership, (group_id, payload.machine_id))
    if existing is None:
        db.add(MachineGroupMembership(group_id=group_id, machine_id=payload.machine_id))
        await write_audit_log(
            db,
            action_type="group_machine_added",
            machine_id=payload.machine_id,
            details={"group_id": str(group_id)},
        )
        await db.commit()

    return await _serialize_group(db, group)


@router.post("/groups/{group_id}/scan", response_model=GroupCommandResponse)
async def queue_group_scan(
    group_id: UUID,
    payload: GroupScanRequest,
    request: Request,
    requested_by: str = Depends(require_roles("admin", "operator")),
    db: AsyncSession = Depends(get_db),
) -> GroupCommandResponse:
    group = await db.get(MachineGroup, group_id)
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found.")

    member_machine_ids = (
        (
            await db.execute(
                select(MachineGroupMembership.machine_id).where(MachineGroupMembership.group_id == group_id)
            )
        )
        .scalars()
        .all()
    )
    if not member_machine_ids:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Group has no machines.")

    redis_client = getattr(request.app.state, "redis", None)
    command_ids: list[UUID] = []
    for machine_id in member_machine_ids:
        command = await enqueue_machine_command(
            db,
            redis_client,
            machine_id=machine_id,
            command_type="scan",
            payload={"force_full": payload.force_full},
            requested_by=requested_by,
        )
        command_ids.append(command.id)
        await invalidate_dashboard_cache(redis_client, machine_id=machine_id)

    await write_audit_log(
        db,
        action_type="group_scan_queued",
        details={"group_id": str(group_id), "queued_commands": len(command_ids)},
    )
    await db.commit()
    return GroupCommandResponse(
        group_id=group_id,
        queued_commands=len(command_ids),
        command_ids=command_ids,
        queued_at=datetime.now(timezone.utc),
    )
