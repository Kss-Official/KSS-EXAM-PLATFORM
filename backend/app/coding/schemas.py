from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class SampleTestCaseDto(BaseModel):
    id: str
    label: str
    input: str
    expectedOutput: str
    explanation: Optional[str] = None


class CodingProblemPublicDto(BaseModel):
    id: str
    examId: int
    title: str
    problemStatement: str
    difficulty: str
    maxMarks: int
    inputFormat: str = ""
    outputFormat: str = ""
    constraints: str = ""
    sampleInput: str = ""
    sampleOutput: str = ""
    sampleExplanation: str = ""
    allowedLanguages: List[str] = Field(default_factory=list)
    timeLimitMs: int = 2000
    memoryLimitMb: int = 256
    starterCode: Dict[str, str] = Field(default_factory=dict)
    sampleTestCases: List[SampleTestCaseDto] = Field(default_factory=list)


class CodingRunRequest(BaseModel):
    examId: int
    questionId: str
    language: str
    code: str
    customInput: Optional[str] = None
    idempotencyKey: Optional[str] = Field(default=None, max_length=128)


class CodingSubmitRequest(BaseModel):
    examId: int
    questionId: str
    language: str
    code: str
    idempotencyKey: str = Field(..., min_length=8, max_length=128)


class TestCaseVerdictDto(BaseModel):
    testCaseId: str
    label: str
    passed: bool
    isHidden: bool
    verdict: str
    runtimeMs: Optional[int] = None
    memoryKb: Optional[int] = None
    # Populated ONLY for non-hidden (sample/custom) test cases
    input: Optional[str] = None
    expectedOutput: Optional[str] = None
    actualOutput: Optional[str] = None
    error: Optional[str] = None


class CodingSubmissionStatusDto(BaseModel):
    submissionId: int
    attemptId: int
    questionId: str
    language: str
    isRunOnly: bool
    verdict: str
    status: str
    passedCount: int
    totalCount: int
    score: float
    maxMarks: float
    runtimeMs: Optional[int] = None
    memoryKb: Optional[int] = None
    errorMessage: Optional[str] = None
    testCaseResults: List[TestCaseVerdictDto] = Field(default_factory=list)
    submittedAt: Optional[str] = None
    updatedAt: Optional[str] = None


class CodingEnqueueResponse(BaseModel):
    submissionId: int
    attemptId: int
    jobId: Optional[str] = None
    verdict: str
    status: str
    idempotentReplay: bool = False
