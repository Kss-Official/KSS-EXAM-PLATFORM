from app.schemas.base import CamelModel
from app.schemas.auth import LoginRequest, AuthUser, AuthResponseDto
from app.schemas.department import DepartmentDto, DepartmentSetSummary, ExamDepartmentSummary
from app.schemas.exam import ExamDto, ExamSlotDto, CreateExamFromParsedDto
from app.schemas.question import (
    QuestionOptionDto, QuestionDto, QuestionSetSummary,
    ParsedOptionDto, ParsedQuestionDto, PdfParseResponseDto
)
from app.schemas.candidate import (
    CandidateDto, CandidateAccessCodeDto, CandidateVerifyRequest, CandidateVerifyResponse,
    CandidateOptionDto, CandidateQuestionDto, CandidateStartAttemptResponse,
    AnswerSaveRequest, CandidateAssignSetRequest, CandidateBatchAssignSetRequest,
    CandidateBatchGenerateSelectedRequest
)
from app.schemas.result import SubmissionResponse, ExamResultDto
from app.schemas.dashboard import AdminDashboardResponse, AuditLogDto, AuditLogResponse
from app.schemas.coding import (
    TestCaseDto, CodingQuestionDto, CodingExamDto,
    CodeRunRequest, CodeRunResponse,
    CodeSubmitRequest, CodeSubmitResponse, TestCaseResultItem,
    BatchEmailDispatchRequest
)

__all__ = [
    "CamelModel",
    "LoginRequest",
    "AuthUser",
    "AuthResponseDto",
    "DepartmentDto",
    "DepartmentSetSummary",
    "ExamDepartmentSummary",
    "ExamDto",
    "ExamSlotDto",
    "CreateExamFromParsedDto",
    "QuestionOptionDto",
    "QuestionDto",
    "QuestionSetSummary",
    "ParsedOptionDto",
    "ParsedQuestionDto",
    "PdfParseResponseDto",
    "CandidateDto",
    "CandidateAccessCodeDto",
    "CandidateVerifyRequest",
    "CandidateVerifyResponse",
    "CandidateOptionDto",
    "CandidateQuestionDto",
    "CandidateStartAttemptResponse",
    "AnswerSaveRequest",
    "SubmissionResponse",
    "ExamResultDto",
    "AdminDashboardResponse",
    "AuditLogDto",
    "AuditLogResponse",
    "TestCaseDto",
    "CodingQuestionDto",
    "CodingExamDto",
    "CodeRunRequest",
    "CodeRunResponse",
    "CodeSubmitRequest",
    "CodeSubmitResponse",
    "TestCaseResultItem",
    "BatchEmailDispatchRequest",
]
