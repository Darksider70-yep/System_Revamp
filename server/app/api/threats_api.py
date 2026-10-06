from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from server.app.core.database import get_db
from server.app.models.models import ThreatReputation, DeviceSoftware, AdminUser
from server.app.auth.rbac import get_current_admin
from server.app.services.vt_service import process_pending_vt_hashes

router = APIRouter(prefix="/api/v2/threats", tags=["Threat Intelligence"])


@router.get("/overview")
def get_threats_overview(
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    reputations = db.query(ThreatReputation).all()
    total_hashes = len(reputations)
    malicious_hashes = sum(1 for r in reputations if r.vt_status == "Malicious")
    suspicious_hashes = sum(1 for r in reputations if r.vt_status == "Suspicious")
    clean_hashes = sum(1 for r in reputations if r.vt_status == "Clean")
    pending_hashes = sum(1 for r in reputations if r.vt_status == "Unknown")

    # Map flagged hashes to affected machines
    flagged = []
    for r in reputations:
        if r.vt_status in ["Malicious", "Suspicious"]:
            installed = (
                db.query(DeviceSoftware)
                .filter(DeviceSoftware.binary_sha256 == r.sha256)
                .all()
            )
            flagged.append({
                "sha256": r.sha256,
                "status": r.vt_status,
                "score": r.vt_score,
                "positives": r.positives_count,
                "total_engines": r.total_engines,
                "affected_devices_count": len(installed),
                "apps": list(set(s.app_name for s in installed)),
            })

    return {
        "total_unique_hashes": total_hashes,
        "clean_hashes": clean_hashes,
        "suspicious_hashes": suspicious_hashes,
        "malicious_hashes": malicious_hashes,
        "pending_vt_queue": pending_hashes,
        "flagged_threats": flagged,
    }


@router.post("/process-queue")
def trigger_vt_queue_processing(
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    processed = process_pending_vt_hashes(db, max_items=4)
    return {"processed_count": processed, "message": f"Processed {processed} hashes against VirusTotal queue"}
