"""Patch orchestration using native package managers."""

from __future__ import annotations

import json
import platform
import re
import shutil
import subprocess
from dataclasses import dataclass


@dataclass
class PatchInstallResult:
    status: str
    software: str
    new_version: str
    provider: str
    command: str
    stderr: str = ""


class PatchOrchestrator:
    """Install software patches via winget/apt/brew."""

    def _provider(self) -> str:
        system = platform.system()
        if system == "Windows" and shutil.which("winget"):
            return "winget"
        if system == "Linux" and shutil.which("apt-get"):
            return "apt"
        if system == "Darwin" and shutil.which("brew"):
            return "brew"
        raise RuntimeError("No supported patch provider available on this host")

    def _run(self, command: list[str], timeout: int = 1800) -> subprocess.CompletedProcess:
        return subprocess.run(command, capture_output=True, text=True, timeout=timeout, check=False)

    def install_patch(self, software: str) -> PatchInstallResult:
        package_name = software.strip()
        if not package_name:
            raise RuntimeError("Software name is required")

        provider = self._provider()
        commands: list[list[str]] = []
        if provider == "winget":
            commands = [
                [
                    "winget",
                    "upgrade",
                    "--name",
                    package_name,
                    "--exact",
                    "--accept-package-agreements",
                    "--accept-source-agreements",
                    "--disable-interactivity",
                ]
            ]
        elif provider == "apt":
            commands = [
                ["apt-get", "update"],
                ["apt-get", "install", "--only-upgrade", "-y", package_name],
            ]
        elif provider == "brew":
            commands = [["brew", "upgrade", package_name]]

        combined_command = " && ".join(" ".join(part for part in command) for command in commands)
        stderr_parts: list[str] = []
        for command in commands:
            result = self._run(command)
            if result.returncode != 0:
                stderr_parts.append((result.stderr or "").strip())
                return PatchInstallResult(
                    status="patch_failed",
                    software=package_name,
                    new_version="Unknown",
                    provider=provider,
                    command=combined_command,
                    stderr=" | ".join(part for part in stderr_parts if part),
                )

        new_version = self.detect_version(package_name, provider)
        return PatchInstallResult(
            status="patch_installed",
            software=package_name,
            new_version=new_version,
            provider=provider,
            command=combined_command,
        )

    def detect_version(self, software: str, provider: str) -> str:
        package_name = software.strip()
        if provider == "winget":
            result = self._run(
                ["winget", "show", "--name", package_name, "--exact", "--accept-source-agreements", "--disable-interactivity"],
                timeout=120,
            )
            if result.returncode != 0:
                return "Unknown"
            match = re.search(r"^\s*Version:\s*([^\r\n]+)", result.stdout or "", flags=re.IGNORECASE | re.MULTILINE)
            return match.group(1).strip() if match else "Unknown"

        if provider == "apt":
            result = self._run(["apt-cache", "policy", package_name], timeout=120)
            if result.returncode != 0:
                return "Unknown"
            match = re.search(r"Installed:\s*([^\r\n]+)", result.stdout or "", flags=re.IGNORECASE)
            return match.group(1).strip() if match else "Unknown"

        if provider == "brew":
            result = self._run(["brew", "info", package_name, "--json=v2"], timeout=120)
            if result.returncode != 0:
                return "Unknown"
            try:
                payload = json.loads(result.stdout or "{}")
            except json.JSONDecodeError:
                return "Unknown"
            formulae = payload.get("formulae", [])
            if formulae:
                installed = formulae[0].get("installed", [])
                if installed:
                    return str(installed[-1].get("version", "Unknown"))
            casks = payload.get("casks", [])
            if casks:
                installed = casks[0].get("installed", [])
                if installed:
                    return str(installed[-1].get("version", "Unknown"))
            return "Unknown"

        return "Unknown"
