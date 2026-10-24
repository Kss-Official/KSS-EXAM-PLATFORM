"""
Unified services façade re-exporting domain-separated services
from app.admin.services and app.candidate.services.
"""
from app.admin.services.candidate_service import CandidateService
from app.admin.services.dashboard_service import DashboardService
from app.admin.services.document_service import DocumentStorageService
from app.admin.services.exam_service import ExamService
from app.admin.services.pdf_service import InMemoryPdfService
from app.admin.services.question_service import QuestionService
from app.candidate.services.candidate_exam_service import CandidateExamService

__all__ = [
    "CandidateService",
    "CandidateExamService",
    "DashboardService",
    "DocumentStorageService",
    "ExamService",
    "InMemoryPdfService",
    "QuestionService",
]
