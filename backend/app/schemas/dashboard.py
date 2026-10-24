from typing import List, Optional
from datetime import datetime
from app.schemas.base import CamelModel

class AdminDashboardResponse(CamelModel):
    application: str
    status: str
    total_exams: int
    active_exams: int
    total_candidates: int
    total_departments: int
    total_attempts: int
    submitted_attempts: int
    qualified_candidates: int
    message: str

class AuditLogDto(CamelModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    performed_by: str
    details: Optional[str] = None
    created_at: Optional[datetime] = None

class AuditLogResponse(CamelModel):
    items: List[AuditLogDto]
    total: int
    page: int
    page_size: int
    total_pages: int
