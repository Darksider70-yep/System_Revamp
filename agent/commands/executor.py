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
    device_id = (
        params.get("device_id")
        or params.get("deviceId")
        or params.get("instance_id")
        or params.get("device_id_pnp")
    )
    device_name = params.get("device_name") or params.get("name")

    if platform.system() != "Windows":
        return False, {}, "PnP device enable only supported on Windows endpoints."

    # If instance ID not explicitly passed, dynamically resolve from device_name via CIM
    if not device_id and device_name:
        try:
            clean_name = device_name.replace("'", "''")
            ps_lookup = (
                f"Get-CimInstance Win32_PnPEntity | "
                f"Where-Object {{ $_.Name -like '*{clean_name}*' }} | "
                f"Select-Object -ExpandProperty DeviceID -First 1"
            )
            lookup_res = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_lookup],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            if lookup_res.returncode == 0 and lookup_res.stdout.strip():
                device_id = lookup_res.stdout.strip()
        except Exception:
            pass

    if not device_id:
        return False, {}, f"Unable to identify PnP device. Parameter 'device_id' or valid 'device_name' required. Received: {params}"

    if dry_run:
        return True, {"action": "enable-device", "target": device_id}, f"Dry run: Enable device '{device_id}' simulated."

    try:
        # 1. Primary method: Native Windows pnputil (authoritative, silent, non-interactive)
        res = subprocess.run(
            ["pnputil", "/enable-device", device_id],
            capture_output=True,
            text=True,
            timeout=25,
            check=False,
        )
        log = res.stdout + ("\n" + res.stderr if res.stderr else "")
        if res.returncode == 0 or "enabled successfully" in log.lower():
            # Refresh device tree
            subprocess.run(["pnputil", "/scan-devices"], capture_output=True, timeout=15, check=False)
            return True, {"returncode": 0, "device_id": device_id, "method": "pnputil"}, log

        # 2. Fallback method: PowerShell Enable-PnpDevice with bypass
        ps_cmd = f"Enable-PnpDevice -InstanceId '{device_id}' -Confirm:$false -ErrorAction SilentlyContinue"
        res_ps = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        ps_log = res_ps.stdout + ("\n" + res_ps.stderr if res_ps.stderr else "")
        success = (res_ps.returncode == 0)
        return success, {"returncode": res_ps.returncode, "device_id": device_id, "method": "powershell"}, f"{log}\n{ps_log}"
    except Exception as e:
        return False, {"error": str(e)}, str(e)


def execute_upgrade_package(params: dict, dry_run: bool) -> Tuple[bool, Dict[str, Any], str]:
    package_id = params.get("package_id") or params.get("winget_id")
    app_name = params.get("package_name") or params.get("name") or params.get("app_name")

    if not package_id and app_name:
        from agent.collectors.software import _resolve_winget_id
        package_id = _resolve_winget_id(app_name)

    if not package_id and app_name and platform.system() == "Windows":
        try:
            search_res = subprocess.run(
                ["winget", "search", "--name", app_name, "--accept-source-agreements"],
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            if search_res.returncode == 0 and search_res.stdout:
                lines = [line.strip() for line in search_res.stdout.splitlines() if line.strip()]
                dash_idx = -1
                for idx, line in enumerate(lines):
                    if set(line.replace(" ", "")) <= {"-"}:
                        dash_idx = idx
                        break
                if dash_idx != -1 and dash_idx + 1 < len(lines):
                    candidate = lines[dash_idx + 1]
                    import re
                    parts = re.split(r'\s{2,}', candidate)
                    if len(parts) >= 2:
                        package_id = parts[1].strip()
        except Exception:
            pass

    if not package_id and app_name:
        package_id = app_name

    if not package_id:
        return False, {}, "Missing required package_id parameter."

    id_flag = "--id" if "." in package_id else "--name"
    cmd_str = f"winget upgrade {id_flag} {package_id} --exact --accept-package-agreements --accept-source-agreements --disable-interactivity"
    if dry_run:
        return True, {"action": "upgrade-package", "command": cmd_str}, f"Dry run preview: {cmd_str}"

    if platform.system() != "Windows":
        return False, {}, "Winget upgrades only supported on Windows endpoints."

    try:
        res = subprocess.run(
            [
                "winget",
                "upgrade",
                id_flag,
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
        success = (res.returncode == 0 or "Successfully installed" in res.stdout or "No applicable update found" in res.stdout)
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


def verify_command_signature(command_id: str, command_type: str, params: dict, received_sig: str, signing_key: str) -> bool:
    """
    Verifies HMAC-SHA256 signature for remediation command execution.
    Matches specification in docs/api_reference.md section 1.5.
    """
    import hmac
    import hashlib
    params_sorted_json = json.dumps(params, sort_keys=True)
    payload = f"{command_id}:{command_type}:{params_sorted_json}".encode("utf-8")
    expected_sig = hmac.new(signing_key.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_sig, received_sig)


# Functional alias
verify_signature = verify_command_signature
