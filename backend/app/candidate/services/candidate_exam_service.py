import re
import time
import secrets
import random
from typing import List, Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status

from app.models import (
    Candidate, CandidateAccessCode, Department, Exam, QuestionSet, Question, QuestionOption,
    ExamSlot, ExamAttempt, AttemptRandomizedQuestion, AttemptRandomizedOption,
    AttemptAnswer, AuditLog
)
from app.schemas import (
    CandidateVerifyRequest, CandidateVerifyResponse,
    CandidateStartAttemptResponse, CandidateQuestionDto, CandidateOptionDto,
    SubmissionResponse
)

secure_random = random.SystemRandom()

def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

class CandidateExamService:
    @classmethod
    def verify_candidate(cls, db: Session, req: CandidateVerifyRequest) -> CandidateVerifyResponse:
        resp = CandidateVerifyResponse(eligible=False, message="")
        input_code = (req.access_code or req.unique_id or req.registration_number or "").strip()
        input_name = (req.full_name or req.name or "").strip()
        input_dept_id = req.department_id
        input_dept_name = (req.department_name or req.department or "").strip()

        # 1. Require all three mandatory identification fields
        if not input_code:
            resp.message = "Unique Candidate ID is required. Please enter the Unique ID provided for your assessment."
            return resp

        if not input_name:
            resp.message = "Full Name is required. Please enter your registered full name."
            return resp

        if input_dept_id is None and not input_dept_name:
            resp.message = "Department selection is required. Please select your assigned department."
            return resp

        # 2. Strict Database Validation: Unique Candidate ID must exist in DB
        access_code_obj = db.query(CandidateAccessCode).filter(
            func.upper(CandidateAccessCode.code) == input_code.upper()
        ).first()

        # If not matching code directly, check candidate registration number in database
        if not access_code_obj:
            clean_reg = re.sub(r'^(MCQ|CODE)[-_]', '', input_code.upper())
            base_reg = re.sub(r'[-_]\d+$', '', clean_reg) or clean_reg
            reg_candidate = re.split(r'[-_](?:ROUND|R\d|\d+$)', clean_reg, flags=re.IGNORECASE)[0]
            cand_by_reg = db.query(Candidate).filter(
                func.upper(Candidate.registration_number).in_([input_code.upper(), clean_reg, base_reg, reg_candidate])
            ).first()
            if cand_by_reg:
                target_round = req.round or ("ROUND_2" if input_code.upper().startswith("CODE-") else "ROUND_1")
                access_code_obj = db.query(CandidateAccessCode).filter(
                    CandidateAccessCode.candidate_id == cand_by_reg.id,
                    CandidateAccessCode.round == target_round,
                    CandidateAccessCode.is_active == True
                ).order_by(CandidateAccessCode.created_at.desc()).first()
                if not access_code_obj:
                    # Auto-provision canonical access code for this candidate and round
                    from app.admin.services.candidate_service import CandidateService
                    CandidateService.generate_access_code(db, cand_by_reg.id, performed_by="SYSTEM", round_name=target_round, force_new=False)
                    access_code_obj = db.query(CandidateAccessCode).filter(
                        CandidateAccessCode.candidate_id == cand_by_reg.id,
                        CandidateAccessCode.round == target_round,
                        CandidateAccessCode.is_active == True
                    ).order_by(CandidateAccessCode.created_at.desc()).first()

        if not access_code_obj:
            resp.message = f"Invalid Unique Candidate ID '{input_code}'. No matching candidate record exists in the database."
            return resp

        # Check 3-use limit and code active status
        if access_code_obj.usage_count >= access_code_obj.max_uses or not access_code_obj.is_active:
            resp.eligible = False
            if access_code_obj.usage_count >= access_code_obj.max_uses:
                resp.message = (
                    f"This Unique Access ID ({access_code_obj.code}) has reached its maximum limit "
                    f"({access_code_obj.usage_count}/{access_code_obj.max_uses} uses) and is permanently expired. "
                    "Please contact your exam administrator for assistance."
                )
            else:
                resp.message = (
                    f"This Unique Access ID ({access_code_obj.code}) has been superseded by a newly issued ID or deactivated. "
                    "Please enter your newly issued Unique ID or contact your administrator."
                )
            resp.access_code = access_code_obj.code
            resp.access_code_uses = access_code_obj.usage_count
            resp.access_code_max_uses = access_code_obj.max_uses
            return resp

        # Retrieve Candidate record associated with this Unique ID
        candidate = db.query(Candidate).options(
            joinedload(Candidate.department)
        ).filter(Candidate.id == access_code_obj.candidate_id).first()

        if not candidate:
            resp.message = "No candidate record found associated with this Unique ID in the database."
            return resp

        if candidate.status and candidate.status.upper() != "ACTIVE":
            resp.message = "Candidate account is disabled, suspended, or inactive. Please contact your exam administrator."
            return resp

        # 3. Strict Database Validation: Full Name must match candidate record in DB
        def normalize_name(s: str) -> str:
            return re.sub(r'\s+', ' ', (s or "").strip()).lower()

        if normalize_name(input_name) != normalize_name(candidate.full_name):
            resp.message = (
                f"Full Name mismatch: The entered name '{input_name}' does not match the name "
                f"registered for Candidate ID '{access_code_obj.code}'. Please enter your exact registered full name."
            )
            return resp

        # 4. Strict Database Validation: Department must match candidate's assigned department in DB
        if not candidate.department_id or not candidate.department:
            resp.message = (
                f"Department mismatch: Candidate '{candidate.full_name}' has no assigned department "
                "in database records. Please contact your exam administrator to assign your department."
            )
            return resp

        # Check Department match via ID, Name, or Code
        def normalize_dept(s: str) -> str:
            clean = (s or "").strip().lower()
            clean = re.sub(r'\s*&\s*', ' and ', clean)
            return re.sub(r'[^a-zA-Z0-9]', '', clean)

        cand_dname = normalize_dept(candidate.department.name)
        cand_dcode = normalize_dept(candidate.department.code or "")

        matched_dept = False

        # Match by direct ID equality
        if input_dept_id is not None and candidate.department_id == input_dept_id:
            matched_dept = True

        # Match by Department Name or Code
        if input_dept_name:
            input_d = normalize_dept(input_dept_name)
            if (input_d == cand_dname or 
                input_d == cand_dcode or 
                input_d in cand_dname or 
                cand_dname in input_d):
                matched_dept = True
            elif cand_dcode and cand_dcode in input_d:
                matched_dept = True

        # If ID was sent, verify if that ID maps to candidate department in DB
        if not matched_dept and input_dept_id is not None:
            dept_from_id = db.query(Department).filter(Department.id == input_dept_id).first()
            if dept_from_id:
                dept_id_name = normalize_dept(dept_from_id.name)
                dept_id_code = normalize_dept(dept_from_id.code or "")
                if dept_id_name == cand_dname or dept_id_code == cand_dcode:
                    matched_dept = True

        if not matched_dept:
            resp.message = (
                f"Department mismatch: The selected department does not match the department assigned "
                f"to this candidate in our records ('{candidate.department.name}'). Please select your assigned department."
            )
            return resp

        # Store validated details
        resp.candidate_id = candidate.id
        resp.registration_number = candidate.registration_number
        resp.full_name = candidate.full_name
        resp.candidate_name = candidate.full_name
        resp.department_name = candidate.department.name

        # Round 2 Coding Assessment verification routing
        is_round_2 = access_code_obj is not None and access_code_obj.round == "ROUND_2"
        if is_round_2:
            from app.models.coding import CodingExam
            coding_exam = db.query(CodingExam).filter(
                CodingExam.status == "PUBLISHED"
            ).order_by(CodingExam.created_at.desc()).first()

            if not coding_exam:
                resp.message = "No published Round 2 Coding Assessment is currently available. Please contact administrator."
                return resp

            resp.eligible = True
            resp.round = "ROUND_2"
            resp.exam_id = coding_exam.id
            resp.assigned_exam_id = coding_exam.id
            resp.exam_title = coding_exam.title
            resp.duration_minutes = coding_exam.duration_minutes
            resp.total_questions = len(coding_exam.questions) if coding_exam.questions else 0
            resp.timing_mode = coding_exam.timing_mode
            resp.department_name = candidate.department.name if candidate.department else "Developer"
            resp.slot_name = "Slot 1 (Coding Assessment)"
            resp.message = "Candidate verified successfully for Round 2 Coding Assessment. Ready to enter terminal."

            if access_code_obj:
                access_code_obj.usage_count += 1
                access_code_obj.last_used_at = datetime.now(timezone.utc)
                if access_code_obj.usage_count >= access_code_obj.max_uses:
                    access_code_obj.is_active = False
                db.add(access_code_obj)
                db.commit()
                db.refresh(access_code_obj)
                resp.access_code = access_code_obj.code
                resp.access_code_uses = access_code_obj.usage_count
                resp.access_code_max_uses = access_code_obj.max_uses

            return resp

        # Eager load attempt relationships
        existing_attempt = db.query(ExamAttempt).options(
            joinedload(ExamAttempt.exam),
            joinedload(ExamAttempt.question_set),
            joinedload(ExamAttempt.slot)
        ).filter(
            ExamAttempt.candidate_id == candidate.id,
            ExamAttempt.status.in_(["ASSIGNED", "IN_PROGRESS"])
        ).first()

        # Only reuse existing attempt if its exam is currently active/published
        if existing_attempt and existing_attempt.exam and existing_attempt.exam.status == "PUBLISHED":
            exam = existing_attempt.exam
            # If candidate has an assigned set and attempt has not started yet (ASSIGNED),
            # synchronize the attempt's question set to match candidate's assigned set
            if existing_attempt.status == "ASSIGNED" and candidate.assigned_set:
                clean_target = candidate.assigned_set.replace("Set", "").replace("_", "").replace("-", "").strip().upper()
                target_qs = db.query(QuestionSet).filter(
                    QuestionSet.exam_id == exam.id,
                    func.upper(QuestionSet.set_code) == clean_target
                ).first()
                if target_qs and existing_attempt.question_set_id != target_qs.id:
                    existing_attempt.question_set_id = target_qs.id
                    db.commit()
                    db.refresh(existing_attempt)
            if existing_attempt.status == "ASSIGNED":
                db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == existing_attempt.id).delete()
                db.commit()
            question_set = existing_attempt.question_set
            slot = existing_attempt.slot
        else:
            dept_id = req.department_id or (candidate.department_id if candidate.department_id else None)

            published_exams = db.query(Exam).options(
                joinedload(Exam.departments)
            ).filter(
                Exam.status == "PUBLISHED"
            ).order_by(Exam.created_at.desc()).all()

            if not published_exams:
                resp.message = "No published examination is currently available. Please contact administrator."
                return resp

            matched_exams = [
                e for e in published_exams
                if not e.departments or (dept_id and any(d.id == dept_id for d in e.departments))
            ]

            if not matched_exams:
                if not dept_id:
                    resp.message = "Please select your assigned department to proceed."
                else:
                    resp.message = "No published examination is currently available for this department."
                return resp

            # Prioritize standard exams over scrap test exams
            production_exams = [
                e for e in matched_exams
                if not (e.title and (e.title.startswith("Live E2E") or e.title.startswith("Access Limit")))
                and (e.total_questions or 0) >= 10
            ]
            candidate_pool = production_exams if production_exams else matched_exams

            # Sort matched exams:
            # 1. Department match
            # 2. Total question count (prefer complete 60-question exams over small scrap)
            # 3. Most recently published exam
            candidate_pool.sort(
                key=lambda e: (
                    1 if dept_id and any(d.id == dept_id for d in e.departments) else 0,
                    e.total_questions or 0,
                    e.created_at.timestamp() if e.created_at else 0
                ),
                reverse=True
            )

            exam = candidate_pool[0]

            # Set allocation across A, B, C, D
            sets = []
            if dept_id:
                sets = db.query(QuestionSet).filter(
                    QuestionSet.exam_id == exam.id,
                    QuestionSet.department_id == dept_id
                ).order_by(QuestionSet.set_code.asc()).all()

            if not sets:
                sets = db.query(QuestionSet).filter(
                    QuestionSet.exam_id == exam.id
                ).order_by(QuestionSet.set_code.asc()).all()

            if not sets:
                resp.message = "Examination sets are not configured. Please contact administrator."
                return resp

            # Prioritize sets that actually have questions configured
            populated_sets = [
                s for s in sets
                if db.query(Question.id).filter(Question.question_set_id == s.id).first() is not None
            ]
            active_sets = populated_sets if populated_sets else sets

            # If candidate has an assigned question paper set (Set A, Set B, Set C, Set D), allocate that exact set!
            cand_assigned = (candidate.assigned_set or "").strip().upper()
            if cand_assigned:
                clean_target = cand_assigned.replace("SET", "").replace("_", "").replace("-", "").strip()
                matched_set = next(
                    (s for s in sets if s.set_code.strip().upper() == clean_target),
                    None
                )
                if matched_set:
                    question_set = matched_set
                else:
                    total_assigned = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam.id).count()
                    set_index = int(total_assigned % len(active_sets))
                    question_set = active_sets[set_index]
            else:
                total_assigned = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam.id).count()
                set_index = int(total_assigned % len(active_sets))
                question_set = active_sets[set_index]

            slot = db.query(ExamSlot).filter(ExamSlot.exam_id == exam.id).order_by(ExamSlot.slot_number.asc()).first()

            prior_attempt = db.query(ExamAttempt).filter(
                ExamAttempt.candidate_id == candidate.id,
                ExamAttempt.exam_id == exam.id
            ).first()

            if prior_attempt:
                if prior_attempt.status in ("SUBMITTED", "EXPIRED"):
                    # Check if candidate has active unique ID with remaining uses
                    if access_code_obj and access_code_obj.is_active and access_code_obj.usage_count < access_code_obj.max_uses:
                        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == prior_attempt.id).delete()
                        db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id == prior_attempt.id).delete()
                        db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id == prior_attempt.id).delete()
                        prior_attempt.status = "ASSIGNED"
                        prior_attempt.slot_id = slot.id if slot else None
                        prior_attempt.question_set_id = question_set.id
                        prior_attempt.started_at = None
                        prior_attempt.expires_at = None
                        prior_attempt.submitted_at = None
                        prior_attempt.score = None
                        prior_attempt.total_marks = None
                        prior_attempt.percentage = None
                        prior_attempt.qualification_status = "PENDING"
                        prior_attempt.receipt_id = None
                        db.commit()
                    else:
                        resp.eligible = False
                        resp.message = "You have already completed this examination."
                        return resp
            else:
                new_attempt = ExamAttempt(
                    candidate_id=candidate.id,
                    exam_id=exam.id,
                    slot_id=slot.id if slot else None,
                    question_set_id=question_set.id,
                    status="ASSIGNED",
                    created_at=datetime.now(timezone.utc)
                )
                db.add(new_attempt)
                db.commit()

        resp.eligible = True
        resp.message = "Candidate verified successfully. Ready to start examination."
        resp.exam_id = exam.id
        resp.assigned_exam_id = exam.id
        resp.exam_title = exam.title
        resp.duration_minutes = exam.duration_minutes
        resp.total_questions = exam.total_questions
        resp.timing_mode = exam.timing_mode
        resp.scheduled_start_time = exam.scheduled_start_time
        resp.scheduled_end_time = exam.scheduled_end_time
        resp.set_code = question_set.set_code
        resp.question_set_code = question_set.set_code
        resp.department_name = candidate.department.name if candidate.department else "General Assessment"
        resp.slot_name = f"Slot {slot.slot_number}" if slot else "Slot 1 (Main)"

        # Atomically increment usage count and mark inactive when limit reached
        if access_code_obj:
            access_code_obj.usage_count += 1
            access_code_obj.last_used_at = datetime.now(timezone.utc)
            if access_code_obj.usage_count >= access_code_obj.max_uses:
                access_code_obj.is_active = False
            db.add(access_code_obj)
            db.commit()
            db.refresh(access_code_obj)
            resp.access_code = access_code_obj.code
            resp.access_code_uses = access_code_obj.usage_count
            resp.access_code_max_uses = access_code_obj.max_uses

        return resp

    @classmethod
    def start_or_resume_attempt(cls, db: Session, candidate_id: int, exam_id: int) -> CandidateStartAttemptResponse:
        attempt = db.query(ExamAttempt).options(
            joinedload(ExamAttempt.exam),
            joinedload(ExamAttempt.candidate),
            joinedload(ExamAttempt.question_set)
        ).filter(
            ExamAttempt.candidate_id == candidate_id,
            ExamAttempt.exam_id == exam_id,
            ExamAttempt.status.in_(["ASSIGNED", "IN_PROGRESS"])
        ).order_by(ExamAttempt.created_at.desc()).first()

        if not attempt:
            # If no active attempt for this exam, check if any attempt for this exam exists
            attempt = db.query(ExamAttempt).options(
                joinedload(ExamAttempt.exam),
                joinedload(ExamAttempt.candidate),
                joinedload(ExamAttempt.question_set)
            ).filter(
                ExamAttempt.candidate_id == candidate_id,
                ExamAttempt.exam_id == exam_id
            ).order_by(ExamAttempt.created_at.desc()).first()

        if not attempt:
            # Auto-provision assigned attempt if candidate and published exam exist
            cand = db.query(Candidate).filter(Candidate.id == candidate_id).first()
            target_exam = db.query(Exam).filter(Exam.id == exam_id, Exam.status == "PUBLISHED").first()
            if cand and target_exam:
                dept_id = cand.department_id
                sets = []
                if dept_id:
                    sets = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == target_exam.id,
                        QuestionSet.department_id == dept_id
                    ).order_by(QuestionSet.set_code.asc()).all()
                if not sets:
                    sets = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == target_exam.id
                    ).order_by(QuestionSet.set_code.asc()).all()
                
                target_qs = None
                if cand.assigned_set and sets:
                    clean_target = cand.assigned_set.replace("SET", "").replace("_", "").replace("-", "").strip().upper()
                    target_qs = next((s for s in sets if s.set_code.strip().upper() == clean_target), None)
                if not target_qs and sets:
                    target_qs = sets[0]
                
                if target_qs:
                    slot = db.query(ExamSlot).filter(ExamSlot.exam_id == target_exam.id).first()
                    attempt = ExamAttempt(
                        candidate_id=cand.id,
                        exam_id=target_exam.id,
                        slot_id=slot.id if slot else None,
                        question_set_id=target_qs.id,
                        status="ASSIGNED",
                        created_at=datetime.now(timezone.utc)
                    )
                    db.add(attempt)
                    db.commit()
                    db.refresh(attempt)

        if not attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No examination assignment found for candidate")

        exam = attempt.exam
        now = datetime.now(timezone.utc)

        if attempt.status in ("SUBMITTED", "EXPIRED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Examination attempt has already been finalized ({attempt.status})."
            )

        if attempt.status == "ASSIGNED":
            # Strict backend enforcement of 3-use limit on CandidateAccessCode
            access_code = db.query(CandidateAccessCode).filter(
                CandidateAccessCode.candidate_id == candidate_id
            ).order_by(CandidateAccessCode.created_at.desc()).first()

            if access_code:
                if access_code.usage_count > access_code.max_uses or (not access_code.is_active and attempt.started_at is not None):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=(
                            f"This Unique Access ID ({access_code.code}) has reached its maximum limit "
                            f"({access_code.usage_count}/{access_code.max_uses} uses) and is permanently expired."
                        )
                    )

            # Ensure fresh clean slate: brand new attempt starts with strictly 0 pre-selected answers
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).delete()

            attempt.status = "IN_PROGRESS"
            attempt.started_at = now
            attempt.expires_at = now + timedelta(minutes=exam.duration_minutes)

            # Eager load raw questions and options
            raw_questions = db.query(Question).options(
                joinedload(Question.options)
            ).filter(
                Question.question_set_id == attempt.question_set_id
            ).order_by(Question.display_order.asc()).all()

            # Resilient fallback: if the assigned set has 0 questions, fallback to another populated set
            if not raw_questions:
                dept_id = attempt.question_set.department_id if attempt.question_set else None
                fallback_set = None
                if dept_id:
                    fallback_set = db.query(QuestionSet).join(Question).filter(
                        QuestionSet.exam_id == exam.id,
                        QuestionSet.department_id == dept_id
                    ).first()
                if not fallback_set:
                    fallback_set = db.query(QuestionSet).join(Question).filter(
                        QuestionSet.exam_id == exam.id
                    ).first()

                if fallback_set:
                    attempt.question_set_id = fallback_set.id
                    raw_questions = db.query(Question).options(
                        joinedload(Question.options)
                    ).filter(
                        Question.question_set_id == fallback_set.id
                    ).order_by(Question.display_order.asc()).all()

            shuffled_questions = list(raw_questions)
            secure_random.shuffle(shuffled_questions)

            # Batch creation of randomized entities
            new_arqs = []
            new_aros = []
            labels = ["A", "B", "C", "D"]

            for i, q in enumerate(shuffled_questions):
                arq = AttemptRandomizedQuestion(
                    attempt_id=attempt.id,
                    question_id=q.id,
                    display_order=i + 1
                )
                new_arqs.append(arq)

                raw_options = list(q.options)
                secure_random.shuffle(raw_options)

                for j, opt in enumerate(raw_options):
                    lbl = labels[j] if j < len(labels) else chr(ord('A') + j)
                    aro = AttemptRandomizedOption(
                        attempt_id=attempt.id,
                        question_id=q.id,
                        option_id=opt.id,
                        display_order=j + 1,
                        display_label=lbl
                    )
                    new_aros.append(aro)

            db.add_all(new_arqs)
            db.add_all(new_aros)

            db.add(AuditLog(
                action="START_EXAM_ATTEMPT",
                entity_type="ExamAttempt",
                entity_id=str(attempt.id),
                performed_by=attempt.candidate.registration_number,
                details=f"Started attempt: examId={exam.id} set={attempt.question_set.set_code}"
            ))
            db.commit()
            db.refresh(attempt)

        elif attempt.status == "IN_PROGRESS":
            exp_utc = _ensure_utc(attempt.expires_at)
            if exp_utc and now > exp_utc:
                cls.finalize_submission(db, attempt)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Examination deadline has expired. Attempt has been auto-submitted."
                )

        # Batch load persisted randomized questions with joined question data
        saved_q_seq = db.query(AttemptRandomizedQuestion).options(
            joinedload(AttemptRandomizedQuestion.question)
        ).filter(
            AttemptRandomizedQuestion.attempt_id == attempt.id
        ).order_by(AttemptRandomizedQuestion.display_order.asc()).all()

        # Batch load persisted randomized options with joined option text
        saved_opt_seq = db.query(AttemptRandomizedOption).options(
            joinedload(AttemptRandomizedOption.option)
        ).filter(
            AttemptRandomizedOption.attempt_id == attempt.id
        ).order_by(
            AttemptRandomizedOption.question_id.asc(),
            AttemptRandomizedOption.display_order.asc()
        ).all()

        opts_by_q: Dict[int, List[AttemptRandomizedOption]] = {}
        for aro in saved_opt_seq:
            opts_by_q.setdefault(aro.question_id, []).append(aro)

        # Load saved answers in single query
        saved_answers = db.query(AttemptAnswer).filter(
            AttemptAnswer.attempt_id == attempt.id
        ).all()
        answered_map: Dict[int, int] = {
            a.question_id: a.selected_option_id
            for a in saved_answers if a.selected_option_id is not None
        }

        candidate_questions: List[CandidateQuestionDto] = []
        for arq in saved_q_seq:
            q = arq.question
            opt_list = opts_by_q.get(q.id, [])
            cand_opts = [
                CandidateOptionDto(
                    option_id=aro.option.id,
                    id=aro.option.id,
                    label=aro.display_label,
                    option_text=aro.option.option_text
                )
                for aro in opt_list
            ]
            cq_dto = CandidateQuestionDto(
                question_id=q.id,
                id=q.id,
                display_index=arq.display_order,
                question_text=q.question_text,
                marks=q.marks,
                options=cand_opts,
                selected_option_id=answered_map.get(q.id)
            )
            candidate_questions.append(cq_dto)

        exp_utc = _ensure_utc(attempt.expires_at)
        remaining_sec = max(0, int((exp_utc - now).total_seconds())) if exp_utc else 0
        answers_dict = {str(k): v for k, v in answered_map.items()}

        return CandidateStartAttemptResponse(
            attempt_id=attempt.id,
            exam_id=exam.id,
            exam_title=exam.title,
            set_code=attempt.question_set.set_code,
            question_set_code=attempt.question_set.set_code,
            started_at=attempt.started_at,
            deadline_at=attempt.expires_at,
            expires_at=attempt.expires_at,
            total_duration_seconds=remaining_sec,
            questions=candidate_questions,
            answers=answers_dict
        )

    @classmethod
    def save_answer(cls, db: Session, attempt_id: int, question_id: int, selected_option_id: Optional[int]) -> Dict[str, Any]:
        attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")

        now = datetime.now(timezone.utc)
        if attempt.status != "IN_PROGRESS":
            if attempt.status == "ASSIGNED":
                attempt.status = "IN_PROGRESS"
                attempt.started_at = now
                if attempt.exam:
                    attempt.expires_at = now + timedelta(minutes=attempt.exam.duration_minutes)
                db.commit()
                db.refresh(attempt)
            else:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot record answers: attempt is {attempt.status}")

        exp_utc = _ensure_utc(attempt.expires_at)
        if exp_utc and now > exp_utc:
            cls.finalize_submission(db, attempt)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam deadline expired. Answers are no longer accepted.")

        # Treat negative or zero option IDs as clearing the selection
        if selected_option_id is not None and selected_option_id <= 0:
            selected_option_id = None

        real_q_id = question_id
        real_opt_id = selected_option_id

        # Verify or resolve question within the attempt's assigned question set
        q = db.query(Question).filter(Question.id == question_id).first()
        if not q or q.question_set_id != attempt.question_set_id:
            arq = db.query(AttemptRandomizedQuestion).filter(
                AttemptRandomizedQuestion.attempt_id == attempt_id,
                AttemptRandomizedQuestion.display_order == question_id
            ).first()
            if arq:
                q = db.query(Question).filter(Question.id == arq.question_id).first()
            else:
                q = db.query(Question).filter(
                    Question.question_set_id == attempt.question_set_id,
                    Question.display_order == question_id
                ).first()
            if q:
                real_q_id = q.id

        if real_opt_id is not None and q:
            opt = db.query(QuestionOption).filter(QuestionOption.id == real_opt_id).first()
            if not opt or opt.question_id != q.id:
                # Check randomized options first
                target_opt = None
                aro = db.query(AttemptRandomizedOption).filter(
                    AttemptRandomizedOption.attempt_id == attempt_id,
                    AttemptRandomizedOption.question_id == q.id,
                    AttemptRandomizedOption.display_order == (real_opt_id if real_opt_id in (1, 2, 3, 4) else -1)
                ).first()
                if aro:
                    target_opt = aro.option
                if not target_opt and q.options:
                    if 0 <= real_opt_id < len(q.options):
                        target_opt = q.options[real_opt_id]
                    elif 1 <= real_opt_id <= len(q.options):
                        target_opt = q.options[real_opt_id - 1]
                    else:
                        target_opt = q.options[real_opt_id % len(q.options)]
                if target_opt:
                    real_opt_id = target_opt.id
                elif not opt:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected option does not belong to question")

        try:
            # Query existing answers for this attempt and question to prevent duplicate rows
            existing_answers = db.query(AttemptAnswer).filter(
                AttemptAnswer.attempt_id == attempt_id,
                AttemptAnswer.question_id == real_q_id
            ).order_by(AttemptAnswer.id.asc()).all()

            if existing_answers:
                answer = existing_answers[0]
                answer.selected_option_id = real_opt_id
                answer.answered_at = now
                if len(existing_answers) > 1:
                    for dup in existing_answers[1:]:
                        db.delete(dup)
            else:
                answer = AttemptAnswer(
                    attempt_id=attempt_id,
                    question_id=real_q_id,
                    selected_option_id=real_opt_id,
                    answered_at=now
                )
                db.add(answer)

            db.commit()
        except Exception:
            db.rollback()
            raise

        return {
            "success": True,
            "questionId": real_q_id,
            "savedOptionId": real_opt_id if real_opt_id is not None else -1
        }

    @classmethod
    def submit_attempt(cls, db: Session, attempt_id: int, answers_payload: Optional[Dict[str, Any]] = None) -> SubmissionResponse:
        attempt = db.query(ExamAttempt).options(
            joinedload(ExamAttempt.exam),
            joinedload(ExamAttempt.candidate),
            joinedload(ExamAttempt.question_set)
        ).filter(ExamAttempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
        return cls.finalize_submission(db, attempt, answers_payload=answers_payload)

    @classmethod
    def finalize_submission(
        cls,
        db: Session,
        attempt: ExamAttempt,
        answers_payload: Optional[Dict[str, Any]] = None
    ) -> SubmissionResponse:
        exam = attempt.exam
        is_published = exam.results_published if exam else False

        if attempt.status == "SUBMITTED":
            return SubmissionResponse(
                success=True,
                message="Attempt was already submitted.",
                attempt_id=attempt.id,
                receipt_id=attempt.receipt_id or "",
                submitted_at=attempt.submitted_at or datetime.now(timezone.utc),
                score=attempt.score if is_published else None,
                total_marks=attempt.total_marks if is_published else None,
                percentage=attempt.percentage if is_published else None,
                is_published=is_published,
                results_published=is_published,
                qualification_status=attempt.qualification_status if is_published else None,
                total_questions=attempt.total_questions,
                questions_answered=attempt.questions_answered,
                correct_answers=attempt.correct_answers,
                incorrect_answers=attempt.incorrect_answers,
                unanswered_questions=attempt.unanswered_questions,
                duration_seconds=attempt.duration_seconds,
                started_at=attempt.started_at,
                candidate_code=attempt.candidate_code,
                question_set_code=attempt.question_set_code
            )

        try:
            correct_count = 0
            incorrect_count = 0
            calculated_score = Decimal("0.00")
            answered_questions_set = set()

            # Load question set questions with options for accurate evaluation
            set_questions = db.query(Question).options(
                joinedload(Question.options)
            ).filter(
                Question.question_set_id == attempt.question_set_id
            ).all()
            q_map_by_id = {q.id: q for q in set_questions}

            arqs = db.query(AttemptRandomizedQuestion).filter(
                AttemptRandomizedQuestion.attempt_id == attempt.id
            ).order_by(AttemptRandomizedQuestion.display_order.asc()).all()
            q_map_by_order = {arq.display_order: q_map_by_id.get(arq.question_id) for arq in arqs if arq.question_id in q_map_by_id}

            if answers_payload and len(answers_payload) > 0:
                for k, opt_val in answers_payload.items():
                    if opt_val is None:
                        continue
                    try:
                        k_num = int(k)
                    except (ValueError, TypeError):
                        continue

                    target_q = q_map_by_order.get(k_num) or q_map_by_id.get(k_num)
                    if not target_q and 1 <= k_num <= len(set_questions):
                        target_q = set_questions[k_num - 1]

                    if not target_q:
                        continue

                    answered_questions_set.add(target_q.id)

                    chosen_opt = None
                    try:
                        opt_id_val = int(opt_val)
                        chosen_opt = next((o for o in target_q.options if o.id == opt_id_val), None)
                        if not chosen_opt and 0 <= opt_id_val < len(target_q.options):
                            chosen_opt = target_q.options[opt_id_val]
                    except (ValueError, TypeError):
                        pass

                    if chosen_opt and chosen_opt.is_correct:
                        correct_count += 1
                        calculated_score += target_q.marks if target_q.marks is not None else Decimal("1.00")
                    else:
                        incorrect_count += 1
                        calculated_score -= target_q.negative_marks if target_q.negative_marks is not None else Decimal("0.00")
            else:
                answers = db.query(AttemptAnswer).options(
                    joinedload(AttemptAnswer.question),
                    joinedload(AttemptAnswer.selected_option)
                ).filter(AttemptAnswer.attempt_id == attempt.id).all()

                latest_answers: Dict[int, AttemptAnswer] = {}
                for a in answers:
                    if a.question_id not in latest_answers:
                        latest_answers[a.question_id] = a
                    else:
                        prev = latest_answers[a.question_id]
                        if a.answered_at and prev.answered_at and a.answered_at > prev.answered_at:
                            latest_answers[a.question_id] = a

                for q_id, a in latest_answers.items():
                    if a.selected_option_id and a.question:
                        answered_questions_set.add(q_id)
                        opt = a.selected_option
                        q = a.question
                        if opt and opt.is_correct:
                            correct_count += 1
                            calculated_score += q.marks if q.marks is not None else Decimal("1.00")
                        else:
                            incorrect_count += 1
                            calculated_score -= q.negative_marks if q.negative_marks is not None else Decimal("0.00")

            if calculated_score < Decimal("0.00"):
                calculated_score = Decimal("0.00")

            total_q = attempt.total_questions or len(set_questions) or (exam.total_questions if exam else 60)
            answered_count = len(answered_questions_set)
            unanswered_count = max(0, total_q - answered_count)

            total_exam_marks = exam.total_marks if (exam and exam.total_marks and exam.total_marks > Decimal("0.00")) else None
            if not total_exam_marks or total_exam_marks <= Decimal("0.00"):
                q_sum = db.query(func.sum(Question.marks)).filter(
                    Question.question_set_id == attempt.question_set_id
                ).scalar()
                total_exam_marks = Decimal(str(q_sum)) if q_sum and q_sum > 0 else Decimal("100.00")

            percentage = ((calculated_score / total_exam_marks) * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            threshold = exam.qualification_threshold if (exam and exam.qualification_threshold) else Decimal("60.00")
            if exam and (exam.qualification_mode or "").upper() == "PERCENTAGE":
                qual_status = "QUALIFIED" if percentage >= threshold else "NOT_QUALIFIED"
            else:
                qual_status = "QUALIFIED" if calculated_score >= threshold else "NOT_QUALIFIED"

            receipt = f"SEB-REC-{secrets.token_hex(4).upper()}-{int(time.time() * 1000)}"
            now = datetime.now(timezone.utc)
            duration_sec = max(0, int((now - attempt.started_at).total_seconds())) if attempt.started_at else 0

            cand_code = attempt.candidate.registration_number if attempt.candidate else (attempt.candidate_code or "")
            set_code = attempt.question_set.set_code if attempt.question_set else (attempt.question_set_code or "A")

            # Store the student's complete overall examination summary in the database
            attempt.status = "SUBMITTED"
            attempt.submitted_at = now
            attempt.candidate_code = cand_code
            attempt.question_set_code = set_code
            attempt.total_questions = total_q
            attempt.questions_answered = answered_count
            attempt.correct_answers = correct_count
            attempt.incorrect_answers = incorrect_count
            attempt.unanswered_questions = unanswered_count
            attempt.duration_seconds = duration_sec
            attempt.score = calculated_score
            attempt.total_marks = total_exam_marks
            attempt.percentage = percentage
            attempt.qualification_status = qual_status
            attempt.receipt_id = receipt

            # IMPORTANT REQUIREMENT:
            # Do not store individual selected answers or selected-question details in the database
            # if they are not required for the intended workflow. Store only the necessary examination
            # summary data and ensure that each student's records remain isolated.
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).delete()

            db.add(AuditLog(
                action="SUBMIT_EXAM",
                entity_type="ExamAttempt",
                entity_id=str(attempt.id),
                performed_by=cand_code or "SYSTEM",
                details=(
                    f"Finalized exam submission: candidate={cand_code} set={set_code} "
                    f"answered={answered_count}/{total_q} correct={correct_count} incorrect={incorrect_count} "
                    f"score={calculated_score}/{total_exam_marks} ({percentage}%) status={qual_status} duration={duration_sec}s receipt={receipt}"
                )
            ))
            db.commit()
            db.refresh(attempt)
        except Exception:
            db.rollback()
            raise

        resp = SubmissionResponse(
            success=True,
            message="Examination submitted successfully. Your examination summary has been safely recorded.",
            receipt_id=receipt,
            submitted_at=attempt.submitted_at,
            attempt_id=attempt.id,
            total_marks=total_exam_marks,
            is_published=is_published,
            results_published=is_published,
            total_questions=total_q,
            questions_answered=answered_count,
            correct_answers=correct_count,
            incorrect_answers=incorrect_count,
            unanswered_questions=unanswered_count,
            duration_seconds=duration_sec,
            started_at=attempt.started_at,
            candidate_code=cand_code,
            question_set_code=set_code
        )

        if is_published:
            resp.score = calculated_score
            resp.percentage = percentage
            resp.qualification_status = qual_status

        return resp
