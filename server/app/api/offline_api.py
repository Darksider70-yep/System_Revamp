import datetime
import hashlib
import hmac
import json
import os
import zipfile
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from server.app.core.config import settings
from server.app.core.database import get_db
from server.app.models.models import (
    VulnerabilityCatalog,
    ThreatReputation,
    InstallerCache,
    AdminUser,
)
from server.app.auth.rbac import get_current_admin, require_role

router = APIRouter(prefix="/api/v2/offline", tags=["Air-Gapped & Installer Cache"])


def sign_payload(payload_bytes: bytes) -> str:
    return hmac.new(settings.DEVICE_SIGNING_KEY.encode(), payload_bytes, hashlib.sha256).hexdigest()


def verify_payload_signature(payload_bytes: bytes, signature: str) -> bool:
    expected = sign_payload(payload_bytes)
    return hmac.compare_digest(expected, signature)


@router.get("/export-intelligence-bundle")
def export_intelligence_bundle(
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin"])),
    db: Session = Depends(get_db),
):
    """Exports a signed offline intelligence bundle containing version catalogs, vulnerability data, and threat reputations."""
    vulnerabilities = [
        {
            "cve_id": v.cve_id,
            "app_name": v.app_name,
            "affected_versions_expr": v.affected_versions_expr,
            "cvss_score": v.cvss_score,
            "severity": v.severity,
            "fixed_in_version": v.fixed_in_version,
            "summary": v.summary,
        }
        for v in db.query(VulnerabilityCatalog).all()
    ]

    threats = [
        {
            "sha256": t.sha256,
            "vt_status": t.vt_status,
            "vt_score": t.vt_score,
            "positives_count": t.positives_count,
            "total_engines": t.total_engines,
        }
        for t in db.query(ThreatReputation).all()
    ]

    bundle_data = {
        "bundle_version": "2.0.0",
        "created_at": datetime.datetime.utcnow().isoformat(),
        "vulnerabilities": vulnerabilities,
        "threats": threats,
    }

    manifest_bytes = json.dumps(bundle_data, indent=2).encode("utf-8")
    signature = sign_payload(manifest_bytes)

    # Pack into zip
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", manifest_bytes)
        zf.writestr("signature.sig", signature)
    zip_buffer.seek(0)

    filename = f"system_revamp_intel_bundle_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/import-intelligence-bundle")
async def import_intelligence_bundle(
    bundle_file: UploadFile = File(...),
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin"])),
    db: Session = Depends(get_db),
):
    """Imports and verifies a signed intelligence bundle into an air-gapped server."""
    content = await bundle_file.read()
    try:
        with zipfile.ZipFile(BytesIO(content)) as zf:
            if "manifest.json" not in zf.namelist() or "signature.sig" not in zf.namelist():
                raise HTTPException(status_code=400, detail="Invalid bundle structure: missing manifest or signature.")

            manifest_bytes = zf.read("manifest.json")
            signature = zf.read("signature.sig").decode("utf-8").strip()

            if not verify_payload_signature(manifest_bytes, signature):
                raise HTTPException(status_code=403, detail="Bundle signature verification failed! Untrusted or tampered bundle.")

            data = json.loads(manifest_bytes.decode("utf-8"))

            # Ingest vulnerabilities
            vuln_count = 0
            for v in data.get("vulnerabilities", []):
                exists = db.query(VulnerabilityCatalog).filter(VulnerabilityCatalog.cve_id == v["cve_id"]).first()
                if not exists:
                    db.add(VulnerabilityCatalog(**v))
                    vuln_count += 1

            # Ingest threats
            threat_count = 0
            for t in data.get("threats", []):
                exists = db.query(ThreatReputation).filter(ThreatReputation.sha256 == t["sha256"]).first()
                if not exists:
                    db.add(ThreatReputation(**t))
                    threat_count += 1
                else:
                    exists.vt_status = t.get("vt_status", exists.vt_status)
                    exists.vt_score = t.get("vt_score", exists.vt_score)

            db.commit()

            return {
                "message": "Intelligence bundle verified and imported successfully.",
                "imported_vulnerabilities": vuln_count,
                "imported_threat_records": threat_count,
            }
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP archive.")


@router.post("/installers/upload")
async def upload_installer(
    app_name: str = Form(...),
    version: str = Form(...),
    installer_file: UploadFile = File(...),
    user: AdminUser = Depends(require_role(["SuperAdmin", "OrgAdmin"])),
    db: Session = Depends(get_db),
):
    """Uploads an application installer into the central server's LAN cache."""
    content = await installer_file.read()
    sha256_hash = hashlib.sha256(content).hexdigest()

    file_path = settings.INSTALLER_DIR / f"{sha256_hash}_{installer_file.filename}"
    with open(file_path, "wb") as f:
        f.write(content)

    entry = InstallerCache(
        app_name=app_name,
        version=version,
        sha256=sha256_hash,
        filename=installer_file.filename,
        file_size_bytes=len(content),
        storage_path=str(file_path),
        approved_by=user.email,
    )
    db.add(entry)
    db.commit()

    return {
        "message": f"Installer for {app_name} v{version} uploaded and cached.",
        "sha256": sha256_hash,
        "filename": installer_file.filename,
    }


@router.get("/installers")
def list_cached_installers(
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    items = db.query(InstallerCache).all()
    return [
        {
            "id": item.id,
            "app_name": item.app_name,
            "version": item.version,
            "sha256": item.sha256,
            "filename": item.filename,
            "file_size_bytes": item.file_size_bytes,
            "approved_by": item.approved_by,
            "uploaded_at": item.uploaded_at,
        }
        for item in items
    ]
