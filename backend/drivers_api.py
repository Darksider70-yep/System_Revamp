# backend/drivers_api.py
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

# Extended list of drivers we consider critical or common
EXPECTED_DRIVERS = [
    {"Driver Name": "nvlddmkm", "Device": "NVIDIA GPU"},
    {"Driver Name": "rt640x64", "Device": "Realtek NIC"},
    {"Driver Name": "iaStorA", "Device": "Intel Storage"},
    {"Driver Name": "usbport", "Device": "USB Controller"},
    {"Driver Name": "hidusb", "Device": "HID Device"},
    {"Driver Name": "kbdhid", "Device": "Keyboard"},
    {"Driver Name": "mouhid", "Device": "Mouse"},
    {"Driver Name": "intelppm", "Device": "CPU Driver"},
    {"Driver Name": "disk", "Device": "Disk Controller"},
    {"Driver Name": "storahci", "Device": "AHCI Controller"},
    {"Driver Name": "rt73", "Device": "Wi-Fi Adapter"},
    {"Driver Name": "bthusb", "Device": "Bluetooth USB Adapter"},
    {"Driver Name": "audiodg", "Device": "Audio Device"},
    {"Driver Name": "ati2mtag", "Device": "AMD GPU"},
    {"Driver Name": "nvlddmkm_win", "Device": "NVIDIA GPU"},
    {"Driver Name": "netwtw06", "Device": "Intel Wireless"},
    {"Driver Name": "btfilter", "Device": "Bluetooth Filter Driver"},
    {"Driver Name": "e1d65x64", "Device": "Intel Ethernet"},
    {"Driver Name": "rtwlane", "Device": "Realtek Wi-Fi"},
    {"Driver Name": "iaahcic", "Device": "Intel AHCI Controller"},
]


def _classify_impact(device_name: str) -> str:
    name = str(device_name).lower()
    if any(token in name for token in ["storage", "disk", "ahci", "cpu"]):
        return "Critical"
    if any(token in name for token in ["nic", "wireless", "wi-fi", "ethernet", "bluetooth"]):
        return "High"
    if any(token in name for token in ["gpu", "audio", "usb"]):
        return "Medium"
    return "Low"


def _impact_score(impact: str) -> int:
    return {
        "Critical": 95,
        "High": 75,
        "Medium": 50,
        "Low": 25,
    }.get(impact, 20)


def scan_installed_drivers():
    """
    Uses WMIC/PowerShell to get installed driver INF names on Windows.
    Returns a list of driver names.
    """
    installed = set()

    # Prefer WMIC CSV output when available (older Windows versions).
    try:
        result = subprocess.run(
            ["wmic", "path", "win32_pnpsigneddriver", "get", "infname", "/format:csv"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0 and result.stdout:
            for line in result.stdout.splitlines():
                line = line.strip()
                if not line or line.lower().startswith("node,"):
                    continue
                parts = line.split(",")
                if not parts:
                    continue
                inf_name = parts[-1].strip().strip('"')
                if inf_name and inf_name.lower() != "infname":
                    driver_name = os.path.splitext(inf_name)[0].lower()
                    installed.add(driver_name)
    except Exception as e:
        print(f"WMIC scan error: {e}")

    # Fallback for newer Windows where WMIC is unavailable/disabled.
    if not installed:
        try:
            ps_cmd = (
                "Get-CimInstance Win32_PnPSignedDriver | "
                "Select-Object -ExpandProperty InfName"
            )
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command", ps_cmd],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and result.stdout:
                for line in result.stdout.splitlines():
                    inf_name = line.strip().strip('"')
                    if inf_name:
                        driver_name = os.path.splitext(inf_name)[0].lower()
                        installed.add(driver_name)
        except Exception as e:
            print(f"PowerShell scan error: {e}")

    return sorted(installed)

@app.get("/drivers")
def get_drivers():
    installed_driver_names = scan_installed_drivers()
    installed_lookup = set(installed_driver_names)
    installed_drivers = [
        {
            "Driver Name": name,
            "Device": "Unknown",
            "Impact": "Low",
            "RiskScore": 0,
            "Status": "Installed",
        }
        for name in installed_driver_names
    ]

    missing_drivers = []
    for driver in EXPECTED_DRIVERS:
        if driver["Driver Name"].lower() not in installed_lookup:
            impact = _classify_impact(driver.get("Device", ""))
            missing_drivers.append(
                {
                    **driver,
                    "Impact": impact,
                    "RiskScore": _impact_score(impact),
                    "Status": "Missing",
                }
            )

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
