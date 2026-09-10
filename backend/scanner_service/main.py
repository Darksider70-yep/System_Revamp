import io
import json
from pathlib import Path
import sys
import time
from typing import Dict, List
import zipfile

from fastapi import FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

_SERVICE_DIR = Path(__file__).resolve().parent
_BACKEND_ROOT = _SERVICE_DIR.parent
if str(_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICE_DIR))
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

try:
    from utils.scanner import get_installed_apps
except ModuleNotFoundError:
    from backend.scanner_service.utils.scanner import get_installed_apps

try:
    from routes.simulate_attack import router as simulate_attack_router
except ModuleNotFoundError:
    try:
        from backend.routes.simulate_attack import router as simulate_attack_router
    except Exception:
        simulate_attack_router = None

try:
    from common import db
    from common.auth import verify_internal_key
except ModuleNotFoundError:
    try:
        from backend.common import db
        from backend.common.auth import verify_internal_key
    except Exception:
        db = None
        verify_internal_key = None

app = FastAPI(
    title="System Scanner Service",
    version="1.0.0"
)

if db:
    db.init_db()

if simulate_attack_router:
    app.include_router(simulate_attack_router)

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
async def scan_system(request: Request):
    if verify_internal_key:
        await verify_internal_key(request)
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
async def generate_offline_package(request: Request, mode: str = Query(default="full")):
    if verify_internal_key:
        await verify_internal_key(request)
    try:
        apps = get_installed_apps()
        mode = str(mode).strip().lower()
        if mode not in {"full", "delta"}:
            mode = "full"

        # Load latest versions (PostgreSQL preferred, fallback to JSON file)
        latest_versions = {}
        if db:
            latest_versions = db.get_all_latest_versions()
        if not latest_versions:
            versions_path = BACKEND_ROOT / "latest_versions.json"
            latest_versions = _read_json(versions_path)

        # Load missing drivers snapshot (PostgreSQL preferred, fallback to JSON file)
        missing_drivers = []
        if db:
            driver_history = db.get_latest_driver_history()
            if driver_history:
                missing_drivers = driver_history.get("missing_drivers", [])
        if not missing_drivers:
            drivers_path = BACKEND_ROOT / "missing_drivers.json"
            missing_drivers = _read_json(drivers_path)

        # Load previous scan snapshot (PostgreSQL preferred, fallback to last_scan_snapshot.json)
        previous_apps = []
        if db:
            prev_snap = db.get_latest_scan_snapshot()
            if prev_snap:
                previous_apps = prev_snap.get("apps", [])
        if not previous_apps and LAST_SNAPSHOT_PATH.exists():
            previous_snapshot = _read_json(LAST_SNAPSHOT_PATH)
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

        # Persist to DB
        if db:
            db.save_scan_snapshot(mode=mode, manifest=manifest, apps=apps, delta=delta)

        # Also backup to JSON file
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
async def generate_remediation_script(request: Request, payload: dict):
    if verify_internal_key:
        await verify_internal_key(request)
    try:
        apps = payload.get("apps", []) if isinstance(payload, dict) else []
        drivers = payload.get("drivers", []) if isinstance(payload, dict) else []
        dry_run = bool(payload.get("dryRun", False)) if isinstance(payload, dict) else False

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

        gen_time = time.strftime("%Y-%m-%d %H:%M:%S")

        if dry_run:
            # -------------------------------------------------------------
            # DRY-RUN PREVIEW SCRIPT
            # -------------------------------------------------------------
            lines = [
                "# ========================================================",
                "# System Revamp - Remediation Script [PREVIEW / DRY-RUN]",
                f"# Generated: {gen_time}",
                "# Mode: DRY-RUN (No changes will be applied to the system)",
                "# ========================================================",
                "Set-StrictMode -Version Latest",
                "$ErrorActionPreference = 'Continue'",
                "",
                "Write-Host '[DRY RUN] Starting Remediation Preview Mode...' -ForegroundColor Cyan",
                "Write-Host '[DRY RUN] No packages or drivers will be modified during this run.' -ForegroundColor DarkCyan",
                "",
                "# ----- Application Updates Preview -----",
            ]

            if app_names:
                for name in app_names:
                    winget_id = _guess_winget_id(name)
                    if winget_id:
                        cmd = (
                            f"winget upgrade --id \"{winget_id}\" --exact "
                            "--accept-package-agreements --accept-source-agreements "
                            "--disable-interactivity"
                        )
                        lines.extend([
                            f"Write-Host '[DRY RUN] Plan: Upgrade {name}' -ForegroundColor Yellow",
                            f"Write-Host '          Command: {cmd}' -ForegroundColor Gray",
                            "",
                        ])
                    else:
                        lines.extend([
                            f"Write-Host '[DRY RUN] Plan: Manual review required for {name} (No exact Winget mapping)' -ForegroundColor DarkYellow",
                            f"Write-Host '          Suggested: winget search --name \"{name}\"' -ForegroundColor Gray",
                            "",
                        ])
            else:
                lines.append("# No applications selected for preview.")
                lines.append("")

            lines.extend([
                "# ----- Driver Remediation Preview -----",
                "Write-Host '[DRY RUN] Plan: Trigger Windows Update PnP Driver Scan' -ForegroundColor Yellow",
                "Write-Host '          Commands: UsoClient StartScan -> StartDownload -> StartInstall' -ForegroundColor Gray",
                "",
            ])

            if driver_names:
                for driver in driver_names:
                    lines.append(f"Write-Host '[DRY RUN] Unresolved hardware driver: {driver}.sys' -ForegroundColor DarkYellow")
            else:
                lines.append("# No specific missing drivers selected.")

            lines.extend([
                "",
                "Write-Host '[DRY RUN] Preview complete. To execute real upgrades, generate script without Dry-Run.' -ForegroundColor Green",
            ])

            script = "\n".join(lines)
            headers = {
                "Content-Disposition": 'attachment; filename="system_revamp_remediation_dryrun.ps1"'
            }
            return Response(content=script, media_type="text/plain; charset=utf-8", headers=headers)

        else:
            # -------------------------------------------------------------
            # EXECUTION SCRIPT WITH PERSISTENT AUDIT LOGGING
            # -------------------------------------------------------------
            lines = [
                "# ========================================================",
                "# System Revamp - Unattended Remediation Script",
                f"# Generated: {gen_time}",
                "# Mode: LIVE EXECUTION (Logs written to ./logs/ directory)",
                "# ========================================================",
                "Set-StrictMode -Version Latest",
                "$ErrorActionPreference = 'Continue'",
                "",
                "# Setup execution log file next to script",
                "$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }",
                "$LogDir = Join-Path $ScriptDir 'logs'",
                "if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }",
                "$LogFile = Join-Path $LogDir ('system_revamp_remediation_' + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.log')",
                "",
                "function Log-Message {",
                "    param([string]$Message, [string]$Level = 'INFO')",
                "    $Stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'",
                "    $Formatted = \"[$Stamp] [$Level] $Message\"",
                "    Add-Content -Path $LogFile -Value $Formatted",
                "}",
                "",
                "function Execute-LoggedCommand {",
                "    param([string]$Command, [string]$Description)",
                "    Write-Host \"Executing: $Description\" -ForegroundColor Yellow",
                "    Log-Message \"Starting: $Description | Command: $Command\" 'INFO'",
                "    ",
                "    $Output = Invoke-Expression $Command 2>&1",
                "    $ExitCode = $LASTEXITCODE",
                "    ",
                "    if ($Output) {",
                "        $OutputStr = ($Output | Out-String).Trim()",
                "        Write-Host $OutputStr",
                "        Log-Message \"Output:`n$OutputStr\" 'DEBUG'",
                "    }",
                "    ",
                "    if ($null -eq $ExitCode -or $ExitCode -eq 0) {",
                "        Log-Message \"Completed: $Description (ExitCode: 0)\" 'SUCCESS'",
                "        Write-Host \"Success: $Description\" -ForegroundColor Green",
                "    } else {",
                "        Log-Message \"Failed: $Description (ExitCode: $ExitCode)\" 'ERROR'",
                "        Write-Host \"Warning/Error (ExitCode $ExitCode): $Description\" -ForegroundColor Red",
                "    }",
                "    Write-Host ''",
                "}",
                "",
                "Write-Host 'Starting system remediation...' -ForegroundColor Cyan",
                "Log-Message '=== System Revamp Remediation Session Started ===' 'INFO'",
                "",
                "# ----- Application Updates (winget) -----",
            ]

            if app_names:
                for name in app_names:
                    winget_id = _guess_winget_id(name)
                    if winget_id:
                        cmd = (
                            f"winget upgrade --id \"{winget_id}\" --exact "
                            "--accept-package-agreements --accept-source-agreements "
                            "--disable-interactivity"
                        )
                        lines.extend([
                            f"Execute-LoggedCommand -Command '{cmd}' -Description 'Upgrade {name} ({winget_id})'",
                        ])
                    else:
                        lines.extend([
                            f"# No safe winget mapping found for: {name}",
                            f"Log-Message 'Skipped auto-upgrade for {name}: No exact Winget ID mapping' 'WARN'",
                            f"Write-Host '# Review manually: winget search --name \"{name}\"' -ForegroundColor DarkYellow",
                            "",
                        ])
            else:
                lines.append("Log-Message 'No applications selected.' 'INFO'")
                lines.append("")

            lines.extend([
                "# ----- Driver Remediation Guidance -----",
                "Execute-LoggedCommand -Command 'UsoClient StartScan' -Description 'Trigger Windows Update Driver Scan'",
                "Execute-LoggedCommand -Command 'UsoClient StartDownload' -Description 'Download Pending Driver Updates'",
                "Execute-LoggedCommand -Command 'UsoClient StartInstall' -Description 'Install Driver Updates'",
                "",
            ])

            if driver_names:
                for driver in driver_names:
                    lines.append(f"Log-Message 'Unresolved driver requires verification: {driver}.sys' 'WARN'")
                    lines.append(f"# Validate/install driver manually if still missing: {driver}.sys")
            else:
                lines.append("Log-Message 'No drivers selected.' 'INFO'")

            lines.extend([
                "",
                "Log-Message '=== System Revamp Remediation Session Completed ===' 'INFO'",
                "Write-Host 'Remediation script completed.' -ForegroundColor Green",
                "Write-Host \"Execution log saved to: $LogFile\" -ForegroundColor Cyan",
            ])

            script = "\n".join(lines)
            headers = {
                "Content-Disposition": 'attachment; filename="system_revamp_remediation.ps1"'
            }
            return Response(content=script, media_type="text/plain; charset=utf-8", headers=headers)
    except Exception as e:
        return {"error": str(e)}
