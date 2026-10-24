from fastapi import APIRouter
from app.admin.routers.auth import router as auth_router
from app.admin.routers.dashboard import router as dashboard_router
from app.admin.routers.departments import router as departments_router
from app.admin.routers.exams import router as exams_router
from app.admin.routers.questions import router as questions_router
from app.admin.routers.candidates import router as candidates_router
from app.admin.routers.results import router as results_router
from app.admin.routers.coding_exams import router as coding_exams_router

from app.admin.services.exam_service import ExamService
from app.admin.services.question_service import QuestionService
from app.admin.services.candidate_service import CandidateService
from app.admin.services.dashboard_service import DashboardService
from app.admin.services.document_service import DocumentStorageService
from app.admin.services.pdf_service import InMemoryPdfService
from app.admin.services.coding_exam_service import CodingExamService
from app.admin.services.batch_email_service import BatchEmailService

admin_router = APIRouter()
admin_router.include_router(auth_router)
admin_router.include_router(dashboard_router)
admin_router.include_router(departments_router)
admin_router.include_router(exams_router)
admin_router.include_router(coding_exams_router)
admin_router.include_router(questions_router)
admin_router.include_router(candidates_router)
admin_router.include_router(results_router)

__all__ = [
    "admin_router",
    "auth_router",
    "dashboard_router",
    "departments_router",
    "exams_router",
    "coding_exams_router",
    "questions_router",
    "candidates_router",
    "results_router",
    "ExamService",
    "QuestionService",
    "CandidateService",
    "DashboardService",
    "DocumentStorageService",
    "InMemoryPdfService",
    "CodingExamService",
    "BatchEmailService",
]
