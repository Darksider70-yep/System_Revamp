import platform
import subprocess
import json

def scan_installed_apps():
    os_type = platform.system()
    apps = []

    if os_type == "Windows":
        try:
            # Use WMIC to list installed apps
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
            # Debian-based: dpkg-query
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

    elif os_type == "Darwin":  # macOS
        try:
            # Use system_profiler to get applications info
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


# 🎯 Fallback for demo (hardcoded apps if scan fails)
def get_installed_apps():
    try:
        scanned = scan_installed_apps()
        if scanned:
            return scanned
    except Exception as e:
        print(f"Scan error: {e}")

    # fallback hardcoded list for hackathon demo
    return [
        {"name": "Node.js", "version": "23.0.0"},
        {"name": "Java(TM) SE Development Kit 21.0.6 (64-bit)", "version": "22.0.1"},
        {"name": "Epic Games Launcher", "version": "1.4.0.0"},
        {"name": "Dropbox Update Helper", "version": "1.5.0.0"},
        {"name": "Microsoft Teams Meeting Add-in for Microsoft Office", "version": "1.25.0"},
        {"name": "Python 3.13.3 Core Interpreter (64-bit)", "version": "3.14.0"}
    ]
