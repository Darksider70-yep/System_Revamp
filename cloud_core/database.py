"""Database and Redis configuration for Cloud Security Core."""

from __future__ import annotations

import os
from typing import AsyncGenerator

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "CLOUD_DATABASE_URL",
    "postgresql+asyncpg://systemrevamp:systemrevamp@localhost:5432/systemrevamp_cloud",
)
REDIS_URL = os.getenv("CLOUD_REDIS_URL", "redis://localhost:6379/0")

DB_POOL_SIZE = max(5, int(os.getenv("CLOUD_DB_POOL_SIZE", "20")))
DB_MAX_OVERFLOW = max(10, int(os.getenv("CLOUD_DB_MAX_OVERFLOW", "40")))
DB_POOL_TIMEOUT = max(5, int(os.getenv("CLOUD_DB_POOL_TIMEOUT", "30")))
DB_POOL_RECYCLE = max(300, int(os.getenv("CLOUD_DB_POOL_RECYCLE", "1800")))


class Base(DeclarativeBase):
    """Base declarative class for SQLAlchemy models."""


engine = create_async_engine(
    DATABASE_URL,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=DB_POOL_TIMEOUT,
    pool_pre_ping=True,
    pool_recycle=DB_POOL_RECYCLE,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield database session for FastAPI dependencies."""
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create tables when the service starts."""
    from . import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def get_redis_client() -> redis.Redis:
    """Create Redis client for cache and pub-sub usage."""
    return redis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
