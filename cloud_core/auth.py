"""Authentication helpers for admin JWT and machine API keys."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

JWT_SECRET_KEY = os.getenv("CLOUD_JWT_SECRET", "replace-this-secret-in-production")
JWT_ALGORITHM = os.getenv("CLOUD_JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = max(5, int(os.getenv("CLOUD_JWT_EXPIRE_MINUTES", "60")))

ADMIN_USERNAME = os.getenv("CLOUD_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("CLOUD_ADMIN_PASSWORD", "admin123")
API_KEY_SALT = os.getenv("CLOUD_API_KEY_SALT", "cloud-security-core-salt")

bearer_scheme = HTTPBearer(auto_error=False)
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


def generate_machine_api_key() -> str:
    return secrets.token_urlsafe(48)


def hash_machine_api_key(api_key: str) -> str:
    data = f"{API_KEY_SALT}:{api_key}".encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def verify_machine_api_key(api_key: str, expected_hash: str) -> bool:
    candidate_hash = hash_machine_api_key(api_key)
    return hmac.compare_digest(candidate_hash, expected_hash)


def validate_admin_credentials(username: str, password: str) -> bool:
    user_ok = hmac.compare_digest(username, ADMIN_USERNAME)
    pass_ok = hmac.compare_digest(password, ADMIN_PASSWORD)
    return user_ok and pass_ok


def create_admin_access_token(subject: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "scope": "admin",
        "exp": expires_at,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc

    scope = str(payload.get("scope", "")).strip().lower()
    subject = str(payload.get("sub", "")).strip()
    if scope != "admin" or not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token does not have admin scope.",
        )
    return subject


async def get_machine_api_key(api_key: str | None = Security(api_key_scheme)) -> str:
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing machine API key.",
        )
    return api_key
