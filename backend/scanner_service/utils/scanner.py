import platform
import subprocess
import json


def scan_installed_apps():
    os_type = platform.system()
    apps = []

    if os_type == "Windows":
        try:
            result = subprocess.check_output(
                ['wmic', 'product', 'get', 'name,version'],
                shell=True
            ).decode(errors="ignore").split("\n")

            for line in result[1:]:
                if line.strip():
                    parts = line.strip().rsplit(" ", 1)
                    if len(parts) == 2:
                        name, version = parts
                        apps.append({
                            "name": name.strip(),
                            "version": version.strip()
                        })
        except Exception as e:
            print(f"Windows scan error: {e}")

    elif os_type == "Linux":
        try:
            result = subprocess.check_output(
                ['dpkg-query', '-W', '-f=${Package} ${Version}\n'],
                shell=True
            ).decode().split("\n")

            for line in result:
                if line.strip():
                    name, version = line.split(" ", 1)
                    apps.append({
                        "name": name.strip(),
                        "version": version.strip()
                    })
        except Exception as e:
            print(f"Linux scan error: {e}")

    elif os_type == "Darwin":
        try:
            result = subprocess.check_output(
                ['system_profiler', 'SPApplicationsDataType', '-json']
            )
            data = json.loads(result)

            for app in data.get("SPApplicationsDataType", []):
                name = app.get("_name")
                version = app.get("version")
                if name and version:
                    apps.append({
                        "name": name.strip(),
                        "version": version.strip()
                    })
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

    # fallback demo data
    return [
        {"name": "Node.js", "version": "23.0.0"},
        {"name": "Python 3", "version": "3.13.3"},
        {"name": "Epic Games Launcher", "version": "1.4.0.0"},
    ]
