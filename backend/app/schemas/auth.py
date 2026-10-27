from typing import Optional
from app.schemas.base import CamelModel

class LoginRequest(CamelModel):
    email: str
    password: Optional[str] = None

class AuthUser(CamelModel):
    id: int
    email: str
    full_name: str
    role: str

class AuthResponseDto(CamelModel):
    success: bool
    message: str
    user: Optional[AuthUser] = None
    token: Optional[str] = None
