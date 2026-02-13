from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Query
from fastapi.responses import StreamingResponse
from fastapi.responses import Response
from utils.scanner import get_installed_apps
from pathlib import Path
import io
import json
import time
import zipfile
from typing import Dict, List

app = FastAPI(
    title="System Scanner Service",
    version="1.0.0"
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
OFFLINE_CACHE_DIR = BACKEND_ROOT / "cache" / "offline_packages"
OFFLINE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
LAST_SNAPSHOT_PATH = OFFLINE_CACHE_DIR / "last_scan_snapshot.json"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Scanner Service running 🚀"}


@app.get("/scan")
def scan_system():
    try:
        apps = get_installed_apps()
        return {"apps": apps}
    except Exception as e:
        return {"error": str(e)}


def _read_json(path: Path):
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def _normalize_apps(apps: List[Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    normalized = {}
    for app in apps:
        name = str(app.get("name", "")).strip()
        version = str(app.get("version", "Unknown")).strip()
        if not name:
            continue
        normalized[name.lower()] = {"name": name, "version": version}
    return normalized


def _compute_delta(previous_apps: List[Dict[str, str]], current_apps: List[Dict[str, str]]):
    prev_map = _normalize_apps(previous_apps)
    curr_map = _normalize_apps(current_apps)

    prev_keys = set(prev_map.keys())
    curr_keys = set(curr_map.keys())

    added = [curr_map[k] for k in sorted(curr_keys - prev_keys)]
    removed = [prev_map[k] for k in sorted(prev_keys - curr_keys)]

    changed = []
    for key in sorted(curr_keys & prev_keys):
        if curr_map[key]["version"] != prev_map[key]["version"]:
            changed.append(
                {
                    "name": curr_map[key]["name"],
                    "previousVersion": prev_map[key]["version"],
                    "currentVersion": curr_map[key]["version"],
                }
            )

    return {
        "added": added,
        "removed": removed,
        "changed": changed,
        "totalChanges": len(added) + len(removed) + len(changed),
    }


@app.get("/generate-offline-package")
def generate_offline_package(mode: str = Query(default="full")):
    try:
        apps = get_installed_apps()
        mode = str(mode).strip().lower()
        if mode not in {"full", "delta"}:
            mode = "full"

        versions_path = BACKEND_ROOT / "latest_versions.json"
        drivers_path = BACKEND_ROOT / "missing_drivers.json"
        latest_versions = _read_json(versions_path)
        missing_drivers = _read_json(drivers_path)

        previous_snapshot = _read_json(LAST_SNAPSHOT_PATH) if LAST_SNAPSHOT_PATH.exists() else {}
        previous_apps = previous_snapshot.get("apps", []) if isinstance(previous_snapshot, dict) else []
        delta = _compute_delta(previous_apps, apps)

        manifest = {
            "generatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "packageMode": mode,
            "appCount": len(apps),
            "hasLatestVersions": bool(latest_versions),
            "hasDriverSnapshot": bool(missing_drivers),
            "deltaChanges": delta["totalChanges"] if mode == "delta" else 0,
        }

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("manifest.json", json.dumps(manifest, indent=2))
            if mode == "full":
                archive.writestr("installed_apps.json", json.dumps({"apps": apps}, indent=2))
            else:
                archive.writestr("delta_apps.json", json.dumps(delta, indent=2))
                archive.writestr("current_apps.json", json.dumps({"apps": apps}, indent=2))
            archive.writestr("latest_versions.json", json.dumps(latest_versions, indent=2))
            archive.writestr("missing_drivers.json", json.dumps(missing_drivers, indent=2))

        _write_json(
            LAST_SNAPSHOT_PATH,
            {
                "generatedAt": manifest["generatedAt"],
                "apps": apps,
            },
        )

        buffer.seek(0)
        filename = "offline_update_package.zip" if mode == "full" else "offline_delta_package.zip"
        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
        return StreamingResponse(buffer, media_type="application/zip", headers=headers)
    except Exception as e:
        return {"error": str(e)}


def _guess_winget_id(app_name: str):
    name = app_name.lower()
    known = {
        "node.js": "OpenJS.NodeJS",
        "python": "Python.Python.3",
        "java": "Oracle.JDK.21",
        "google chrome": "Google.Chrome",
        "github desktop": "GitHub.GitHubDesktop",
        "git": "Git.Git",
        "dropbox": "Dropbox.Dropbox",
        "dbeaver": "DBeaver.DBeaver",
        "epic games launcher": "EpicGames.EpicGamesLauncher",
    }
    for key, winget_id in known.items():
        if key in name:
            return winget_id
    return None


@app.post("/generate-remediation-script")
def generate_remediation_script(payload: dict):
    try:
        apps = payload.get("apps", []) if isinstance(payload, dict) else []
        drivers = payload.get("drivers", []) if isinstance(payload, dict) else []

        app_names = []
        for item in apps:
            if isinstance(item, dict):
                name = str(item.get("name", "")).strip()
            else:
                name = str(item).strip()
            if name:
                app_names.append(name)

        driver_names = []
        for item in drivers:
            if isinstance(item, dict):
                driver_name = str(item.get("Driver Name", "")).strip()
            else:
                driver_name = str(item).strip()
            if driver_name:
                driver_names.append(driver_name)

        lines = [
            "# System Revamp - Remediation Script",
            f"# Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            "Set-StrictMode -Version Latest",
            "$ErrorActionPreference = 'Continue'",
            "",
            "Write-Host 'Starting safe remediation steps...' -ForegroundColor Cyan",
            "",
            "# ----- Application Updates (winget) -----",
        ]

        if app_names:
            for name in app_names:
                winget_id = _guess_winget_id(name)
                if winget_id:
                    lines.extend(
                        [
                            f"Write-Host 'Updating {name} ({winget_id})' -ForegroundColor Yellow",
                            (
                                f"winget upgrade --id \"{winget_id}\" --exact "
                                "--accept-package-agreements --accept-source-agreements "
                                "--disable-interactivity"
                            ),
                            "",
                        ]
                    )
                else:
                    lines.extend(
                        [
                            f"# No safe winget mapping found for: {name}",
                            f"# Review manually: winget search --name \"{name}\"",
                            "",
                        ]
                    )
        else:
            lines.append("# No applications selected.")
            lines.append("")

        lines.extend(
            [
                "# ----- Driver Remediation Guidance -----",
                "Write-Host 'Checking Windows Update for driver updates...' -ForegroundColor Yellow",
                "UsoClient StartScan",
                "UsoClient StartDownload",
                "UsoClient StartInstall",
                "",
            ]
        )

        if driver_names:
            for driver in driver_names:
                lines.append(f"# Validate/install driver manually if still missing: {driver}.sys")
        else:
            lines.append("# No drivers selected.")

        lines.extend(
            [
                "",
                "Write-Host 'Remediation script completed.' -ForegroundColor Green",
            ]
        )

        script = "\n".join(lines)
        headers = {
            "Content-Disposition": 'attachment; filename="system_revamp_remediation.ps1"'
        }
        return Response(content=script, media_type="text/plain; charset=utf-8", headers=headers)
    except Exception as e:
        return {"error": str(e)}
