import datetime
import json
import re
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from server.app.core.database import get_db
from server.app.models.models import Command, AdminUser, Device, Lab, AuditLog
from server.app.schemas.schemas import CommandQueueRequest, CommandApprovalRequest
from server.app.auth.rbac import get_current_admin, require_role
from server.app.auth.device_auth import sign_command

router = APIRouter(prefix="/api/v2/commands", tags=["Fleet Commands & Remediation"])

ALLOWED_COMMAND_TYPES = {
    "rescan",
    "scan-drivers",
    "enable-device",
    "upgrade-package",
    "run-protection-scan",
}


def sanitize_parameter_value(val: str) -> str:
    """Sanitizes arguments to strictly prevent shell injection."""
    if not isinstance(val, str):
        return str(val)
    # Reject shell metacharacters: ; | ` $ > < \n \r &&
    if re.search(r"[;|`$><\r\n]|&&", val):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parameter contains illegal shell metacharacters: {val}",
        )
    return val.strip()


@router.post("/queue")
def queue_command(
    req: CommandQueueRequest,
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin", "LabAdmin"])),
    db: Session = Depends(get_db),
):
    if req.command_type not in ALLOWED_COMMAND_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Command '{req.command_type}' is not in the allowed command whitelist: {list(ALLOWED_COMMAND_TYPES)}",
        )

    # Sanitize parameters
    sanitized_params = {}
    for k, v in req.params.items():
        if isinstance(v, str):
            sanitized_params[k] = sanitize_parameter_value(v)
        elif isinstance(v, list):
            sanitized_params[k] = [sanitize_parameter_value(item) if isinstance(item, str) else item for item in v]
        else:
            sanitized_params[k] = v

    params_json_str = json.dumps(sanitized_params, sort_keys=True)

    # Initial status: pending approval or approved directly if user has rights and not requested approval
    initial_status = "pending" if req.requires_approval else "approved"

    cmd = Command(
        org_id=user.org_id,
        target_type=req.target_type,
        target_id=req.target_id,
        command_type=req.command_type,
        params_json=params_json_str,
        dry_run=req.dry_run,
        status=initial_status,
        created_by=user.email,
        approved_by=user.email if initial_status == "approved" else None,
    )
    db.add(cmd)
    db.flush()

    # Generate cryptographic HMAC signature
    cmd.signature = sign_command(cmd.id, cmd.command_type, params_json_str)

    # Audit log
    db.add(
        AuditLog(
            org_id=user.org_id,
            user_id=user.id,
            action="command_queued",
            target_type=req.target_type,
            target_id=req.target_id,
            details_json=json.dumps({"command_type": req.command_type, "dry_run": req.dry_run, "status": initial_status}),
        )
    )
    db.commit()

    return {
        "command_id": cmd.id,
        "status": cmd.status,
        "signature": cmd.signature,
        "dry_run": cmd.dry_run,
        "message": f"Command '{cmd.command_type}' queued successfully.",
    }


@router.post("/approve")
def approve_command(
    req: CommandApprovalRequest,
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin"])),
    db: Session = Depends(get_db),
):
    cmd = db.query(Command).filter(Command.id == req.command_id).first()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    if req.approved:
        cmd.status = "approved"
        cmd.approved_by = user.email
    else:
        cmd.status = "rejected"
        cmd.completed_at = datetime.datetime.utcnow()

    db.add(
        AuditLog(
            org_id=user.org_id,
            user_id=user.id,
            action="command_approved" if req.approved else "command_rejected",
            target_type="command",
            target_id=cmd.id,
            details_json=json.dumps({"approved": req.approved, "by": user.email}),
        )
    )
    db.commit()

    return {"command_id": cmd.id, "status": cmd.status, "message": f"Command is now {cmd.status}"}


@router.get("/list")
@router.get("/history")
def list_commands(
    status_filter: Optional[str] = None,
    limit: int = 50,
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Command)
    if user.role != "SuperAdmin":
        query = query.filter(Command.org_id == user.org_id)
    if status_filter:
        query = query.filter(Command.status == status_filter)

    cmds = query.order_by(Command.created_at.desc()).limit(limit).all()
    return [
        {
            "id": c.id,
            "target_type": c.target_type,
            "target_id": c.target_id,
            "command_type": c.command_type,
            "params": json.loads(c.params_json) if c.params_json else {},
            "dry_run": c.dry_run,
            "status": c.status,
            "created_by": c.created_by,
            "approved_by": c.approved_by,
            "result": json.loads(c.result_json) if c.result_json else {},
            "created_at": c.created_at,
            "completed_at": c.completed_at,
        }
        for c in cmds
    ]
