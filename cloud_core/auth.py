"""Authentication helpers for RBAC, JWT rotation, and machine API keys."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

JWT_ALGORITHM = os.getenv("CLOUD_JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = max(5, int(os.getenv("CLOUD_JWT_EXPIRE_MINUTES", "60")))
API_KEY_SALT = os.getenv("CLOUD_API_KEY_SALT", "cloud-security-core-salt")

bearer_scheme = HTTPBearer(auto_error=False)
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


@dataclass(frozen=True, slots=True)
class AuthUser:
    username: str
    password: str
    role: str


def _load_auth_users() -> dict[str, AuthUser]:
    users: dict[str, AuthUser] = {}
    raw = os.getenv("CLOUD_AUTH_USERS_JSON", "").strip()
    if raw:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {}

        if isinstance(payload, dict):
            for username, item in payload.items():
                if not isinstance(item, dict):
                    continue
                clean_user = str(username).strip()
                clean_password = str(item.get("password", "")).strip()
                clean_role = str(item.get("role", "analyst")).strip().lower() or "analyst"
                if clean_user and clean_password:
                    users[clean_user] = AuthUser(
                        username=clean_user,
                        password=clean_password,
                        role=clean_role,
                    )

    admin_username = os.getenv("CLOUD_ADMIN_USERNAME", "admin").strip() or "admin"
    admin_password = os.getenv("CLOUD_ADMIN_PASSWORD", "admin123").strip() or "admin123"
    users.setdefault(
        admin_username,
        AuthUser(username=admin_username, password=admin_password, role="admin"),
    )
    return users


def _load_jwt_keys() -> tuple[dict[str, str], str]:
    raw = os.getenv("CLOUD_JWT_KEYS_JSON", "").strip()
    keys: dict[str, str] = {}
    if raw:
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {}
        if isinstance(payload, dict):
            for key_id, secret in payload.items():
                clean_key = str(key_id).strip()
                clean_secret = str(secret).strip()
                if clean_key and clean_secret:
                    keys[clean_key] = clean_secret

    fallback_secret = os.getenv("CLOUD_JWT_SECRET", "").strip()
    if fallback_secret and "default" not in keys:
        keys["default"] = fallback_secret
    if not keys:
        keys["default"] = "replace-this-secret-in-production"

    active_key_id = os.getenv("CLOUD_JWT_ACTIVE_KID", "").strip() or next(iter(keys.keys()))
    if active_key_id not in keys:
        keys[active_key_id] = next(iter(keys.values()))
    return keys, active_key_id


AUTH_USERS = _load_auth_users()
JWT_KEYS, ACTIVE_JWT_KEY_ID = _load_jwt_keys()


def generate_machine_api_key() -> str:
    return secrets.token_urlsafe(48)


def hash_machine_api_key(api_key: str) -> str:
    data = f"{API_KEY_SALT}:{api_key}".encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def verify_machine_api_key(api_key: str, expected_hash: str) -> bool:
    candidate_hash = hash_machine_api_key(api_key)
    return hmac.compare_digest(candidate_hash, expected_hash)


def authenticate_user(username: str, password: str) -> AuthUser | None:
    clean_username = str(username).strip()
    clean_password = str(password).strip()
    if not clean_username or not clean_password:
        return None

    user = AUTH_USERS.get(clean_username)
    if user is None:
        return None

    if hmac.compare_digest(clean_password, user.password):
        return user
    return None


def validate_admin_credentials(username: str, password: str) -> bool:
    user = authenticate_user(username, password)
    return bool(user and user.role == "admin")


def create_access_token(subject: str, role: str, expires_minutes: int = JWT_EXPIRE_MINUTES) -> tuple[str, str]:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=max(5, int(expires_minutes)))
    payload = {
        "sub": subject,
        "role": role.strip().lower(),
        "scope": role.strip().lower(),
        "exp": expires_at,
    }
    headers = {"kid": ACTIVE_JWT_KEY_ID}
    token = jwt.encode(payload, JWT_KEYS[ACTIVE_JWT_KEY_ID], algorithm=JWT_ALGORITHM, headers=headers)
    return token, ACTIVE_JWT_KEY_ID


def create_admin_access_token(subject: str) -> str:
    token, _ = create_access_token(subject=subject, role="admin")
    return token


def _decode_token(token: str) -> dict[str, Any]:
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token header.",
        ) from exc

    requested_key_id = str(header.get("kid", "")).strip()
    key_candidates: list[tuple[str, str]] = []
    if requested_key_id and requested_key_id in JWT_KEYS:
        key_candidates.append((requested_key_id, JWT_KEYS[requested_key_id]))
    key_candidates.extend((key_id, secret) for key_id, secret in JWT_KEYS.items() if key_id != requested_key_id)

    last_error: Exception | None = None
    for key_id, secret in key_candidates:
        try:
            payload = jwt.decode(token, secret, algorithms=[JWT_ALGORITHM])
            payload["kid"] = key_id
            return payload
        except JWTError as exc:
            last_error = exc
            continue

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
    ) from last_error


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, str]:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
        )

    payload = _decode_token(credentials.credentials)
    role = str(payload.get("role", payload.get("scope", ""))).strip().lower()
    subject = str(payload.get("sub", "")).strip()
    key_id = str(payload.get("kid", "")).strip()
    if not role or not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing required claims.",
        )
    return {"subject": subject, "role": role, "key_id": key_id}


def require_roles(*roles: str) -> Callable[..., Any]:
    allowed = {str(role).strip().lower() for role in roles if str(role).strip()}

    async def dependency(user: dict[str, str] = Depends(get_current_user)) -> str:
        role = user["role"].strip().lower()
        if allowed and role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role privileges.",
            )
        return user["subject"]

    return dependency


async def get_current_admin(subject: str = Depends(require_roles("admin"))) -> str:
    return subject


async def get_machine_api_key(api_key: str | None = Security(api_key_scheme)) -> str:
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing machine API key.",
        )
    return api_key
