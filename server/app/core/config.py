import os
import secrets
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "server_data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def _get_or_create_secret(env_var_name: str, secret_filename: str) -> str:
    env_val = os.getenv(env_var_name)
    if env_val:
        return env_val
    secret_path = DATA_DIR / secret_filename
    if secret_path.exists():
        try:
            stored = secret_path.read_text(encoding="utf-8").strip()
            if stored:
                return stored
        except Exception:
            pass
    # Generate cryptographically strong 256-bit key
    new_secret = secrets.token_hex(32)
    try:
        secret_path.write_text(new_secret, encoding="utf-8")
    except Exception:
        pass
    return new_secret


class Settings(BaseModel):
    APP_NAME: str = "System Revamp Fleet Server"
    APP_VERSION: str = "2.0.0"
    ENV: str = os.getenv("APP_ENV", "development")
    
    # Server network config
    HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("SERVER_PORT", "8000"))
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DATA_DIR / 'fleet.db'}"
    )
    
    # Security & Auth
    SECRET_KEY: str = Field(default_factory=lambda: _get_or_create_secret("SECRET_KEY", ".jwt_secret"))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Device Token signing secret (HMAC)
    DEVICE_SIGNING_KEY: str = Field(default_factory=lambda: _get_or_create_secret("DEVICE_SIGNING_KEY", ".device_signing_key"))
    
    # Threat Intel
    VIRUSTOTAL_API_KEY: Optional[str] = os.getenv("VT_API_KEY", None)
    
    # Offline bundles & Installer storage
    STORAGE_DIR: Path = DATA_DIR / "storage"
    INSTALLER_DIR: Path = DATA_DIR / "installers"
    BUNDLE_DIR: Path = DATA_DIR / "bundles"
    
    # Rate Limits
    VT_RATE_LIMIT_PER_MINUTE: int = 4
    AUTH_RATE_LIMIT_PER_MINUTE: int = 15
    AGENT_POLL_INTERVAL_MINUTES: int = 5


settings = Settings()
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.INSTALLER_DIR.mkdir(parents=True, exist_ok=True)
settings.BUNDLE_DIR.mkdir(parents=True, exist_ok=True)
