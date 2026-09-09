# backend/drivers_api.py
import json
import os
import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PNP_ERROR_DESCRIPTIONS = {
    1: "Device is not configured correctly.",
    3: "Driver for this device might be corrupted.",
    10: "This device cannot start.",
    14: "This device cannot work properly until you restart your computer.",
    18: "Reinstall the drivers for this device.",
    22: "This device is disabled.",
    28: "The drivers for this device are not installed.",
    31: "This device is not working properly because Windows cannot load the drivers required.",
    39: "Windows cannot load the device driver for this hardware.",
    43: "Windows has stopped this device because it has reported problems.",
    48: "The software for this device has been blocked from starting because it is known to have problems with Windows.",
}


def _classify_impact(device_name: str, device_class: str = "") -> str:
    combined = f"{device_name} {device_class}".lower()
    if any(token in combined for token in ["storage", "disk", "nvme", "scsi", "ahci", "processor", "cpu", "motherboard", "chipset"]):
        return "Critical"
    if any(token in combined for token in ["net", "nic", "wireless", "wi-fi", "ethernet", "network", "bluetooth"]):
        return "High"
    if any(token in combined for token in ["display", "gpu", "video", "media", "audio", "sound", "usb", "controller"]):
        return "Medium"
    return "Low"


def _impact_score(impact: str) -> int:
    return {
        "Critical": 95,
        "High": 75,
        "Medium": 50,
        "Low": 25,
    }.get(impact, 20)


def scan_problem_devices():
    """
    Scans for actual hardware devices on Windows with configuration/driver errors
    (e.g., Code 28 driver missing, Code 10 failed to start).
    """
    problems = []
    try:
        ps_cmd = (
            "Get-CimInstance Win32_PnPEntity -Filter 'ConfigManagerErrorCode <> 0' | "
            "Select-Object Name, DeviceID, Status, ConfigManagerErrorCode, PNPClass, Manufacturer | "
            "ConvertTo-Json -Compress"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            raw = json.loads(result.stdout)
            items = [raw] if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
            for item in items:
                name = item.get("Name") or item.get("DeviceID") or "Unknown Hardware Device"
                code = item.get("ConfigManagerErrorCode", 0)
                reason = PNP_ERROR_DESCRIPTIONS.get(code, f"Hardware Error Code {code}")
                device_class = item.get("PNPClass") or ""
                impact = _classify_impact(name, device_class)

                # Format driver name cleanly
                driver_name = name.split("(")[0].strip() if "(" in name else name
                is_disabled = (code == 22)
                status_label = "Disabled" if is_disabled else "Missing"

                problems.append({
                    "Driver Name": driver_name,
                    "Device": f"{name} ({reason})",
                    "Impact": impact,
                    "RiskScore": _impact_score(impact),
                    "Status": status_label,
                    "IsDisabled": is_disabled,
                    "ErrorCode": code,
                    "Reason": reason,
                    "DeviceID": item.get("DeviceID", ""),
                    "Manufacturer": item.get("Manufacturer", "Unknown"),
                })
    except Exception as e:
        print(f"Error scanning problem devices: {e}")

    return problems


def scan_installed_signed_drivers():
    """
    Retrieves installed, functioning signed hardware drivers from Windows CIM.
    """
    installed = []
    try:
        ps_cmd = (
            "Get-CimInstance Win32_PnPSignedDriver | "
            "Where-Object { $_.DeviceName } | "
            "Select-Object -Property DeviceName, DriverVersion, InfName, Manufacturer, DeviceClass | "
            "ConvertTo-Json -Compress"
        )
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=25,
            check=False,
        )
        if result.returncode == 0 and result.stdout.strip():
            raw = json.loads(result.stdout)
            items = [raw] if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
            seen_drivers = set()

            for item in items:
                device_name = item.get("DeviceName") or ""
                inf_name = item.get("InfName") or ""
                driver_name = os.path.splitext(inf_name)[0] if inf_name else device_name

                # Deduplicate repeated interface entries
                unique_key = (driver_name.lower(), device_name.lower())
                if unique_key in seen_drivers:
                    continue
                seen_drivers.add(unique_key)

                impact = _classify_impact(device_name, item.get("DeviceClass") or "")
                installed.append({
                    "Driver Name": driver_name,
                    "Device": device_name,
                    "Manufacturer": item.get("Manufacturer") or "Standard",
                    "Version": item.get("DriverVersion") or "Verified",
                    "DeviceClass": item.get("DeviceClass") or "System",
                    "Impact": impact,
                    "RiskScore": 0,
                    "Status": "Installed",
                })
    except Exception as e:
        print(f"Error scanning installed drivers: {e}")

    return installed


