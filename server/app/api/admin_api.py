import datetime
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from server.app.core.database import get_db
from server.app.models.models import (
    Organization,
    Site,
    Lab,
    Device,
    DeviceSoftware,
    DeviceDriver,
    EnrollmentToken,
    ScanSnapshot,
    ThreatReputation,
    Command,
    AuditLog,
    AdminUser,
)
from server.app.schemas.schemas import (
    OrgCreate,
    OrgResponse,
    SiteCreate,
    SiteResponse,
    LabCreate,
    LabResponse,
    EnrollmentTokenCreate,
    EnrollmentTokenResponse,
    FleetOverview,
    DeviceDetailResponse,
)
from server.app.auth.rbac import get_current_admin, require_role
from server.app.auth.device_auth import generate_enrollment_token

router = APIRouter(prefix="/api/v2/admin", tags=["Admin Management"])


# --- Organization, Site & Lab Management ---

@router.get("/orgs", response_model=List[OrgResponse])
def list_organizations(
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if user.role == "SuperAdmin":
        orgs = db.query(Organization).all()
    else:
        orgs = db.query(Organization).filter(Organization.id == user.org_id).all()

    res = []
    for org in orgs:
        sites_count = db.query(Site).filter(Site.org_id == org.id).count()
        dev_count = db.query(Device).join(Lab).join(Site).filter(Site.org_id == org.id).count()
        res.append(OrgResponse(id=org.id, name=org.name, created_at=org.created_at, sites_count=sites_count, devices_count=dev_count))
    return res


@router.post("/orgs", response_model=OrgResponse)
def create_organization(
    req: OrgCreate,
    user: AdminUser = Depends(require_role(["SuperAdmin"])),
    db: Session = Depends(get_db),
):
    org = Organization(name=req.name)
    db.add(org)
    db.commit()
    db.refresh(org)
    return OrgResponse(id=org.id, name=org.name, created_at=org.created_at, sites_count=0, devices_count=0)


@router.get("/sites", response_model=List[SiteResponse])
def list_sites(
    org_id: Optional[str] = None,
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    target_org = user.org_id if user.role != "SuperAdmin" else (org_id or user.org_id)
    sites = db.query(Site).filter(Site.org_id == target_org).all()
    res = []
    for s in sites:
        labs_count = db.query(Lab).filter(Lab.site_id == s.id).count()
        res.append(SiteResponse(id=s.id, org_id=s.org_id, name=s.name, location=s.location, created_at=s.created_at, labs_count=labs_count))
    return res


@router.post("/sites", response_model=SiteResponse)
def create_site(
    req: SiteCreate,
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin"])),
    db: Session = Depends(get_db),
):
    site = Site(org_id=req.org_id, name=req.name, location=req.location or "")
    db.add(site)
    db.commit()
    db.refresh(site)
    return SiteResponse(id=site.id, org_id=site.org_id, name=site.name, location=site.location, created_at=site.created_at, labs_count=0)


@router.get("/labs", response_model=List[LabResponse])
def list_labs(
    site_id: Optional[str] = None,
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Lab).join(Site)
    if user.role != "SuperAdmin":
        query = query.filter(Site.org_id == user.org_id)
    if site_id:
        query = query.filter(Lab.site_id == site_id)

    labs = query.all()
    res = []
    for lab in labs:
        dev_count = db.query(Device).filter(Device.lab_id == lab.id).count()
        res.append(LabResponse(id=lab.id, site_id=lab.site_id, name=lab.name, network_subnet=lab.network_subnet, created_at=lab.created_at, devices_count=dev_count))
    return res


@router.post("/labs", response_model=LabResponse)
def create_lab(
    req: LabCreate,
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin"])),
    db: Session = Depends(get_db),
):
    lab = Lab(site_id=req.site_id, name=req.name, network_subnet=req.network_subnet or "")
    db.add(lab)
    db.commit()
    db.refresh(lab)
    return LabResponse(id=lab.id, site_id=lab.site_id, name=lab.name, network_subnet=lab.network_subnet, created_at=lab.created_at, devices_count=0)


# --- Enrollment Tokens ---

@router.post("/enrollment-tokens", response_model=EnrollmentTokenResponse)
def create_enrollment_token(
    req: EnrollmentTokenCreate,
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin", "LabAdmin"])),
    db: Session = Depends(get_db),
):
    raw_token, token_hash = generate_enrollment_token()
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=req.expires_days)

    tok = EnrollmentToken(
        org_id=user.org_id if user.role != "SuperAdmin" else req.org_id,
        lab_id=req.lab_id,
        token_hash=token_hash,
        name=req.name,
        created_by=user.email,
        expires_at=expires_at,
        max_uses=req.max_uses,
    )
    db.add(tok)
    db.commit()
    db.refresh(tok)

    return EnrollmentTokenResponse(
        id=tok.id,
        token=raw_token,  # Revealed only on creation
        name=tok.name,
        expires_at=tok.expires_at,
        max_uses=tok.max_uses,
        used_count=tok.used_count,
        is_revoked=tok.is_revoked,
    )


@router.get("/enrollment-tokens")
def list_enrollment_tokens(
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(EnrollmentToken)
    if user.role != "SuperAdmin":
        query = query.filter(EnrollmentToken.org_id == user.org_id)
    tokens = query.all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "created_by": t.created_by,
            "expires_at": t.expires_at,
            "max_uses": t.max_uses,
            "used_count": t.used_count,
            "is_revoked": t.is_revoked,
            "created_at": t.created_at,
        }
        for t in tokens
    ]


