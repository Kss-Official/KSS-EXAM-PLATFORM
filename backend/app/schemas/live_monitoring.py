from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict

class LiveExamineeDto(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    candidateId: int
    registrationNumber: str
    fullName: str
    email: str
    department: Optional[str] = None
    college: Optional[str] = None
    batch: Optional[str] = None
    assignedSet: Optional[str] = None
    attemptId: Optional[int] = None
    status: str
    startedAt: Optional[datetime] = None
    expiresAt: Optional[datetime] = None
    extraTimeMinutes: int = 0
    questionsAnswered: int = 0
    totalQuestions: int = 0
    remainingSeconds: int = 0
    alertsCount: int = 0
    lastAlert: Optional[Dict[str, Any]] = None
    terminationReason: Optional[str] = None

class ProctorAlertDto(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: int
    candidateId: int
    candidateName: str
    registrationNumber: str
    department: Optional[str] = None
    attemptId: Optional[int] = None
    alertType: str
    severity: str = "MEDIUM"
    message: str
    status: str = "NEW"
    reviewedBy: Optional[str] = None
    reviewedAt: Optional[datetime] = None
    createdAt: datetime

class GiveExtraTimeRequest(BaseModel):
    candidateId: int
    attemptId: Optional[int] = None
    extraMinutes: int = 10

class StopExamRequest(BaseModel):
    candidateId: int
    attemptId: Optional[int] = None
    reason: str = "Examination stopped by administrator."

class RecordAlertRequest(BaseModel):
    candidateId: int
    attemptId: Optional[int] = None
    alertType: str
    message: str
    severity: Optional[str] = "MEDIUM"

class ReviewAlertRequest(BaseModel):
    status: str = "REVIEWED"  # REVIEWED, DISMISSED, ACTION_TAKEN
