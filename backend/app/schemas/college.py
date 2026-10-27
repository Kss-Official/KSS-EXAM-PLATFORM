from typing import Optional
from datetime import datetime
from app.schemas.base import CamelModel

class CollegeDto(CamelModel):
    id: Optional[int] = None
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    active: bool = True
    created_at: Optional[datetime] = None
    candidates_count: Optional[int] = 0

class CollegeCreateDto(CamelModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    active: bool = True