@router.delete("/enrollment-tokens/{token_id}")
def revoke_enrollment_token(
    token_id: str,
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin", "LabAdmin"])),
    db: Session = Depends(get_db),
):
    tok = db.query(EnrollmentToken).filter(EnrollmentToken.id == token_id).first()
    if not tok:
        raise HTTPException(status_code=404, detail="Token not found")
    tok.is_revoked = True
    db.commit()
    return {"message": "Enrollment token revoked successfully"}


# --- Fleet Overview & Device Drilldown ---

@router.get("/fleet/overview", response_model=FleetOverview)
def get_fleet_overview(
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Device).join(Lab).join(Site)
    if user.role != "SuperAdmin":
        query = query.filter(Site.org_id == user.org_id)

    total_devices = query.count()
    online_devices = query.filter(Device.is_online == True).count()
    offline_devices = total_devices - online_devices

    # Devices with critical or high risk software
    crit_devices = query.filter(Device.software.any(DeviceSoftware.risk_level == "Critical")).count()
    high_devices = query.filter(Device.software.any(DeviceSoftware.risk_level == "High")).count()

    # Top outdated applications fleetwide
    top_apps = (
        db.query(
            DeviceSoftware.app_name,
            DeviceSoftware.latest_version,
            DeviceSoftware.risk_level,
            func.count(DeviceSoftware.id).label("affected_devices"),
        )
        .filter(DeviceSoftware.risk_level.in_(["Critical", "High", "Medium"]))
        .group_by(DeviceSoftware.app_name, DeviceSoftware.latest_version, DeviceSoftware.risk_level)
        .order_by(func.count(DeviceSoftware.id).desc())
        .limit(5)
        .all()
    )

    # Top missing drivers fleetwide
    top_drivers = (
        db.query(
            DeviceDriver.device_name,
            DeviceDriver.impact,
            func.count(DeviceDriver.id).label("affected_devices"),
        )
        .filter(DeviceDriver.error_code > 0)
        .group_by(DeviceDriver.device_name, DeviceDriver.impact)
        .order_by(func.count(DeviceDriver.id).desc())
        .limit(5)
        .all()
    )

    threats_flagged = db.query(ThreatReputation).filter(ThreatReputation.vt_status.in_(["Malicious", "Suspicious"])).count()
    
    now = datetime.datetime.utcnow()
    is_stale = False
    if total_devices > 0:
        latest_heartbeat = db.query(func.max(Device.last_heartbeat)).scalar()
        if latest_heartbeat and (now - latest_heartbeat).total_seconds() > 3600:
            is_stale = True

    compliance = (
        round(((total_devices - crit_devices) / total_devices * 100), 1)
        if total_devices > 0
        else None
    )
    status_msg = (
        f"Fleet telemetry active ({total_devices} devices)"
        if total_devices > 0
        else "No devices enrolled in fleet yet"
    )

    return FleetOverview(
        total_devices=total_devices,
        online_devices=online_devices,
        offline_devices=offline_devices,
        compliance_percent=compliance,
        critical_risk_devices=crit_devices,
        high_risk_devices=high_devices,
        top_outdated_apps=[{"app_name": a[0], "latest_version": a[1], "risk_level": a[2], "affected_devices": a[3]} for a in top_apps],
        top_missing_drivers=[{"device_name": d[0], "impact": d[1], "affected_devices": d[2]} for d in top_drivers],
        threats_flagged=threats_flagged,
        source="fleet_telemetry",
        fetched_at=now,
        stale=is_stale,
        status_message=status_msg,
    )


