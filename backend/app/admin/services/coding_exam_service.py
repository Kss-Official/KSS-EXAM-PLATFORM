import json
import secrets
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models import AuditLog
from app.models.coding import CodingExam, CodingQuestion, CodingTestCase
from app.schemas.coding import CodingExamDto, CodingQuestionDto, TestCaseDto

class CodingExamService:
    @staticmethod
    def _to_dto(exam: CodingExam) -> CodingExamDto:
        selected_depts = []
        if exam.selected_departments:
            try:
                selected_depts = json.loads(exam.selected_departments)
            except Exception:
                selected_depts = []

        allowed_langs = []
        if exam.allowed_languages:
            try:
                allowed_langs = json.loads(exam.allowed_languages)
            except Exception:
                allowed_langs = []

        questions_dtos = []
        for q in exam.questions:
            q_allowed_langs = []
            if q.allowed_languages:
                try:
                    q_allowed_langs = json.loads(q.allowed_languages)
                except Exception:
                    q_allowed_langs = []

            tc_dtos = [
                TestCaseDto(
                    id=tc.id,
                    label=tc.label,
                    input=tc.input_data or "",
                    expectedOutput=tc.expected_output or "",
                    isHidden=tc.is_hidden,
                    marks=float(tc.marks or 0.0),
                    explanation=tc.explanation
                )
                for tc in q.test_cases
            ]

            questions_dtos.append(
                CodingQuestionDto(
                    id=q.id,
                    title=q.title,
                    problemStatement=q.problem_statement,
                    difficulty=q.difficulty,
                    maxMarks=q.max_marks,
                    inputFormat=q.input_format or "",
                    outputFormat=q.output_format or "",
                    constraints=q.constraints or "",
                    sampleInput=q.sample_input or "",
                    sampleOutput=q.sample_output or "",
                    sampleExplanation=q.sample_explanation or "",
                    allowedLanguages=q_allowed_langs,
                    timeLimitMs=q.time_limit_ms,
                    memoryLimitMb=q.memory_limit_mb,
                    testCases=tc_dtos
                )
            )

        return CodingExamDto(
            id=exam.id,
            title=exam.title,
            description=exam.description or "",
            instructions=exam.instructions or "",
            durationMinutes=exam.duration_minutes,
            timingMode=exam.timing_mode,
            examDate=exam.exam_date,
            startTime=exam.start_time,
            selectedDepartments=selected_depts,
            allowedLanguages=allowed_langs,
            evaluationMode=exam.evaluation_mode,
            qualificationPercentage=float(exam.qualification_percentage or 60.0),
            totalMarks=float(exam.total_marks or 100.0),
            status=exam.status,
            questions=questions_dtos,
            createdAt=exam.created_at.isoformat() if exam.created_at else None,
            updatedAt=exam.updated_at.isoformat() if exam.updated_at else None
        )

    @classmethod
    def get_all_coding_exams(cls, db: Session) -> List[CodingExamDto]:
        exams = db.query(CodingExam).options(
            joinedload(CodingExam.questions).joinedload(CodingQuestion.test_cases)
        ).order_by(CodingExam.created_at.desc()).all()
        return [cls._to_dto(e) for e in exams]

    @classmethod
    def get_coding_exam_by_id(cls, db: Session, exam_id: int) -> CodingExamDto:
        exam = db.query(CodingExam).options(
            joinedload(CodingExam.questions).joinedload(CodingQuestion.test_cases)
        ).filter(CodingExam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Coding exam {exam_id} not found")
        return cls._to_dto(exam)

    @classmethod
    def create_coding_exam(cls, db: Session, dto: CodingExamDto, performed_by: str) -> CodingExamDto:
        now = datetime.now(timezone.utc)
        exam = CodingExam(
            title=dto.title.strip(),
            description=dto.description,
            instructions=dto.instructions,
            duration_minutes=dto.durationMinutes,
            timing_mode=dto.timingMode,
            exam_date=dto.examDate,
            start_time=dto.startTime,
            selected_departments=json.dumps(dto.selectedDepartments or []),
            allowed_languages=json.dumps(dto.allowedLanguages or []),
            evaluation_mode=dto.evaluationMode,
            qualification_percentage=dto.qualificationPercentage,
            total_marks=dto.totalMarks,
            status=dto.status or "DRAFT",
            created_at=now,
            updated_at=now
        )
        db.add(exam)
        db.flush()

        for q_dto in dto.questions:
            base_q_id = q_dto.id or f"code-q-{secrets.token_hex(4)}"
            q_id = base_q_id
            if db.query(CodingQuestion).filter(CodingQuestion.id == q_id).first():
                q_id = f"{base_q_id}-{secrets.token_hex(3)}"

            q = CodingQuestion(
                id=q_id,
                exam_id=exam.id,
                title=q_dto.title,
                problem_statement=q_dto.problemStatement,
                difficulty=q_dto.difficulty,
                max_marks=q_dto.maxMarks,
                input_format=q_dto.inputFormat,
                output_format=q_dto.outputFormat,
                constraints=q_dto.constraints,
                sample_input=q_dto.sampleInput,
                sample_output=q_dto.sampleOutput,
                sample_explanation=q_dto.sampleExplanation,
                allowed_languages=json.dumps(q_dto.allowedLanguages or []),
                time_limit_ms=q_dto.timeLimitMs or 2000,
                memory_limit_mb=q_dto.memoryLimitMb or 256,
                created_at=now
            )
            db.add(q)
            db.flush()

            for tc_dto in q_dto.testCases:
                base_tc_id = tc_dto.id or f"tc-{secrets.token_hex(4)}"
                tc_id = base_tc_id
                if db.query(CodingTestCase).filter(CodingTestCase.id == tc_id).first():
                    tc_id = f"{base_tc_id}-{secrets.token_hex(3)}"

                tc = CodingTestCase(
                    id=tc_id,
                    question_id=q.id,
                    label=tc_dto.label,
                    input_data=tc_dto.input or "",
                    expected_output=tc_dto.expectedOutput or "",
                    is_hidden=tc_dto.isHidden,
                    marks=tc_dto.marks,
                    explanation=tc_dto.explanation
                )
                db.add(tc)

        db.add(AuditLog(
            action="CREATE_CODING_EXAM",
            entity_type="CodingExam",
            entity_id=str(exam.id),
            performed_by=performed_by,
            details=f"Created coding assessment: {exam.title} ({len(dto.questions)} problems)"
        ))
        db.commit()
        db.refresh(exam)
        return cls.get_coding_exam_by_id(db, exam.id)

    @classmethod
    def update_coding_exam(cls, db: Session, exam_id: int, dto: CodingExamDto, performed_by: str) -> CodingExamDto:
        exam = db.query(CodingExam).filter(CodingExam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Coding exam {exam_id} not found")

        exam.title = dto.title.strip()
        exam.description = dto.description
        exam.instructions = dto.instructions
        exam.duration_minutes = dto.durationMinutes
        exam.timing_mode = dto.timingMode
        exam.exam_date = dto.examDate
        exam.start_time = dto.startTime
        exam.selected_departments = json.dumps(dto.selectedDepartments or [])
        exam.allowed_languages = json.dumps(dto.allowedLanguages or [])
        exam.evaluation_mode = dto.evaluationMode
        exam.qualification_percentage = dto.qualificationPercentage
        exam.total_marks = dto.totalMarks
        exam.status = dto.status or exam.status
        exam.updated_at = datetime.now(timezone.utc)

        # Cleanly delete existing test cases and questions
        existing_q_ids = [row[0] for row in db.query(CodingQuestion.id).filter(CodingQuestion.exam_id == exam.id).all()]
        if existing_q_ids:
            db.query(CodingTestCase).filter(CodingTestCase.question_id.in_(existing_q_ids)).delete(synchronize_session=False)
            db.query(CodingQuestion).filter(CodingQuestion.exam_id == exam.id).delete(synchronize_session=False)
            db.flush()

        now = datetime.now(timezone.utc)
        for q_dto in dto.questions:
            q_id = q_dto.id or f"code-q-{secrets.token_hex(4)}"
            q = CodingQuestion(
                id=q_id,
                exam_id=exam.id,
                title=q_dto.title,
                problem_statement=q_dto.problemStatement,
                difficulty=q_dto.difficulty,
                max_marks=q_dto.maxMarks,
                input_format=q_dto.inputFormat,
                output_format=q_dto.outputFormat,
                constraints=q_dto.constraints,
                sample_input=q_dto.sampleInput,
                sample_output=q_dto.sampleOutput,
                sample_explanation=q_dto.sampleExplanation,
                allowed_languages=json.dumps(q_dto.allowedLanguages or []),
                time_limit_ms=q_dto.timeLimitMs or 2000,
                memory_limit_mb=q_dto.memoryLimitMb or 256,
                created_at=now
            )
            db.add(q)
            db.flush()

            for tc_dto in q_dto.testCases:
                tc_id = tc_dto.id or f"tc-{secrets.token_hex(4)}"
                tc = CodingTestCase(
                    id=tc_id,
                    question_id=q.id,
                    label=tc_dto.label,
                    input_data=tc_dto.input or "",
                    expected_output=tc_dto.expectedOutput or "",
                    is_hidden=tc_dto.isHidden,
                    marks=tc_dto.marks,
                    explanation=tc_dto.explanation
                )
                db.add(tc)

        db.add(AuditLog(
            action="UPDATE_CODING_EXAM",
            entity_type="CodingExam",
            entity_id=str(exam.id),
            performed_by=performed_by,
            details=f"Updated coding assessment: {exam.title}"
        ))
        db.commit()
        return cls.get_coding_exam_by_id(db, exam.id)

    @classmethod
    def publish_coding_exam(cls, db: Session, exam_id: int, performed_by: str) -> CodingExamDto:
        exam = db.query(CodingExam).filter(CodingExam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Coding exam {exam_id} not found")

        exam.status = "PUBLISHED"
        exam.updated_at = datetime.now(timezone.utc)

        db.add(AuditLog(
            action="PUBLISH_CODING_EXAM",
            entity_type="CodingExam",
            entity_id=str(exam.id),
            performed_by=performed_by,
            details=f"Published coding assessment: {exam.title}"
        ))
        db.commit()
        return cls.get_coding_exam_by_id(db, exam.id)

    @classmethod
    def delete_coding_exam(cls, db: Session, exam_id: int, performed_by: str) -> Dict[str, Any]:
        exam = db.query(CodingExam).filter(CodingExam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Coding exam {exam_id} not found")

        title = exam.title
        db.delete(exam)
        db.add(AuditLog(
            action="DELETE_CODING_EXAM",
            entity_type="CodingExam",
            entity_id=str(exam_id),
            performed_by=performed_by,
            details=f"Deleted coding assessment: {title} (ID {exam_id})"
        ))
        db.commit()
        return {"success": True, "message": f"Coding exam '{title}' deleted successfully."}
