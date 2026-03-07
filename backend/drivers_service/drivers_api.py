"""Driver Scanner Service API (port 8001)."""

from __future__ import annotations

import json
import logging
import platform
import re
import subprocess
from typing import Any, Dict, List, Mapping

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from common.api import (
    allowed_origins_from_env,
    apply_standard_api_controls,
    configure_logger,
    health_payload,
    success_payload,
)

SERVICE_NAME = "driver_service"
LOGGER = configure_logger(SERVICE_NAME)

app = FastAPI(title="Driver Scanner Service", version="2.0.0")

origins = allowed_origins_from_env()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
apply_standard_api_controls(app, SERVICE_NAME)


def _run(command: List[str], timeout: int = 45) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)


def _impact_label(status: str, error_code: int | None = None) -> str:
    if error_code is not None and error_code > 20:
        return "Critical"
    normalized = str(status).strip().lower()
    if normalized in {"error", "degraded"}:
        return "High"
    if normalized in {"warning", "unknown"}:
        return "Medium"
    return "Low"


def _windows_drivers() -> Dict[str, Any]:
    installed_drivers: List[Dict[str, str]] = []
    driver_issues: List[Dict[str, str]] = []

    driver_command = [
        "powershell",
        "-NoProfile",
        "-Command",
        (
            "Get-CimInstance Win32_PnPSignedDriver | "
            "Select-Object DeviceName, DriverVersion, InfName, DriverProviderName, IsSigned | "
            "ConvertTo-Json -Depth 3"
        ),
    ]
    driver_result = _run(driver_command, timeout=60)
    if driver_result.returncode == 0 and (driver_result.stdout or "").strip():
        try:
            payload = json.loads(driver_result.stdout)
        except json.JSONDecodeError:
            payload = []
        rows = payload if isinstance(payload, list) else [payload]
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            name = str(row.get("DeviceName", "")).strip()
            inf_name = str(row.get("InfName", "")).strip()
            if not name and not inf_name:
                continue
            installed_drivers.append(
                {
                    "Driver Name": inf_name or name,
                    "Device": name or "Unknown Device",
                    "Version": str(row.get("DriverVersion", "Unknown")).strip() or "Unknown",
                    "Provider": str(row.get("DriverProviderName", "Unknown")).strip() or "Unknown",
                    "Status": "Installed",
                    "Signed": str(row.get("IsSigned", "Unknown")).strip() or "Unknown",
                }
            )

    issue_command = [
        "powershell",
        "-NoProfile",
        "-Command",
        (
            "Get-CimInstance Win32_PnPEntity | "
            "Where-Object { $_.ConfigManagerErrorCode -ne 0 -or $_.Status -ne 'OK' } | "
            "Select-Object Name, Status, ConfigManagerErrorCode, PNPDeviceID | "
            "ConvertTo-Json -Depth 3"
        ),
    ]
    issue_result = _run(issue_command, timeout=60)
    if issue_result.returncode == 0 and (issue_result.stdout or "").strip():
        try:
            payload = json.loads(issue_result.stdout)
        except json.JSONDecodeError:
            payload = []
        rows = payload if isinstance(payload, list) else [payload]
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            device_name = str(row.get("Name", "")).strip()
            status = str(row.get("Status", "Unknown")).strip() or "Unknown"
            error_code_raw = row.get("ConfigManagerErrorCode")
            try:
                error_code = int(error_code_raw)
            except (TypeError, ValueError):
                error_code = None
            if not device_name:
                continue
            driver_issues.append(
                {
                    "Driver Name": str(row.get("PNPDeviceID", device_name)).strip() or device_name,
                    "Device": device_name,
                    "Impact": _impact_label(status, error_code=error_code),
                    "Status": status,
                    "ConfigManagerErrorCode": str(error_code if error_code is not None else "Unknown"),
                }
            )

    return {
        "installedDrivers": installed_drivers,
        "missingDrivers": driver_issues,
        "driverIssues": driver_issues,
    }


def _linux_drivers() -> Dict[str, Any]:
    installed_drivers: List[Dict[str, str]] = []
    driver_issues: List[Dict[str, str]] = []

    lspci_result = _run(["lspci", "-k"], timeout=30)
    if lspci_result.returncode != 0:
        return {
            "installedDrivers": [],
            "missingDrivers": [],
            "driverIssues": [],
        }

    current_device = ""
    current_driver = ""
    kernel_modules = ""
    for line in lspci_result.stdout.splitlines():
        if line and not line.startswith("\t"):
            if current_device:
                if current_driver:
                    installed_drivers.append(
                        {
                            "Driver Name": current_driver,
                            "Device": current_device,
                            "Status": "Installed",
                            "Provider": "kernel",
                            "Version": "Unknown",
                        }
                    )
                elif kernel_modules:
                    driver_issues.append(
                        {
                            "Driver Name": kernel_modules,
                            "Device": current_device,
                            "Impact": "Medium",
                            "Status": "Kernel module available but not bound",
                        }
                    )
            current_device = line.strip()
            current_driver = ""
            kernel_modules = ""
            continue

        raw = line.strip()
        if raw.lower().startswith("kernel driver in use:"):
            current_driver = raw.split(":", 1)[1].strip()
        elif raw.lower().startswith("kernel modules:"):
            kernel_modules = raw.split(":", 1)[1].strip()

    if current_device:
        if current_driver:
            installed_drivers.append(
                {
                    "Driver Name": current_driver,
                    "Device": current_device,
                    "Status": "Installed",
                    "Provider": "kernel",
                    "Version": "Unknown",
                }
            )
        elif kernel_modules:
            driver_issues.append(
                {
                    "Driver Name": kernel_modules,
                    "Device": current_device,
                    "Impact": "Medium",
                    "Status": "Kernel module available but not bound",
                }
            )

    return {
        "installedDrivers": installed_drivers,
        "missingDrivers": driver_issues,
        "driverIssues": driver_issues,
    }


