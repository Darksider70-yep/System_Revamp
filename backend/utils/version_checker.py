import requests
import subprocess
import re
import time
import json
from fastapi import FastAPI
from utils.scanner import get_installed_apps
from packaging import version
from pathlib import Path
from collections import defaultdict

app = FastAPI()

# --- Known app mapping ---
APP_NAME_MAPPING = {
    # Python interpreter
    "Python 3": {"type": "winget", "query": "Python.Python.3"},

    # Python packages
    "pip": {"type": "pypi", "query": "pip"},
    "setuptools": {"type": "pypi", "query": "setuptools"},

    # Node.js
    "Node.js": {"type": "winget", "query": "OpenJS.NodeJS"},

    # Java
    "Java SE Development Kit": {"type": "winget", "query": "Oracle.JDK.22"},

    # Microsoft runtimes (older hardcoded ones)
    "Microsoft Visual C++ 2019 X86 Debug Runtime": {"type": "hardcoded", "version": "14.29.30157"},
    "Microsoft Visual C++ 2019 X64 Debug Runtime": {"type": "hardcoded", "version": "14.29.30157"},

    # Example Winget apps
    "Microsoft Edge": {"type": "winget", "query": "Microsoft.Edge"},
    "Google Chrome": {"type": "winget", "query": "Google.Chrome"},

    # --- NEW: .NET families ---
    "Microsoft .NET Host - 6.0": {"type": "dotnet", "version_family": "6.0"},
    "Microsoft .NET Host - 8.0": {"type": "dotnet", "version_family": "8.0"},
    "Microsoft ASP.NET Core 6.0": {"type": "dotnet", "version_family": "6.0"},
    "Microsoft ASP.NET Core 8.0": {"type": "dotnet", "version_family": "8.0"},

    # --- NEW: Epic Games ---
    "Epic Games Launcher": {"type": "winget", "query": "EpicGames.EpicGamesLauncher"},
    "Epic Online Services": {"type": "winget", "query": "EpicGames.EpicOnlineServices"},

    # --- NEW: Visual C++ latest runtimes ---
    "Microsoft Visual C++ 2015-2022 X64 Minimum Runtime": {"type": "hardcoded", "version": "14.42.34438"},
    "Microsoft Visual C++ 2015-2022 X86 Minimum Runtime": {"type": "hardcoded", "version": "14.42.34438"},
}

# --- Cache ---
CACHE = {}
CACHE_TTL = 3600  # 1 hour


def get_cached_version(key: str, fetch_func) -> str:
    current_time = time.time()
    if key in CACHE:
        val, ts = CACHE[key]
        if current_time - ts < CACHE_TTL:
            return val
    val = fetch_func(key)
    CACHE[key] = (val, current_time)
    return val


# --- PyPI ---
def check_pypi(package_name: str) -> str:
    return get_cached_version(package_name, _check_pypi)


def _check_pypi(package_name: str) -> str:
    try:
        resp = requests.get(f"https://pypi.org/pypi/{package_name}/json", timeout=5)
        if resp.status_code == 200:
            return resp.json()["info"]["version"]
    except:
        pass
    return "Unknown"


# --- NPM ---
def check_npm(package_name: str) -> str:
    return get_cached_version(package_name, _check_npm)


def _check_npm(package_name: str) -> str:
    try:
        resp = requests.get(f"https://registry.npmjs.org/{package_name}/latest", timeout=5)
        if resp.status_code == 200:
            return resp.json()["version"]
    except:
        pass
    return "Unknown"


# --- Winget ---
def check_winget(app_id: str) -> str:
    return get_cached_version(app_id, _check_winget)


def _check_winget(app_id: str) -> str:
    # Try precise `winget show`
    try:
        result = subprocess.check_output(
            ["winget", "show", app_id],
            text=True,
            stderr=subprocess.DEVNULL
        )
        match = re.search(r"Version:\s*([\d\.]+)", result)
        if match:
            return match.group(1).strip()
    except Exception:
        pass

    # Fallback to `winget search`
    try:
        result = subprocess.check_output(
            ["winget", "search", "--name", app_id],
            text=True,
            stderr=subprocess.DEVNULL
        )
        matches = re.findall(r"\d+(?:\.\d+)+", result)
        if matches:
            return matches[-1]
    except Exception:
        pass

    return "Unknown"


# --- .NET checker ---
DOTNET_INDEX_URL = "https://dotnetcli.blob.core.windows.net/dotnet/release-metadata/releases-index.json"


