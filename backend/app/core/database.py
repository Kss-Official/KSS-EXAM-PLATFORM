import logging
from sqlalchemy import create_engine, BigInteger, Integer
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger("ExamSecure.Database")

# Cross-database primary key type: BIGINT on PostgreSQL, INTEGER PRIMARY KEY on SQLite
ID_TYPE = BigInteger().with_variant(Integer, "sqlite")

def _init_engine():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql"):
        try:
            # Quick connectivity verification with 15s timeout for Neon serverless
            probe_engine = create_engine(db_url, connect_args={"connect_timeout": 15})
            with probe_engine.connect() as conn:
                pass
            logger.info("Successfully connected to primary PostgreSQL database.")
            return create_engine(
                db_url,
                pool_size=settings.DB_POOL_SIZE,
                max_overflow=settings.DB_MAX_OVERFLOW,
                pool_recycle=settings.DB_POOL_RECYCLE,
                pool_pre_ping=settings.DB_POOL_PRE_PING,
                pool_timeout=30,
                connect_args={"connect_timeout": 15},
                echo=False
            )
        except Exception as exc:
            logger.warning(
                f"[DATABASE FAILOVER] PostgreSQL unreachable ({exc}). "
                f"Falling back to local persistent SQLite (examsecure.db) for zero downtime."
            )
            return create_engine(
                "sqlite:///./examsecure.db",
                connect_args={"check_same_thread": False},
                echo=False
            )
    return create_engine(
        db_url,
        connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
        echo=False
    )

engine = _init_engine()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)

Base = declarative_base()

def get_db():
    """
    FastAPI dependency yielding a clean database session per request,
    ensuring safe session close and rollback on unhandled exceptions.
    """
    db: Session = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
