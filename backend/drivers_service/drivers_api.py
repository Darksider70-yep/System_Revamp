"""Driver Scanner Service API (port 8001)."""

from __future__ import annotations

import logging
import os
import platform
import subprocess
from typing import Dict, List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
LOGGER = logging.getLogger("drivers_service")

app = FastAPI(title="Driver Scanner Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

EXPECTED_DRIVERS = [
    {"Driver Name": "nvlddmkm", "Device": "NVIDIA GPU"},
    {"Driver Name": "rt640x64", "Device": "Realtek Network"},
    {"Driver Name": "intelppm", "Device": "CPU Driver"},
    {"Driver Name": "storahci", "Device": "AHCI Controller"},
]


def _normalize_driver_name(inf_name: str) -> str:
    return os.path.splitext(inf_name.strip())[0].lower()


def _impact_for_device(device_name: str) -> str:
    value = device_name.lower()
    if "cpu" in value or "ahci" in value:
        return "Critical"
    if "network" in value:
        return "High"
    if "gpu" in value:
        return "Medium"
    return "Low"


def scan_installed_drivers() -> List[str]:
    """Retrieve installed drivers from Windows via WMIC."""
    if platform.system() != "Windows":
        LOGGER.info("Driver scan requested on non-Windows platform")
        return []

    command = ["wmic", "path", "win32_pnpsigneddriver", "get", "infname"]
    installed = set()

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        if result.returncode == 0:
            for line in (result.stdout or "").splitlines():
                raw = line.strip()
                if not raw or raw.lower() == "infname":
                    continue
                installed.add(_normalize_driver_name(raw))
        else:
            LOGGER.warning("WMIC command failed: %s", (result.stderr or "").strip())
    except FileNotFoundError:
        LOGGER.warning("WMIC is not available on this host")
    except Exception as exc:
        LOGGER.exception("Unexpected driver scan error: %s", exc)

    return sorted(installed)


def _build_known_driver_map() -> Dict[str, Dict[str, str]]:
    return {item["Driver Name"].lower(): item for item in EXPECTED_DRIVERS}


@app.get("/")
def root() -> Dict[str, str]:
    """Health endpoint."""
    return {"message": "Driver Scanner Service running"}


@app.get("/drivers")
def get_drivers() -> Dict[str, object]:
    """Return missing and installed drivers compared to expected set."""
    installed_names = scan_installed_drivers()
    expected_lookup = _build_known_driver_map()
    installed_lookup = set(installed_names)

    installed_drivers: List[Dict[str, str]] = []
    for name in installed_names:
        known = expected_lookup.get(name)
        installed_drivers.append(
            {
                "Driver Name": name,
                "Device": known["Device"] if known else "Unknown Device",
                "Status": "Installed",
            }
        )

    missing_drivers: List[Dict[str, str]] = []
    risk_summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for expected in EXPECTED_DRIVERS:
        expected_name = expected["Driver Name"].lower()
        if expected_name not in installed_lookup:
            impact = _impact_for_device(expected["Device"])
            risk_summary[impact.lower()] += 1
            missing_drivers.append(
                {
                    "Driver Name": expected["Driver Name"],
                    "Device": expected["Device"],
                    "Impact": impact,
                    "Status": "Missing",
                }
            )

    return {
        "missingDrivers": missing_drivers,
        "installedDrivers": installed_drivers,
        "riskSummary": risk_summary,
    }


@app.post("/drivers/download")
def download_missing_drivers(payload: Dict[str, List[str]] | None = None) -> Dict[str, object]:
    """Trigger Windows Update driver workflow for educational demo usage."""
    requested = []
    if isinstance(payload, dict):
        raw = payload.get("drivers", [])
        if isinstance(raw, list):
            requested = [str(item).strip() for item in raw if str(item).strip()]

    steps = [
        ("Start driver scan", "UsoClient StartScan"),
        ("Download driver updates", "UsoClient StartDownload"),
        ("Install downloaded updates", "UsoClient StartInstall"),
        ("Rescan devices", "pnputil /scan-devices"),
    ]

    logs = []
    for step_name, command in steps:
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command", command],
                capture_output=True,
                text=True,
                timeout=90,
                check=False,
            )
            logs.append(
                {
                    "step": step_name,
                    "command": command,
                    "returnCode": result.returncode,
                    "stdout": (result.stdout or "").strip(),
                    "stderr": (result.stderr or "").strip(),
                }
            )
        except Exception as exc:
            logs.append(
                {
                    "step": step_name,
                    "command": command,
                    "returnCode": -1,
                    "stdout": "",
                    "stderr": str(exc),
                }
            )

    success = all(item.get("returnCode", 1) == 0 for item in logs)
    return {
        "requestedDrivers": requested,
        "steps": logs,
        "success": success,
    }