def check_dotnet(version_family: str) -> str:
    """
    version_family: e.g. "6.0", "8.0"
    Returns latest runtime version from official Microsoft feeds
    """
    try:
        index = requests.get(DOTNET_INDEX_URL, timeout=5).json()
        for release in index["releases-index"]:
            if release["channel-version"].startswith(version_family):
                family_url = release["releases.json"]
                family_data = requests.get(family_url, timeout=5).json()
                # Pick highest runtime version that is not preview
                versions = [
                    rel["runtime"]["version"]
                    for rel in family_data.get("releases", [])
                    if "runtime" in rel and "version" in rel["runtime"]
                ]
                if versions:
                    return max(versions, key=version.parse)
    except Exception as e:
        print(f"[.NET checker] Failed for {version_family}: {e}")
    return "Unknown"


# --- Risk assessment with normalized versions ---
def assess_risk(current: str, latest: str) -> str:
    if latest == "Unknown" or current == "Unknown":
        return "Unknown ❓"

    try:
        cur_v = version.parse(current)
        lat_v = version.parse(latest)

        if cur_v >= lat_v:
            return "Low ✅"   # up-to-date or ahead
        elif cur_v.major < lat_v.major:
            return "High 🔴"  # major version gap
        elif cur_v.minor < lat_v.minor:
            return "Medium 🟠"  # minor version gap
        else:
            return "Low ⚠️"   # just patch behind
    except Exception:
        return "High ⚠️" if current != latest else "Low ✅"


# --- Main checker ---
def check_latest_versions(installed_apps: dict) -> list:
    results = []

    for app, current_version in installed_apps.items():
        latest = "Unknown"

        # --- Check mapping first ---
        if app in APP_NAME_MAPPING:
            mapping = APP_NAME_MAPPING[app]
            if mapping["type"] == "winget":
                latest = check_winget(mapping["query"])
            elif mapping["type"] == "pypi":
                latest = check_pypi(mapping["query"])
            elif mapping["type"] == "npm":
                latest = check_npm(mapping["query"])
            elif mapping["type"] == "hardcoded":
                latest = mapping["version"]
            elif mapping["type"] == "dotnet":
                latest = check_dotnet(mapping["version_family"])

        # --- Fallback rules ---
        if latest == "Unknown":
            if "Python" in app:
                if "pip" in app.lower() or "bootstrap" in app.lower():
                    latest = check_pypi("pip")
                else:
                    latest = check_winget("Python.Python.3")
            elif "Node.js" in app or "npm" in app:
                latest = check_npm("npm")
            elif "Java" in app:
                latest = "22.0.0"  # fallback
            else:
                latest = check_winget(app)

        # --- Status with version parsing ---
        try:
            if latest != "Unknown" and version.parse(current_version) >= version.parse(latest):
                status = "Up-to-date ✅"
            elif latest != "Unknown":
                status = "Update Available ⚠️"
            else:
                status = "Unknown ❓"
        except Exception:
            status = "Update Available ⚠️" if latest != "Unknown" else "Unknown ❓"

        risk = assess_risk(current_version, latest)

        results.append({
            "name": app,
            "current": current_version,
            "latest": latest,
            "status": status,
            "risk": risk
        })

    return results


# --- Logging for unknown apps (with frequency) ---
def log_unknown_apps(results: list):
    log_file = Path("unknown_apps.json")
    data = defaultdict(int)

    # Load existing
    if log_file.exists():
        try:
            data.update(json.loads(log_file.read_text(encoding="utf-8")))
        except:
            pass

    # Count unknowns
    for app in results:
        if app["latest"] == "Unknown":
            key = f"{app['name']} | Current: {app['current']}"
            data[key] += 1

    log_file.write_text(json.dumps(data, indent=2), encoding="utf-8")


# --- FastAPI Routes ---
@app.get("/")
def root():
    return {"message": "Driver & App Version Checker API running 🚀. Use /scan to check installed apps."}


@app.get("/scan")
def scan_and_check():
    installed_apps = get_installed_apps()
    installed_dict = {app["name"]: app["version"] for app in installed_apps}
    results = check_latest_versions(installed_dict)
    log_unknown_apps(results)  # log apps with unknown latest versions
    return {"apps": results}


@app.get("/unknown")
def get_unknowns():
    log_file = Path("unknown_apps.json")
    if not log_file.exists():
        return {"unknown_apps": []}
    try:
        data = json.loads(log_file.read_text(encoding="utf-8"))
    except:
        data = {}
    return {"unknown_apps": data}
