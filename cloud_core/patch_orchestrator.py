"""Patch orchestration using native package managers."""

from __future__ import annotations

import json
import platform
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass
from typing import Iterable, Sequence

from common.metrics import record_patch_result

@dataclass(slots=True)
class PatchCandidate:
    name: str
    package_id: str
    current_version: str
    available_version: str
    provider: str
    source: str | None = None


@dataclass(slots=True)
class PatchInstallResult:
    status: str
    software: str
    new_version: str
    provider: str
    command: str
    stderr: str = ""
    package_id: str | None = None


class PatchOrchestrator:
    """Install software patches via winget/apt/brew."""

    def _provider(self) -> str:
        system = platform.system()
        if system == "Windows" and shutil.which("winget"):
            return "winget"
        if system == "Linux" and shutil.which("apt-get") and shutil.which("apt"):
            return "apt"
        if system == "Darwin" and shutil.which("brew"):
            return "brew"
        raise RuntimeError("No supported patch provider available on this host")

    def _run(self, command: Sequence[str], timeout: int = 1800) -> subprocess.CompletedProcess[str]:
        return subprocess.run(list(command), capture_output=True, text=True, timeout=timeout, check=False)

    def _parse_winget_upgrades(self, stdout: str) -> list[PatchCandidate]:
        rows: list[PatchCandidate] = []
        for line in stdout.splitlines():
            raw = line.rstrip()
            if not raw or raw.lower().startswith(("name", "---", "the following")):
                continue
            parts = re.split(r"\s{2,}", raw.strip())
            if len(parts) < 4:
                continue
            if len(parts) == 4:
                name, package_id, current_version, available_version = parts
                source = None
            else:
                name, package_id, current_version, available_version, *rest = parts
                source = " ".join(rest).strip() or None
            rows.append(
                PatchCandidate(
                    name=name.strip(),
                    package_id=package_id.strip(),
                    current_version=current_version.strip(),
                    available_version=available_version.strip(),
                    provider="winget",
                    source=source,
                )
            )
        return rows

    def _list_winget_outdated(self) -> list[PatchCandidate]:
        command = [
            "winget",
            "upgrade",
            "--include-unknown",
            "--accept-source-agreements",
            "--disable-interactivity",
        ]
        result = self._run(command, timeout=120)
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or "winget upgrade failed").strip())
        return self._parse_winget_upgrades(result.stdout or "")

    def _list_apt_outdated(self) -> list[PatchCandidate]:
        result = self._run(["apt", "list", "--upgradable"], timeout=120)
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or "apt list failed").strip())

        rows: list[PatchCandidate] = []
        pattern = re.compile(r"^(?P<name>[^/]+)/[^ ]+\s+(?P<available>[^ ]+).*\[upgradable from: (?P<current>[^\]]+)\]")
        for line in result.stdout.splitlines():
            raw = line.strip()
            if not raw or raw.lower().startswith("listing"):
                continue
            match = pattern.search(raw)
            if not match:
                continue
            rows.append(
                PatchCandidate(
                    name=match.group("name").strip(),
                    package_id=match.group("name").strip(),
                    current_version=match.group("current").strip(),
                    available_version=match.group("available").strip(),
                    provider="apt",
                )
            )
        return rows

    def _list_brew_outdated(self) -> list[PatchCandidate]:
        result = self._run(["brew", "outdated", "--json=v2"], timeout=120)
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout or "brew outdated failed").strip())

        try:
            payload = json.loads(result.stdout or "{}")
        except json.JSONDecodeError as exc:
            raise RuntimeError("Unable to parse brew outdated JSON") from exc

        rows: list[PatchCandidate] = []
        for formula in payload.get("formulae", []):
            installed_versions = formula.get("installed_versions") or []
            rows.append(
                PatchCandidate(
                    name=str(formula.get("name", "")).strip(),
                    package_id=str(formula.get("name", "")).strip(),
                    current_version=str(installed_versions[-1] if installed_versions else "Unknown").strip(),
                    available_version=str(formula.get("current_version", "Unknown")).strip(),
                    provider="brew",
                    source="formula",
                )
            )
        for cask in payload.get("casks", []):
            installed_versions = cask.get("installed_versions") or []
            rows.append(
                PatchCandidate(
                    name=str(cask.get("name", cask.get("token", ""))).strip() or str(cask.get("token", "")).strip(),
                    package_id=str(cask.get("token", "")).strip(),
                    current_version=str(installed_versions[-1] if installed_versions else "Unknown").strip(),
                    available_version=str(cask.get("current_version", "Unknown")).strip(),
                    provider="brew",
                    source="cask",
                )
            )
        return [row for row in rows if row.package_id]

    def list_outdated(self, targets: Sequence[str] | None = None) -> list[PatchCandidate]:
        provider = self._provider()
        if provider == "winget":
            rows = self._list_winget_outdated()
        elif provider == "apt":
            rows = self._list_apt_outdated()
        else:
            rows = self._list_brew_outdated()

        if not targets:
            return rows

        target_tokens = [str(item).strip().lower() for item in targets if str(item).strip()]
        filtered: list[PatchCandidate] = []
        for row in rows:
            haystack = f"{row.name} {row.package_id}".lower()
            if any(token == row.package_id.lower() or token == row.name.lower() or token in haystack for token in target_tokens):
                filtered.append(row)
        return filtered

    def export_patch_metadata(self, targets: Sequence[str] | None = None) -> list[dict[str, str | None]]:
        return [asdict(item) for item in self.list_outdated(targets=targets)]

    def _build_upgrade_commands(self, candidate: PatchCandidate) -> list[list[str]]:
        if candidate.provider == "winget":
            return [
                [
                    "winget",
                    "upgrade",
                    "--id",
                    candidate.package_id,
                    "--exact",
                    "--accept-package-agreements",
                    "--accept-source-agreements",
                    "--disable-interactivity",
                ]
            ]
        if candidate.provider == "apt":
            return [
                ["apt-get", "update"],
                ["apt-get", "install", "--only-upgrade", "-y", candidate.package_id],
            ]
        return [["brew", "upgrade", candidate.package_id]]

    def _match_candidate(self, software: str) -> PatchCandidate:
        candidates = self.list_outdated(targets=[software])
        if not candidates:
            raise RuntimeError(f"No outdated package matched '{software}'")

        software_token = software.strip().lower()
        for candidate in candidates:
            if software_token in {candidate.name.lower(), candidate.package_id.lower()}:
                return candidate
        return candidates[0]

    def install_patch(self, software: str) -> PatchInstallResult:
        if not software.strip():
            raise RuntimeError("Software name is required")

        candidate = self._match_candidate(software)
        commands = self._build_upgrade_commands(candidate)
        combined_command = " && ".join(" ".join(part for part in command) for command in commands)

        stderr_parts: list[str] = []
        for command in commands:
            result = self._run(command)
            if result.returncode != 0:
                stderr_parts.append((result.stderr or result.stdout or "").strip())
                patch_result = PatchInstallResult(
                    status="patch_failed",
                    software=candidate.name,
                    new_version=candidate.current_version,
                    provider=candidate.provider,
                    command=combined_command,
                    stderr=" | ".join(part for part in stderr_parts if part),
                    package_id=candidate.package_id,
                )
                record_patch_result("patch_orchestrator", candidate.provider, patch_result.status)
                return patch_result

        new_version = self.detect_version(candidate.package_id, candidate.provider) or candidate.available_version
        patch_result = PatchInstallResult(
            status="patch_installed",
            software=candidate.name,
            new_version=new_version,
            provider=candidate.provider,
            command=combined_command,
            package_id=candidate.package_id,
        )
        record_patch_result("patch_orchestrator", candidate.provider, patch_result.status)
        return patch_result

    def auto_patch(self, targets: Sequence[str] | None = None) -> dict[str, list[dict[str, str]]]:
        patched: list[dict[str, str]] = []
        failed: list[dict[str, str]] = []

        candidates = self.list_outdated(targets=targets)
        for candidate in candidates:
            result = self.install_patch(candidate.package_id)
            item = {
                "software": result.software,
                "package_id": result.package_id or candidate.package_id,
                "provider": result.provider,
                "version": result.new_version,
            }
            if result.status == "patch_installed":
                patched.append(item)
            else:
                failed.append({**item, "error": result.stderr})
        return {"patched": patched, "failed": failed}

    def detect_version(self, software: str, provider: str | None = None) -> str:
        package_name = software.strip()
        selected_provider = provider or self._provider()
        if selected_provider == "winget":
            result = self._run(
                [
                    "winget",
                    "show",
                    "--id",
                    package_name,
                    "--exact",
                    "--accept-source-agreements",
                    "--disable-interactivity",
                ],
                timeout=120,
            )
            if result.returncode != 0:
                return "Unknown"
            match = re.search(r"^\s*Version:\s*([^\r\n]+)", result.stdout or "", flags=re.IGNORECASE | re.MULTILINE)
            return match.group(1).strip() if match else "Unknown"

        if selected_provider == "apt":
            result = self._run(["apt-cache", "policy", package_name], timeout=120)
            if result.returncode != 0:
                return "Unknown"
            match = re.search(r"Installed:\s*([^\r\n]+)", result.stdout or "", flags=re.IGNORECASE)
            return match.group(1).strip() if match else "Unknown"

        if selected_provider == "brew":
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

    def provider_name(self) -> str:
        return self._provider()

    def summarize_targets(self, targets: Iterable[str]) -> list[str]:
        return [str(item).strip() for item in targets if str(item).strip()]
