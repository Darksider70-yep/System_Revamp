from __future__ import annotations

import signal
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class ManagedProcess:
    name: str
    command: List[str]
    cwd: str
    popen: subprocess.Popen | None = None


BASE_DIR = Path("/app")
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_BUILD_DIR = BASE_DIR / "frontend_build"

PROCESSES: List[ManagedProcess] = [
    ManagedProcess(
        name="frontend",
        command=[
            sys.executable,
            "-m",
            "http.server",
            "3000",
            "--bind",
            "0.0.0.0",
            "--directory",
            str(FRONTEND_BUILD_DIR),
        ],
        cwd=str(BASE_DIR),
    ),
    ManagedProcess(
        name="scanner-api",
        command=["uvicorn", "scanner_service.main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=str(BACKEND_DIR),
    ),
    ManagedProcess(
        name="drivers-api",
        command=["uvicorn", "drivers_service.drivers_api:app", "--host", "0.0.0.0", "--port", "8001"],
        cwd=str(BACKEND_DIR),
    ),
    ManagedProcess(
        name="version-api",
        command=["uvicorn", "version_service.main:app", "--host", "0.0.0.0", "--port", "8002"],
        cwd=str(BACKEND_DIR),
    ),
]


def start_all() -> None:
    for managed in PROCESSES:
        managed.popen = subprocess.Popen(managed.command, cwd=managed.cwd)
        print(f"[startup] started {managed.name} (pid={managed.popen.pid})", flush=True)


def stop_all(exit_code: int) -> None:
    for managed in PROCESSES:
        proc = managed.popen
        if proc and proc.poll() is None:
            proc.terminate()

    deadline = time.time() + 8
    while time.time() < deadline:
        if all((managed.popen is None or managed.popen.poll() is not None) for managed in PROCESSES):
            break
        time.sleep(0.2)

    for managed in PROCESSES:
        proc = managed.popen
        if proc and proc.poll() is None:
            proc.kill()

    sys.exit(exit_code)


def handle_signal(signum: int, _frame) -> None:
    print(f"[shutdown] received signal {signum}", flush=True)
    stop_all(0)


def monitor() -> None:
    while True:
        for managed in PROCESSES:
            proc = managed.popen
            if proc is None:
                continue
            code = proc.poll()
            if code is not None:
                print(f"[shutdown] {managed.name} exited with code {code}", flush=True)
                stop_all(code if code != 0 else 1)
        time.sleep(0.5)


def main() -> None:
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    start_all()
    monitor()


if __name__ == "__main__":
    main()
