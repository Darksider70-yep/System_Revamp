import pyotp
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from server.app.core.database import get_db
from server.app.models.models import AdminUser, AuditLog
from server.app.schemas.schemas import (
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    TOTPSetupResponse,
    TOTPVerifyRequest,
    AdminUserResponse,
)
from server.app.auth.password import verify_password
from server.app.auth.jwt_handler import create_access_token, create_refresh_token, decode_token
from server.app.auth.rbac import get_current_admin

router = APIRouter(prefix="/api/v2/auth", tags=["Admin Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.email == request.email.lower()).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # If TOTP is enabled on the account, check code
    if user.totp_enabled:
        if not request.totp_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="TOTP 2FA code is required",
            )
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(request.totp_code, valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid 2FA TOTP code",
            )

    access_token = create_access_token(data={"sub": user.id, "role": user.role, "org_id": user.org_id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    # Log audit
    db.add(
        AuditLog(
            org_id=user.org_id,
            user_id=user.id,
            action="admin_login",
            target_type="admin_user",
            target_id=user.id,
            details_json=f'{{"email": "{user.email}", "role": "{user.role}"}}',
        )
    )
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=3600,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "org_id": user.org_id,
            "totp_enabled": user.totp_enabled,
        },
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    user_id = payload.get("sub")
    user = db.query(AdminUser).filter(AdminUser.id == user_id, AdminUser.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    access_token = create_access_token(data={"sub": user.id, "role": user.role, "org_id": user.org_id})
    new_refresh = create_refresh_token(data={"sub": user.id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=3600,
        user={
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "org_id": user.org_id,
            "totp_enabled": user.totp_enabled,
        },
    )


@router.post("/totp/setup", response_model=TOTPSetupResponse)
def setup_totp(user: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="System Revamp Fleet")

    user.totp_secret = secret
    db.commit()

    return TOTPSetupResponse(secret=secret, provisioning_uri=uri)


@router.post("/totp/verify")
def verify_and_enable_totp(
    request: TOTPVerifyRequest,
    user: AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="TOTP setup not initialized")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(request.totp_code):
        raise HTTPException(status_code=400, detail="Invalid confirmation code")

    user.totp_enabled = True
    db.commit()
    return {"message": "2FA TOTP successfully enabled"}


@router.get("/me", response_model=AdminUserResponse)
def get_current_user_profile(user: AdminUser = Depends(get_current_admin)):
    return AdminUserResponse(
        id=user.id,
        org_id=user.org_id,
        email=user.email,
        name=user.name,
        role=user.role,
        totp_enabled=user.totp_enabled,
        is_active=user.is_active,
        created_at=user.created_at,
    )
