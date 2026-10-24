"""
Re-export bootstrap logic from app.core.bootstrap for backward compatibility.
"""
from app.core.bootstrap import init_super_admin

__all__ = ["init_super_admin"]
