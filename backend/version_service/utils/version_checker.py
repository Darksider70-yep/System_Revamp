import requests
import subprocess
import re
import time
from packaging import version

CACHE = {}
CACHE_TTL = 3600


def get_cached_version(key, fetch_func):
    now = time.time()
    if key in CACHE:
        val, ts = CACHE[key]
        if now - ts < CACHE_TTL:
            return val

    val = fetch_func(key)
    CACHE[key] = (val, now)
    return val


# ------------------------
# PyPI
# ------------------------

def _check_pypi(package_name):
    try:
        resp = requests.get(f"https://pypi.org/pypi/{package_name}/json", timeout=5)
        if resp.status_code == 200:
            return resp.json()["info"]["version"]
    except:
        pass
    return "Unknown"


def check_pypi(package_name):
    return get_cached_version(package_name, _check_pypi)


# ------------------------
# Winget
# ------------------------

def _check_winget(app_id):
    try:
        result = subprocess.check_output(
            ["winget", "show", app_id],
            text=True,
            stderr=subprocess.DEVNULL
        )
        match = re.search(r"Version:\s*([\d\.]+)", result)
        if match:
            return match.group(1).strip()
    except:
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

    try:
        cur_v = version.parse(current)
        lat_v = version.parse(latest)

        if cur_v >= lat_v:
            return "Low"
        elif cur_v.major < lat_v.major:
            return "High"
        elif cur_v.minor < lat_v.minor:
            return "Medium"
        else:
            return "Low"
    except:
        return "High"


# ------------------------
# Main Logic
# ------------------------

def check_latest_versions(installed_apps: dict):
    results = []

    for app, current_version in installed_apps.items():
        latest = "Unknown"

        if "Python" in app:
            latest = check_winget("Python.Python.3")
        elif "Node.js" in app:
            latest = check_winget("OpenJS.NodeJS")
        else:
            latest = check_winget(app)

        if latest != "Unknown" and version.parse(current_version) >= version.parse(latest):
            status = "Up-to-date ✅"
        elif latest != "Unknown":
            status = "Update Available ⚠️"
        else:
            status = "Unknown ❓"

        risk = assess_risk(current_version, latest)

        results.append({
            "name": app,
            "current": current_version,
            "latest": latest,
            "status": status,
            "riskLevel": risk
        })

    return results
