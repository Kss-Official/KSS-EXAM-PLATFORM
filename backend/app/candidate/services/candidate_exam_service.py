import re
import time
import secrets
import random
from typing import List, Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone, timedelta
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
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

# High-concurrency in-memory cache for question sets during 800-candidate submit spikes
_QUESTION_SET_CACHE: Dict[int, Any] = {}
_QUESTION_SET_CACHE_TTL = 120.0  # seconds

def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def _get_cached_question_metadata(db: Session, question_set_id: int) -> Dict[str, Any]:
    """In-memory cache for question set questions & options to eliminate 2-4 DB SELECT queries on every autosave."""
    now_t = time.time()
    cached = _QUESTION_SET_CACHE.get(question_set_id)
    if cached and (now_t - cached["time"] < _QUESTION_SET_CACHE_TTL):
        return cached["data"]

    questions = db.query(Question).options(
        joinedload(Question.options)
    ).filter(
        Question.question_set_id == question_set_id
    ).all()

    valid_q_ids = set()
    q_by_order = {}
    opt_to_q = {}
    q_options_by_id = {}

    for q in questions:
        valid_q_ids.add(q.id)
        if q.display_order is not None:
            q_by_order[q.display_order] = q.id
        opt_ids = []
        for opt in (q.options or []):
            opt_to_q[opt.id] = q.id
            opt_ids.append(opt.id)
        q_options_by_id[q.id] = opt_ids

    data = {
        "valid_q_ids": valid_q_ids,
        "q_by_order": q_by_order,
        "opt_to_q": opt_to_q,
        "q_options_by_id": q_options_by_id
    }
    _QUESTION_SET_CACHE[question_set_id] = {"time": now_t, "data": data}
    return data

