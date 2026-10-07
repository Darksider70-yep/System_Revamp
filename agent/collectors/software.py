import os
import platform
import subprocess
from typing import List, Dict, Any, Optional

COMMON_WINGET_MAPPINGS: Dict[str, str] = {
    "google chrome": "Google.Chrome",
    "git": "Git.Git",
    "visual studio code": "Microsoft.VisualStudioCode",
    "python": "Python.Python.3",
    "node.js": "OpenJS.NodeJS",
    "nodejs": "OpenJS.NodeJS",
    "vlc media player": "VideoLAN.VLC",
    "7-zip": "7zip.7zip",
    "zoom": "Zoom.Zoom",
    "docker desktop": "Docker.DockerDesktop",
    "postman": "Postman.Postman",
    "dbeaver": "dbeaver.dbeaver",
    "notepad++": "Notepad++.Notepad++",
    "mozilla firefox": "Mozilla.Firefox",
}


def _resolve_winget_id(app_name: str) -> Optional[str]:
    norm = app_name.lower()
    for k, v in COMMON_WINGET_MAPPINGS.items():
        if k in norm:
            return v
    return None


def scan_windows_registry() -> List[Dict[str, Any]]:
    import winreg
    apps = {}

    hives = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", winreg.KEY_READ | winreg.KEY_WOW64_64KEY),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", winreg.KEY_READ | winreg.KEY_WOW64_32KEY),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", winreg.KEY_READ),
    ]

    for root_hive, subkey_path, access_mask in hives:
        try:
            with winreg.OpenKey(root_hive, subkey_path, 0, access_mask) as key:
                num_subkeys = winreg.QueryInfoKey(key)[0]
                for i in range(num_subkeys):
                    try:
                        subkey_name = winreg.EnumKey(key, i)
                        with winreg.OpenKey(key, subkey_name) as subkey:
                            def _get_val(name):
                                try:
                                    val, _ = winreg.QueryValueEx(subkey, name)
                                    return str(val).strip() if val else ""
                                except OSError:
                                    return ""

                            name = _get_val("DisplayName")
                            if not name or _get_val("SystemComponent") == "1" or name.startswith("KB"):
                                continue

                            version = _get_val("DisplayVersion") or "Unknown"
                            publisher = _get_val("Publisher")
                            install_location = _get_val("InstallLocation")
                            display_icon = _get_val("DisplayIcon")

                            key_id = name.lower()
                            if key_id not in apps or (apps[key_id]["version"] == "Unknown" and version != "Unknown"):
                                apps[key_id] = {
                                    "name": name,
                                    "version": version,
                                    "publisher": publisher,
                                    "install_path": install_location or display_icon,
                                    "winget_id": _resolve_winget_id(name),
                                }
                    except OSError:
                        continue
        except OSError:
            continue

    return list(apps.values())


def scan_linux_packages() -> List[Dict[str, Any]]:
    apps = []
    # Try dpkg
    try:
        res = subprocess.run(
            ["dpkg-query", "-W", "-f=${Package}\t${Version}\t${Maintainer}\n"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                parts = line.split("\t")
                if len(parts) >= 2:
                    apps.append({
                        "name": parts[0],
                        "version": parts[1],
                        "publisher": parts[2] if len(parts) > 2 else "",
                        "install_path": "",
                    })
            return apps
    except Exception:
        pass

    # Try rpm
    try:
        res = subprocess.run(
            ["rpm", "-qa", "--queryformat", "%{NAME}\t%{VERSION}\t%{VENDOR}\n"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                parts = line.split("\t")
                if len(parts) >= 2:
                    apps.append({
                        "name": parts[0],
                        "version": parts[1],
                        "publisher": parts[2] if len(parts) > 2 else "",
                        "install_path": "",
                    })
            return apps
    except Exception:
        pass

    return apps


def collect_installed_software() -> List[Dict[str, Any]]:
    system = platform.system()
    if system == "Windows":
        return scan_windows_registry()
    elif system == "Linux":
        return scan_linux_packages()
    return []
