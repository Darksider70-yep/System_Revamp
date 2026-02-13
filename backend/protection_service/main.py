import hashlib
import os
import re
import subprocess
from pathlib import Path
from typing import Dict, List

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Software Protection Service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VT_API_BASE = "https://www.virustotal.com/api/v3/files"
VT_CACHE: Dict[str, dict] = {}
SIGNATURE_CACHE: Dict[str, str] = {}
VT_KEY_FALLBACK_PATH = Path.home() / ".system_revamp_vt_api_key"

KNOWN_EXECUTABLES = {
    "google chrome": ["chrome.exe"],
    "github desktop": ["githubdesktop.exe"],
    "git": ["git.exe"],
    "dropbox": ["dropbox.exe"],
    "dbeaver": ["dbeaver.exe"],
    "epic games launcher": ["epicgameslauncher.exe"],
    "aws command line interface": ["aws.exe"],
    "go programming language": ["go.exe"],
    "fast node manager": ["fnm.exe"],
}


def _read_reg_value(reg_key, value_name):
    import winreg

    try:
        value, _ = winreg.QueryValueEx(reg_key, value_name)
        return value
    except OSError:
        return None


def _sanitize_exe_path(raw_value: str):
    if not raw_value:
        return None

    value = str(raw_value).strip().strip('"')
    if ",0" in value:
        value = value.split(",0", 1)[0]
    if ".exe" in value.lower():
        idx = value.lower().find(".exe")
        value = value[: idx + 4]
    value = os.path.expandvars(value)
    return value if os.path.isfile(value) else None


def _find_exe_from_install_location(path: str):
    if not path:
        return None
    path = str(path).strip().strip('"')
    if not os.path.isdir(path):
        return None
    try:
        for entry in os.listdir(path):
            full_path = os.path.join(path, entry)
            if os.path.isfile(full_path) and entry.lower().endswith(".exe"):
                return full_path
    except OSError:
        return None
    return None


def _extract_exe_from_command(raw_value: str):
    if not raw_value:
        return None

    value = os.path.expandvars(str(raw_value).strip())
    quoted = re.search(r'"([^"]+?\.exe)"', value, flags=re.IGNORECASE)
    if quoted:
        path = quoted.group(1)
        return path if os.path.isfile(path) else None

    bare = re.search(r"([A-Za-z]:\\[^ ]+?\.exe)", value, flags=re.IGNORECASE)
    if bare:
        path = bare.group(1)
        return path if os.path.isfile(path) else None
    return None


def _find_exe_from_path_by_name(app_name: str):
    name = app_name.strip().lower()
    candidates = []
    for key, exes in KNOWN_EXECUTABLES.items():
        if key in name:
            candidates.extend(exes)

    for exe in candidates:
        try:
            result = subprocess.run(
                ["where", exe],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            if result.returncode == 0:
                first = (result.stdout or "").splitlines()
                if first:
                    path = first[0].strip()
                    if os.path.isfile(path):
                        return path
        except Exception:
            continue
    return None


def _get_authenticode_status(file_path: str):
    if file_path in SIGNATURE_CACHE:
        return SIGNATURE_CACHE[file_path]

    try:
        escaped_path = file_path.replace("'", "''")
        cmd = (
            f"(Get-AuthenticodeSignature -FilePath '{escaped_path}').Status"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", cmd],
            capture_output=True,
            text=True,
            timeout=6,
            check=False,
        )
        status = (result.stdout or "").strip() or "UnknownError"
    except Exception:
        status = "UnknownError"

    SIGNATURE_CACHE[file_path] = status
    return status


def _scan_installed_apps_with_paths():
    import winreg

    uninstall_paths = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ]
    hives = [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]

    results = []
    seen = set()

    for hive in hives:
        for uninstall_path in uninstall_paths:
            try:
                with winreg.OpenKey(hive, uninstall_path) as uninstall_key:
                    key_count, _, _ = winreg.QueryInfoKey(uninstall_key)
                    for idx in range(key_count):
                        sub_key_name = winreg.EnumKey(uninstall_key, idx)
                        try:
                            with winreg.OpenKey(uninstall_key, sub_key_name) as app_key:
                                name = _read_reg_value(app_key, "DisplayName")
                                version = _read_reg_value(app_key, "DisplayVersion") or "Unknown"
                                if not name:
                                    continue

                                display_icon = _read_reg_value(app_key, "DisplayIcon")
                                uninstall_string = _read_reg_value(app_key, "UninstallString")
                                install_location = _read_reg_value(app_key, "InstallLocation")

                                exe_path = _sanitize_exe_path(display_icon)
                                if not exe_path:
                                    exe_path = _sanitize_exe_path(uninstall_string)
                                if not exe_path:
                                    exe_path = _extract_exe_from_command(uninstall_string)
                                if not exe_path:
                                    exe_path = _find_exe_from_install_location(install_location)
                                if not exe_path:
                                    exe_path = _find_exe_from_path_by_name(str(name))

                                identity = (str(name).strip().lower(), str(version).strip().lower(), str(exe_path).lower())
                                if identity in seen:
                                    continue
                                seen.add(identity)

                                results.append(
                                    {
                                        "name": str(name).strip(),
                                        "version": str(version).strip(),
                                        "path": exe_path,
                                    }
                                )
                        except OSError:
                            continue
            except OSError:
                continue

    results.sort(key=lambda item: item["name"].lower())
    return results


