import random
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models import (
    Exam, ExamSlot, Department, QuestionSet, Question, QuestionOption,
    ExamAttempt, AuditLog
)
from app.schemas import ExamDto, CreateExamFromParsedDto

class ExamService:
    @staticmethod
    def _to_dto(exam: Exam) -> ExamDto:
        dept_ids = [d.id for d in exam.departments] if exam.departments else []
        dept_names = [d.name for d in exam.departments] if exam.departments else []
        return ExamDto(
            id=exam.id,
            title=exam.title,
            description=exam.description,
            duration_minutes=exam.duration_minutes,
            total_questions=exam.total_questions,
            status=exam.status,
            qualification_mode=exam.qualification_mode or "PERCENTAGE",
            qualification_threshold=exam.qualification_threshold or Decimal("60.00"),
            timing_mode=exam.timing_mode or "DURATION_FROM_START",
            total_marks=exam.total_marks or Decimal("100.00"),
            marks_per_question=exam.marks_per_question or Decimal("1.00"),
            negative_marks=exam.negative_marks or Decimal("0.00"),
            scheduled_start_time=exam.scheduled_start_time,
            scheduled_end_time=exam.scheduled_end_time,
            results_published=exam.results_published or False,
            created_at=exam.created_at,
            department_ids=dept_ids,
            department_names=dept_names
        )

    @classmethod
    def get_all_exams(cls, db: Session) -> List[ExamDto]:
        """
        Retrieves all exams with eager-loaded department associations in a single query.
        """
        exams = db.query(Exam).options(
            joinedload(Exam.departments)
        ).order_by(Exam.created_at.desc()).all()
        return [cls._to_dto(e) for e in exams]

    @classmethod
    def get_published_exams(cls, db: Session) -> List[ExamDto]:
        """
        Retrieves published exams with eager-loaded department associations.
        """
        exams = db.query(Exam).options(
            joinedload(Exam.departments)
        ).filter(Exam.status.in_(["ACTIVATED", "PUBLISHED"])).order_by(Exam.created_at.desc()).all()
        return [cls._to_dto(e) for e in exams]

    @classmethod
    def get_exam_by_id(cls, db: Session, exam_id: int) -> ExamDto:
        exam = db.query(Exam).options(
            joinedload(Exam.departments)
        ).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Exam not found with ID: {exam_id}")
        return cls._to_dto(exam)

    @classmethod
    def create_exam(cls, db: Session, dto: ExamDto, performed_by: str) -> ExamDto:
        exam = Exam(
            title=dto.title.strip(),
            description=dto.description,
            duration_minutes=dto.duration_minutes or 60,
            total_questions=dto.total_questions or 50,
            status="DRAFT",
            qualification_mode=dto.qualification_mode or "PERCENTAGE",
            qualification_threshold=dto.qualification_threshold or Decimal("60.00"),
            timing_mode=dto.timing_mode or "DURATION_FROM_START",
            total_marks=dto.total_marks or Decimal("100.00"),
            marks_per_question=dto.marks_per_question or Decimal("1.00"),
            negative_marks=dto.negative_marks or Decimal("0.00"),
            scheduled_start_time=dto.scheduled_start_time,
            scheduled_end_time=dto.scheduled_end_time,
            results_published=False,
            created_at=datetime.now(timezone.utc)
        )

        depts = []
        if dto.department_ids:
            depts = db.query(Department).filter(Department.id.in_(dto.department_ids)).all()
            exam.departments = depts

        db.add(exam)
        db.flush()

        # Initialize Sets A, B, C, D
        sets = ["A", "B", "C", "D"]
        if depts:
            for dept in depts:
                for s in sets:
                    qs = QuestionSet(
                        exam_id=exam.id,
                        department_id=dept.id,
                        set_code=s,
                        name=f"{dept.name} - Set {s}"
                    )
                    db.add(qs)
        else:
            for s in sets:
                qs = QuestionSet(
                    exam_id=exam.id,
                    set_code=s,
                    name=f"Question Set {s}"
                )
                db.add(qs)

        # Default Slot 1
        now = datetime.now(timezone.utc)
        slot = ExamSlot(
            exam_id=exam.id,
            slot_number=1,
            starts_at=now,
            ends_at=now + timedelta(days=30),
            capacity=150
        )
        db.add(slot)

        audit = AuditLog(
            action="CREATE_EXAM",
            entity_type="Exam",
            entity_id=str(exam.id),
            performed_by=performed_by,
            details=f"Created exam: {exam.title} with 4 independent sets A-D per department and Slot 1"
        )
        db.add(audit)
        db.commit()
        db.refresh(exam)

        return cls._to_dto(exam)

    @classmethod
    def create_exam_from_parsed(cls, db: Session, dto: CreateExamFromParsedDto, performed_by: str) -> ExamDto:
        total_q = len(dto.questions) if dto.questions else (dto.total_questions or 50)
        exam = Exam(
            title=dto.title.strip(),
            description=dto.description,
            duration_minutes=dto.duration_minutes or 60,
            total_questions=total_q,
            status="PUBLISHED" if dto.publish_immediately else "DRAFT",
            qualification_mode=dto.qualification_mode or "PERCENTAGE",
            qualification_threshold=dto.qualification_threshold or Decimal("60.00"),
            timing_mode=dto.timing_mode or "DURATION_FROM_START",
            total_marks=dto.total_marks or Decimal("100.00"),
            marks_per_question=dto.marks_per_question or Decimal("1.00"),
            negative_marks=dto.negative_marks or Decimal("0.00"),
            scheduled_start_time=dto.scheduled_start_time,
            scheduled_end_time=dto.scheduled_end_time,
            results_published=False,
            created_at=datetime.now(timezone.utc)
        )

        depts = []
        if dto.department_ids:
            depts = db.query(Department).filter(Department.id.in_(dto.department_ids)).all()
            exam.departments = depts

        db.add(exam)
        db.flush()

        target_set_codes = dto.target_sets if dto.target_sets else ["A", "B", "C", "D"]
        created_sets: List[QuestionSet] = []

        if depts:
            for dept in depts:
                for sc in target_set_codes:
                    qs = QuestionSet(
                        exam_id=exam.id,
                        department_id=dept.id,
                        set_code=sc.upper(),
                        name=f"{dept.name} - Set {sc.upper()}"
                    )
                    db.add(qs)
                    created_sets.append(qs)
        else:
            for sc in target_set_codes:
                qs = QuestionSet(
                    exam_id=exam.id,
                    set_code=sc.upper(),
                    name=f"Question Set {sc.upper()}"
                )
                db.add(qs)
                created_sets.append(qs)

        db.flush()

        # Populate questions into created sets
        if dto.questions and created_sets:
            for qs in created_sets:
                for pq in dto.questions:
                    q = Question(
                        question_set_id=qs.id,
                        question_text=pq.question_text,
                        marks=pq.marks or dto.marks_per_question or Decimal("1.00"),
                        negative_marks=pq.negative_marks or dto.negative_marks or Decimal("0.00"),
                        display_order=pq.display_order,
                        created_at=datetime.now(timezone.utc)
                    )
                    db.add(q)
                    db.flush()

                    for idx, opt in enumerate(pq.options):
                        o = QuestionOption(
                            question_id=q.id,
                            option_text=opt.option_text,
                            is_correct=opt.correct,
                            display_order=idx + 1
                        )
                        db.add(o)

        # Slot 1
        now = datetime.now(timezone.utc)
        slot = ExamSlot(
            exam_id=exam.id,
            slot_number=1,
            starts_at=now,
            ends_at=now + timedelta(days=30),
            capacity=150
        )
        db.add(slot)

        audit = AuditLog(
            action="CREATE_EXAM_FROM_PARSED",
            entity_type="Exam",
            entity_id=str(exam.id),
            performed_by=performed_by,
            details=f"Created exam from parsed PDF: '{exam.title}' with {total_q} questions across sets"
        )
        db.add(audit)
        db.commit()
        db.refresh(exam)

        return cls._to_dto(exam)

    @classmethod
    def update_exam(cls, db: Session, exam_id: int, dto: ExamDto, performed_by: str) -> ExamDto:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

        if exam.status in ("PUBLISHED", "COMPLETED"):
            attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).count()
            if attempts > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot modify exam configuration once candidate attempts have begun."
                )

        exam.title = dto.title.strip()
        exam.description = dto.description
        exam.duration_minutes = dto.duration_minutes
        exam.total_questions = dto.total_questions
        exam.qualification_mode = dto.qualification_mode
        exam.qualification_threshold = dto.qualification_threshold
        exam.timing_mode = dto.timing_mode
        exam.total_marks = dto.total_marks
        exam.marks_per_question = dto.marks_per_question
        exam.negative_marks = dto.negative_marks
        exam.scheduled_start_time = dto.scheduled_start_time
        exam.scheduled_end_time = dto.scheduled_end_time

        if dto.department_ids is not None:
            depts = db.query(Department).filter(Department.id.in_(dto.department_ids)).all()
            exam.departments = depts
            for dept in depts:
                for sc in ["A", "B", "C", "D"]:
                    exists = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == exam_id,
                        QuestionSet.department_id == dept.id,
                        QuestionSet.set_code == sc
                    ).first()
                    if not exists:
                        qs = QuestionSet(
                            exam_id=exam_id,
                            department_id=dept.id,
                            set_code=sc,
                            name=f"{dept.name} - Set {sc}"
                        )
                        db.add(qs)

        audit = AuditLog(
            action="UPDATE_EXAM",
            entity_type="Exam",
            entity_id=str(exam.id),
            performed_by=performed_by,
            details=f"Updated exam configuration: {exam.title}"
        )
        db.add(audit)
        db.commit()
        db.refresh(exam)
        return cls._to_dto(exam)

    @classmethod
    def publish_exam(cls, db: Session, exam_id: int, performed_by: str) -> ExamDto:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

        # Auto-replicate questions from populated sets into empty sets B, C, D across departments
        dept_ids = [d.id for d in exam.departments] if exam.departments else [None]
        for dept_id in dept_ids:
            q_filter = [QuestionSet.exam_id == exam_id]
            if dept_id is not None:
                q_filter.append(QuestionSet.department_id == dept_id)
            else:
                q_filter.append(QuestionSet.department_id.is_(None))

            group_sets = db.query(QuestionSet).options(
                joinedload(QuestionSet.questions).joinedload(Question.options)
            ).filter(*q_filter).order_by(QuestionSet.set_code.asc()).all()

            primary_set = next((s for s in group_sets if s.set_code == "A" and len(s.questions) > 0), None)
            if not primary_set:
                primary_set = next((s for s in group_sets if len(s.questions) > 0), None)

            if primary_set and primary_set.questions:
                src_questions = list(primary_set.questions)
                for target_set in group_sets:
                    if target_set.id != primary_set.id and len(target_set.questions) == 0:
                        shuffled_qs = list(src_questions)
                        rnd = random.Random(f"{exam_id}_{dept_id}_{target_set.set_code}")
                        rnd.shuffle(shuffled_qs)
                        for q_idx, sq in enumerate(shuffled_qs):
                            new_q = Question(
                                question_set_id=target_set.id,
                                question_text=sq.question_text,
                                marks=sq.marks,
                                negative_marks=sq.negative_marks,
                                display_order=q_idx + 1,
                                created_at=datetime.now(timezone.utc)
                            )
                            db.add(new_q)
                            db.flush()

                            opts = list(sq.options)
                            rnd.shuffle(opts)
                            for o_idx, so in enumerate(opts):
                                new_opt = QuestionOption(
                                    question_id=new_q.id,
                                    option_text=so.option_text,
                                    is_correct=so.is_correct,
                                    display_order=o_idx + 1
                                )
                                db.add(new_opt)

        # Single Active Exam Policy: Deactivate all other exams so exactly one exam is active at any time
        db.query(Exam).filter(Exam.id != exam_id).update({"status": "DEACTIVATED"})

        exam.status = "ACTIVATED"
        db.add(AuditLog(
            action="ACTIVATE_EXAM",
            entity_type="Exam",
            entity_id=str(exam.id),
            performed_by=performed_by,
            details=f"Activated exam: {exam.title} (Single active exam policy enforced; other exams deactivated)"
        ))
        db.commit()
        db.refresh(exam)
        return cls._to_dto(exam)

    @classmethod
    def close_exam(cls, db: Session, exam_id: int, performed_by: str) -> ExamDto:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
        exam.status = "DEACTIVATED"
        db.add(AuditLog(
            action="DEACTIVATE_EXAM",
            entity_type="Exam",
            entity_id=str(exam.id),
            performed_by=performed_by,
            details=f"Deactivated exam: {exam.title}"
        ))
        db.commit()
        db.refresh(exam)
        return cls._to_dto(exam)

    @classmethod
    def delete_exam(cls, db: Session, exam_id: int, force: bool, performed_by: str) -> None:
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

        attempt_count = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).count()
        if attempt_count > 0 and not force:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"This examination contains {attempt_count} candidate attempt(s). Deleting will erase all candidate submissions. Pass force=true to proceed."
            )

        title = exam.title
        try:
            if force:
                attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).all()
                for att in attempts:
                    db.delete(att)
                db.flush()

            db.delete(exam)
            db.add(AuditLog(
                action="DELETE_EXAM",
                entity_type="Exam",
                entity_id=str(exam_id),
                performed_by=performed_by,
                details=f"Deleted exam '{title}' (force={force}, erasedAttempts={attempt_count})"
            ))
            db.commit()
        except Exception:
            db.rollback()
            raise
