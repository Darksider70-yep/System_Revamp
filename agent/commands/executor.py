import json
import os
import platform
import subprocess
from typing import Dict, Any, Tuple
from agent.collectors.drivers import collect_drivers
from agent.collectors.protection import audit_software_binary
from agent.collectors.software import collect_installed_software


def execute_rescan(params: dict, dry_run: bool) -> Tuple[bool, Dict[str, Any], str]:
    if dry_run:
        return True, {"action": "rescan", "status": "dry_run_success"}, "Dry run: inventory rescan simulated."
    # In live mode, caller will trigger scan_and_report
    return True, {"action": "rescan", "status": "completed"}, "Inventory rescan completed successfully."


def execute_scan_drivers(params: dict, dry_run: bool) -> Tuple[bool, Dict[str, Any], str]:
    if dry_run:
        return True, {"action": "scan-drivers", "command": "pnputil /scan-devices"}, "Dry run: pnputil hardware rescan simulated."

    if platform.system() != "Windows":
        return False, {}, "Driver diagnostics only supported on Windows."

    try:
        res = subprocess.run(
            ["pnputil", "/scan-devices"],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        log = res.stdout + ("\n" + res.stderr if res.stderr else "")
        return res.returncode == 0, {"returncode": res.returncode}, log
    except Exception as e:
        return False, {"error": str(e)}, str(e)


def execute_enable_device(params: dict, dry_run: bool) -> Tuple[bool, Dict[str, Any], str]:
    device_id = params.get("device_id") or params.get("deviceId")
    if not device_id:
        return False, {}, "Missing required device_id parameter."

    if dry_run:
        return True, {"action": "enable-device", "target": device_id}, f"Dry run: Enable-PnpDevice -InstanceId '{device_id}' simulated."

    if platform.system() != "Windows":
        return False, {}, "PnP device enable only supported on Windows."

    try:
        ps_cmd = f"Enable-PnpDevice -InstanceId '{device_id}' -Confirm:$false"
        res = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        log = res.stdout + ("\n" + res.stderr if res.stderr else "")
        return res.returncode == 0, {"returncode": res.returncode}, log
    except Exception as e:
        return False, {"error": str(e)}, str(e)


def execute_upgrade_package(params: dict, dry_run: bool) -> Tuple[bool, Dict[str, Any], str]:
    package_id = params.get("package_id") or params.get("winget_id")
    if not package_id:
        return False, {}, "Missing required package_id parameter."

    cmd_str = f"winget upgrade --id {package_id} --exact --accept-package-agreements --accept-source-agreements --disable-interactivity"
    if dry_run:
        return True, {"action": "upgrade-package", "command": cmd_str}, f"Dry run preview: {cmd_str}"

    if platform.system() != "Windows":
        return False, {}, "Winget upgrades only supported on Windows endpoints."

    try:
        res = subprocess.run(
            [
                "winget",
                "upgrade",
                "--id",
                package_id,
                "--exact",
                "--accept-package-agreements",
                "--accept-source-agreements",
                "--disable-interactivity",
            ],
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
        log = res.stdout + ("\n" + res.stderr if res.stderr else "")
        success = (res.returncode == 0 or "Successfully installed" in res.stdout)
        return success, {"returncode": res.returncode, "package_id": package_id}, log
    except Exception as e:
        return False, {"error": str(e)}, str(e)


COMMAND_DISPATCHER = {
    "rescan": execute_rescan,
    "scan-drivers": execute_scan_drivers,
    "enable-device": execute_enable_device,
    "upgrade-package": execute_upgrade_package,
}


def dispatch_command(command_type: str, params: dict, dry_run: bool = False) -> Tuple[bool, Dict[str, Any], str]:
    handler = COMMAND_DISPATCHER.get(command_type)
    if not handler:
        return False, {"error": f"Unknown command type: {command_type}"}, f"Command {command_type} not supported."
    return handler(params, dry_run)
