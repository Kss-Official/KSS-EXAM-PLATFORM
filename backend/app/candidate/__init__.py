from app.candidate.routers.portal import router as candidate_router
from app.candidate.services.candidate_exam_service import CandidateExamService

__all__ = [
    "candidate_router",
    "CandidateExamService",
]
