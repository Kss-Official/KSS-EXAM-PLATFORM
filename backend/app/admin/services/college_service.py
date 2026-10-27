import logging
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.college import College
from app.models.candidate import Candidate
from app.models.audit import AuditLog
from app.schemas.college import CollegeDto, CollegeCreateDto

logger = logging.getLogger("ExamSecure.CollegeService")

class CollegeService:
    @staticmethod
    def _to_dto(c: College, candidate_count: int = 0) -> CollegeDto:
        return CollegeDto(
            id=c.id,
            name=c.name,
            code=c.code,
            description=c.description,
            active=c.active,
            created_at=c.created_at,
            candidates_count=candidate_count
        )

    @classmethod
    def get_all_colleges(cls, db: Session) -> List[CollegeDto]:
        """
        Retrieves all colleges with real-time candidate counts.
        """
        counts = dict(
            db.query(Candidate.college_id, func.count(Candidate.id))
            .filter(Candidate.college_id.isnot(None))
            .group_by(Candidate.college_id)
            .all()
        )
        colleges = db.query(College).order_by(College.name.asc()).all()
        return [cls._to_dto(c, counts.get(c.id, 0)) for c in colleges]

    @classmethod
    def get_active_colleges(cls, db: Session) -> List[CollegeDto]:
        """
        Retrieves only active colleges.
        """
        counts = dict(
            db.query(Candidate.college_id, func.count(Candidate.id))
            .filter(Candidate.college_id.isnot(None))
            .group_by(Candidate.college_id)
            .all()
        )
        colleges = db.query(College).filter(College.active == True).order_by(College.name.asc()).all()
        return [cls._to_dto(c, counts.get(c.id, 0)) for c in colleges]

    @classmethod
    def get_college_by_id(cls, db: Session, college_id: int) -> CollegeDto:
        college = db.query(College).filter(College.id == college_id).first()
        if not college:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"College with ID {college_id} not found"
            )
        cand_count = db.query(func.count(Candidate.id)).filter(Candidate.college_id == college_id).scalar() or 0
        return cls._to_dto(college, cand_count)

    @classmethod
    def create_college(cls, db: Session, dto: CollegeCreateDto, performed_by: str) -> CollegeDto:
        name_clean = dto.name.strip()
        code_clean = (dto.code or "").strip().upper() or None

        # Check unique name
        if db.query(College).filter(func.lower(College.name) == name_clean.lower()).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"College with name '{name_clean}' already exists"
            )

        # Check unique code
        if code_clean and db.query(College).filter(func.upper(College.code) == code_clean).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"College with code '{code_clean}' already exists"
            )

        college = College(
            name=name_clean,
            code=code_clean,
            description=dto.description.strip() if dto.description else None,
            active=dto.active,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(college)
        db.flush()

        db.add(AuditLog(
            action="CREATE_COLLEGE",
            entity_type="College",
            entity_id=str(college.id),
            performed_by=performed_by,
            details=f"Created college: {college.name} ({college.code or 'No code'})"
        ))
        db.commit()
        db.refresh(college)
        return cls._to_dto(college, 0)

    @classmethod
    def update_college(cls, db: Session, college_id: int, dto: CollegeCreateDto, performed_by: str) -> CollegeDto:
        college = db.query(College).filter(College.id == college_id).first()
        if not college:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"College with ID {college_id} not found"
            )

        name_clean = dto.name.strip()
        code_clean = (dto.code or "").strip().upper() or None

        # Uniqueness checks excluding current college
        dup_name = db.query(College).filter(
            func.lower(College.name) == name_clean.lower(),
            College.id != college_id
        ).first()
        if dup_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another college with name '{name_clean}' already exists"
            )

        if code_clean:
            dup_code = db.query(College).filter(
                func.upper(College.code) == code_clean,
                College.id != college_id
            ).first()
            if dup_code:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Another college with code '{code_clean}' already exists"
                )

        college.name = name_clean
        college.code = code_clean
        college.description = dto.description.strip() if dto.description else None
        college.active = dto.active
        college.updated_at = datetime.now(timezone.utc)

        db.add(AuditLog(
            action="UPDATE_COLLEGE",
            entity_type="College",
            entity_id=str(college.id),
            performed_by=performed_by,
            details=f"Updated college: {college.name} ({college.code or 'No code'})"
        ))
        db.commit()
        db.refresh(college)
        cand_count = db.query(func.count(Candidate.id)).filter(Candidate.college_id == college_id).scalar() or 0
        return cls._to_dto(college, cand_count)

    @classmethod
    def delete_college(cls, db: Session, college_id: int, performed_by: str) -> bool:
        college = db.query(College).filter(College.id == college_id).first()
        if not college:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"College with ID {college_id} not found"
            )

        cand_count = db.query(func.count(Candidate.id)).filter(Candidate.college_id == college_id).scalar() or 0
        if cand_count > 0:
            # If candidates are enrolled, soft-deactivate instead of hard deleting
            college.active = False
            college.updated_at = datetime.now(timezone.utc)
            db.add(AuditLog(
                action="DEACTIVATE_COLLEGE",
                entity_type="College",
                entity_id=str(college.id),
                performed_by=performed_by,
                details=f"Deactivated college {college.name} because {cand_count} candidates are enrolled."
            ))
            db.commit()
            return True

        college_name = college.name
        db.delete(college)
        db.add(AuditLog(
            action="DELETE_COLLEGE",
            entity_type="College",
            entity_id=str(college_id),
            performed_by=performed_by,
            details=f"Permanently deleted college {college_name} (ID: {college_id})"
        ))
        db.commit()
        return True