class CandidateExamService:
    @classmethod
    def verify_candidate(cls, db: Session, req: CandidateVerifyRequest) -> CandidateVerifyResponse:
        resp = CandidateVerifyResponse(eligible=False, message="")
        input_name = (req.full_name or req.name or "").strip()
        input_email = (req.email or "").strip().lower()
        input_dept_id = req.department_id
        input_dept_name = (req.department_name or req.department or "").strip()

        # 1. Require all three mandatory identification fields
        if not input_name:
            resp.message = "Full Name is required. Please enter your registered full name."
            return resp

        if not input_email:
            resp.message = "Email Address is required. Please enter your registered email address."
            return resp

        if input_dept_id is None and not input_dept_name:
            resp.message = "Department selection is required. Please select your assigned department."
            return resp

        # 2. Strict Database Validation: Look up Candidate by registered Email or Registration Number (Sl. No.)
        cand_query = db.query(Candidate).options(
            joinedload(Candidate.department),
            joinedload(Candidate.college)
        )
        candidate = None
        target_reg = (req.registration_number or "").strip().upper()
        if not target_reg and input_email and (input_email.isdigit() or "@" not in input_email):
            target_reg = input_email.strip().upper()

        if input_email and "@" in input_email:
            candidate = cand_query.filter(func.lower(Candidate.email) == input_email).first()

        # Fallback to registration number / Sl. No. if email didn't match or input was a registration number
        if not candidate and target_reg:
            candidate = cand_query.filter(func.upper(Candidate.registration_number) == target_reg).first()

        if not candidate:
            ident = input_email or req.registration_number or "provided identifier"
            resp.message = f"Access Denied: No candidate record found for '{ident}'. Please verify your registered email address or contact your administrator."
            return resp

        # Strict validation: If both email and registration number are provided, both must match candidate
        if input_email and "@" in input_email and target_reg:
            if candidate.registration_number.strip().upper() != target_reg or candidate.email.strip().lower() != input_email:
                resp.message = f"Registration and email mismatch: The provided registration number '{target_reg}' does not match the registered email '{input_email}'."
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
                f"registered for email '{input_email}'. Please enter your exact registered full name."
            )
            return resp

        # Authoritative mapping of department categories
        NON_TECHNICAL_CODES = {
            "HR", "MKT", "SALES_MKT", "SALES", "MARKETING", "FIN", "FINANCE", 
            "OPS", "MGMT", "NON_TECH", "DATAMKT", "BIZDEV", "RECRUIT", "CORPREL", "PR"
        }
        NON_TECHNICAL_KEYWORDS = [
            "human resource", "hr", "sales", "marketing", "business", "management",
            "non-technical", "non technical", "finance", "accounting", "commerce",
            "recruitment", "talent acquisition", "data and marketing", "data & marketing",
            "operations", "corporate", "administration", "public relations", "communications"
        ]

        def get_department_category(dept_name: str, dept_code: str) -> str:
            code_upper = (dept_code or "").strip().upper()
            if code_upper in NON_TECHNICAL_CODES:
                return "NON_TECHNICAL"
            name_clean = (dept_name or "").strip().lower()
            name_clean = re.sub(r'\s*&\s*', ' and ', name_clean)
            for kw in NON_TECHNICAL_KEYWORDS:
                if re.search(r'\b' + re.escape(kw) + r'\b', name_clean):
                    return "NON_TECHNICAL"
            return "TECHNICAL"

        # Determine track from candidate's chosen department (Technical vs Non-Technical)
        # Note: Department is NOT matched against DB; only Name & Email authorize the candidate.
        input_d = (input_dept_name or "").strip().lower()
        if "non" in input_d:
            chosen_track = "Non-Technical Department"
            chosen_category = "NON_TECHNICAL"
        else:
            chosen_track = "Technical Department"
            chosen_category = "TECHNICAL"

        # Store validated details
        resp.candidate_id = candidate.id
        resp.registration_number = candidate.registration_number
        resp.full_name = candidate.full_name
        resp.candidate_name = candidate.full_name
        resp.email = candidate.email
        resp.department_name = chosen_track
        resp.college_name = candidate.college.name if candidate.college else None

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
        if existing_attempt and existing_attempt.exam and existing_attempt.exam.status in ("ACTIVATED", "PUBLISHED"):
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
            published_exams = db.query(Exam).options(
                joinedload(Exam.departments)
            ).filter(
                Exam.status.in_(["ACTIVATED", "PUBLISHED"])
            ).order_by(Exam.created_at.desc()).all()

            if not published_exams:
                resp.message = "No activated examination is currently available. Please contact administrator."
                return resp

            def exam_matches_track(e, track_cat):
                if not e.departments:
                    return True
                for d in e.departments:
                    if get_department_category(d.name, d.code or "") == track_cat:
                        return True
                return False

            track_matched = [e for e in published_exams if exam_matches_track(e, chosen_category)]
            candidate_pool = track_matched if track_matched else published_exams

            # Single active exam policy: the first activated exam in pool is the target exam
            exam = candidate_pool[0]

            # Set allocation across A, B, C, D
            sets = []
            track_dept_ids = [
                d.id for d in exam.departments
                if get_department_category(d.name, d.code or "") == chosen_category
            ]
            if track_dept_ids:
                sets = db.query(QuestionSet).filter(
                    QuestionSet.exam_id == exam.id,
                    QuestionSet.department_id.in_(track_dept_ids)
                ).order_by(QuestionSet.set_code.asc()).all()

            if not sets and candidate.department_id:
                sets = db.query(QuestionSet).filter(
                    QuestionSet.exam_id == exam.id,
                    QuestionSet.department_id == candidate.department_id
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
                if prior_attempt.status in ("SUBMITTED", "EXPIRED", "COMPLETED"):
                    resp.eligible = False
                    resp.message = "You have already completed and submitted your examination."
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
        resp.message = "Candidate credentials verified successfully. Ready to start examination."
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

        from app.core.security import create_session_token
        resp.token = create_session_token({
            "candidate_id": candidate.id,
            "registration_number": candidate.registration_number,
            "email": candidate.email,
            "role": "CANDIDATE"
        })

        return resp

    @classmethod
    def start_or_resume_attempt(cls, db: Session, candidate_id: int, exam_id: int) -> CandidateStartAttemptResponse:
        # Enforce single active exam policy: ensure we target the currently ACTIVATED exam
        active_exam = db.query(Exam).filter(Exam.status.in_(["ACTIVATED", "PUBLISHED"])).order_by(Exam.created_at.desc()).first()
        if active_exam:
            req_exam = db.query(Exam).filter(Exam.id == exam_id).first() if exam_id else None
            if not req_exam or req_exam.status not in ("ACTIVATED", "PUBLISHED"):
                exam_id = active_exam.id

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
            cand = db.query(Candidate).options(joinedload(Candidate.department)).filter(Candidate.id == candidate_id).first()
            target_exam = db.query(Exam).options(joinedload(Exam.departments)).filter(Exam.id == exam_id, Exam.status.in_(["ACTIVATED", "PUBLISHED"])).first()
            if cand and target_exam:
                dept_id = cand.department_id

                # Enforce department authorization: candidate department MUST be in exam departments
                if target_exam.departments:
                    allowed_dept_ids = {d.id for d in target_exam.departments}
                    if not dept_id or dept_id not in allowed_dept_ids:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Access denied: Candidate's assigned department is not authorized for this examination."
                        )

                sets = []
                if dept_id:
                    sets = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == target_exam.id,
                        QuestionSet.department_id == dept_id
                    ).order_by(QuestionSet.set_code.asc()).all()

                # Only fall back to universal sets if no department-specific sets exist
                if not sets:
                    sets = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == target_exam.id,
                        QuestionSet.department_id == None
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
                    try:
                        db.add(attempt)
                        db.commit()
                        db.refresh(attempt)
                    except Exception:
                        db.rollback()
                        attempt = db.query(ExamAttempt).options(
                            joinedload(ExamAttempt.exam),
                            joinedload(ExamAttempt.candidate),
                            joinedload(ExamAttempt.question_set)
                        ).filter(
                            ExamAttempt.candidate_id == cand.id,
                            ExamAttempt.exam_id == target_exam.id
                        ).order_by(ExamAttempt.created_at.desc()).first()
                else:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: No question sets configured for your department in this examination."
                    )

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

            # Batch creation of randomized entities using high-speed bulk mappings
            # to collapse 300 individual ORM INSERT statements down to 2 batch operations.
            new_arqs = []
            new_aros = []
            labels = ["A", "B", "C", "D"]

            for i, q in enumerate(shuffled_questions):
                new_arqs.append({
                    "attempt_id": attempt.id,
                    "question_id": q.id,
                    "display_order": i + 1
                })

                raw_options = list(q.options)
                secure_random.shuffle(raw_options)

                for j, opt in enumerate(raw_options):
                    lbl = labels[j] if j < len(labels) else chr(ord('A') + j)
                    new_aros.append({
                        "attempt_id": attempt.id,
                        "question_id": q.id,
                        "option_id": opt.id,
                        "display_order": j + 1,
                        "display_label": lbl
                    })

            try:
                if new_arqs:
                    db.bulk_insert_mappings(AttemptRandomizedQuestion, new_arqs)
                if new_aros:
                    db.bulk_insert_mappings(AttemptRandomizedOption, new_aros)

                db.add(AuditLog(
                    action="START_EXAM_ATTEMPT",
                    entity_type="ExamAttempt",
                    entity_id=str(attempt.id),
                    performed_by=attempt.candidate.registration_number,
                    details=f"Started attempt: examId={exam.id} set={attempt.question_set.set_code}"
                ))
                db.commit()
                db.refresh(attempt)
            except Exception:
                db.rollback()
                # If concurrent transaction already randomized and committed, refresh attempt state gracefully
                attempt = db.query(ExamAttempt).options(
                    joinedload(ExamAttempt.exam),
                    joinedload(ExamAttempt.candidate),
                    joinedload(ExamAttempt.question_set)
                ).filter(ExamAttempt.id == attempt.id).first()

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
    def save_answer(
        cls,
        db: Session,
        attempt_id: int,
        question_id: int,
        selected_option_id: Optional[int],
        candidate_id: Optional[int] = None
    ) -> Dict[str, Any]:
        attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")

        # Session & Candidate Isolation: prevent cross-candidate tampering
        if candidate_id is not None and attempt.candidate_id != candidate_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: attempt does not belong to the current candidate"
            )

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

        # High-performance question & option resolution using cached question set metadata
        meta = _get_cached_question_metadata(db, attempt.question_set_id) if attempt.question_set_id else None
        if meta and real_q_id in meta["valid_q_ids"]:
            pass  # Fast path: already direct question ID, 0 DB queries!
        elif meta and real_q_id in meta["q_by_order"]:
            real_q_id = meta["q_by_order"][real_q_id]  # Display order resolved via cache, 0 DB queries!
        else:
            # Fallback to database resolution if not in cache
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

        if real_opt_id is not None:
            if meta and meta["opt_to_q"].get(real_opt_id) == real_q_id:
                pass  # Fast path: option verified in memory, 0 DB queries!
            elif meta and real_q_id in meta["q_options_by_id"]:
                q_opts = meta["q_options_by_id"][real_q_id]
                if 0 <= real_opt_id < len(q_opts):
                    real_opt_id = q_opts[real_opt_id]
                elif 1 <= real_opt_id <= len(q_opts):
                    real_opt_id = q_opts[real_opt_id - 1]
                else:
                    target_opt = None
                    aro = db.query(AttemptRandomizedOption).filter(
                        AttemptRandomizedOption.attempt_id == attempt_id,
                        AttemptRandomizedOption.question_id == real_q_id,
                        AttemptRandomizedOption.display_order == (real_opt_id if real_opt_id in (1, 2, 3, 4) else -1)
                    ).first()
                    if aro and aro.option_id:
                        real_opt_id = aro.option_id
            else:
                opt = db.query(QuestionOption).filter(QuestionOption.id == real_opt_id).first()
                if not opt or opt.question_id != real_q_id:
                    target_opt = None
                    aro = db.query(AttemptRandomizedOption).filter(
                        AttemptRandomizedOption.attempt_id == attempt_id,
                        AttemptRandomizedOption.question_id == real_q_id,
                        AttemptRandomizedOption.display_order == (real_opt_id if real_opt_id in (1, 2, 3, 4) else -1)
                    ).first()
                    if aro:
                        target_opt = aro.option
                    if target_opt:
                        real_opt_id = target_opt.id
                    elif not opt:
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected option does not belong to question")

        try:
            dialect_name = db.bind.dialect.name if db.bind else ""
            if dialect_name == "postgresql":
                # Single-roundtrip atomic O(1) upsert via Postgres ON CONFLICT DO UPDATE
                stmt = pg_insert(AttemptAnswer).values(
                    attempt_id=attempt_id,
                    question_id=real_q_id,
                    selected_option_id=real_opt_id,
                    answered_at=now
                ).on_conflict_do_update(
                    index_elements=["attempt_id", "question_id"],
                    set_=dict(
                        selected_option_id=real_opt_id,
                        answered_at=now
                    )
                )
                db.execute(stmt)
                db.commit()
            elif dialect_name == "sqlite":
                stmt = sqlite_insert(AttemptAnswer).values(
                    attempt_id=attempt_id,
                    question_id=real_q_id,
                    selected_option_id=real_opt_id,
                    answered_at=now
                ).on_conflict_do_update(
                    index_elements=["attempt_id", "question_id"],
                    set_=dict(
                        selected_option_id=real_opt_id,
                        answered_at=now
                    )
                )
                db.execute(stmt)
                db.commit()
            else:
                existing_answer = db.query(AttemptAnswer).filter(
                    AttemptAnswer.attempt_id == attempt_id,
                    AttemptAnswer.question_id == real_q_id
                ).first()

                if existing_answer:
                    existing_answer.selected_option_id = real_opt_id
                    existing_answer.answered_at = now
                else:
                    answer = AttemptAnswer(
                        attempt_id=attempt_id,
                        question_id=real_q_id,
                        selected_option_id=real_opt_id,
                        answered_at=now
                    )
                    db.add(answer)
                db.commit()
        except Exception as exc:
            db.rollback()
            try:
                conflicted = db.query(AttemptAnswer).filter(
                    AttemptAnswer.attempt_id == attempt_id,
                    AttemptAnswer.question_id == real_q_id
                ).first()
                if conflicted:
                    conflicted.selected_option_id = real_opt_id
                    conflicted.answered_at = now
                    db.commit()
                else:
                    raise exc
            except Exception:
                db.rollback()
                raise

        return {
            "success": True,
            "questionId": real_q_id,
            "savedOptionId": real_opt_id if real_opt_id is not None else -1
        }

    @classmethod
    def submit_attempt(
        cls,
        db: Session,
        attempt_id: int,
        answers_payload: Optional[Dict[str, Any]] = None,
        candidate_id: Optional[int] = None
    ) -> SubmissionResponse:
        attempt = db.query(ExamAttempt).options(
            joinedload(ExamAttempt.exam),
            joinedload(ExamAttempt.candidate),
            joinedload(ExamAttempt.question_set)
        ).filter(ExamAttempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
        # Session & Candidate Isolation: prevent cross-candidate tampering
        if candidate_id is not None and attempt.candidate_id != candidate_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: attempt does not belong to the current candidate"
            )
        return cls.finalize_submission(db, attempt, answers_payload=answers_payload)

    @classmethod
    def _build_submission_response(
        cls,
        attempt: ExamAttempt,
        is_published: bool,
        message: str = "Examination submitted successfully."
    ) -> SubmissionResponse:
        receipt = attempt.receipt_id or ""
        cand_code = attempt.candidate_code or (attempt.candidate.registration_number if attempt.candidate else "")
        set_code = attempt.question_set_code or (attempt.question_set.set_code if attempt.question_set else "A")

        resp = SubmissionResponse(
            success=True,
            message=message,
            receipt_id=receipt,
            submitted_at=attempt.submitted_at or datetime.now(timezone.utc),
            attempt_id=attempt.id,
            total_marks=attempt.total_marks,
            is_published=is_published,
            results_published=is_published,
            total_questions=attempt.total_questions,
            questions_answered=attempt.questions_answered,
            correct_answers=attempt.correct_answers,
            incorrect_answers=attempt.incorrect_answers,
            unanswered_questions=attempt.unanswered_questions,
            duration_seconds=attempt.duration_seconds,
            started_at=attempt.started_at,
            candidate_code=cand_code,
            question_set_code=set_code
        )
        if is_published:
            resp.score = attempt.score
            resp.percentage = attempt.percentage
            resp.qualification_status = attempt.qualification_status
        return resp

    @classmethod
    def finalize_submission(
        cls,
        db: Session,
        attempt: ExamAttempt,
        answers_payload: Optional[Dict[str, Any]] = None
    ) -> SubmissionResponse:
        exam = attempt.exam
        is_published = exam.results_published if exam else False

        # Fast idempotent path: check if attempt was already finalized
        if attempt.status == "SUBMITTED":
            return cls._build_submission_response(attempt, is_published, "Attempt was already submitted.")

        try:
            # Row-level lock on ExamAttempt to serialize simultaneous final submissions
            # Any competing finalization threads will queue here until this transaction commits.
            locked_attempt = db.query(ExamAttempt).filter(
                ExamAttempt.id == attempt.id
            ).with_for_update().first()

            if not locked_attempt:
                locked_attempt = attempt

            # Re-check under the row lock: if another thread finalized it just now, return cached receipt
            if locked_attempt.status == "SUBMITTED":
                return cls._build_submission_response(locked_attempt, is_published, "Attempt was already submitted.")

            attempt = locked_attempt

            correct_count = 0
            incorrect_count = 0
            calculated_score = Decimal("0.00")
            answered_questions_set = set()

            # Load question set questions with options bound to current db session
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
            started_utc = _ensure_utc(attempt.started_at)
            duration_sec = max(0, int((now - started_utc).total_seconds())) if started_utc else 0

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
