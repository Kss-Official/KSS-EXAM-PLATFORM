from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas import AdminDashboardResponse, AuditLogResponse
from app.admin.services import DashboardService

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])

@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_dashboard(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return DashboardService.get_live_statistics(db)

@router.get("/audit-logs", response_model=AuditLogResponse)
def get_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, alias="pageSize", description="Page size"),
    action: Optional[str] = Query(None, description="Filter by action name"),
    entity_type: Optional[str] = Query(None, alias="entityType", description="Filter by entity type"),
    search: Optional[str] = Query(None, description="Search keyword in action, details, or user"),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Retrieves paginated administrative audit trail of all platform operations."""
    return DashboardService.get_audit_logs(
        db=db,
        page=page,
        page_size=page_size,
        action=action,
        entity_type=entity_type,
        search=search
    )

