"""
Re-export security methods from app.core for backward compatibility.
"""
from typing import Optional, Dict, Any
from fastapi import Request, Response
from app.core.config import settings
from app.core.database import get_db
from app.models.user import AppUser
from app.core.security import (
    hash_password, verify_password, create_session_token,
    verify_session_token, set_auth_cookie, clear_auth_cookie,
    extract_token_from_request
)
from app.core.dependencies import (
    get_current_user_optional, get_current_user, require_super_admin
)

def create_user_session(user: AppUser, response: Response) -> str:
    session_data = {
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role
    }
    token = create_session_token(session_data, max_age=settings.SESSION_MAX_AGE)
    set_auth_cookie(response, token)
    return token

def destroy_user_session(response: Response, request: Optional[Request] = None) -> None:
    clear_auth_cookie(response)

__all__ = [
    "hash_password",
    "verify_password",
    "create_session_token",
    "verify_session_token",
    "create_user_session",
    "destroy_user_session",
    "extract_token_from_request",
    "get_current_user_optional",
    "get_current_user",
    "require_super_admin",
]