def _macos_drivers() -> Dict[str, Any]:
    installed_drivers: List[Dict[str, str]] = []
    result = _run(["kmutil", "showloaded"], timeout=30)
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            raw = re.split(r"\s+", line.strip())
            if len(raw) < 7 or raw[0].lower() == "index":
                continue
            bundle_id = raw[-1]
            installed_drivers.append(
                {
                    "Driver Name": bundle_id,
                    "Device": bundle_id,
                    "Status": "Installed",
                    "Provider": "kernel",
                    "Version": raw[5] if len(raw) > 5 else "Unknown",
                }
            )

    return {
        "installedDrivers": installed_drivers,
        "missingDrivers": [],
        "driverIssues": [],
    }


def get_drivers() -> Dict[str, Any]:
    system = platform.system()
    if system == "Windows":
        return _windows_drivers()
    if system == "Linux":
        return _linux_drivers()
    if system == "Darwin":
        return _macos_drivers()
    return {"installedDrivers": [], "missingDrivers": [], "driverIssues": []}


def _risk_summary(driver_issues: List[Mapping[str, Any]]) -> Dict[str, int]:
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for item in driver_issues:
        impact = str(item.get("Impact", "Low")).strip().lower()
        if impact in summary:
            summary[impact] += 1
    return summary


def _driver_update_steps() -> List[Dict[str, str]]:
    system = platform.system()
    if system == "Windows":
        return [
            {"step": "Start driver scan", "command": "UsoClient StartScan"},
            {"step": "Download driver updates", "command": "UsoClient StartDownload"},
            {"step": "Install driver updates", "command": "UsoClient StartInstall"},
            {"step": "Rescan plug and play devices", "command": "pnputil /scan-devices"},
        ]
    if system == "Linux":
        return [
            {"step": "Refresh package metadata", "command": "apt-get update"},
            {"step": "Upgrade kernel and firmware packages", "command": "apt-get upgrade -y"},
        ]
    if system == "Darwin":
        return [
            {"step": "Update Homebrew metadata", "command": "brew update"},
            {"step": "Upgrade driver-backed packages", "command": "brew upgrade"},
        ]
    return []


@app.get("/")
def root(request: Request) -> Dict[str, object]:
    return success_payload(
        SERVICE_NAME,
        {"message": "Driver Scanner Service running"},
        request_id=getattr(request.state, "request_id", ""),
    )


@app.get("/health")
def health() -> Dict[str, Any]:
    return health_payload(
        SERVICE_NAME,
        database={"status": "not_configured"},
        cache={"status": "not_configured"},
        api={"status": "ok"},
        details={"platform": platform.system()},
    )


@app.get("/drivers")
def drivers(request: Request) -> Dict[str, object]:
    payload = get_drivers()
    issues = payload.get("driverIssues", [])
    result = {
        **payload,
        "riskSummary": _risk_summary(issues if isinstance(issues, list) else []),
    }
    return success_payload(
        SERVICE_NAME,
        result,
        request_id=getattr(request.state, "request_id", ""),
        **result,
    )


@app.post("/drivers/download")
def download_missing_drivers(request: Request) -> Dict[str, object]:
    steps = _driver_update_steps()
    logs: List[Dict[str, Any]] = []
    for step in steps:
        command = step["command"]
        if platform.system() == "Windows":
            shell_command = ["powershell", "-NoProfile", "-Command", command]
        else:
            shell_command = command.split(" ")
        try:
            result = _run(shell_command, timeout=120)
            logs.append(
                {
                    "step": step["step"],
                    "command": command,
                    "returnCode": result.returncode,
                    "stdout": (result.stdout or "").strip(),
                    "stderr": (result.stderr or "").strip(),
                }
            )
        except Exception as exc:
            logs.append(
                {
                    "step": step["step"],
                    "command": command,
                    "returnCode": -1,
                    "stdout": "",
                    "stderr": str(exc),
                }
            )

    success = all(item.get("returnCode") == 0 for item in logs) if logs else False
    response = {"success": success, "steps": logs}
    return success_payload(
        SERVICE_NAME,
        response,
        request_id=getattr(request.state, "request_id", ""),
        **response,
    )
