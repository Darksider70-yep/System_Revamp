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


# Standard Windows Device Setup Class GUIDs (Authoritative Microsoft Specifications)
CLASS_GUID_IMPACT: Dict[str, str] = {
    # Critical: Core system, storage, processing, chipset, security
    "{4d36e967-e325-11ce-bfc1-08002be10318}": "Critical",  # DiskDrive
    "{4d36e97b-e325-11ce-bfc1-08002be10318}": "Critical",  # SCSIAdapter
    "{4d36e96a-e325-11ce-bfc1-08002be10318}": "Critical",  # HDC (Hard Disk Controller)
    "{4d36e97d-e325-11ce-bfc1-08002be10318}": "Critical",  # System (Motherboard, ACPI, chipset)
    "{50127dc3-0f36-415e-a6cc-4cb3be25f615}": "Critical",  # Processor
    "{d94ee5d8-d18d-4444-9bc0-88031d279930}": "Critical",  # SecurityDevices (TPM)

    # High: Networking, communications
    "{4d36e972-e325-11ce-bfc1-08002be10318}": "High",  # Net (Network Adapters / WiFi / Ethernet)
    "{e0cbf06c-cdb3-4647-bb8a-263b43f0f974}": "High",  # Bluetooth
    "{4d36e96d-e325-11ce-bfc1-08002be10318}": "High",  # Modem

    # Medium: Display, audio, input, USB controllers
    "{4d36e968-e325-11ce-bfc1-08002be10318}": "Medium",  # Display (GPU / Video)
    "{4d36e96c-e325-11ce-bfc1-08002be10318}": "Medium",  # Media (Sound / Audio)
    "{36fc9e60-c465-11cf-8056-444553540000}": "Medium",  # USB (Host controllers / Hubs)
    "{745a17a0-74d3-11d0-b6fe-00a0c90f57da}": "Medium",  # HIDClass
    "{4d36e96b-e325-11ce-bfc1-08002be10318}": "Medium",  # Keyboard
    "{4d36e96f-e325-11ce-bfc1-08002be10318}": "Medium",  # Mouse
    "{4d36e978-e325-11ce-bfc1-08002be10318}": "Medium",  # Ports (COM & LPT)

    # Low: Printers, sensors, imaging, peripherals
    "{1ed2bbf9-11f0-4084-b21f-b054a77d616e}": "Low",  # PrintQueue
    "{4d36e979-e325-11ce-bfc1-08002be10318}": "Low",  # Printer
    "{6bdd1fc6-810f-11d0-bec7-08002be2092f}": "Low",  # Image (Camera/Scanner)
    "{5175d327-165c-4447-920f-560be9f92e2b}": "Low",  # Sensor
}

SETUP_CLASS_IMPACT: Dict[str, str] = {
    "diskdrive": "Critical",
    "scsiadapter": "Critical",
    "hdc": "Critical",
    "system": "Critical",
    "processor": "Critical",
    "securitydevices": "Critical",
    "net": "High",
    "bluetooth": "High",
    "modem": "High",
    "display": "Medium",
    "media": "Medium",
    "usb": "Medium",
    "hidclass": "Medium",
    "keyboard": "Medium",
    "mouse": "Medium",
    "ports": "Medium",
    "printer": "Low",
    "printqueue": "Low",
    "image": "Low",
    "sensor": "Low",
}


def _classify_impact(device_name: str, device_class: str = "", class_guid: str = "") -> str:
    """Classifies driver issue severity using Class GUID, PNPClass, and keywords as fallback."""
    # 1. Authoritative: match standard Device Class GUID
    clean_guid = class_guid.strip().lower()
    if clean_guid in CLASS_GUID_IMPACT:
        return CLASS_GUID_IMPACT[clean_guid]

    # 2. Match standard Setup Class name
    clean_class = device_class.strip().lower()
    if clean_class in SETUP_CLASS_IMPACT:
        return SETUP_CLASS_IMPACT[clean_class]

    # 3. Fallback keyword heuristic
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
            "Select-Object Name, DeviceID, Status, ConfigManagerErrorCode, PNPClass, Manufacturer, ClassGuid | "
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
                class_guid = item.get("ClassGuid") or ""
                impact = _classify_impact(name, device_class, class_guid)
                is_disabled = (code == 22)
                status = "Disabled" if is_disabled else ("Missing" if code == 28 else "Error")

                driver_name = name.split("(")[0].strip() if "(" in name else name

                drivers.append({
                    "device_name": driver_name,
                    "device_id_pnp": item.get("DeviceID", ""),
                    "device_class_guid": class_guid,
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
