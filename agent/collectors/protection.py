import hashlib
import json
import os
import platform
import re
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, Tuple


def calculate_sha256(file_path: str) -> Optional[str]:
    if not file_path or not os.path.isfile(file_path):
        return None
    try:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return None


def resolve_executable_path(raw_path: str) -> Optional[str]:
    if not raw_path:
        return None
    cleaned = str(raw_path).strip().strip('"')
    if ",0" in cleaned:
        cleaned = cleaned.split(",0", 1)[0]
    if ".exe" in cleaned.lower():
        idx = cleaned.lower().find(".exe")
        cleaned = cleaned[: idx + 4]
    cleaned = os.path.expandvars(cleaned)
    if os.path.isfile(cleaned):
        return cleaned

    # Check directory
    if os.path.isdir(cleaned):
        try:
            for item in os.listdir(cleaned):
                if item.lower().endswith(".exe"):
                    candidate = os.path.join(cleaned, item)
                    if os.path.isfile(candidate):
                        return candidate
        except OSError:
            pass
    return None


def check_authenticode_signature(exe_path: str) -> Tuple[str, str]:
    """
    Returns: (signature_status, signer_name)
    Statuses: Valid, Unsigned, HashMismatch, NotTrusted
    """
    if platform.system() != "Windows" or not exe_path or not os.path.isfile(exe_path):
        return "Unsigned", ""

    try:
        ps_cmd = (
            f"$sig = Get-AuthenticodeSignature -LiteralPath '{exe_path}'; "
            "$signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { '' }; "
            "[PSCustomObject]@{ Status = $sig.Status.ToString(); Signer = $signer } | ConvertTo-Json -Compress"
        )
        res = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_cmd],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=8,
            check=False,
        )
        if res.returncode == 0 and res.stdout.strip():
            data = json.loads(res.stdout)
            raw_status = data.get("Status", "NotSigned")
            raw_signer = data.get("Signer", "")

            # Parse CN from subject
            signer_name = ""
            if "CN=" in raw_signer:
                m = re.search(r"CN=([^,]+)", raw_signer)
                if m:
                    signer_name = m.group(1).strip()
            elif raw_signer:
                signer_name = raw_signer[:60]

            if raw_status == "Valid":
                return "Valid", signer_name
            elif raw_status in ("NotSigned", "UnknownError"):
                return "Unsigned", ""
            elif raw_status == "HashMismatch":
                return "HashMismatch", signer_name
            elif raw_status in ("NotTrusted", "NotValid"):
                return "NotTrusted", signer_name
            else:
                return "Unsigned", ""
    except Exception:
        pass

    return "Unsigned", ""


def audit_software_binary(install_path: str) -> Dict[str, Any]:
    resolved_path = resolve_executable_path(install_path)
    if not resolved_path:
        return {
            "binary_sha256": None,
            "signature_status": "Unsigned",
            "signer_name": "",
        }

    sha256_hash = calculate_sha256(resolved_path)
    sig_status, signer = check_authenticode_signature(resolved_path)

    return {
        "binary_sha256": sha256_hash,
        "signature_status": sig_status,
        "signer_name": signer,
    }
