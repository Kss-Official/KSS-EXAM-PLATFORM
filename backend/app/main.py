import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core import settings, SessionLocal, init_super_admin, init_default_departments, init_default_candidates
from app.routers import health_router
from app.admin import admin_router
from app.candidate import candidate_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ExamSecure")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing ExamSecure FastAPI Backend...")
    try:
        from app.core.database import Base, engine
        import app.models  # ensure models are registered
        Base.metadata.create_all(bind=engine)
        from app.core.schema_guard import ensure_indexes_and_constraints
        ensure_indexes_and_constraints()
    except Exception as e:
        logger.warning(f"Database schema synchronization notice: {e}")

    db = SessionLocal()
    try:
        init_super_admin(db)
        init_default_departments(db)
        init_default_candidates(db)
        logger.info("Database connectivity established and administrator account, departments & candidate access codes verified.")
    except Exception as e:
        logger.error(f"Error initializing administrator bootstrap: {e}")
    finally:
        db.close()
    yield
    logger.info("ExamSecure FastAPI Backend shutting down.")

app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise examination platform backend powered by Python and FastAPI",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration matching frontend Vite origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600
)

# Exception handlers ensuring uniform error payload format { success: False, message, statusCode }
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": detail,
            "error": detail,
            "statusCode": exc.status_code
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_msg = "; ".join([f"{err['loc'][-1]}: {err['msg']}" for err in exc.errors()])
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": f"Validation failed: {error_msg}",
            "errors": exc.errors(),
            "statusCode": 422
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled server error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": f"Internal Server Error: {str(exc)}",
            "statusCode": 500
        }
    )

# 1. System & Health Check Endpoints
app.include_router(health_router)

# 2. 🛡️ Administrator Management Portal Endpoints (/api/admin/*, /api/auth/*)
app.include_router(admin_router)

# 3. 🎓 Candidate Examination Portal Endpoints (/api/candidate/*)
app.include_router(candidate_router)

@app.get("/")
def root():
    return {
        "platform": settings.APP_NAME,
        "backend": "Python + FastAPI",
        "version": settings.APP_VERSION,
        "status": "ONLINE",
        "docs": "/docs"
    }
