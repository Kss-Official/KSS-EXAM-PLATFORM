from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class TestCaseDto(BaseModel):
    id: str
    label: str
    input: str = ""
    expectedOutput: str = ""
    isHidden: bool = False
    marks: float = 5.0
    explanation: Optional[str] = None

class CodingQuestionDto(BaseModel):
    id: str
    title: str
    problemStatement: str
    difficulty: str = "Medium"
    maxMarks: int = 20
    inputFormat: Optional[str] = ""
    outputFormat: Optional[str] = ""
    constraints: Optional[str] = ""
    sampleInput: Optional[str] = ""
    sampleOutput: Optional[str] = ""
    sampleExplanation: Optional[str] = ""
    allowedLanguages: List[str] = Field(default_factory=list)
    timeLimitMs: Optional[int] = 2000
    memoryLimitMb: Optional[int] = 256
    testCases: List[TestCaseDto] = Field(default_factory=list)

class CodingExamDto(BaseModel):
    id: Optional[Any] = None
    title: str
    description: Optional[str] = ""
    instructions: Optional[str] = ""
    durationMinutes: int = 60
    timingMode: str = "DURATION_FROM_START"
    examDate: Optional[str] = None
    startTime: Optional[str] = None
    selectedDepartments: List[str] = Field(default_factory=list)
    allowedLanguages: List[str] = Field(default_factory=list)
    evaluationMode: str = "PARTIAL_PER_TESTCASE"
    qualificationPercentage: float = 60.0
    totalMarks: float = 100.0
    status: str = "DRAFT"
    questions: List[CodingQuestionDto] = Field(default_factory=list)
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class CodeRunRequest(BaseModel):
    language: str
    code: str
    input: str = ""
    timeLimitMs: int = 3000

class CodeRunResponse(BaseModel):
    output: str
    error: Optional[str] = None
    executionTimeMs: int = 0
    status: str  # "SUCCESS", "ERROR", "TIMEOUT"

class CodeSubmitRequest(BaseModel):
    examId: Any
    questionId: str
    candidateId: int
    language: str
    code: str

class TestCaseResultItem(BaseModel):
    testCaseId: str
    label: str
    passed: bool
    actualOutput: Optional[str] = None
    expectedOutput: Optional[str] = None
    isHidden: bool = False
    marksAwarded: float = 0.0
    error: Optional[str] = None
    executionTimeMs: int = 0

class CodeSubmitResponse(BaseModel):
    success: bool
    status: str  # "PASSED", "PARTIAL", "FAILED", "ERROR"
    passedCount: int
    totalCount: int
    score: float
    maxMarks: float
    testCaseResults: List[TestCaseResultItem]
    message: str

class BatchEmailDispatchRequest(BaseModel):
    round: str = "ROUND_1"  # "ROUND_1" or "ROUND_2"
    candidateIds: Optional[List[int]] = None
    examTitle: Optional[str] = "Campus Technical Assessment"
    provider: Optional[str] = "auto"
    delaySeconds: float = 1.2  # Pacing between emails to prevent SMTP throttle/ban
