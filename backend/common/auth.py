import os
import secrets
import threading
import time
from typing import Optional
from fastapi import Header, HTTPException, Request, status

try:
    from common import redis_client
except ModuleNotFoundError:
    try:
        from backend.common import redis_client
    except Exception:
        redis_client = None

INTERNAL_KEY_HEADER = "X-Internal-Key"
SSE_TOKEN_PREFIX = "sr:sse_token:"
DEFAULT_SSE_TTL_SECONDS = 30

# In-memory fallback for SSE tokens if Redis is offline
_MEMORY_SSE_TOKENS = {}
_MEMORY_SSE_LOCK = threading.Lock()


def get_configured_internal_key() -> str:
    """Retrieves configured internal key from environment (trimmed)."""
    return os.getenv("INTERNAL_API_KEY", "").strip()


async def verify_internal_key(
    request: Request,
    x_internal_key: Optional[str] = None,
) -> bool:
    """
    FastAPI dependency and helper validating the internal service/frontend shared key via HTTP header.
    - Automatically bypasses OPTIONS preflight requests so browser CORS works properly.
    - If INTERNAL_API_KEY is unset/empty in environment, access is permitted (local dev mode).
    - Checks header `X-Internal-Key`.
    - Query strings are NEVER accepted for raw internal keys.
    - Raises HTTP 401 if a key is required but missing or invalid.
    """
    # 1. OPTIONS preflight bypass
    if request and getattr(request, "method", "").upper() == "OPTIONS":
        return True

    configured_key = get_configured_internal_key()
    if not configured_key:
        return True

    header_val = None
    if isinstance(x_internal_key, str):
        header_val = x_internal_key
    elif request and hasattr(request, "headers"):
        header_val = request.headers.get(INTERNAL_KEY_HEADER)

    provided_key = (header_val or "").strip()

    if not provided_key or provided_key != configured_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing X-Internal-Key header",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return True


def generate_sse_token(expires_in: int = DEFAULT_SSE_TTL_SECONDS) -> str:
    """
    Generates a cryptographically secure, short-lived single-use token for SSE streaming.
    Stores token in Redis (or in-memory fallback) with TTL.
    """
    token = secrets.token_urlsafe(32)
    key = f"{SSE_TOKEN_PREFIX}{token}"

    if redis_client:
        redis_client.cache_set(key, "active", ttl_seconds=expires_in)
    else:
        now = time.time()
        with _MEMORY_SSE_LOCK:
            _clean_memory_sse_tokens(now)
            _MEMORY_SSE_TOKENS[token] = now + expires_in

    return token


def consume_sse_token(token: Optional[str]) -> bool:
    """
    Validates and immediately consumes (deletes) a single-use SSE ticket token.
    Returns True if valid and consumed; False if missing, expired, or already used.
    """
    # If auth is disabled (dev mode without INTERNAL_API_KEY), permit access
    configured_key = get_configured_internal_key()
    if not configured_key:
        return True

    if not token or not isinstance(token, str):
        return False

    token_str = token.strip()
    if not token_str:
        return False

    key = f"{SSE_TOKEN_PREFIX}{token_str}"

    if redis_client:
        r = redis_client.get_redis_client()
        if r:
            try:
                # Atomically get and delete the token in Redis
                val = r.getdel(key) if hasattr(r, "getdel") else None
                if val is None:
                    pipe = r.pipeline()
                    pipe.get(key)
                    pipe.delete(key)
                    results = pipe.execute()
                    val = results[0]
                return bool(val)
            except Exception as e:
                print(f"[Auth] Redis error checking SSE token: {e}")

        # Fallback to in-memory cache in redis_client
        val = redis_client.cache_get(key)
        if val is not None:
            redis_client.cache_delete(key)
            return True

    # Standalone memory fallback
    now = time.time()
    with _MEMORY_SSE_LOCK:
        _clean_memory_sse_tokens(now)
        exp = _MEMORY_SSE_TOKENS.pop(token_str, None)
        if exp is not None and now <= exp:
            return True

    return False


def _clean_memory_sse_tokens(now: float):
    """Evicts expired tokens from memory store."""
    expired = [t for t, exp in _MEMORY_SSE_TOKENS.items() if now > exp]
    for t in expired:
        _MEMORY_SSE_TOKENS.pop(t, None)
