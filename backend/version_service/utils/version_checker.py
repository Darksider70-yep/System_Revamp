import json
import re
import subprocess
import time
from pathlib import Path

import requests
from packaging import version

CACHE = {}
CACHE_TTL = 3600
_LATEST_DB = None


def _load_latest_db():
    global _LATEST_DB
    if _LATEST_DB is not None:
        return _LATEST_DB

    db_path = Path(__file__).resolve().parents[2] / "latest_versions.json"
    try:
        with db_path.open("r", encoding="utf-8") as f:
            raw = json.load(f)
            _LATEST_DB = {str(k).strip().lower(): str(v).strip() for k, v in raw.items()}
    except Exception:
        _LATEST_DB = {}

    return _LATEST_DB


def get_cached_version(key, fetch_func):
    now = time.time()
    if key in CACHE:
        val, ts = CACHE[key]
        if now - ts < CACHE_TTL:
            return val

    val = fetch_func(key)
    CACHE[key] = (val, now)
    return val


def _safe_parse(v):
    try:
        return version.parse(str(v).strip())
    except Exception:
        return None


# ------------------------
# PyPI
# ------------------------

def _check_pypi(package_name):
    try:
        resp = requests.get(f"https://pypi.org/pypi/{package_name}/json", timeout=5)
        if resp.status_code == 200:
            return resp.json()["info"]["version"]
    except Exception:
        pass
    return "Unknown"


def check_pypi(package_name):
    return get_cached_version(package_name, _check_pypi)


# ------------------------
# Winget
# ------------------------

def _check_winget(app_id):
    try:
        result = subprocess.run(
            [
                "winget",
                "show",
                "--id",
                app_id,
                "--exact",
                "--accept-source-agreements",
                "--disable-interactivity",
            ],
            capture_output=True,
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=8,
            check=False,
        )
        if result.returncode != 0:
            return "Unknown"

        match = re.search(r"Version:\s*([^\r\n]+)", result.stdout)
        if match:
            return match.group(1).strip()
    except Exception:
        pass
    return "Unknown"


def check_winget(app_id):
    return get_cached_version(app_id, _check_winget)


# ------------------------
# Risk Assessment
# ------------------------

def assess_risk(current, latest):
    if latest == "Unknown":
        return "Unknown"

    cur_v = _safe_parse(current)
    lat_v = _safe_parse(latest)
    if not cur_v or not lat_v:
        return "High"

    if cur_v >= lat_v:
        return "Low"
    if cur_v.major < lat_v.major:
        return "High"
    if cur_v.minor < lat_v.minor:
        return "Medium"
    return "Low"


# ------------------------
# Main Logic
# ------------------------

def _resolve_from_local_db(app_name):
    db = _load_latest_db()
    key = app_name.strip().lower()

    if key in db:
        return db[key]

    for known_name, known_version in db.items():
        if known_name in key or key in known_name:
            return known_version

    return "Unknown"


def _resolve_latest_version(app_name):
    normalized = app_name.lower()
    # For common runtimes, prefer live lookup first, then fallback to local DB.
    if "python" in normalized:
        live = check_winget("Python.Python.3")
        return live if live != "Unknown" else _resolve_from_local_db(app_name)
    if "node.js" in normalized or normalized.startswith("node"):
        live = check_winget("OpenJS.NodeJS")
        return live if live != "Unknown" else _resolve_from_local_db(app_name)
    if "java" in normalized:
        live = check_winget("Oracle.JDK.21")
        return live if live != "Unknown" else _resolve_from_local_db(app_name)

    latest = _resolve_from_local_db(app_name)
    if latest != "Unknown":
        return latest

    return "Unknown"


def check_latest_versions(installed_apps: dict):
    results = []

    for app, current_version in installed_apps.items():
        latest = _resolve_latest_version(app)
        current_parsed = _safe_parse(current_version)
        latest_parsed = _safe_parse(latest) if latest != "Unknown" else None

        if latest_parsed and current_parsed and current_parsed >= latest_parsed:
            status = "Up-to-date"
        elif latest_parsed and current_parsed:
            status = "Update Available"
        else:
            status = "Unverified"
            latest = current_version if str(current_version).strip().lower() != "unknown" else "N/A"

        risk = "Unknown" if status == "Unverified" else assess_risk(current_version, latest)

        results.append(
            {
                "name": app,
                "current": current_version,
                "latest": latest,
                "status": status,
                "riskLevel": risk,
            }
        )

    return results
