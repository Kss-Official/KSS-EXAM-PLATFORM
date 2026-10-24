"""
Re-export configuration from app.core.config for backward compatibility.
"""
from app.core.config import settings, Settings

__all__ = ["settings", "Settings"]
