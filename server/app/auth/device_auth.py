import hashlib
import hmac
import secrets
import time
from typing import Tuple
from server.app.core.config import settings


def generate_enrollment_token() -> Tuple[str, str]:
    """Generates a raw enrollment token and its SHA-256 hash for storage."""
    raw_token = f"sr_enroll_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return raw_token, token_hash


def generate_device_token(device_id: str) -> Tuple[str, str]:
    """Generates an individual device token and its SHA-256 hash."""
    random_entropy = secrets.token_urlsafe(32)
    raw_token = f"sr_dev_{device_id}_{random_entropy}"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return raw_token, token_hash


def sign_command(command_id: str, command_type: str, params_str: str) -> str:
    """Signs a command payload with the server's device signing key."""
    message = f"{command_id}:{command_type}:{params_str}".encode("utf-8")
    signature = hmac.new(
        settings.DEVICE_SIGNING_KEY.encode("utf-8"),
        message,
        hashlib.sha256
    ).hexdigest()
    return signature


def verify_command_signature(command_id: str, command_type: str, params_str: str, signature: str) -> bool:
    """Verifies that the command signature was generated with the shared signing key."""
    expected = sign_command(command_id, command_type, params_str)
    return hmac.compare_digest(expected, signature)