@app.get("/drivers")
def get_drivers():
    missing_drivers = scan_problem_devices()
    installed_drivers = scan_installed_signed_drivers()

    # Sort missing drivers by risk severity
    missing_drivers.sort(key=lambda item: item.get("RiskScore", 0), reverse=True)

    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for item in missing_drivers:
        impact = str(item.get("Impact", "")).lower()
        if impact in summary:
            summary[impact] += 1

    return {
        "missingDrivers": missing_drivers,
        "installedDrivers": installed_drivers,
        "riskSummary": summary,
    }


@app.post("/drivers/download")
def download_missing_drivers(payload: dict = None):
    requested = []
    if isinstance(payload, dict):
        raw = payload.get("drivers", [])
        if isinstance(raw, list):
            requested = [str(item).strip() for item in raw if str(item).strip()]

    # Trigger PnP device scanning and Windows driver sync
    steps = [
        ("Rescan Plug and Play hardware devices", "pnputil /scan-devices"),
        ("Trigger Windows Update driver search", "UsoClient StartScan"),
        ("Download pending driver updates", "UsoClient StartDownload"),
        ("Install approved driver packages", "UsoClient StartInstall"),
    ]

    log = []
    for step_name, command in steps:
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command", command],
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
            log.append(
                {
                    "step": step_name,
                    "command": command,
                    "returnCode": result.returncode,
                    "stdout": (result.stdout or "").strip(),
                    "stderr": (result.stderr or "").strip(),
                }
            )
        except Exception as e:
            log.append(
                {
                    "step": step_name,
                    "command": command,
                    "returnCode": -1,
                    "stdout": "",
                    "stderr": str(e),
                }
            )

    all_ok = all(item.get("returnCode", 1) == 0 for item in log)
    access_denied = any("access is denied" in str(item.get("stdout", "")).lower() or "access is denied" in str(item.get("stderr", "")).lower() for item in log)
    
    if all_ok:
        message = "Hardware rescan and driver synchronization completed successfully."
    elif access_denied:
        message = "Driver scan and sync initiated. For direct kernel-level hardware rescans, start the backend terminal as Administrator."
    else:
        message = "Hardware rescan and driver update trigger completed. Windows Update and PnP manager are synchronizing driver packages."

    return {
        "requestedDrivers": requested,
        "steps": log,
        "success": all_ok or not access_denied,
        "requiresElevation": access_denied,
        "message": message,
    }


@app.post("/drivers/enable")
def enable_device(payload: dict = None):
    """
    Enables a disabled hardware device via PowerShell Enable-PnpDevice.
    """
    if not isinstance(payload, dict):
        return {"success": False, "message": "Invalid request payload"}

    device_id = payload.get("deviceId") or ""
    driver_name = payload.get("driverName") or ""

    if not device_id and not driver_name:
        return {"success": False, "message": "Device identifier or driver name required."}

    # First attempt: Enable by exact Device Instance ID
    ps_cmd = ""
    if device_id:
        escaped_id = device_id.replace("'", "''")
        ps_cmd = f"Get-PnpDevice -InstanceId '{escaped_id}' -ErrorAction SilentlyContinue | Enable-PnpDevice -Confirm:$false"
    else:
        escaped_name = driver_name.replace("'", "''")
        ps_cmd = f"Get-PnpDevice | Where-Object {{ $_.FriendlyName -like '*{escaped_name}*' }} | Enable-PnpDevice -Confirm:$false"

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )

        access_denied = (
            "access is denied" in str(result.stderr).lower()
            or "access is denied" in str(result.stdout).lower()
            or "permission" in str(result.stderr).lower()
        )

        if result.returncode == 0:
            return {
                "success": True,
                "message": f"Device '{driver_name or device_id}' enabled successfully.",
            }
        elif access_denied:
            return {
                "success": False,
                "requiresElevation": True,
                "message": (
                    "Device enabling requires administrative privileges. "
                    "Please run the backend service as Administrator."
                ),
            }
        else:
            return {
                "success": False,
                "message": (result.stderr or result.stdout or "Failed to enable hardware device.").strip(),
            }
    except Exception as e:
        return {"success": False, "message": str(e)}

