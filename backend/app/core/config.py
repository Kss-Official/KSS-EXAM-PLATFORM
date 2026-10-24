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

    # Server Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    UPLOAD_DIR: str = "private-storage"
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB

    # PostgreSQL Database Connection
    DATABASE_URL: str = "postgresql://postgres.rborsyccguiyupkmmvpr:B5hJjBwB13nQO4R8@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_PRE_PING: bool = True

    # Security & Cryptography
    SECRET_KEY: str = "examsecure-enterprise-jwt-super-secret-key-production-grade-2026-min-64-bytes-entropy-kalpanaaa-software"
    SESSION_COOKIE_NAME: str = "JSESSIONID"
    SESSION_MAX_AGE: int = 7200  # 2 hours
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
