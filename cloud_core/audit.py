"""Audit logging helpers for Cloud Security Core."""

from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .models import AuditLog


async def write_audit_log(
    db: AsyncSession,
    action_type: str,
    machine_id: UUID | None = None,
    details: Dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            machine_id=machine_id,
            action_type=action_type.strip().lower(),
            details=details or {},
        )
    )
