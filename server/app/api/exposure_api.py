import asyncio
import datetime
import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from server.app.core.database import get_db
from server.app.models.models import Device, DeviceSoftware, AdminUser
from server.app.auth.rbac import get_current_admin, issue_ticket_token, consume_ticket_token
from server.app.services.exposure_engine import check_app_vulnerabilities, seed_vulnerability_catalog

router = APIRouter(prefix="/api/v2/exposure", tags=["Exposure Assessment"])


@router.post("/token")
def generate_exposure_ticket(
    device_id: str = Query(...),
    user: AdminUser = Depends(get_current_admin),
):
    ticket = issue_ticket_token(device_id, ttl_seconds=30)
    return {"ticket": ticket, "expires_in": 30}


@router.get("/stream/{device_id}")
async def stream_exposure_assessment(
    device_id: str,
    ticket: str = Query(...),
    db: Session = Depends(get_db),
):
    # Verify and burn ticket token
    validated_dev_id = consume_ticket_token(ticket)
    if not validated_dev_id or validated_dev_id != device_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired ticket token",
        )

    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    software_list = db.query(DeviceSoftware).filter(DeviceSoftware.device_id == device_id).all()

    async def event_generator():
        yield f"data: {json.dumps({'step': 1, 'progress': 10, 'level': 'INFO', 'message': f'Starting Exposure Assessment on {device.hostname}...' })}\n\n"
        await asyncio.sleep(0.3)

        yield f"data: {json.dumps({'step': 2, 'progress': 30, 'level': 'INFO', 'message': f'Analyzing {len(software_list)} installed packages against OSV.dev & National Vulnerability Database (NVD)...' })}\n\n"
        await asyncio.sleep(0.4)

        total_cves = []
        for sw in software_list:
            cves = check_app_vulnerabilities(sw.app_name, sw.version, db)
            for cve in cves:
                total_cves.append(cve)
                cve_id = cve["cve_id"]
                cvss = cve["cvss_score"]
                fix = cve.get("fixed_in_version") or "Latest Patch"
                cve_src = cve.get("source", "osv.dev")
                msg = f"Identified {cve_id} in {sw.app_name} v{sw.version} (CVSS {cvss}) via {cve_src} - Fixed in {fix}"
                payload_json = json.dumps({"step": 3, "progress": 60, "level": "WARN", "message": msg, "source": cve_src, "cve_id": cve_id})
                yield f"data: {payload_json}\n\n"
                await asyncio.sleep(0.3)

        yield f"data: {json.dumps({'step': 4, 'progress': 90, 'level': 'INFO', 'message': 'Synthesizing exploit mitigation and remediation guidance...' })}\n\n"
        await asyncio.sleep(0.3)

        summary_data = {
            "device_id": device_id,
            "hostname": device.hostname,
            "total_packages_audited": len(software_list),
            "vulnerabilities_found": total_cves,
            "sources": ["osv.dev", "nvd.nist.gov"],
            "fetched_at": datetime.datetime.utcnow().isoformat(),
            "status": "Assessment Complete",
        }

        yield f"event: summary\ndata: {json.dumps(summary_data)}\n\n"
        yield f"event: end\ndata: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
