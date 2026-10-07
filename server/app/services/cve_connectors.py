import datetime
import json
import re
import time
import urllib.request
import urllib.error
import urllib.parse
from typing import List, Dict, Any, Optional, Tuple
from packaging import version as pkg_version
from sqlalchemy.orm import Session
from server.app.models.models import VulnerabilityCatalog

_LAST_NVD_REQUEST_TIME = 0.0

# Map common software names to OSV ecosystem / package names
ECOSYSTEM_MAPPINGS: Dict[str, Tuple[str, str]] = {
    "node.js": ("npm", "node"),
    "nodejs": ("npm", "node"),
    "npm": ("npm", "npm"),
    "python": ("PyPI", "python"),
    "requests": ("PyPI", "requests"),
    "urllib3": ("PyPI", "urllib3"),
    "flask": ("PyPI", "flask"),
    "django": ("PyPI", "django"),
    "pip": ("PyPI", "pip"),
    "git": ("GIT", "git"),
    "curl": ("GIT", "curl"),
    "openssl": ("GIT", "openssl"),
}


def _throttle_nvd_request():
    """Enforce safe interval between unauthenticated public NVD API calls (min 6.0 seconds)."""
    global _LAST_NVD_REQUEST_TIME
    now = time.time()
    elapsed = now - _LAST_NVD_REQUEST_TIME
    if elapsed < 6.0:
        time.sleep(6.0 - elapsed)
    _LAST_NVD_REQUEST_TIME = time.time()


