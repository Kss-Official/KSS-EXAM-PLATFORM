import re
from typing import List, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models import (
    QuestionSet, Question, QuestionOption,
    AttemptAnswer, AttemptRandomizedQuestion, AttemptRandomizedOption, AuditLog
)
from app.schemas import QuestionDto, QuestionOptionDto

class QuestionService:
    @staticmethod
    def _to_dto(q: Question) -> QuestionDto:
        options_dto = []
        correct_id = None
        for opt in q.options:
            if opt.is_correct:
                correct_id = opt.id
            options_dto.append(QuestionOptionDto(
                id=opt.id,
                option_text=opt.option_text,
                correct=opt.is_correct,
                display_order=opt.display_order
            ))
        return QuestionDto(
            id=q.id,
            question_set_id=q.question_set_id,
            question_text=q.question_text,
            marks=q.marks,
            negative_marks=q.negative_marks,
            display_order=q.display_order,
            options=options_dto,
            correct_option_id=correct_id
        )

    @classmethod
    def get_questions_by_set_id(cls, db: Session, question_set_id: int) -> List[QuestionDto]:
        """
        Retrieves all questions for a question set with eager-loaded options in a single query.
        """
        qs = db.query(Question).options(
            joinedload(Question.options)
        ).filter(Question.question_set_id == question_set_id).order_by(Question.display_order.asc()).all()
        return [cls._to_dto(q) for q in qs]

    @classmethod
    def get_questions_by_exam_and_set_code(cls, db: Session, exam_id: int, set_code: str) -> List[QuestionDto]:
        q_set = db.query(QuestionSet).filter(
            QuestionSet.exam_id == exam_id,
            QuestionSet.set_code == set_code.upper()
        ).first()
        if not q_set:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Question Set '{set_code}' not found for Exam ID {exam_id}")
        return cls.get_questions_by_set_id(db, q_set.id)

    @classmethod
    def get_questions_by_exam_dept_and_set_code(cls, db: Session, exam_id: int, dept_id: int, set_code: str) -> List[QuestionDto]:
        q_set = db.query(QuestionSet).filter(
            QuestionSet.exam_id == exam_id,
            QuestionSet.department_id == dept_id,
            QuestionSet.set_code == set_code.upper()
        ).first()
        if not q_set:
            # Fallback to exam-level set
            return cls.get_questions_by_exam_and_set_code(db, exam_id, set_code)
        return cls.get_questions_by_set_id(db, q_set.id)

    @classmethod
    def create_question(cls, db: Session, question_set_id: int, dto: QuestionDto, performed_by: str) -> QuestionDto:
        q_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
        if not q_set:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question Set not found")

        curr_count = db.query(Question).filter(Question.question_set_id == question_set_id).count()
        next_order = dto.display_order if dto.display_order else (curr_count + 1)

        q = Question(
            question_set_id=question_set_id,
            question_text=dto.question_text.strip(),
            marks=dto.marks or Decimal("1.00"),
            negative_marks=dto.negative_marks or Decimal("0.00"),
            display_order=next_order,
            created_at=datetime.now(timezone.utc)
        )
        db.add(q)
        db.flush()

        if dto.options:
            has_explicit_correct = any(
                (dto.correct_option_id is not None and dto.correct_option_id == opt.id) or getattr(opt, "correct", False)
                for opt in dto.options
            )
            for idx, opt_dto in enumerate(dto.options):
                if has_explicit_correct:
                    is_corr = (dto.correct_option_id is not None and dto.correct_option_id == opt_dto.id) or opt_dto.correct
                else:
                    is_corr = (idx == 0)
                o = QuestionOption(
                    question_id=q.id,
                    option_text=opt_dto.option_text.strip(),
                    is_correct=is_corr,
                    display_order=idx + 1
                )
                db.add(o)

        db.add(AuditLog(
            action="CREATE_QUESTION",
            entity_type="Question",
            entity_id=str(q.id),
            performed_by=performed_by,
            details=f"Added MCQ to Set {q_set.set_code} order={next_order}"
        ))
        db.commit()
        db.refresh(q)
        return cls._to_dto(q)

    @classmethod
    def delete_question(cls, db: Session, question_id: int, performed_by: str) -> None:
        q = db.query(Question).filter(Question.id == question_id).first()
        if not q:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
        try:
            db.query(AttemptAnswer).filter(AttemptAnswer.question_id == question_id).delete(synchronize_session=False)
            db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.question_id == question_id).delete(synchronize_session=False)
            db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.question_id == question_id).delete(synchronize_session=False)
            db.delete(q)
            db.add(AuditLog(
                action="DELETE_QUESTION",
                entity_type="Question",
                entity_id=str(question_id),
                performed_by=performed_by,
                details=f"Deleted MCQ question ID: {question_id}"
            ))
            db.commit()
        except Exception:
            db.rollback()
            raise

    @classmethod
    def import_questions_from_text(cls, db: Session, question_set_id: int, raw_text: str, performed_by: str) -> List[QuestionDto]:
        q_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
        if not q_set:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question Set not found")

        blocks = re.split(r"(?i)(?=Q(?:uestion)?\s*\d*\s*[:.)])", raw_text)
        current_order = db.query(Question).filter(Question.question_set_id == question_set_id).count()

        opt_pattern = re.compile(r"(?m)^\s*([A-Da-d])[\)\.]\s*(.+)$")
        ans_pattern = re.compile(r"(?i)(?:Ans(?:wer)?|Correct)\s*[:.)]\s*([A-Da-d])")

        imported_questions: List[Question] = []

        for block in blocks:
            trimmed = block.strip()
            if not trimmed:
                continue

            lines = trimmed.split("\n", 1)
            q_header = re.sub(r"(?i)^Q(?:uestion)?\s*\d*\s*[:.)]\s*", "", lines[0]).strip()
            if not q_header and len(lines) > 1:
                q_header = lines[1].strip()

            found_options: Dict[str, str] = {}
            for m in opt_pattern.finditer(trimmed):
                found_options[m.group(1).upper()] = m.group(2).strip()

            if len(found_options) < 2:
                continue

            ans_m = ans_pattern.search(trimmed)
            correct_letter = ans_m.group(1).upper() if ans_m else "A"

            current_order += 1
            q = Question(
                question_set_id=question_set_id,
                question_text=q_header if q_header else f"Question {current_order}",
                marks=Decimal("1.00"),
                negative_marks=Decimal("0.00"),
                display_order=current_order,
                created_at=datetime.now(timezone.utc)
            )
            db.add(q)
            db.flush()

            opt_order = 1
            for lbl, opt_text in found_options.items():
                is_corr = (lbl == correct_letter)
                opt = QuestionOption(
                    question_id=q.id,
                    option_text=opt_text,
                    is_correct=is_corr,
                    display_order=opt_order
                )
                db.add(opt)
                opt_order += 1

            imported_questions.append(q)

        db.add(AuditLog(
            action="IMPORT_QUESTIONS",
            entity_type="QuestionSet",
            entity_id=str(question_set_id),
            performed_by=performed_by,
            details=f"Imported {len(imported_questions)} MCQs to Question Set {q_set.set_code}"
        ))
        db.commit()

        # Reload with joined options to avoid N+1 queries during DTO mapping
        reloaded = db.query(Question).options(
            joinedload(Question.options)
        ).filter(Question.id.in_([q.id for q in imported_questions])).order_by(Question.display_order.asc()).all()

        return [cls._to_dto(q) for q in reloaded]

    @classmethod
    def apply_answer_key(cls, db: Session, question_set_id: int, answer_key_text: str, performed_by: str) -> Dict[str, Any]:
        q_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
        if not q_set:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question Set not found")

        questions = db.query(Question).options(
            joinedload(Question.options)
        ).filter(Question.question_set_id == question_set_id).order_by(Question.display_order.asc()).all()

        if not questions:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Question Set {q_set.set_code} has no questions.")

        pair_pattern = re.compile(r"(\d+)\s*[:.)-]\s*([A-Da-d])")
        mappings: Dict[int, str] = {}
        for m in pair_pattern.finditer(answer_key_text):
            mappings[int(m.group(1))] = m.group(2).upper()

        updated_count = 0
        for idx, q in enumerate(questions):
            display_num = idx + 1
            target_letter = mappings.get(display_num)
            if target_letter and q.options:
                target_idx = ord(target_letter) - ord('A')
                if 0 <= target_idx < len(q.options):
                    for o_idx, opt in enumerate(q.options):
                        opt.is_correct = (o_idx == target_idx)
                    updated_count += 1

        try:
            db.add(AuditLog(
                action="APPLY_ANSWER_KEY",
                entity_type="QuestionSet",
                entity_id=str(question_set_id),
                performed_by=performed_by,
                details=f"Applied answer key to Set {q_set.set_code}: updated {updated_count} questions"
            ))
            db.commit()
        except Exception:
            db.rollback()
            raise

        return {
            "success": True,
            "setCode": q_set.set_code,
            "totalQuestions": len(questions),
            "mappedAnswers": updated_count
        }

    @classmethod
    def bulk_update_questions(cls, db: Session, question_set_id: int, dtos: List[QuestionDto], performed_by: str) -> List[QuestionDto]:
        q_set = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
        if not q_set:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question Set not found")

        result = []
        try:
            for dto in dtos:
                if dto.id:
                    q = db.query(Question).options(joinedload(Question.options)).filter(Question.id == dto.id).first()
                    if q:
                        q.question_text = dto.question_text
                        q.marks = dto.marks or q.marks
                        q.negative_marks = dto.negative_marks or q.negative_marks
                        q.display_order = dto.display_order or q.display_order
                        # update options
                        if dto.options:
                            for opt_dto in dto.options:
                                if opt_dto.id:
                                    opt = db.query(QuestionOption).filter(QuestionOption.id == opt_dto.id).first()
                                    if opt:
                                        opt.option_text = opt_dto.option_text
                                        opt.is_correct = opt_dto.correct
                        result.append(cls._to_dto(q))
                else:
                    created = cls.create_question(db, question_set_id, dto, performed_by)
                    result.append(created)

            db.commit()
        except Exception:
            db.rollback()
            raise
        return result

    @classmethod
    def delete_all_questions_in_set(cls, db: Session, question_set_id: int, performed_by: str) -> None:
        questions = db.query(Question).filter(Question.question_set_id == question_set_id).all()
        q_ids = [q.id for q in questions]
        try:
            if q_ids:
                db.query(AttemptAnswer).filter(AttemptAnswer.question_id.in_(q_ids)).delete(synchronize_session=False)
                db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.question_id.in_(q_ids)).delete(synchronize_session=False)
                db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.question_id.in_(q_ids)).delete(synchronize_session=False)
            for q in questions:
                db.delete(q)
            db.add(AuditLog(
                action="DELETE_ALL_QUESTIONS_IN_SET",
                entity_type="QuestionSet",
                entity_id=str(question_set_id),
                performed_by=performed_by,
                details=f"Cleared all {len(questions)} questions in Question Set {question_set_id}"
            ))
            db.commit()
        except Exception:
            db.rollback()
            raise

    @classmethod
    def delete_question_set(cls, db: Session, question_set_id: int, performed_by: str) -> None:
        qs = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
        if not qs:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question Set not found")
        try:
            # Clean up questions in set first
            questions = db.query(Question).filter(Question.question_set_id == question_set_id).all()
            q_ids = [q.id for q in questions]
            if q_ids:
                db.query(AttemptAnswer).filter(AttemptAnswer.question_id.in_(q_ids)).delete(synchronize_session=False)
                db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.question_id.in_(q_ids)).delete(synchronize_session=False)
                db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.question_id.in_(q_ids)).delete(synchronize_session=False)
            db.delete(qs)
            db.add(AuditLog(
                action="DELETE_QUESTION_SET",
                entity_type="QuestionSet",
                entity_id=str(question_set_id),
                performed_by=performed_by,
                details=f"Deleted Question Set {question_set_id}"
            ))
            db.commit()
        except Exception:
            db.rollback()
            raise
