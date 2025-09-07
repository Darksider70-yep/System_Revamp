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

def scan_installed_drivers():
    """
    Uses WMIC to get installed drivers on Windows.
    Returns a list of driver names.
    """
    installed = []
    try:
        result = subprocess.run(
            ["wmic", "path", "win32_pnpsigneddriver", "get", "devicename,infname"],
            capture_output=True,
            text=True,
        )
        lines = result.stdout.strip().splitlines()[1:]  # skip header
        for line in lines:
            parts = line.split()
            if len(parts) >= 2:
                inf_name = parts[-1]  # usually the .inf file
                driver_name = os.path.splitext(inf_name)[0]
                installed.append(driver_name.lower())
    except Exception as e:
        print(f"Error scanning drivers: {e}")
    return installed

@app.get("/drivers")
def get_drivers():
    installed_driver_names = scan_installed_drivers()
    installed_drivers = [{"Driver Name": name, "Device": "Unknown", "Status": "Installed"} for name in installed_driver_names]

    missing_drivers = []
    for driver in EXPECTED_DRIVERS:
        if driver["Driver Name"].lower() not in installed_driver_names:
            missing_drivers.append({**driver, "Status": "Missing"})

    return {
        "missingDrivers": missing_drivers,
        "installedDrivers": installed_drivers
    }