def _sha256_file(path: str):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _vt_lookup_file_hash(file_hash: str):
    if file_hash in VT_CACHE:
        return VT_CACHE[file_hash]

    api_key = os.getenv("VT_API_KEY", "").strip()
    if not api_key and VT_KEY_FALLBACK_PATH.exists():
        try:
            api_key = VT_KEY_FALLBACK_PATH.read_text(encoding="utf-8").strip()
        except Exception:
            api_key = ""
    if not api_key:
        return {"status": "NoApiKey"}

    try:
        resp = requests.get(
            f"{VT_API_BASE}/{file_hash}",
            headers={"x-apikey": api_key},
            timeout=15,
        )
        if resp.status_code == 404:
            data = {"status": "NotFound"}
        elif resp.status_code == 200:
            data = {"status": "OK", "payload": resp.json()}
        else:
            data = {"status": "Error", "code": resp.status_code}
    except Exception as e:
        data = {"status": "Error", "error": str(e)}

    VT_CACHE[file_hash] = data
    return data


def _to_threat_result(app_name: str, app_version: str, file_path: str):
    if not file_path or not os.path.isfile(file_path):
        return {
            "name": app_name,
            "version": app_version,
            "path": file_path,
            "sha256": None,
            "threatStatus": "Unknown",
            "threatScore": 40,
            "summary": "Executable path not found.",
            "source": "Local",
            "vtLink": None,
        }

    try:
        file_hash = _sha256_file(file_path)
    except Exception as e:
        return {
            "name": app_name,
            "version": app_version,
            "path": file_path,
            "sha256": None,
            "threatStatus": "Error",
            "threatScore": 50,
            "summary": f"Unable to hash file: {e}",
            "source": "Local",
            "vtLink": None,
        }

    vt = _vt_lookup_file_hash(file_hash)
    vt_link = f"https://www.virustotal.com/gui/file/{file_hash}"

    if vt.get("status") == "NoApiKey":
        sig_status = _get_authenticode_status(file_path)
        if sig_status == "Valid":
            local_status = "Clean"
            local_score = 20
            local_msg = "VT_API_KEY not configured. File has a valid Authenticode signature."
        elif sig_status in {"NotSigned", "HashMismatch"}:
            local_status = "Suspicious"
            local_score = 65
            local_msg = f"VT_API_KEY not configured. Authenticode status is {sig_status}."
        else:
            local_status = "Unknown"
            local_score = 35
            local_msg = f"VT_API_KEY not configured. Authenticode status is {sig_status}."

        return {
            "name": app_name,
            "version": app_version,
            "path": file_path,
            "sha256": file_hash,
            "threatStatus": local_status,
            "threatScore": local_score,
            "summary": local_msg,
            "source": "Local + VirusTotal",
            "vtLink": vt_link,
        }

    if vt.get("status") == "NotFound":
        return {
            "name": app_name,
            "version": app_version,
            "path": file_path,
            "sha256": file_hash,
            "threatStatus": "Unknown",
            "threatScore": 30,
            "summary": "Hash not found in VirusTotal.",
            "source": "VirusTotal",
            "vtLink": vt_link,
        }

    if vt.get("status") != "OK":
        return {
            "name": app_name,
            "version": app_version,
            "path": file_path,
            "sha256": file_hash,
            "threatStatus": "Error",
            "threatScore": 45,
            "summary": f"VirusTotal error: {vt}",
            "source": "VirusTotal",
            "vtLink": vt_link,
        }

    payload = vt["payload"]
    stats = payload.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
    malicious = int(stats.get("malicious", 0))
    suspicious = int(stats.get("suspicious", 0))
    harmless = int(stats.get("harmless", 0))
    undetected = int(stats.get("undetected", 0))

    if malicious > 0:
        status = "Malicious"
        score = 90
    elif suspicious > 0:
        status = "Suspicious"
        score = 70
    elif harmless + undetected > 0:
        status = "Clean"
        score = 10
    else:
        status = "Unknown"
        score = 35

    summary = (
        f"Engines: malicious={malicious}, suspicious={suspicious}, "
        f"harmless={harmless}, undetected={undetected}"
    )
    return {
        "name": app_name,
        "version": app_version,
        "path": file_path,
        "sha256": file_hash,
        "threatStatus": status,
        "threatScore": score,
        "summary": summary,
        "source": "VirusTotal",
        "vtLink": vt_link,
    }


