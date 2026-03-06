"""System information utilities for real-time monitoring."""

from __future__ import annotations

import getpass
import os
import platform
import socket
from pathlib import Path
from typing import Dict

import psutil

GIB = 1024**3


def _cpu_name() -> str:
    direct = (platform.processor() or "").strip()
    if direct:
        return direct

    system = platform.system()
    if system == "Linux":
        cpuinfo = Path("/proc/cpuinfo")
        if cpuinfo.exists():
            try:
                for line in cpuinfo.read_text(encoding="utf-8", errors="ignore").splitlines():
                    if line.lower().startswith("model name"):
                        _, value = line.split(":", 1)
                        clean = value.strip()
                        if clean:
                            return clean
            except OSError:
                pass
    if system == "Windows":
        env_name = os.environ.get("PROCESSOR_IDENTIFIER", "").strip()
        if env_name:
            return env_name

    return "Unknown CPU"


def _gpu_name() -> str:
    try:
        import GPUtil  # type: ignore

        gpus = GPUtil.getGPUs()
        if not gpus:
            return "Unavailable"
        names = sorted({str(gpu.name).strip() for gpu in gpus if str(gpu.name).strip()})
        return ", ".join(names) if names else "Unavailable"
    except Exception:
        return "Unavailable"


def _disk_path() -> str:
    if platform.system() == "Windows":
        return os.environ.get("SystemDrive", "C:") + "\\"
    return "/"


def collect_system_info() -> Dict[str, object]:
    """Collect host system details for monitoring surfaces."""
    disk_usage = psutil.disk_usage(_disk_path())
    memory = psutil.virtual_memory()

    return {
        "os": platform.system(),
        "os_version": f"{platform.system()} {platform.release()}".strip(),
        "cpu": _cpu_name(),
        "cores": int(psutil.cpu_count(logical=True) or 0),
        "ram_gb": round(memory.total / GIB, 2),
        "gpu": _gpu_name(),
        "disk_total_gb": round(disk_usage.total / GIB, 2),
        "disk_free_gb": round(disk_usage.free / GIB, 2),
        "hostname": socket.gethostname(),
        "user": getpass.getuser(),
    }

