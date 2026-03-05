"""FastAPI entrypoint for System Scanner Service (port 8000)."""

from __future__ import annotations

import io
import json
import logging
import platform
import time
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from packaging.version import InvalidVersion, Version
from pydantic import BaseModel, Field

try:
    from scanner import get_installed_apps
except ImportError:  # pragma: no cover
    from .scanner import get_installed_apps

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
LOGGER = logging.getLogger("scanner_service.main")

app = FastAPI(title="System Scanner Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
VERSION_DB_CANDIDATES = [
    BACKEND_ROOT / "version_service" / "latest_versions.json",
    BACKEND_ROOT / "latest_versions.json",
]


class AttackSimulationRequest(BaseModel):
    """Input schema for vulnerability simulation."""

    software: str = Field(..., min_length=1, max_length=150)
    current: Optional[str] = Field(default=None, max_length=64)
    latest: Optional[str] = Field(default=None, max_length=64)
    riskLevel: Optional[str] = Field(default=None, max_length=20)


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _safe_parse_version(value: Optional[str]) -> Optional[Version]:
    if not value:
        return None
    try:
        return Version(str(value).strip())
    except (InvalidVersion, TypeError, ValueError):
        return None


def _load_latest_versions() -> Tuple[Dict[str, str], Dict[str, str]]:
    """Load latest version DB; returns normalized and raw mapping."""
    for path in VERSION_DB_CANDIDATES:
        if not path.exists():
            continue
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            LOGGER.warning("Unable to parse %s: %s", path, exc)
            continue

        if not isinstance(payload, dict):
            continue

        raw = {str(key).strip(): str(value).strip() for key, value in payload.items() if str(key).strip()}
        normalized = {_normalize_name(key): value for key, value in raw.items()}
        return normalized, raw

    return {}, {}


def _lookup_latest_from_db(app_name: str, latest_db: Mapping[str, str]) -> Optional[str]:
    normalized = _normalize_name(app_name)
    if normalized in latest_db:
        return latest_db[normalized]

    for known_name, known_version in latest_db.items():
        if normalized in known_name or known_name in normalized:
            return known_version
    return None


def _build_update_metadata(apps: List[Dict[str, str]], latest_db: Mapping[str, str]) -> Dict[str, Any]:
    outdated: List[Dict[str, str]] = []

    for app in apps:
        name = str(app.get("name", "")).strip()
        current = str(app.get("version", "Unknown")).strip()
        if not name:
            continue

        latest = _lookup_latest_from_db(name, latest_db)
        if not latest:
            continue

        current_parsed = _safe_parse_version(current)
        latest_parsed = _safe_parse_version(latest)
        if current_parsed and latest_parsed and current_parsed < latest_parsed:
            outdated.append(
                {
                    "name": name,
                    "current": current,
                    "latest": latest,
                }
            )

    return {
        "totalDetectedApps": len(apps),
        "totalOutdatedApps": len(outdated),
        "outdatedApps": outdated,
    }


def _infer_risk_level(current: Optional[str], latest: Optional[str], provided: Optional[str]) -> str:
    if provided:
        clean = provided.strip().title()
        if clean in {"High", "Medium", "Low", "Unknown"}:
            return clean

    current_parsed = _safe_parse_version(current)
    latest_parsed = _safe_parse_version(latest)
    if not current_parsed or not latest_parsed:
        return "Unknown"
    if current_parsed >= latest_parsed:
        return "Low"
    if latest_parsed.major > current_parsed.major:
        return "High"
    if latest_parsed.minor > current_parsed.minor:
        return "Medium"
    return "Low"


def _attack_profile_for_risk(risk_level: str) -> str:
    if risk_level == "High":
        return "Remote Code Execution"
    if risk_level == "Medium":
        return "Privilege Escalation"
    if risk_level == "Low":
        return "Information Disclosure"
    return "Unknown"


def _vulnerability_label(software: str) -> str:
    name = _normalize_name(software)
    if "node" in name or "python" in name or "java" in name:
        return "Outdated runtime"
    if "chrome" in name or "browser" in name:
        return "Unpatched browser engine"
    if "driver" in name:
        return "Kernel driver exposure"
    return "Outdated software component"


def _recommendation(latest: Optional[str]) -> str:
    if latest and latest.strip() and latest.strip().lower() not in {"unknown", "n/a"}:
        return f"Update to version {latest.strip()}"
    return "Apply latest vendor security patches"


def _build_instructions(manifest: Mapping[str, Any]) -> str:
    generated_at = manifest.get("generatedAt", "Unknown")
    return "\n".join(
        [
            "SYSTEM REVAMP OFFLINE PATCH PACKAGE",
            f"Generated: {generated_at}",
            "",
            "How to use:",
            "1. Copy this ZIP to the air-gapped target system.",
            "2. Extract ZIP contents to a trusted folder.",
            "3. Review updates_manifest.json to prioritize risky outdated apps.",
            "4. Use latest_versions.json to validate approved target versions.",
            "5. Perform vendor-approved updates and re-run the scanner service.",
            "",
            "This package is intended for educational and defensive operations.",
        ]
    )


def _guess_winget_id(app_name: str) -> Optional[str]:
    name = _normalize_name(app_name)
    known = {
        "node.js": "OpenJS.NodeJS",
        "python": "Python.Python.3",
        "java": "Oracle.JDK",
        "google chrome": "Google.Chrome",
        "github desktop": "GitHub.GitHubDesktop",
        "git": "Git.Git",
        "dropbox": "Dropbox.Dropbox",
    }
    for key, value in known.items():
        if key in name:
            return value
    return None


@app.get("/")
def root() -> Dict[str, str]:
    """Health endpoint."""
    return {"message": "Scanner Service running"}


@app.get("/scan")
def scan_system() -> Dict[str, List[Dict[str, str]]]:
    """Scan installed applications for the current OS."""
    try:
        return {"apps": get_installed_apps()}
    except Exception as exc:
        LOGGER.exception("Scan failed: %s", exc)
        raise HTTPException(status_code=500, detail="System scan failed.") from exc


@app.post("/simulate-attack")
def simulate_attack(payload: AttackSimulationRequest) -> Dict[str, str]:
    """Generate an educational vulnerability scenario for outdated software."""
    software = payload.software.strip()
    risk_level = _infer_risk_level(payload.current, payload.latest, payload.riskLevel)

    return {
        "software": software,
        "vulnerability": _vulnerability_label(software),
        "riskLevel": risk_level,
        "possibleAttack": _attack_profile_for_risk(risk_level),
        "recommendation": _recommendation(payload.latest),
    }


@app.get("/simulate-attack/{software}")
def simulate_attack_legacy(software: str) -> Dict[str, str]:
    """Backward-compatible simulation endpoint."""
    if not software.strip():
        raise HTTPException(status_code=422, detail="Software name is required.")
    return {
        "software": software.strip(),
        "vulnerability": _vulnerability_label(software),
        "riskLevel": "Unknown",
        "possibleAttack": _attack_profile_for_risk("Unknown"),
        "recommendation": "Collect version intelligence and update to the latest secure release",
    }


@app.get("/generate-offline-package")
def generate_offline_package(mode: str = Query(default="full")) -> StreamingResponse:
    """Build offline patch ZIP package for air-gapped environments."""
    try:
        scan_mode = mode.strip().lower()
        if scan_mode not in {"full", "delta"}:
            scan_mode = "full"

        apps = get_installed_apps()
        latest_normalized, latest_raw = _load_latest_versions()
        metadata = _build_update_metadata(apps, latest_normalized)

        manifest = {
            "generatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "platform": platform.system(),
            "mode": scan_mode,
            **metadata,
        }

        instructions = _build_instructions(manifest)

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("updates_manifest.json", json.dumps(manifest, indent=2))
            archive.writestr("latest_versions.json", json.dumps(latest_raw, indent=2))
            archive.writestr("instructions.txt", instructions)

        zip_buffer.seek(0)
        filename = "offline_update_package.zip" if scan_mode == "full" else "offline_delta_package.zip"
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        LOGGER.exception("Offline package generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Unable to generate offline package.") from exc


@app.post("/generate-remediation-script")
def generate_remediation_script(payload: Dict[str, Any]) -> Response:
    """Generate a PowerShell remediation script for selected apps/drivers."""
    apps = payload.get("apps", []) if isinstance(payload, dict) else []
    drivers = payload.get("drivers", []) if isinstance(payload, dict) else []

    app_names = [str(item).strip() for item in apps if str(item).strip()]
    driver_names = [str(item).strip() for item in drivers if str(item).strip()]

    lines = [
        "# System Revamp - Remediation Script",
        f"# Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "Set-StrictMode -Version Latest",
        "$ErrorActionPreference = 'Continue'",
        "",
        "Write-Host 'Starting remediation actions...' -ForegroundColor Cyan",
        "",
        "# Application updates",
    ]

    if app_names:
        for app_name in app_names:
            winget_id = _guess_winget_id(app_name)
            if winget_id:
                lines.extend(
                    [
                        f"Write-Host 'Updating {app_name} ({winget_id})' -ForegroundColor Yellow",
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
                        f"# No trusted winget mapping for: {app_name}",
                        f"# Manual review: winget search --name \"{app_name}\"",
                        "",
                    ]
                )
    else:
        lines.append("# No applications selected")
        lines.append("")

    lines.extend(
        [
            "# Driver update flow",
            "UsoClient StartScan",
            "UsoClient StartDownload",
            "UsoClient StartInstall",
            "pnputil /scan-devices",
            "",
        ]
    )

    if driver_names:
        for driver_name in driver_names:
            lines.append(f"# Validate driver package manually if still missing: {driver_name}.sys")
    else:
        lines.append("# No drivers selected")

    lines.extend(["", "Write-Host 'Remediation script completed.' -ForegroundColor Green"])

    script_body = "\n".join(lines)
    return Response(
        content=script_body,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="system_revamp_remediation.ps1"'},
    )
