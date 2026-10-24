from typing import Optional
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import extract_token_from_request, verify_session_token
from app.models.user import AppUser

def get_client_ip(request: Request) -> str:
    """Extracts client IP address supporting reverse proxies and Cloudflare/Nginx headers."""
    xf = request.headers.get("x-forwarded-for")
    if xf:
        return xf.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[AppUser]:
    """
    Returns authenticated AppUser if valid session cookie or Bearer token is present,
    otherwise None.
    """
    token = extract_token_from_request(request)
    if not token:
        return None

    data = verify_session_token(token, max_age=settings.SESSION_MAX_AGE)
    if not data or "user_id" not in data:
        return None

    user = db.query(AppUser).filter(AppUser.id == data["user_id"]).first()
    if not user or not user.enabled or not user.account_non_locked:
        return None

    return user

def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> AppUser:
    """
    Guarantees active authenticated user session. Raises HTTP 401 if unauthenticated.
    """
    user = get_current_user_optional(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: No active session found. Please sign in."
        )
    return user

def require_super_admin(
    current_user: AppUser = Depends(get_current_user)
) -> AppUser:
    """
    Guarantees user has SUPER_ADMIN role clearance. Raises HTTP 403 if unauthorized.
    """
    if current_user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: SUPER_ADMIN role is required."
        )
    return current_user
