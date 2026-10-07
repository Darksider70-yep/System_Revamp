import datetime
from packaging import version
from typing import Tuple, Optional
from sqlalchemy.orm import Session
from server.app.models.models import AppWingetMapping, VulnerabilityCatalog, LatestVersionCache

# Default seeded latest catalog
_SEED_LATEST_VERSIONS = {
    "google chrome": "128.0.6613.85",
    "python": "3.13.3",
    "python 3": "3.13.3",
    "node.js": "22.11.0",
    "nodejs": "22.11.0",
    "git": "2.47.0",
    "visual studio code": "1.95.0",
    "vlc media player": "3.0.21",
    "7-zip": "24.08",
    "zoom": "6.2.6",
    "docker desktop": "4.35.0",
    "postman": "11.18.0",
    "dbeaver": "24.2.4",
}


def safe_parse_version(v_str: str) -> Optional[version.Version]:
    if not v_str or str(v_str).strip().lower() in ("unknown", "n/a", "none", ""):
        return None
    try:
        # Strip trailing build metadata or extra tokens
        cleaned = str(v_str).strip().split(" ")[0].split("-")[0]
        return version.parse(cleaned)
    except Exception:
        return None


def calculate_risk_level(current_v_str: str, latest_v_str: str, is_vulnerable: bool = False) -> str:
    """
    Authoritative Rule Table:
    - Major jump >= 2 or known-vulnerable (CVSS >= 7.0): Critical
    - 1 major jump: High
    - Minor jump: Medium
    - Patch / up-to-date: Low
    - Unparseable: Unknown
    """
    if is_vulnerable:
        return "Critical"

    cur = safe_parse_version(current_v_str)
    lat = safe_parse_version(latest_v_str)

    if not cur or not lat:
        if str(current_v_str).strip().lower() == str(latest_v_str).strip().lower():
            return "Low"
        return "Unknown"

    if cur >= lat:
        return "Low"

    # Compare major
    major_diff = lat.major - cur.major
    if major_diff >= 2:
        return "Critical"
    elif major_diff == 1:
        return "High"

    # Compare minor
    minor_diff = lat.minor - cur.minor
    if minor_diff >= 1:
        return "Medium"

    # Patch difference or other
    return "Low"


def evaluate_software_risk(
    app_name: str,
    current_version: str,
    db: Optional[Session] = None,
) -> Tuple[str, str, str, Optional[datetime.datetime], bool]:
    """
    Resolves the latest version for an application and evaluates its risk level with provenance.
    Returns: (latest_version_str, risk_level_str, source_str, fetched_at, is_stale_bool)
    """
    norm_name = app_name.strip().lower()
    latest_ver = "Unknown"
    source = "unknown"
    fetched_at = None
    is_stale = False
    now = datetime.datetime.utcnow()

    # 1. Primary: query version connectors and DB cache
    if db:
        try:
            from server.app.services.version_connectors import resolve_latest_version
            latest_ver, source, fetched_at, is_stale = resolve_latest_version(app_name, db)
        except Exception as e:
            print(f"[RISK ENGINE] Error resolving version: {e}")

    # 2. Fallback to seed catalog if live lookup/cache has no entry
    if latest_ver == "Unknown":
        for k, v in _SEED_LATEST_VERSIONS.items():
            if k in norm_name or norm_name in k:
                latest_ver = v
                source = "offline_catalog"
                fetched_at = None
                is_stale = True
                break

    # 3. If still unknown, treat current installed version as baseline
    if latest_ver == "Unknown":
        latest_ver = current_version
        source = "installed_baseline"
        fetched_at = now
        is_stale = False

    # Check vulnerability catalog
    is_vuln = False
    if db:
        vuln = db.query(VulnerabilityCatalog).filter(
            VulnerabilityCatalog.app_name.ilike(f"%{norm_name}%"),
            VulnerabilityCatalog.cvss_score >= 7.0,
        ).first()
        if vuln:
            is_vuln = True

    risk = calculate_risk_level(current_version, latest_ver, is_vulnerable=is_vuln)
    return latest_ver, risk, source, fetched_at, is_stale
