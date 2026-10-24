"""
Re-export rate limiter from app.core.rate_limiter for backward compatibility.
"""
from app.core.rate_limiter import rate_limiter, RateLimiter

__all__ = ["rate_limiter", "RateLimiter"]
