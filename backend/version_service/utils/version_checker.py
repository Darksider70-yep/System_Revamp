"""Backward-compatible wrapper for legacy imports."""

try:
    from version_checker import check_latest_versions
except ImportError:  # pragma: no cover
    from ..version_checker import check_latest_versions

__all__ = ["check_latest_versions"]