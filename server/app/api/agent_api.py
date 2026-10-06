import datetime
import hashlib
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from server.app.core.database import get_db
from server.app.models.models import (
    EnrollmentToken,
    Device,
    Lab,
    ScanSnapshot,
    DeviceSoftware,
    DeviceDriver,
    Command,
    ThreatReputation,
    AuditLog,
)
from server.app.schemas.schemas import (
    AgentEnrollRequest,
    AgentEnrollResponse,
    AgentHeartbeatRequest,
    TelemetryReport,
    TelemetryIngestResponse,
    CommandPollItem,
    CommandResultSubmit,
)
from server.app.auth.device_auth import generate_device_token, sign_command
from server.app.auth.rbac import verify_device_token
from server.app.services.risk_engine import evaluate_software_risk

router = APIRouter(prefix="/api/v2/agent", tags=["Agent Communication"])


@router.post("/enroll", response_model=AgentEnrollResponse)
def enroll_agent(request: AgentEnrollRequest, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(request.enrollment_token.encode("utf-8")).hexdigest()
    enroll_token = db.query(EnrollmentToken).filter(
        EnrollmentToken.token_hash == token_hash,
        EnrollmentToken.is_revoked == False,
    ).first()

    if not enroll_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked enrollment token",
        )

    if datetime.datetime.utcnow() > enroll_token.expires_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Enrollment token has expired",
        )

    if enroll_token.used_count >= enroll_token.max_uses:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Enrollment token maximum usage limit reached",
        )

    # Determine default lab if none specified
    target_lab_id = enroll_token.lab_id
    if not target_lab_id:
        default_lab = db.query(Lab).join(Lab.site).filter(Lab.site.has(org_id=enroll_token.org_id)).first()
        if default_lab:
            target_lab_id = default_lab.id

    # Create new Device
    new_device = Device(
        lab_id=target_lab_id,
        hostname=request.hostname,
        os_name=request.os_name,
        os_version=request.os_version,
        os_build=request.os_build or "",
        ip_address=request.ip_address or "",
        mac_address=request.mac_address or "",
        agent_version=request.agent_version,
        is_enrolled=True,
        is_online=True,
        device_token_hash="temporary",
    )
    db.add(new_device)
    db.flush()  # Generate device.id

    # Generate device token
    raw_token, dev_token_hash = generate_device_token(new_device.id)
    new_device.device_token_hash = dev_token_hash

    # Increment token usage
    enroll_token.used_count += 1

    # Audit log
    db.add(
        AuditLog(
            org_id=enroll_token.org_id,
            user_id="agent_installer",
            action="agent_enrolled",
            target_type="device",
            target_id=new_device.id,
            details_json=json.dumps({"hostname": request.hostname, "os": request.os_name, "token_id": enroll_token.id}),
        )
    )
    db.commit()

    return AgentEnrollResponse(
        device_id=new_device.id,
        device_token=raw_token,
        org_id=enroll_token.org_id,
        lab_id=target_lab_id,
        poll_interval_seconds=300,
        server_time=datetime.datetime.utcnow(),
    )


@router.post("/heartbeat")
def agent_heartbeat(
    request: AgentHeartbeatRequest,
    device: Device = Depends(verify_device_token),
    db: Session = Depends(get_db),
):
    if device.id != request.device_id:
        raise HTTPException(status_code=403, detail="Device ID mismatch with token")

    device.is_online = True
    device.last_heartbeat = datetime.datetime.utcnow()
    if request.ip_address:
        device.ip_address = request.ip_address
    if request.uptime_seconds:
        device.uptime_seconds = request.uptime_seconds
    if request.disk_free_gb is not None:
        device.disk_free_gb = request.disk_free_gb

    db.commit()
    return {"status": "ok", "timestamp": datetime.datetime.utcnow()}


