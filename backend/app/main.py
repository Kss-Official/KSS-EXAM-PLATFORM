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

_is_prod = settings.ENVIRONMENT.lower() == "production"

app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise examination platform backend powered by Python and FastAPI",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs" if not _is_prod or settings.DEBUG else None,
    redoc_url="/redoc" if not _is_prod or settings.DEBUG else None,
    openapi_url="/openapi.json" if not _is_prod or settings.DEBUG else None
)

from starlette.middleware.gzip import GZipMiddleware

# Path normalization middleware: support routes with or without /api prefix
@app.middleware("http")
async def normalize_api_paths(request: Request, call_next):
    path = request.url.path
    for prefix in ["/candidate", "/admin", "/auth", "/health"]:
        if path == prefix or path.startswith(f"{prefix}/"):
            request.scope["path"] = f"/api{path}"
            break
    return await call_next(request)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=*, microphone=*"
    if _is_prod:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# CORS configuration matching frontend Vite origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=3600
)

# High-performance GZip response compression for JSON payloads > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

def _attach_cors(request: Request, response: JSONResponse) -> JSONResponse:
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Exception handlers ensuring uniform error payload format { success: False, message, statusCode }
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    resp = JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": detail,
            "error": detail,
            "statusCode": exc.status_code
        }
    )
    return _attach_cors(request, resp)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_msg = "; ".join([f"{err.get('loc', ['field'])[-1]}: {err.get('msg', 'Invalid')}" for err in exc.errors()])
    from fastapi.encoders import jsonable_encoder
    safe_errors = [
        {"loc": [str(l) for l in err.get("loc", [])], "msg": str(err.get("msg", "")), "type": str(err.get("type", ""))}
        for err in exc.errors()
    ]
    resp = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": f"Validation failed: {error_msg}",
            "errors": safe_errors,
            "statusCode": 422
        }
    )
    return _attach_cors(request, resp)

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled server error: {exc}")
    resp = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": f"Internal Server Error: {str(exc)}",
            "statusCode": 500
        }
    )
    return _attach_cors(request, resp)

# 1. System & Health Check Endpoints
app.include_router(health_router)

# 2. 🛡️ Administrator Management Portal Endpoints (/api/admin/*, /api/auth/*)
app.include_router(admin_router)

# 3. 🎓 Candidate Examination Portal Endpoints (/api/candidate/*)
app.include_router(candidate_router)

@app.get("/")
@app.get("/api")
def root():
    return {
        "platform": settings.APP_NAME,
        "backend": "Python + FastAPI",
        "version": settings.APP_VERSION,
        "status": "ONLINE",
        "docs": "/docs"
    }
