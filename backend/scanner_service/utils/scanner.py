"""Backward-compatible wrapper for scanner imports."""

try:
    from scanner import get_installed_apps
except ImportError:  # pragma: no cover
    from ..scanner import get_installed_apps

__all__ = ["get_installed_apps"]