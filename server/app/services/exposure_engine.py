import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from packaging import version
from server.app.models.models import VulnerabilityCatalog, DeviceSoftware

# Seed genuine known CVEs
SEED_CVES = [
    {
        "cve_id": "CVE-2024-21892",
        "app_name": "Node.js",
        "affected_versions_expr": "< 20.11.1",
        "cvss_score": 8.1,
        "severity": "HIGH",
        "fixed_in_version": "20.11.1",
        "summary": "Code execution through improper path validation in Node.js permission model.",
    },
    {
        "cve_id": "CVE-2024-22019",
        "app_name": "Node.js",
        "affected_versions_expr": "< 20.11.1",
        "cvss_score": 7.5,
        "severity": "HIGH",
        "fixed_in_version": "20.11.1",
        "summary": "HTTP request smuggling via chunked extension parsing vulnerability in llhttp.",
    },
    {
        "cve_id": "CVE-2023-24329",
        "app_name": "Python",
        "affected_versions_expr": "< 3.11.4",
        "cvss_score": 7.5,
        "severity": "HIGH",
        "fixed_in_version": "3.11.4",
        "summary": "Bypass of blocklists in urllib.parse when parsing URLs starting with blank spaces.",
    },
    {
        "cve_id": "CVE-2024-32002",
        "app_name": "Git",
        "affected_versions_expr": "< 2.45.1",
        "cvss_score": 9.8,
        "severity": "CRITICAL",
        "fixed_in_version": "2.45.1",
        "summary": "Recursive submodule clone allows arbitrary code execution via symbolic links on case-insensitive filesystems.",
    },
    {
        "cve_id": "CVE-2024-4671",
        "app_name": "Google Chrome",
        "affected_versions_expr": "< 124.0.6367.201",
        "cvss_score": 8.8,
        "severity": "HIGH",
        "fixed_in_version": "124.0.6367.201",
        "summary": "Use-after-free in Visuals subsystem in Google Chrome allowed remote attacker to potentially exploit heap corruption.",
    },
]


def seed_vulnerability_catalog(db: Session):
    for entry in SEED_CVES:
        exists = db.query(VulnerabilityCatalog).filter(VulnerabilityCatalog.cve_id == entry["cve_id"]).first()
        if not exists:
            db.add(
                VulnerabilityCatalog(
                    cve_id=entry["cve_id"],
                    app_name=entry["app_name"],
                    affected_versions_expr=entry["affected_versions_expr"],
                    cvss_score=entry["cvss_score"],
                    severity=entry["severity"],
                    fixed_in_version=entry["fixed_in_version"],
                    summary=entry["summary"],
                )
            )
    db.commit()


from server.app.services.cve_connectors import sync_and_check_app_vulnerabilities


def check_app_vulnerabilities(app_name: str, app_version: str, db: Session) -> List[Dict[str, Any]]:
    """
    Checks real vulnerabilities for an installed application using live OSV.dev
    and NVD feeds, cached in the vulnerability catalog.
    """
    try:
        return sync_and_check_app_vulnerabilities(app_name, app_version, db)
    except Exception as e:
        print(f"[EXPOSURE ENGINE] Error during CVE check: {e}")
        # Fallback to local DB queries if live lookup fails
        norm_name = app_name.strip().lower()
        cves = db.query(VulnerabilityCatalog).filter(
            VulnerabilityCatalog.app_name.ilike(f"%{norm_name}%")
        ).all()
        matches = []
        for cve in cves:
            matches.append({
                "cve_id": cve.cve_id,
                "app_name": app_name,
                "installed_version": app_version,
                "cvss_score": cve.cvss_score,
                "severity": cve.severity,
                "fixed_in_version": cve.fixed_in_version or "Patched Release",
                "summary": cve.summary,
                "source": getattr(cve, "cve_source", "osv.dev") or "osv.dev",
            })
        return matches
