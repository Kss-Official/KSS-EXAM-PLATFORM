from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from sqlalchemy.orm import Session

from app.core import (
    get_db, rate_limiter, get_client_ip, get_current_user,
    verify_password, create_session_token, set_auth_cookie, clear_auth_cookie
)
from app.models import AppUser
from app.schemas import LoginRequest, AuthResponseDto, AuthUser

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login", response_model=AuthResponseDto)
def login(req: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    email = req.email.strip().lower()
    rate_limit_key = f"{email}@{client_ip}"

    if rate_limiter.is_blocked(rate_limit_key) or rate_limiter.is_blocked(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Account temporarily locked for 15 minutes to prevent brute-force attacks."
        )

    user = db.query(AppUser).filter(AppUser.email.ilike(email)).first()
    if not user:
        from app.models.candidate import Candidate
        candidate = db.query(Candidate).filter(Candidate.email.ilike(email)).first()
        if candidate and candidate.status == "ACTIVE":
            session_data = {
                "candidate_id": candidate.id,
                "email": candidate.email,
                "full_name": candidate.full_name,
                "role": "CANDIDATE"
            }
            token = create_session_token(session_data)
            set_auth_cookie(response, token)
            rate_limiter.record_successful_attempt(rate_limit_key)
            rate_limiter.record_successful_attempt(client_ip)
            return AuthResponseDto(
                success=True,
                message="Candidate authenticated successfully.",
                user=AuthUser(
                    id=candidate.id,
                    email=candidate.email,
                    full_name=candidate.full_name,
                    role="CANDIDATE"
                ),
                token=token
            )

        rate_limiter.record_failed_attempt(rate_limit_key)
        rate_limiter.record_failed_attempt(client_ip)
        remaining = rate_limiter.get_remaining_attempts(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid email or credentials. Remaining attempts: {remaining}"
        )

    if not req.password or not verify_password(req.password, user.password_hash):
        rate_limiter.record_failed_attempt(rate_limit_key)
        rate_limiter.record_failed_attempt(client_ip)
        remaining = rate_limiter.get_remaining_attempts(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid email or password. Remaining attempts: {remaining}"
        )

    if not user.enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This administrator account has been disabled. Contact system support."
        )

    if not user.account_non_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is currently locked. Contact system support."
        )

    rate_limiter.record_successful_attempt(rate_limit_key)
    rate_limiter.record_successful_attempt(client_ip)

    # Establish secure session token
    session_data = {
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role
    }
    token = create_session_token(session_data)
    set_auth_cookie(response, token)

    return AuthResponseDto(
        success=True,
        message="Authentication successful",
        user=AuthUser(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role
        ),
        token=token
    )

@router.get("/me", response_model=AuthUser)
def get_me(current_user: AppUser = Depends(get_current_user)):
    return AuthUser(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role
    )

@router.post("/logout", response_model=AuthResponseDto)
def logout(response: Response):
    clear_auth_cookie(response)
    return AuthResponseDto(
        success=True,
        message="Signed out successfully",
        user=None
    )