@router.get("/devices")
def list_devices(
    lab_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Device).join(Lab).join(Site)
    if user.role != "SuperAdmin":
        query = query.filter(Site.org_id == user.org_id)
    if lab_id:
        query = query.filter(Device.lab_id == lab_id)
    if status_filter == "online":
        query = query.filter(Device.is_online == True)
    elif status_filter == "offline":
        query = query.filter(Device.is_online == False)

    devices = query.all()
    res = []
    for d in devices:
        crit_count = db.query(DeviceSoftware).filter(DeviceSoftware.device_id == d.id, DeviceSoftware.risk_level == "Critical").count()
        driver_issue_count = db.query(DeviceDriver).filter(DeviceDriver.device_id == d.id, DeviceDriver.error_code > 0).count()
        res.append({
            "id": d.id,
            "hostname": d.hostname,
            "os_name": d.os_name,
            "os_version": d.os_version,
            "ip_address": d.ip_address,
            "is_online": d.is_online,
            "last_heartbeat": d.last_heartbeat,
            "lab_name": d.lab.name if d.lab else "Unassigned",
            "critical_risks": crit_count,
            "driver_issues": driver_issue_count,
        })
    return res


@router.get("/devices/{device_id}", response_model=DeviceDetailResponse)
def get_device_detail(
    device_id: str,
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    software = db.query(DeviceSoftware).filter(DeviceSoftware.device_id == device.id).all()
    drivers = db.query(DeviceDriver).filter(DeviceDriver.device_id == device.id).all()
    recent_cmds = db.query(Command).filter(Command.target_id == device.id).order_by(Command.created_at.desc()).limit(10).all()

    return DeviceDetailResponse(
        id=device.id,
        hostname=device.hostname,
        os_name=device.os_name,
        os_version=device.os_version,
        ip_address=device.ip_address,
        mac_address=device.mac_address,
        is_online=device.is_online,
        last_heartbeat=device.last_heartbeat,
        agent_version=device.agent_version,
        lab_name=device.lab.name if device.lab else "",
        site_name=device.lab.site.name if device.lab and device.lab.site else "",
        org_name=device.lab.site.organization.name if device.lab and device.lab.site and device.lab.site.organization else "",
        system_metrics={
            "cpu_model": device.cpu_model,
            "cpu_cores": device.cpu_cores,
            "ram_total_gb": device.ram_total_gb,
            "disk_total_gb": device.disk_total_gb,
            "disk_free_gb": device.disk_free_gb,
            "uptime_seconds": device.uptime_seconds,
        },
        software=[{
            "id": s.id,
            "name": s.app_name,
            "version": s.version,
            "latest_version": s.latest_version,
            "risk_level": s.risk_level,
            "publisher": s.publisher,
            "signature_status": s.signature_status,
            "signer_name": s.signer_name,
            "binary_sha256": s.binary_sha256,
            "version_source": getattr(s, "version_source", "unknown") or "unknown",
            "version_fetched_at": getattr(s, "version_fetched_at", None),
            "is_stale": getattr(s, "is_stale", False),
        } for s in software],
        drivers=[{
            "id": drv.id,
            "name": drv.device_name,
            "status": drv.status,
            "impact": drv.impact,
            "risk_score": drv.risk_score,
            "error_code": drv.error_code,
            "reason": drv.reason,
            "manufacturer": drv.manufacturer,
            "is_disabled": drv.is_disabled,
            "device_class_guid": getattr(drv, "device_class_guid", "") or "",
            "source": getattr(drv, "source", "pnp_entity") or "pnp_entity",
            "is_stale": getattr(drv, "is_stale", False),
        } for drv in drivers],
        recent_commands=[{
            "id": c.id,
            "type": c.command_type,
            "status": c.status,
            "dry_run": c.dry_run,
            "created_at": c.created_at,
            "completed_at": c.completed_at,
            "result": json.loads(c.result_json) if c.result_json else {},
        } for c in recent_cmds],
    )


@router.get("/audit-logs")
def list_audit_logs(
    limit: int = 50,
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if user.role != "SuperAdmin":
        query = query.filter(AuditLog.org_id == user.org_id)
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "action": l.action,
            "user_id": l.user_id,
            "target_type": l.target_type,
            "target_id": l.target_id,
            "details": json.loads(l.details_json) if l.details_json else {},
            "timestamp": l.timestamp,
        }
        for l in logs
    ]
