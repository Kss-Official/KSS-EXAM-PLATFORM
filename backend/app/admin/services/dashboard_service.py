from typing import List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models import (
    Exam, Candidate, Department, ExamAttempt, AttemptAnswer, AttemptRandomizedQuestion, AuditLog
)
from app.schemas import AdminDashboardResponse, ExamResultDto, AuditLogDto, AuditLogResponse

class DashboardService:
    @classmethod
    def get_live_statistics(cls, db: Session) -> AdminDashboardResponse:
        """
        Aggregates real-time examination telemetry using optimized SQL aggregate queries
        to eliminate latency bottlenecks over remote PostgreSQL connections.
        """
        # 1. Aggregate Exam metrics in a single query
        total_exams, active_exams = db.query(
            func.count(Exam.id),
            func.count().filter(Exam.status == "PUBLISHED")
        ).first()

        # 2. Aggregate Attempt metrics in a single query
        total_attempts, submitted_attempts, qualified_candidates = db.query(
            func.count(ExamAttempt.id),
            func.count().filter(ExamAttempt.status == "SUBMITTED"),
            func.count().filter(ExamAttempt.qualification_status == "QUALIFIED")
        ).first()

        # 3. Candidate & Department counts
        total_candidates = db.query(func.count(Candidate.id)).scalar() or 0
        total_departments = db.query(func.count(Department.id)).scalar() or 0

        return AdminDashboardResponse(
            application="ExamSecure Examination Platform",
            status="UP",
            total_exams=total_exams or 0,
            active_exams=active_exams or 0,
            total_candidates=total_candidates,
            total_departments=total_departments,
            total_attempts=total_attempts or 0,
            submitted_attempts=submitted_attempts or 0,
            qualified_candidates=qualified_candidates or 0,
            message="Live statistics aggregated from PostgreSQL database"
        )

    @classmethod
    def get_exam_results(cls, db: Session, exam_id: Optional[int] = None) -> List[ExamResultDto]:
        """
        Loads all candidate exam results using eager joins to avoid N+1 queries.
        Answer counts are retrieved via a single SQL GROUP BY aggregation of distinct question IDs.
        """
        query = db.query(ExamAttempt).options(
            joinedload(ExamAttempt.candidate).joinedload(Candidate.department),
            joinedload(ExamAttempt.exam),
            joinedload(ExamAttempt.question_set),
            joinedload(ExamAttempt.slot)
        )
        if exam_id:
            query = query.filter(ExamAttempt.exam_id == exam_id)
        attempts = query.order_by(ExamAttempt.created_at.desc()).all()

        if not attempts:
            return []

        attempt_ids = [a.id for a in attempts]

        # Single aggregated GROUP BY query for answered counts across all attempts (counting distinct questions)
        answered_counts = dict(
            db.query(AttemptAnswer.attempt_id, func.count(func.distinct(AttemptAnswer.question_id)))
            .filter(
                AttemptAnswer.attempt_id.in_(attempt_ids),
                AttemptAnswer.selected_option_id.isnot(None)
            )
            .group_by(AttemptAnswer.attempt_id)
            .all()
        )

        attempt_q_counts = dict(
            db.query(AttemptRandomizedQuestion.attempt_id, func.count(AttemptRandomizedQuestion.id))
            .filter(AttemptRandomizedQuestion.attempt_id.in_(attempt_ids))
            .group_by(AttemptRandomizedQuestion.attempt_id)
            .all()
        )

        results: List[ExamResultDto] = []
        for a in attempts:
            answered_cnt = a.questions_answered if (a.questions_answered is not None and a.questions_answered > 0) else answered_counts.get(a.id, 0)
            total_q = a.total_questions or attempt_q_counts.get(a.id) or (a.exam.total_questions if a.exam else 50)
            unanswered_cnt = a.unanswered_questions if a.unanswered_questions is not None else max(0, total_q - answered_cnt)

            cand_name = a.candidate.full_name if a.candidate else "Unknown"
            reg_num = a.candidate_code or (a.candidate.registration_number if a.candidate else "-")
            dept_name = a.candidate.department.name if (a.candidate and a.candidate.department) else "Unassigned"
            set_cd = a.question_set_code or (a.question_set.set_code if a.question_set else "-")

            dto = ExamResultDto(
                attempt_id=a.id,
                candidate_id=a.candidate_id,
                candidate_name=cand_name,
                registration_number=reg_num,
                department_name=dept_name,
                exam_id=a.exam_id,
                exam_title=a.exam.title if a.exam else "Exam",
                set_code=set_cd,
                slot_number=a.slot.slot_number if a.slot else 1,
                attempt_status=a.status,
                answered_count=answered_cnt,
                unanswered_count=unanswered_cnt,
                score=a.score,
                total_marks=a.total_marks or (a.exam.total_marks if a.exam else None),
                percentage=a.percentage,
                qualification_threshold=a.exam.qualification_threshold if a.exam else None,
                qualification_status=a.qualification_status,
                results_published=a.exam.results_published if a.exam else False,
                submitted_at=a.submitted_at,
                total_questions=total_q,
                questions_answered=answered_cnt,
                correct_answers=a.correct_answers,
                incorrect_answers=a.incorrect_answers,
                duration_seconds=a.duration_seconds,
                started_at=a.started_at,
                candidate_code=a.candidate_code or reg_num,
                question_set_code=set_cd,
            )
            results.append(dto)

        return results

    @classmethod
    def publish_exam_results(cls, db: Session, exam_id: int, publish: bool, admin_user: str) -> Exam:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

        exam.results_published = publish
        db.add(AuditLog(
            action="PUBLISH_RESULTS" if publish else "UNPUBLISH_RESULTS",
            entity_type="Exam",
            entity_id=str(exam.id),
            performed_by=admin_user,
            details=f"Exam ID={exam.id} results publication set to {publish}"
        ))
        db.commit()
        db.refresh(exam)
        return exam

    @classmethod
    def get_audit_logs(
        cls,
        db: Session,
        page: int = 1,
        page_size: int = 50,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        search: Optional[str] = None
    ) -> AuditLogResponse:
        """
        Retrieves paginated platform audit logs with optional filters for actions, entities, or keywords.
        """
        query = db.query(AuditLog)
        if action:
            query = query.filter(AuditLog.action.ilike(f"%{action}%"))
        if entity_type:
            query = query.filter(AuditLog.entity_type.ilike(f"%{entity_type}%"))
        if search:
            search_pat = f"%{search}%"
            query = query.filter(
                (AuditLog.action.ilike(search_pat)) |
                (AuditLog.performed_by.ilike(search_pat)) |
                (AuditLog.details.ilike(search_pat))
            )

        total = query.count()
        page_size = min(max(1, page_size), 200)
        total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1
        page = min(max(1, page), total_pages)
        offset = (page - 1) * page_size

        logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size).all()

        items = [
            AuditLogDto(
                id=log.id,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                performed_by=log.performed_by,
                details=log.details,
                created_at=log.created_at
            )
            for log in logs
        ]

        return AuditLogResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