@router.post("/telemetry", response_model=TelemetryIngestResponse)
def ingest_telemetry(
    report: TelemetryReport,
    device: Device = Depends(verify_device_token),
    db: Session = Depends(get_db),
):
    if device.id != report.device_id:
        raise HTTPException(status_code=403, detail="Device ID mismatch with token")

    device.is_online = True
    device.last_heartbeat = datetime.datetime.utcnow()

    # Update system metrics if present
    if report.system_metrics:
        device.cpu_model = report.system_metrics.cpu_model or device.cpu_model
        device.cpu_cores = report.system_metrics.cpu_cores or device.cpu_cores
        device.ram_total_gb = report.system_metrics.ram_total_gb or device.ram_total_gb
        device.disk_total_gb = report.system_metrics.disk_total_gb or device.disk_total_gb
        device.disk_free_gb = report.system_metrics.disk_free_gb or device.disk_free_gb
        device.uptime_seconds = report.system_metrics.uptime_seconds or device.uptime_seconds

    # Clear existing software & drivers for full snapshot replacement (idempotent)
    db.query(DeviceSoftware).filter(DeviceSoftware.device_id == device.id).delete()
    db.query(DeviceDriver).filter(DeviceDriver.device_id == device.id).delete()

    critical_risks_count = 0
    now = datetime.datetime.utcnow()

    # Ingest and classify software
    for sw in report.software:
        latest_ver, risk_level = evaluate_software_risk(sw.name, sw.version, db)
        if risk_level == "Critical":
            critical_risks_count += 1

        db.add(
            DeviceSoftware(
                device_id=device.id,
                app_name=sw.name,
                version=sw.version,
                publisher=sw.publisher or "",
                install_path=sw.install_path or "",
                binary_sha256=sw.binary_sha256,
                signature_status=sw.signature_status or "Unsigned",
                signer_name=sw.signer_name or "",
                risk_level=risk_level,
                latest_version=latest_ver,
                last_scanned_at=now,
            )
        )

        # Pre-seed threat reputations table for unknown hashes
        if sw.binary_sha256:
            existing_threat = db.query(ThreatReputation).filter(ThreatReputation.sha256 == sw.binary_sha256).first()
            if not existing_threat:
                db.add(
                    ThreatReputation(
                        sha256=sw.binary_sha256,
                        vt_status="Unknown",
                        last_checked_at=now,
                    )
                )

    # Ingest drivers
    driver_issues_count = 0
    for drv in report.drivers:
        if drv.error_code > 0 or drv.status in ["Missing", "Disabled", "Error"]:
            driver_issues_count += 1

        db.add(
            DeviceDriver(
                device_id=device.id,
                device_name=drv.device_name,
                device_id_pnp=drv.device_id_pnp or "",
                error_code=drv.error_code,
                reason=drv.reason or "",
                impact=drv.impact or "Low",
                risk_score=drv.risk_score or 0,
                status=drv.status or "Installed",
                manufacturer=drv.manufacturer or "Unknown",
                is_disabled=drv.is_disabled or False,
                last_scanned_at=now,
            )
        )

    # Record Scan Snapshot
    snapshot = ScanSnapshot(
        device_id=device.id,
        snapshot_type=report.snapshot_type,
        software_count=len(report.software),
        driver_issues_count=driver_issues_count,
        critical_risks_count=critical_risks_count,
        system_metrics_json=json.dumps(report.system_metrics.dict() if report.system_metrics else {}),
        created_at=now,
    )
    db.add(snapshot)
    db.commit()

    return TelemetryIngestResponse(
        success=True,
        processed_software=len(report.software),
        processed_drivers=len(report.drivers),
        critical_risks=critical_risks_count,
        message=f"Telemetry ingested successfully. Snapshot created.",
    )


@router.get("/commands", response_model=List[CommandPollItem])
def poll_commands(
    device: Device = Depends(verify_device_token),
    db: Session = Depends(get_db),
):
    # Find approved / pending commands targeted at this device, its lab, or its org
    now = datetime.datetime.utcnow()
    commands = db.query(Command).filter(
        Command.status == "approved",
        (
            (Command.target_type == "device") & (Command.target_id == device.id)
            | (Command.target_type == "lab") & (Command.target_id == device.lab_id)
            | (Command.target_type == "fleet")
        )
    ).all()

    items = []
    for cmd in commands:
        params_dict = json.loads(cmd.params_json) if cmd.params_json else {}
        params_str = json.dumps(params_dict, sort_keys=True)
        sig = sign_command(cmd.id, cmd.command_type, params_str)

        items.append(
            CommandPollItem(
                id=cmd.id,
                command_type=cmd.command_type,
                params=params_dict,
                signature=sig,
                dry_run=cmd.dry_run,
            )
        )
        cmd.status = "dispatched"
        cmd.dispatched_at = now

    db.commit()
    return items


@router.post("/commands/result")
def submit_command_result(
    submission: CommandResultSubmit,
    device: Device = Depends(verify_device_token),
    db: Session = Depends(get_db),
):
    cmd = db.query(Command).filter(Command.id == submission.command_id).first()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    cmd.status = submission.status
    cmd.completed_at = datetime.datetime.utcnow()
    cmd.result_json = json.dumps({
        "device_id": device.id,
        "hostname": device.hostname,
        "status": submission.status,
        "result": submission.result,
        "execution_log": submission.execution_log,
    })

    # Log to audit log
    db.add(
        AuditLog(
            org_id=cmd.org_id,
            user_id="agent",
            action=f"command_{submission.status}",
            target_type="command",
            target_id=cmd.id,
            details_json=json.dumps({"command_type": cmd.command_type, "device": device.hostname}),
        )
    )
    db.commit()

    return {"message": "Command result recorded"}
