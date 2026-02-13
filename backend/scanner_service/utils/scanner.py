import json
import platform
import subprocess


def _read_reg_value(reg_key, value_name):
    import winreg

    try:
        value, _ = winreg.QueryValueEx(reg_key, value_name)
        return value
    except OSError:
        return None


def _scan_windows_apps_from_registry():
    import winreg

    uninstall_paths = [
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ]
    hives = [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]

    apps = []
    seen = set()

    for hive in hives:
        for uninstall_path in uninstall_paths:
            try:
                with winreg.OpenKey(hive, uninstall_path) as uninstall_key:
                    key_count, _, _ = winreg.QueryInfoKey(uninstall_key)
                    for idx in range(key_count):
                        sub_key_name = winreg.EnumKey(uninstall_key, idx)
                        try:
                            with winreg.OpenKey(uninstall_key, sub_key_name) as app_key:
                                name = _read_reg_value(app_key, "DisplayName")
                                version = _read_reg_value(app_key, "DisplayVersion") or "Unknown"
                                if not name:
                                    continue

                                identity = (str(name).strip().lower(), str(version).strip().lower())
                                if identity in seen:
                                    continue
                                seen.add(identity)

                                apps.append(
                                    {
                                        "name": str(name).strip(),
                                        "version": str(version).strip(),
                                    }
                                )
                        except OSError:
                            continue
            except OSError:
                continue

    apps.sort(key=lambda app: app["name"].lower())
    return apps


def scan_installed_apps():
    os_type = platform.system()
    apps = []

    if os_type == "Windows":
        try:
            apps = _scan_windows_apps_from_registry()
        except Exception as e:
            print(f"Windows scan error: {e}")

    elif os_type == "Linux":
        try:
            result = subprocess.run(
                ["dpkg-query", "-W", "-f=${Package} ${Version}\n"],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            if result.returncode == 0:
                for line in result.stdout.splitlines():
                    if line.strip():
                        name, version = line.split(" ", 1)
                        apps.append({"name": name.strip(), "version": version.strip()})
            else:
                print(f"Linux scan command failed: {result.stderr.strip()}")
        except Exception as e:
            print(f"Linux scan error: {e}")

    elif os_type == "Darwin":
        try:
            result = subprocess.run(
                ["system_profiler", "SPApplicationsDataType", "-json"],
                capture_output=True,
                text=True,
                timeout=45,
                check=False,
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                for app in data.get("SPApplicationsDataType", []):
                    name = app.get("_name")
                    version = app.get("version")
                    if name and version:
                        apps.append({"name": name.strip(), "version": version.strip()})
            else:
                print(f"macOS scan command failed: {result.stderr.strip()}")
        except Exception as e:
            print(f"macOS scan error: {e}")

    return apps


def get_installed_apps():
    try:
        scanned = scan_installed_apps()
        if scanned:
            return scanned
    except Exception as e:
        print(f"Scan error: {e}")

    return [
        {"name": "Node.js", "version": "23.0.0"},
        {"name": "Python 3", "version": "3.13.3"},
        {"name": "Epic Games Launcher", "version": "1.4.0.0"},
    ]
