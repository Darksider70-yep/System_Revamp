import json
import platform
import subprocess
from typing import List, Dict, Any

PNP_ERROR_DESCRIPTIONS = {
    1: "Device is not configured correctly.",
    3: "Driver for this device might be corrupted.",
    10: "This device cannot start.",
    14: "This device requires a restart.",
    18: "Reinstall the drivers for this device.",
    22: "This device is disabled.",
    28: "The drivers for this device are not installed.",
    31: "Windows cannot load the drivers required.",
    39: "Windows cannot load the device driver.",
    43: "Windows stopped this device due to problems.",
    48: "Device blocked from starting.",
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


def collect_drivers() -> List[Dict[str, Any]]:
    if platform.system() != "Windows":
        return []

    drivers = []
    
    # 1. Primary problem detection: Win32_PnPEntity with ConfigManagerErrorCode > 0
    try:
        ps_cmd = (
            "Get-CimInstance Win32_PnPEntity -Filter 'ConfigManagerErrorCode > 0' | "
            "Select-Object Name, DeviceID, Status, ConfigManagerErrorCode, PNPClass, Manufacturer | "
            "ConvertTo-Json -Compress"
        )
        res = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
            check=False,
        )
        if res.returncode == 0 and res.stdout.strip():
            raw = json.loads(res.stdout)
            items = [raw] if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
            for item in items:
                name = item.get("Name") or item.get("DeviceID") or "Unknown Hardware Device"
                code = item.get("ConfigManagerErrorCode", 0)
                reason = PNP_ERROR_DESCRIPTIONS.get(code, f"Hardware Error Code {code}")
                device_class = item.get("PNPClass") or ""
                impact = _classify_impact(name, device_class)
                is_disabled = (code == 22)
                status = "Disabled" if is_disabled else ("Missing" if code == 28 else "Error")

                driver_name = name.split("(")[0].strip() if "(" in name else name

                drivers.append({
                    "device_name": driver_name,
                    "device_id_pnp": item.get("DeviceID", ""),
                    "error_code": code,
                    "reason": reason,
                    "impact": impact,
                    "risk_score": _impact_score(impact),
                    "status": status,
                    "manufacturer": item.get("Manufacturer", "Unknown"),
                    "is_disabled": is_disabled,
                })
    except Exception as e:
        print(f"[AGENT] Error collecting PnP problem drivers: {e}")

    # 2. Functioning Signed Drivers (sample/summary)
    try:
        ps_cmd = (
            "Get-CimInstance Win32_PnPSignedDriver | "
            "Where-Object { $_.DeviceName -and $_.ConfigManagerErrorCode -eq 0 } | "
            "Select-Object -First 30 DeviceName, DriverVersion, InfName, Manufacturer, DeviceClass | "
            "ConvertTo-Json -Compress"
        )
        res = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=15,
            check=False,
        )
        if res.returncode == 0 and res.stdout.strip():
            raw = json.loads(res.stdout)
            items = [raw] if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
            for item in items:
                name = item.get("DeviceName") or "Installed Driver"
                drivers.append({
                    "device_name": name,
                    "device_id_pnp": item.get("InfName", ""),
                    "error_code": 0,
                    "reason": "Functioning Normally",
                    "impact": "Low",
                    "risk_score": 0,
                    "status": "Installed",
                    "manufacturer": item.get("Manufacturer", "Unknown"),
                    "is_disabled": False,
                })
    except Exception as e:
        print(f"[AGENT] Error collecting signed drivers: {e}")

    return drivers
