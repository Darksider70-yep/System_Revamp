import datetime
from typing import Optional


def utc_now() -> datetime.datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.datetime.now(datetime.timezone.utc)


def ensure_utc(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    """Ensure a datetime object is timezone-aware UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=datetime.timezone.utc)
    return dt
