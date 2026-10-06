import hashlib
import time
from typing import List, Optional
from fastapi import Depends, HTTPException, Header, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from server.app.auth.jwt_handler import decode_token
from server.app.core.database import get_db
from server.app.models.models import AdminUser, Device

security = HTTPBearer()

# In-memory single-use ticket tokens for SSE exposure streaming
_SINGLE_USE_TICKETS = {}


def issue_ticket_token(device_id: str, ttl_seconds: int = 30) -> str:
    import secrets
    token = secrets.token_urlsafe(32)
    _SINGLE_USE_TICKETS[token] = {
        "device_id": device_id,
        "expires_at": time.time() + ttl_seconds,
    }
    return token


def consume_ticket_token(token: str) -> Optional[str]:
    # Prune expired
    now = time.time()
    to_delete = [k for k, v in _SINGLE_USE_TICKETS.items() if v["expires_at"] < now]
    for k in to_delete:
        _SINGLE_USE_TICKETS.pop(k, None)

    ticket = _SINGLE_USE_TICKETS.pop(token, None)
    if not ticket or ticket["expires_at"] < now:
        return None
    return ticket["device_id"]


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> AdminUser:
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    user = db.query(AdminUser).filter(AdminUser.id == user_id, AdminUser.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated",
        )
    return user


def require_role(allowed_roles: List[str]):
    async def role_checker(current_user: AdminUser = Depends(get_current_admin)) -> AdminUser:
        if current_user.role == "SuperAdmin":
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role: {current_user.role}",
            )
        return current_user
    return role_checker


async def verify_device_token(
    x_device_token: Optional[str] = Header(None, alias="X-Device-Token"),
    db: Session = Depends(get_db),
) -> Device:
    if not x_device_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Device-Token header",
        )
    token_hash = hashlib.sha256(x_device_token.encode("utf-8")).hexdigest()
    device = db.query(Device).filter(
        Device.device_token_hash == token_hash,
        Device.is_enrolled == True,
    ).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Device token is invalid or revoked",
        )
    return device
