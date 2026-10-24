"""
Unified routers façade re-exporting domain-separated routes
from app.admin.routers and app.candidate.routers.
"""
from app.routers.health import router as health_router
from app.admin.routers.auth import router as auth_router
from app.admin.routers.dashboard import router as dashboard_router
from app.admin.routers.departments import router as departments_router
from app.admin.routers.exams import router as exams_router
from app.admin.routers.questions import router as questions_router
from app.admin.routers.candidates import router as candidates_router
from app.admin.routers.results import router as results_router
from app.candidate.routers.portal import router as candidate_portal_router

__all__ = [
    "health_router",
    "auth_router",
    "dashboard_router",
    "departments_router",
    "exams_router",
    "questions_router",
    "candidates_router",
    "results_router",
    "candidate_portal_router",
]
