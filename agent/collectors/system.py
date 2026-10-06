import os
import platform
import shutil
import time
import psutil

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False


def collect_system_metrics() -> dict:
    hostname = platform.node()
    os_name = platform.system()
    os_release = platform.release()
    os_version = platform.version()

    cpu_model = platform.processor() or "Unknown CPU"
    cpu_cores = os.cpu_count() or 1

    # RAM calculation
    ram_total_gb = 0.0
    if PSUTIL_AVAILABLE:
        try:
            ram = psutil.virtual_memory()
            ram_total_gb = round(ram.total / (1024 ** 3), 2)
        except Exception:
            pass

    # Disk calculation
    disk_total_gb = 0.0
    disk_free_gb = 0.0
    try:
        root_drive = "C:\\" if os_name == "Windows" else "/"
        total, used, free = shutil.disk_usage(root_drive)
        disk_total_gb = round(total / (1024 ** 3), 2)
        disk_free_gb = round(free / (1024 ** 3), 2)
    except Exception:
        pass

    # Uptime
    uptime_seconds = 0
    if PSUTIL_AVAILABLE:
        try:
            uptime_seconds = int(time.time() - psutil.boot_time())
        except Exception:
            pass

    return {
        "hostname": hostname,
        "os_name": os_name,
        "os_version": f"{os_release} ({os_version})",
        "cpu_model": cpu_model,
        "cpu_cores": cpu_cores,
        "ram_total_gb": ram_total_gb,
        "disk_total_gb": disk_total_gb,
        "disk_free_gb": disk_free_gb,
        "uptime_seconds": uptime_seconds,
    }
