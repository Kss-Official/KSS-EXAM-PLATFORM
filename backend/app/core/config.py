from typing import List
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve paths to find .env file whether started from root or backend directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
ROOT_ENV_PATH = BASE_DIR.parent / ".env"

env_file_to_use = str(ENV_PATH) if ENV_PATH.exists() else (str(ROOT_ENV_PATH) if ROOT_ENV_PATH.exists() else ".env")

class Settings(BaseSettings):
    # Application Metadata
    APP_NAME: str = "ExamSecure Enterprise Platform"
    APP_VERSION: str = "2.0.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # set ENVIRONMENT=production to enforce startup security checks
    # Reverse proxies whose X-Forwarded-For header is trusted (exact client IPs as seen by the app)
    TRUSTED_PROXY_IPS: List[str] = ["127.0.0.1", "::1"]

    # Server Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    UPLOAD_DIR: str = "private-storage"
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB

    # Database Connection (overridden by DATABASE_URL in .env)
    DATABASE_URL: str = "sqlite:///./examsecure.db"
    DB_POOL_SIZE: int = 50
    DB_MAX_OVERFLOW: int = 100
    DB_POOL_RECYCLE: int = 300  # 5 min recycling to prevent stale Neon serverless connections
    DB_POOL_PRE_PING: bool = True
    DB_POOL_TIMEOUT: int = 45   # 45s timeout under heavy concurrent burst

    # Security & Cryptography
    SECRET_KEY: str = "examsecure-enterprise-jwt-super-secret-key-production-grade-2026-min-64-bytes-entropy-kalpanaaa-software"
    SESSION_COOKIE_NAME: str = "JSESSIONID"
    SESSION_MAX_AGE: int = 7200  # 2 hours
    COOKIE_SECURE: bool = False  # Set to True in production HTTPS environments
    ALLOW_SQLITE_FAILOVER: bool = True  # In production, set to False to prevent silent SQLite split-brain
    BCRYPT_ROUNDS: int = 12

    # Administrator Initial Bootstrap
    ADMIN_BOOTSTRAP_EMAIL: str = "d.koushik@kalpanaaasoftwaresolutions.in"
    ADMIN_BOOTSTRAP_PASSWORD: str = "Admin@ExamSecure2026!"
    ADMIN_BOOTSTRAP_NAME: str = "Koushik D (Super Admin)"

    # Email Delivery Provider Configuration (Resend, Brevo, or SMTP)
    EMAIL_PROVIDER: str = "auto"  # "resend", "brevo", "smtp", or "auto"
    EMAIL_FROM: str = "ExamSecure <onboarding@resend.dev>"
    EMAIL_REPLY_TO: str = "support@kalpanaaasoftwaresolutions.in"
    RESEND_API_KEY: str = ""
    BREVO_API_KEY: str = ""
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    PORTAL_BASE_URL: str = "http://localhost:5173"

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]

    model_config = SettingsConfigDict(
        env_file=env_file_to_use,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )

settings = Settings()

_DEFAULT_SECRET_KEY_PREFIX = "examsecure-enterprise-jwt-super-secret-key"


def validate_security_settings(s: "Settings") -> None:
    """Fail fast in production on insecure defaults; warn loudly elsewhere."""
    import logging
    problems = []
    if s.SECRET_KEY.startswith(_DEFAULT_SECRET_KEY_PREFIX) or len(s.SECRET_KEY) < 32:
        problems.append("SECRET_KEY is the built-in default or too short")
    if s.ADMIN_BOOTSTRAP_PASSWORD == "Admin@ExamSecure2026!":
        problems.append("ADMIN_BOOTSTRAP_PASSWORD is the built-in default")
    if any(o.strip() == "*" for o in s.CORS_ORIGINS):
        problems.append("CORS_ORIGINS contains a wildcard while credentials are enabled")
    if not problems:
        return
    if s.ENVIRONMENT.lower() == "production":
        raise RuntimeError("Refusing to start in production: " + "; ".join(problems))
    logging.getLogger(__name__).warning("INSECURE SETTINGS (set ENVIRONMENT=production to enforce): %s", "; ".join(problems))


validate_security_settings(settings)
