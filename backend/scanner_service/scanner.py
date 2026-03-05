"""Cross-platform software inventory scanner helpers."""

from __future__ import annotations

import json
import logging
import platform
import subprocess
from typing import Dict, List, Set, Tuple

LOGGER = logging.getLogger("scanner_service.scanner")


def _deduplicate_apps(apps: List[Dict[str, str]]) -> List[Dict[str, str]]:
    seen: Set[Tuple[str, str]] = set()
    unique_apps: List[Dict[str, str]] = []
    for app in apps:
        name = str(app.get("name", "")).strip()
        version = str(app.get("version", "Unknown")).strip()
        if not name:
            continue
        key = (name.lower(), version.lower())
        if key in seen:
            continue
        seen.add(key)
        unique_apps.append({"name": name, "version": version or "Unknown"})
    return sorted(unique_apps, key=lambda item: item["name"].lower())


def _read_reg_value(reg_key, value_name: str):
    import winreg

    try:
        value, _ = winreg.QueryValueEx(reg_key, value_name)
        return value
    except OSError:
        return None


def _scan_windows_registry() -> List[Dict[str, str]]:
    import winreg

    uninstall_paths = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ]
    hives = [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]

    apps: List[Dict[str, str]] = []
    for hive in hives:
        for uninstall_path in uninstall_paths:
            try:
                with winreg.OpenKey(hive, uninstall_path) as uninstall_key:
                    key_count, _, _ = winreg.QueryInfoKey(uninstall_key)
                    for index in range(key_count):
                        sub_key_name = winreg.EnumKey(uninstall_key, index)
                        try:
                            with winreg.OpenKey(uninstall_key, sub_key_name) as app_key:
                                name = _read_reg_value(app_key, "DisplayName")
                                if not name:
                                    continue
                                version = _read_reg_value(app_key, "DisplayVersion") or "Unknown"
                                apps.append(
                                    {
                                        "name": str(name).strip(),
                                        "version": str(version).strip() or "Unknown",
                                    }
                                )
                        except OSError:
                            continue
            except OSError:
                continue

    return _deduplicate_apps(apps)


def _scan_linux_dpkg() -> List[Dict[str, str]]:
    apps: List[Dict[str, str]] = []
    try:
        result = subprocess.run(
            ["dpkg-query", "-W", "-f=${Package} ${Version}\n"],
            capture_output=True,
            text=True,
            timeout=25,
            check=False,
        )
    except FileNotFoundError:
        LOGGER.warning("dpkg-query is not available on this host")
        return []
    except Exception as exc:
        LOGGER.exception("Linux package scan failed: %s", exc)
        return []

    if result.returncode != 0:
        LOGGER.warning("dpkg-query command failed: %s", (result.stderr or "").strip())
        return []

    for line in (result.stdout or "").splitlines():
        raw = line.strip()
        if not raw:
            continue
        if " " not in raw:
            apps.append({"name": raw, "version": "Unknown"})
            continue
        package_name, package_version = raw.split(" ", 1)
        apps.append({"name": package_name.strip(), "version": package_version.strip() or "Unknown"})

    return _deduplicate_apps(apps)


def _scan_macos_system_profiler() -> List[Dict[str, str]]:
    apps: List[Dict[str, str]] = []
    try:
        result = subprocess.run(
            ["system_profiler", "SPApplicationsDataType", "-json"],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except FileNotFoundError:
        LOGGER.warning("system_profiler is not available on this host")
        return []
    except Exception as exc:
        LOGGER.exception("macOS package scan failed: %s", exc)
        return []

    if result.returncode != 0:
        LOGGER.warning("system_profiler command failed: %s", (result.stderr or "").strip())
        return []

    try:
        payload = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        LOGGER.warning("Unable to parse system_profiler JSON output")
        return []

    for app in payload.get("SPApplicationsDataType", []):
        name = str(app.get("_name", "")).strip()
        version = str(app.get("version", "Unknown")).strip()
        if name:
            apps.append({"name": name, "version": version or "Unknown"})

    return _deduplicate_apps(apps)


def get_installed_apps() -> List[Dict[str, str]]:
    """Detect installed applications from the host platform."""
    os_name = platform.system()
    if os_name == "Windows":
        return _scan_windows_registry()
    if os_name == "Linux":
        return _scan_linux_dpkg()
    if os_name == "Darwin":
        return _scan_macos_system_profiler()

    LOGGER.warning("Unsupported platform for scan: %s", os_name)
    return []
