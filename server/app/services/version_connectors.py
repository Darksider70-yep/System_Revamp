import datetime
import json
import re
import urllib.request
import urllib.error
from typing import Optional, Tuple, Dict
from sqlalchemy.orm import Session
from server.app.models.models import LatestVersionCache

# Map common normalized desktop/server app names to endoflife.date product identifiers
ENDOFLIFE_PRODUCT_MAP: Dict[str, str] = {
    "python": "python",
    "python 3": "python",
    "node.js": "nodejs",
    "nodejs": "nodejs",
    "node": "nodejs",
    "git": "git",
    "docker": "docker-engine",
    "docker desktop": "docker-engine",
    "go": "go",
    "golang": "go",
    "postgresql": "postgresql",
    "redis": "redis",
    "mongodb": "mongodb",
    "nginx": "nginx",
    "apache": "apache",
    "php": "php",
    "ruby": "ruby",
    "mariadb": "mariadb",
    "mysql": "mysql",
    "terraform": "terraform",
    "kubernetes": "kubernetes",
    "ansible": "ansible",
}


def _fetch_from_endoflife(product_id: str) -> Optional[str]:
    """Queries endoflife.date REST API for authoritative latest stable version."""
    url = f"https://endoflife.date/api/{product_id}.json"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "SystemRevampFleetServer/2.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                if isinstance(data, list) and len(data) > 0:
                    # Return latest release from the most recent active release cycle
                    for cycle in data:
                        latest = cycle.get("latest")
                        if latest:
                            return str(latest).strip()
    except Exception:
        pass
    return None


def _fetch_from_pypi(package_name: str) -> Optional[str]:
    """Queries PyPI JSON API for latest package release version."""
    clean_pkg = re.sub(r"[^a-zA-Z0-9_\-\.]", "", package_name).strip().lower()
    url = f"https://pypi.org/pypi/{clean_pkg}/json"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "SystemRevampFleetServer/2.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                version = data.get("info", {}).get("version")
                if version:
                    return str(version).strip()
    except Exception:
        pass
    return None


def fetch_live_latest_version(app_name: str) -> Optional[Tuple[str, str]]:
    """
    Attempts to fetch the real latest version from live authoritative public APIs.
    Returns: (latest_version, source_name) or None if not found/offline.
    """
    norm = app_name.strip().lower()

    # 1. Check endoflife.date mapping
    matched_product = None
    for k, v in ENDOFLIFE_PRODUCT_MAP.items():
        if k == norm or norm.startswith(k + " ") or f" {k} " in f" {norm} ":
            matched_product = v
            break

    if matched_product:
        ver = _fetch_from_endoflife(matched_product)
        if ver:
            return ver, "endoflife.date"

    # 2. Check PyPI if looks like a python tool or library
    if any(token in norm for token in ["python", "pip", "py", "pytest", "fastapi", "requests", "django", "flask"]):
        pypi_candidate = norm.replace("python-", "").replace("python ", "").strip()
        ver = _fetch_from_pypi(pypi_candidate)
        if ver:
            return ver, "pypi.org"

    return None


def resolve_latest_version(
    app_name: str,
    db: Session,
    force_refresh: bool = False,
) -> Tuple[str, str, Optional[datetime.datetime], bool]:
    """
    Resolves the latest version for an application:
    1. Checks DB cache.
    2. If missing or expired (ttl_seconds > 86400), fetches live from upstream API.
    3. If live succeeds, updates DB cache.
    4. If live fails, uses cached value marked is_stale=True.
    Returns: (latest_version, source, fetched_at, is_stale)
    """
    norm_name = app_name.strip().lower()
    now = datetime.datetime.utcnow()

    cached = (
        db.query(LatestVersionCache)
        .filter(LatestVersionCache.app_name == norm_name)
        .first()
    )

    # If cached and not expired and not forcing refresh
    if cached and not force_refresh:
        age_seconds = (now - cached.fetched_at).total_seconds() if cached.fetched_at else 999999
        if age_seconds < cached.ttl_seconds:
            return cached.latest_version, cached.source, cached.fetched_at, False

    # Attempt live upstream fetch
    live_result = fetch_live_latest_version(app_name)
    if live_result:
        latest_ver, source = live_result
        if cached:
            cached.latest_version = latest_ver
            cached.source = source
            cached.fetched_at = now
            cached.is_stale = False
        else:
            cached = LatestVersionCache(
                app_name=norm_name,
                latest_version=latest_ver,
                source=source,
                fetched_at=now,
                ttl_seconds=86400,
                is_stale=False,
            )
            db.add(cached)
        try:
            db.commit()
        except Exception:
            db.rollback()
        return latest_ver, source, now, False

    # Live lookup unavailable or unknown app
    if cached:
        # Return stale cached entry with honest stale flag
        return cached.latest_version, cached.source, cached.fetched_at, True

    # Unknown
    return "Unknown", "unknown", now, False