@app.get("/")
def root():
    return {"message": "Software Protection Service running"}


@app.get("/protection/debug-key")
def debug_key_state():
    env_key = os.getenv("VT_API_KEY", "").strip()
    file_key = ""
    if VT_KEY_FALLBACK_PATH.exists():
        try:
            file_key = VT_KEY_FALLBACK_PATH.read_text(encoding="utf-8").strip()
        except Exception:
            file_key = ""
    return {
        "envKeyLen": len(env_key),
        "fileKeyLen": len(file_key),
        "fallbackPath": str(VT_KEY_FALLBACK_PATH),
    }


@app.post("/protection/scan")
def protection_scan(payload: dict = None):
    payload = payload if isinstance(payload, dict) else {}
    requested_apps = payload.get("apps", [])
    max_apps = int(payload.get("maxApps", 15))
    max_apps = max(1, min(max_apps, 30))

    installed = _scan_installed_apps_with_paths()
    if requested_apps and isinstance(requested_apps, list):
        requested_names = set()
        for item in requested_apps:
            if isinstance(item, dict):
                name = str(item.get("name", "")).strip().lower()
            else:
                name = str(item).strip().lower()
            if name:
                requested_names.add(name)

        filtered = []
        for app_item in installed:
            app_name = app_item["name"].strip().lower()
            if any(req in app_name or app_name in req for req in requested_names):
                filtered.append(app_item)
        installed = filtered

    installed = installed[:max_apps]
    results = [
        _to_threat_result(
            app_name=item.get("name", "Unknown"),
            app_version=item.get("version", "Unknown"),
            file_path=item.get("path"),
        )
        for item in installed
    ]

    summary = {
        "malicious": sum(1 for item in results if item["threatStatus"] == "Malicious"),
        "suspicious": sum(1 for item in results if item["threatStatus"] == "Suspicious"),
        "clean": sum(1 for item in results if item["threatStatus"] == "Clean"),
        "unknown": sum(1 for item in results if item["threatStatus"] == "Unknown"),
        "error": sum(1 for item in results if item["threatStatus"] == "Error"),
    }

    return {
        "results": results,
        "summary": summary,
        "scannedCount": len(results),
        "note": "Set VT_API_KEY environment variable to enable live VirusTotal reputation.",
    }
