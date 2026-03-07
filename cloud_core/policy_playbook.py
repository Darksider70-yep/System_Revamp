"""Automated policy enforcement and response playbooks."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select

from .audit import write_audit_log
from .database import SessionLocal
from .models import App, Driver, Machine, MachineCommand, MachineGroup, MachineGroupMembership, ScanResult, SecurityEvent

DEFAULT_REQUIRE_LATEST_SOFTWARE = os.getenv("CLOUD_POLICY_REQUIRE_LATEST_SOFTWARE", "1").strip().lower() in {"1", "true", "yes"}
DEFAULT_MAX_RISK_SCORE = max(0, min(100, int(os.getenv("CLOUD_POLICY_MAX_RISK_SCORE", "80"))))
DEFAULT_MANDATORY_DRIVER = os.getenv("CLOUD_POLICY_MANDATORY_DRIVER_PRESENCE", "1").strip().lower() in {"1", "true", "yes"}

PLAYBOOK_EMERGENCY_PATCH_RISK = max(0, min(100, int(os.getenv("CLOUD_PLAYBOOK_EMERGENCY_PATCH_RISK", "90"))))
PLAYBOOK_SCAN_UNKNOWN_SOFTWARE = os.getenv("CLOUD_PLAYBOOK_SCAN_UNKNOWN_SOFTWARE", "1").strip().lower() in {"1", "true", "yes"}
PLAYBOOK_PATCH_COOLDOWN_MINUTES = max(1, int(os.getenv("CLOUD_PLAYBOOK_PATCH_COOLDOWN_MINUTES", "30")))
PLAYBOOK_SCAN_COOLDOWN_MINUTES = max(1, int(os.getenv("CLOUD_PLAYBOOK_SCAN_COOLDOWN_MINUTES", "15")))


def _queue_key(machine_id: UUID) -> str:
    return f"system_revamp:machine:{machine_id}:commands"


def _is_unknown_version(value: str) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized in {"unknown", "n/a", "na", ""}


def _parse_minutes(value: str | None) -> int | None:
    if not value:
        return None
    raw = str(value).strip()
    if ":" not in raw:
        return None
    hour_raw, minute_raw = raw.split(":", 1)
    try:
        hour = int(hour_raw)
        minute = int(minute_raw)
    except ValueError:
        return None
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return (hour * 60) + minute


def _in_patch_window(start: str | None, end: str | None, now_utc: datetime) -> bool:
    start_min = _parse_minutes(start)
    end_min = _parse_minutes(end)
    if start_min is None or end_min is None:
        return True
    current_min = (now_utc.hour * 60) + now_utc.minute
    if start_min <= end_min:
        return start_min <= current_min <= end_min
    # Overnight window, e.g., 22:00 -> 03:00.
    return current_min >= start_min or current_min <= end_min


async def _effective_policy(machine_id: UUID) -> dict[str, Any]:
    policy = {
        "require_latest_software": DEFAULT_REQUIRE_LATEST_SOFTWARE,
        "max_risk_score": DEFAULT_MAX_RISK_SCORE,
        "mandatory_driver_presence": DEFAULT_MANDATORY_DRIVER,
    }
    patch_windows: list[tuple[str | None, str | None]] = []

    async with SessionLocal() as db:
        rows = (
            (
                await db.execute(
                    select(MachineGroup.policy, MachineGroup.patch_window_start, MachineGroup.patch_window_end)
                    .join(MachineGroupMembership, MachineGroupMembership.group_id == MachineGroup.id)
                    .where(MachineGroupMembership.machine_id == machine_id)
                )
            )
            .all()
        )
        for policy_blob, patch_start, patch_end in rows:
            if isinstance(policy_blob, dict):
                if "require_latest_software" in policy_blob:
                    policy["require_latest_software"] = bool(policy_blob["require_latest_software"])
                if "mandatory_driver_presence" in policy_blob:
                    policy["mandatory_driver_presence"] = bool(policy_blob["mandatory_driver_presence"])
                if "max_risk_score" in policy_blob and policy_blob["max_risk_score"] is not None:
                    try:
                        policy["max_risk_score"] = max(0, min(100, int(policy_blob["max_risk_score"])))
                    except (TypeError, ValueError):
                        pass
            patch_windows.append((patch_start, patch_end))

    policy["patch_windows"] = patch_windows
    return policy


async def _recent_command_exists(machine_id: UUID, command_type: str, cooldown_minutes: int) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max(1, cooldown_minutes))
    async with SessionLocal() as db:
        row = (
            (
                await db.execute(
                    select(MachineCommand.id)
                    .where(
                        MachineCommand.machine_id == machine_id,
                        MachineCommand.command_type == command_type,
                        MachineCommand.created_at >= cutoff,
                    )
                    .limit(1)
                )
            )
            .first()
        )
    return row is not None


async def evaluate_policies_and_playbooks(app: Any, machine_id: UUID, scan_id: int) -> None:
    policy = await _effective_policy(machine_id)
    generated_alerts: list[dict[str, Any]] = []
    queued_command_ids: list[UUID] = []

    async with SessionLocal() as db:
        machine = await db.get(Machine, machine_id)
        scan = await db.get(ScanResult, scan_id)
        if machine is None or scan is None:
            return

        apps = (
            (await db.execute(select(App).where(App.scan_id == scan_id).order_by(App.name.asc())))
            .scalars()
            .all()
        )
        drivers = (
            (await db.execute(select(Driver).where(Driver.scan_id == scan_id).order_by(Driver.driver_name.asc())))
            .scalars()
            .all()
        )

        previous_scan = (
            (
                await db.execute(
                    select(ScanResult)
                    .where(
                        ScanResult.machine_id == machine_id,
                        ScanResult.id != scan_id,
                        ScanResult.timestamp < scan.timestamp,
                    )
                    .order_by(ScanResult.timestamp.desc())
                    .limit(1)
                )
            )
            .scalars()
            .first()
        )

        previous_scan_apps: list[App] = []
        previous_scan_drivers: list[Driver] = []
        if previous_scan is not None:
            previous_scan_apps = (
                (await db.execute(select(App).where(App.scan_id == previous_scan.id))).scalars().all()
            )
            previous_scan_drivers = (
                (await db.execute(select(Driver).where(Driver.scan_id == previous_scan.id))).scalars().all()
            )

        outdated_apps = [
            item
            for item in apps
            if not _is_unknown_version(item.latest_version) and item.current_version.strip() != item.latest_version.strip()
        ]
        missing_drivers = [item for item in drivers if item.status.strip().lower() != "installed"]

        violations: list[tuple[str, str, str]] = []
        if policy["require_latest_software"] and outdated_apps:
            violations.append(
                (
                    "Policy Violation: Outdated Software",
                    "High",
                    f"{len(outdated_apps)} applications are behind latest approved versions.",
                )
            )
        if scan.risk_score > int(policy["max_risk_score"]):
            violations.append(
                (
                    "Policy Violation: Risk Threshold",
                    "Critical" if scan.risk_score >= 90 else "High",
                    f"Risk score {scan.risk_score} exceeded policy threshold {policy['max_risk_score']}.",
                )
            )
        if policy["mandatory_driver_presence"] and missing_drivers:
            violations.append(
                (
                    "Policy Violation: Driver Presence",
                    "Medium",
                    f"{len(missing_drivers)} required drivers are missing or degraded.",
                )
            )

        for event_type, risk_level, details in violations:
            event = SecurityEvent(
                machine_id=machine_id,
                event_type=event_type,
                risk_level=risk_level,
                timestamp=datetime.now(timezone.utc),
                details=details,
            )
            db.add(event)
            generated_alerts.append(
                {
                    "type": "policy_violation",
                    "machine_id": str(machine_id),
                    "hostname": machine.hostname,
                    "risk_level": risk_level,
                    "message": details,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            await write_audit_log(
                db,
                action_type="policy_violation",
                machine_id=machine_id,
                details={"event_type": event_type, "details": details},
            )

        if scan.risk_score >= PLAYBOOK_EMERGENCY_PATCH_RISK:
            patch_allowed = any(
                _in_patch_window(start, end, datetime.now(timezone.utc))
                for start, end in policy.get("patch_windows", [])
            ) if policy.get("patch_windows") else True
            if patch_allowed and not await _recent_command_exists(machine_id, "patch", PLAYBOOK_PATCH_COOLDOWN_MINUTES):
                command = MachineCommand(
                    machine_id=machine_id,
                    command_type="patch",
                    status="queued",
                    payload={"software": None, "patch_all": True, "origin": "playbook_risk_threshold"},
                    requested_by="playbook_engine",
                )
                db.add(command)
                await db.flush()
                queued_command_ids.append(command.id)
                await write_audit_log(
                    db,
                    action_type="playbook_patch_queued",
                    machine_id=machine_id,
                    details={"command_id": str(command.id), "risk_score": scan.risk_score},
                )
            elif not patch_allowed:
                db.add(
                    SecurityEvent(
                        machine_id=machine_id,
                        event_type="Playbook Deferred: Patch Window",
                        risk_level="Medium",
                        timestamp=datetime.now(timezone.utc),
                        details="Emergency patch playbook deferred because current time is outside configured patch window.",
                    )
                )

        if PLAYBOOK_SCAN_UNKNOWN_SOFTWARE:
            current_unknown = {
                item.name.strip().lower()
                for item in apps
                if _is_unknown_version(item.latest_version)
            }
            previous_unknown = {
                item.name.strip().lower()
                for item in previous_scan_apps
                if _is_unknown_version(item.latest_version)
            }
            new_unknown = sorted(name for name in current_unknown if name not in previous_unknown)
            if new_unknown and not await _recent_command_exists(machine_id, "scan", PLAYBOOK_SCAN_COOLDOWN_MINUTES):
                command = MachineCommand(
                    machine_id=machine_id,
                    command_type="scan",
                    status="queued",
                    payload={"force_full": True, "origin": "playbook_unknown_software", "software": new_unknown},
                    requested_by="playbook_engine",
                )
                db.add(command)
                await db.flush()
                queued_command_ids.append(command.id)
                await write_audit_log(
                    db,
                    action_type="playbook_scan_queued",
                    machine_id=machine_id,
                    details={"command_id": str(command.id), "new_unknown_software": new_unknown},
                )

        current_missing = len(missing_drivers)
        previous_missing = sum(
            1 for item in previous_scan_drivers if item.status.strip().lower() != "installed"
        )
        if current_missing > previous_missing:
            details = f"Missing/degraded driver count increased from {previous_missing} to {current_missing}."
            db.add(
                SecurityEvent(
                    machine_id=machine_id,
                    event_type="Playbook Alert: Driver Removed",
                    risk_level="High",
                    timestamp=datetime.now(timezone.utc),
                    details=details,
                )
            )
            await write_audit_log(
                db,
                action_type="playbook_driver_removed_alert",
                machine_id=machine_id,
                details={"details": details},
            )

        await db.commit()

    redis_client = getattr(app.state, "redis", None)
    if redis_client is not None and queued_command_ids:
        for command_id in queued_command_ids:
            try:
                await redis_client.lpush(_queue_key(machine_id), str(command_id))
            except Exception:
                continue

    alert_hub = getattr(app.state, "alert_hub", None)
    if alert_hub is not None:
        for alert in generated_alerts:
            try:
                await alert_hub.publish(alert)
            except Exception:
                continue