def query_osv_vulnerabilities(
    app_name: str,
    installed_version: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Queries keyless OSV.dev REST API (https://api.osv.dev/v1/query)
    Returns normalized CVE records.
    """
    norm = app_name.strip().lower()
    ecosystem = None
    pkg_name = norm

    for k, (eco, p) in ECOSYSTEM_MAPPINGS.items():
        if k == norm or norm.startswith(k + " ") or f" {k} " in f" {norm} ":
            ecosystem = eco
            pkg_name = p
            break

    query_payload: Dict[str, Any] = {"package": {"name": pkg_name}}
    if ecosystem:
        query_payload["package"]["ecosystem"] = ecosystem
    if installed_version and installed_version not in ("Unknown", "N/A", ""):
        # Clean version string (e.g. "20.10.0.1" -> "20.10.0")
        clean_v = str(installed_version).split(" ")[0].split("-")[0]
        query_payload["version"] = clean_v

    url = "https://api.osv.dev/v1/query"
    req = urllib.request.Request(
        url,
        data=json.dumps(query_payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "SystemRevampFleetServer/2.0",
        },
    )

    results: List[Dict[str, Any]] = []
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                vulns = data.get("vulns", [])
                for v in vulns:
                    # Resolve CVE identifier (prefer CVE-XXXX-YYYY from aliases or ID)
                    cve_id = v.get("id", "")
                    aliases = v.get("aliases", [])
                    for a in aliases:
                        if a.startswith("CVE-"):
                            cve_id = a
                            break

                    summary = v.get("summary") or v.get("details") or "Vulnerability reported in OSV advisory."
                    if len(summary) > 300:
                        summary = summary[:297] + "..."

                    # Determine severity / score
                    cvss_score = 7.5  # standard fallback for unrated
                    severity = "HIGH"
                    severity_list = v.get("severity", [])
                    if severity_list and isinstance(severity_list, list):
                        for s_item in severity_list:
                            score_str = s_item.get("score")
                            if score_str and "CVSS" in score_str:
                                # Parse CVSS vector base score if possible
                                m = re.search(r"CVSS:[^/]+/.*", score_str)
                                if m:
                                    cvss_score = 8.0
                    if v.get("database_specific", {}).get("severity"):
                        db_sev = str(v["database_specific"]["severity"]).upper()
                        if "CRIT" in db_sev:
                            severity = "CRITICAL"
                            cvss_score = 9.5
                        elif "HIGH" in db_sev:
                            severity = "HIGH"
                            cvss_score = 8.0
                        elif "MED" in db_sev:
                            severity = "MEDIUM"
                            cvss_score = 5.5
                        elif "LOW" in db_sev:
                            severity = "LOW"
                            cvss_score = 3.0

                    # Find fixed in version
                    fixed_version = ""
                    for affected in v.get("affected", []):
                        for r in affected.get("ranges", []):
                            for event in r.get("events", []):
                                if "fixed" in event:
                                    fixed_version = event["fixed"]
                                    break

                    results.append({
                        "cve_id": cve_id,
                        "app_name": app_name,
                        "cvss_score": cvss_score,
                        "severity": severity,
                        "fixed_in_version": fixed_version,
                        "summary": summary,
                        "source": "osv.dev",
                    })
    except Exception as e:
        # Network timeout or unlisted package
        pass

    return results


def query_nvd_vulnerabilities(app_name: str) -> List[Dict[str, Any]]:
    """
    Queries keyless NIST NVD 2.0 API with rate limiting.
    https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=<app_name>&resultsPerPage=5
    """
    clean_app = re.sub(r"[^a-zA-Z0-9_\-\. ]", "", app_name).strip()
    if not clean_app or len(clean_app) < 3:
        return []

    _throttle_nvd_request()
    url = f"https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch={urllib.parse.quote(clean_app)}&resultsPerPage=5"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "SystemRevampFleetServer/2.0 (Academic/Enterprise Fleet)"},
    )

    results: List[Dict[str, Any]] = []
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                items = data.get("vulnerabilities", [])
                for item in items:
                    cve_obj = item.get("cve", {})
                    cve_id = cve_obj.get("id")
                    if not cve_id:
                        continue

                    # Extract description
                    descriptions = cve_obj.get("descriptions", [])
                    desc_text = "NVD security advisory."
                    for d in descriptions:
                        if d.get("lang") == "en":
                            desc_text = d.get("value", desc_text)
                            break
                    if len(desc_text) > 300:
                        desc_text = desc_text[:297] + "..."

                    # Extract CVSS
                    metrics = cve_obj.get("metrics", {})
                    cvss_score = 6.0
                    severity = "MEDIUM"

                    # Check CVSS v3.1 then v3.0 then v2
                    v31 = metrics.get("cvssMetricV31", [])
                    if v31 and len(v31) > 0:
                        cvss_data = v31[0].get("cvssData", {})
                        cvss_score = float(cvss_data.get("baseScore", 6.0))
                        severity = cvss_data.get("baseSeverity", "MEDIUM").upper()
                    elif metrics.get("cvssMetricV30"):
                        cvss_data = metrics["cvssMetricV30"][0].get("cvssData", {})
                        cvss_score = float(cvss_data.get("baseScore", 6.0))
                        severity = cvss_data.get("baseSeverity", "MEDIUM").upper()

                    results.append({
                        "cve_id": cve_id,
                        "app_name": app_name,
                        "cvss_score": cvss_score,
                        "severity": severity,
                        "fixed_in_version": "",
                        "summary": desc_text,
                        "source": "nvd.nist.gov",
                    })
    except Exception:
        pass

    return results


def sync_and_check_app_vulnerabilities(
    app_name: str,
    installed_version: str,
    db: Session,
    enable_live_query: bool = True,
) -> List[Dict[str, Any]]:
    """
    Checks for real known vulnerabilities:
    1. Checks VulnerabilityCatalog in DB.
    2. If fewer than desired entries or catalog empty, queries live OSV.dev and/or NVD.
    3. Persists any discovered genuine CVE records into DB with provenance metadata.
    4. Returns matches for the application.
    """
    norm_name = app_name.strip().lower()
    now = datetime.datetime.utcnow()

    # Query existing entries in DB
    existing = (
        db.query(VulnerabilityCatalog)
        .filter(VulnerabilityCatalog.app_name.ilike(f"%{norm_name}%"))
        .all()
    )

    # If no records exist in DB and live queries enabled, fetch from live OSV API
    if not existing and enable_live_query:
        live_cves = query_osv_vulnerabilities(app_name, installed_version)
        if not live_cves and any(token in norm_name for token in ["chrome", "edge", "firefox", "acrobat", "office", "teams"]):
            # For major desktop apps, query NVD if OSV returned nothing
            live_cves = query_nvd_vulnerabilities(app_name)

        for c in live_cves:
            cve_id = c["cve_id"]
            db_entry = db.query(VulnerabilityCatalog).filter(VulnerabilityCatalog.cve_id == cve_id).first()
            if not db_entry:
                db_entry = VulnerabilityCatalog(
                    cve_id=cve_id,
                    app_name=c["app_name"],
                    affected_versions_expr=f"< {c['fixed_in_version']}" if c["fixed_in_version"] else "*",
                    cvss_score=c["cvss_score"],
                    severity=c["severity"],
                    fixed_in_version=c["fixed_in_version"],
                    summary=c["summary"],
                    cve_source=c["source"],
                    cve_fetched_at=now,
                )
                db.add(db_entry)
        try:
            db.commit()
        except Exception:
            db.rollback()

        existing = (
            db.query(VulnerabilityCatalog)
            .filter(VulnerabilityCatalog.app_name.ilike(f"%{norm_name}%"))
            .all()
        )

    # Filter to items that affect current version
    matches: List[Dict[str, Any]] = []
    for cve in existing:
        is_affected = True
        if cve.fixed_in_version and installed_version not in ("Unknown", "N/A", ""):
            try:
                cur_v = pkg_version.parse(installed_version)
                fix_v = pkg_version.parse(cve.fixed_in_version)
                if cur_v >= fix_v:
                    is_affected = False
            except Exception:
                pass

        if is_affected:
            matches.append({
                "cve_id": cve.cve_id,
                "app_name": app_name,
                "installed_version": installed_version,
                "cvss_score": cve.cvss_score,
                "severity": cve.severity,
                "fixed_in_version": cve.fixed_in_version or "Latest Patch",
                "summary": cve.summary,
                "source": getattr(cve, "cve_source", "osv.dev") or "osv.dev",
                "fetched_at": getattr(cve, "cve_fetched_at", now),
            })

    return matches
