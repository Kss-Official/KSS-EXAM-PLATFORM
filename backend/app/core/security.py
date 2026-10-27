import time
import hmac
import hashlib
import base64
import json
import bcrypt
from typing import Optional, Dict, Any
from fastapi import Request, Response
from app.core.config import settings

def hash_password(password: str) -> str:
    """Hashes a plaintext password using BCrypt with configured work factor."""
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies plaintext password against BCrypt hash (supports both $2a$ and $2b$ prefixes)."""
    try:
        pwd_bytes = plain_password.encode("utf-8")
        h_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, h_bytes)
    except Exception:
        try:
            if hashed_password.startswith("$2a$"):
                converted = ("$2b$" + hashed_password[4:]).encode("utf-8")
                return bcrypt.checkpw(plain_password.encode("utf-8"), converted)
        except Exception:
            pass
        return False

# =========================================================================
# Cryptographic HMAC-SHA256 Signed Session Token Engine
# =========================================================================

def create_session_token(data: Dict[str, Any], max_age: Optional[int] = None) -> str:
    """Creates a tamper-proof cryptographically signed HMAC-SHA256 session token."""
    ttl = max_age or settings.SESSION_MAX_AGE
    secret_bytes = settings.SECRET_KEY.encode("utf-8")
    payload_json = json.dumps(data, separators=(",", ":")).encode("utf-8")
    b64_payload = base64.urlsafe_b64encode(payload_json).decode("utf-8").rstrip("=")
    timestamp = str(int(time.time()))
    signature_payload = f"{b64_payload}.{timestamp}".encode("utf-8")
    sig = hmac.new(secret_bytes, signature_payload, hashlib.sha256).hexdigest()
    return f"{b64_payload}.{timestamp}.{sig}"

def verify_session_token(token: str, max_age: Optional[int] = None) -> Optional[Dict[str, Any]]:
    """Verifies HMAC signature, timestamp expiry, and decodes payload."""
    if not token or not isinstance(token, str):
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    b64_payload, ts_str, sig = parts
    try:
        ts = int(ts_str)
        ttl = max_age or settings.SESSION_MAX_AGE
        if time.time() - ts > ttl:
            return None
    except (ValueError, TypeError):
        return None

    secret_bytes = settings.SECRET_KEY.encode("utf-8")
    signature_payload = f"{b64_payload}.{ts_str}".encode("utf-8")
    expected_sig = hmac.new(secret_bytes, signature_payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return None

    pad = len(b64_payload) % 4
    if pad:
        b64_payload += "=" * (4 - pad)
    try:
        payload_bytes = base64.urlsafe_b64decode(b64_payload.encode("utf-8"))
        return json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        return None

def set_auth_cookie(response: Response, token: str) -> None:
    """Sets secure HttpOnly session cookie matching JSESSIONID contract."""
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        path="/"
    )

def clear_auth_cookie(response: Response) -> None:
    """Deletes session cookie from client browser."""
    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE
    )

def extract_token_from_request(request: Request) -> Optional[str]:
    """Extracts session token from either HttpOnly cookie or Authorization Bearer header."""
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None
