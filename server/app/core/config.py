import os
from pathlib import Path
from pydantic import BaseModel
from typing import Optional

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "server_data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


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
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY", 
        "system-revamp-super-secure-production-jwt-secret-key-change-in-env"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Device Token signing secret (HMAC)
    DEVICE_SIGNING_KEY: str = os.getenv(
        "DEVICE_SIGNING_KEY",
        "system-revamp-device-signing-secret-key-change-in-env"
    )
    
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
