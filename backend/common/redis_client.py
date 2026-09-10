import json
import os
import threading
import time
from typing import Any, Optional, Tuple

try:
    import redis
    REDIS_PKG_AVAILABLE = True
except ImportError:
    REDIS_PKG_AVAILABLE = False

_REDIS_CLIENT = None
_REDIS_INITIALIZED = False
_REDIS_AVAILABLE = False

# Fallback in-memory storage
_MEMORY_CACHE = {}
_MEMORY_CACHE_LOCK = threading.Lock()
_MEMORY_RATELIMITS = {}
_MEMORY_RATELIMIT_LOCK = threading.Lock()


def _get_redis_config():
    url = os.getenv("REDIS_URL")
    if url:
        return {"url": url}
    return {
        "host": os.getenv("REDIS_HOST", "localhost"),
        "port": int(os.getenv("REDIS_PORT", "6379")),
        "password": os.getenv("REDIS_PASSWORD", None),
        "db": int(os.getenv("REDIS_DB", "0")),
    }


def init_redis() -> bool:
    """Initializes Redis connection and performs health check ping."""
    global _REDIS_CLIENT, _REDIS_INITIALIZED, _REDIS_AVAILABLE

    if not REDIS_PKG_AVAILABLE:
        print("[Redis] redis-py not installed. Operating in fallback memory mode.")
        _REDIS_AVAILABLE = False
        _REDIS_INITIALIZED = True
        return False

    if _REDIS_INITIALIZED and _REDIS_AVAILABLE:
        return True

    cfg = _get_redis_config()
    try:
        if "url" in cfg:
            client = redis.Redis.from_url(cfg["url"], decode_responses=True, socket_timeout=2)
        else:
            client = redis.Redis(
                host=cfg["host"],
                port=cfg["port"],
                password=cfg["password"],
                db=cfg["db"],
                decode_responses=True,
                socket_timeout=2,
            )
        # Test connection
        client.ping()
        _REDIS_CLIENT = client
        _REDIS_AVAILABLE = True
        _REDIS_INITIALIZED = True
        print(f"[Redis] Connected to Redis server successfully.")
        return True
    except Exception as e:
        print(f"[Redis] Redis server not reachable ({e}). Operating in memory fallback mode.")
        _REDIS_AVAILABLE = False
        _REDIS_INITIALIZED = True
        return False


def get_redis_client():
    if not _REDIS_INITIALIZED:
        init_redis()
    if _REDIS_AVAILABLE:
        return _REDIS_CLIENT
    return None


def cache_get(key: str) -> Optional[Any]:
    """Retrieve item from Redis cache or in-memory fallback."""
    r = get_redis_client()
    if r:
        try:
            val = r.get(key)
            if val is not None:
                try:
                    return json.loads(val)
                except Exception:
                    return val
            return None
        except Exception as e:
            print(f"[Redis] Error reading cache key '{key}': {e}")

    # In-memory fallback
    now = time.time()
    with _MEMORY_CACHE_LOCK:
        if key in _MEMORY_CACHE:
            val, exp = _MEMORY_CACHE[key]
            if exp is None or now < exp:
                return val
            else:
                del _MEMORY_CACHE[key]
    return None


def cache_set(key: str, value: Any, ttl_seconds: int = 3600) -> bool:
    """Store item in Redis cache or in-memory fallback with TTL."""
    r = get_redis_client()
    if r:
        try:
            serialized = json.dumps(value) if not isinstance(value, str) else value
            r.set(key, serialized, ex=ttl_seconds)
            return True
        except Exception as e:
            print(f"[Redis] Error setting cache key '{key}': {e}")

    # In-memory fallback
    exp = time.time() + ttl_seconds if ttl_seconds > 0 else None
    with _MEMORY_CACHE_LOCK:
        _MEMORY_CACHE[key] = (value, exp)
    return True


def cache_delete(key: str) -> bool:
    """Delete item from Redis or in-memory cache."""
    r = get_redis_client()
    if r:
        try:
            r.delete(key)
            return True
        except Exception as e:
            print(f"[Redis] Error deleting cache key '{key}': {e}")

    with _MEMORY_CACHE_LOCK:
        _MEMORY_CACHE.pop(key, None)
    return True


def check_rate_limit(key: str, max_requests: int = 4, window_seconds: int = 60) -> Tuple[bool, int]:
    """
    Sliding window rate-limiter.
    Returns (allowed: bool, retry_after_seconds: int).
    """
    prefix = f"sr:ratelimit:{key}"
    r = get_redis_client()
    now = time.time()

    if r:
        try:
            pipe = r.pipeline()
            # Remove timestamps outside current sliding window
            pipe.zremrangebyscore(prefix, 0, now - window_seconds)
            # Count elements currently in the window
            pipe.zcard(prefix)
            # Execute pipeline
            _, current_count = pipe.execute()

            if current_count >= max_requests:
                # Get the oldest timestamp in the current window to compute retry_after
                oldest_entries = r.zrange(prefix, 0, 0, withscores=True)
                if oldest_entries:
                    oldest_ts = oldest_entries[0][1]
                    retry_after = max(1, int(window_seconds - (now - oldest_ts)))
                else:
                    retry_after = window_seconds
                return False, retry_after

            # Add current request timestamp and set expire
            pipe = r.pipeline()
            pipe.zadd(prefix, {f"{now}": now})
            pipe.expire(prefix, window_seconds + 5)
            pipe.execute()
            return True, 0
        except Exception as e:
            print(f"[Redis] Rate limit check error: {e}")

    # In-memory fallback
    with _MEMORY_RATELIMIT_LOCK:
        timestamps = _MEMORY_RATELIMITS.get(key, [])
        # Filter to window
        timestamps = [ts for ts in timestamps if now - ts < window_seconds]
        if len(timestamps) >= max_requests:
            oldest_ts = timestamps[0]
            retry_after = max(1, int(window_seconds - (now - oldest_ts)))
            _MEMORY_RATELIMITS[key] = timestamps
            return False, retry_after

        timestamps.append(now)
        _MEMORY_RATELIMITS[key] = timestamps
        return True, 0
