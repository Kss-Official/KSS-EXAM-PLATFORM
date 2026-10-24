import csv
import io
import re
import secrets
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, UploadFile, status

from app.models import (
    Candidate, CandidateAccessCode, Department, Exam, ExamSlot, QuestionSet, ExamAttempt, AuditLog
)
from app.schemas import CandidateDto, CandidateAccessCodeDto
from app.core import EmailService

class CandidateService:
    @staticmethod
    def _to_dto(c: Candidate) -> CandidateDto:
        return CandidateDto(
            id=c.id,
            registration_number=c.registration_number,
            full_name=c.full_name,
            email=c.email,
            department_id=c.department_id,
            department_name=c.department.name if c.department else None,
            status=c.status or "ACTIVE",
            created_at=c.created_at,
            assigned_set=c.assigned_set
        )

    @classmethod
    def get_all_candidates(cls, db: Session) -> List[CandidateDto]:
        """
        Retrieves all registered candidates with eager-loaded departments and access codes in a single query.
        """
        cands = db.query(Candidate).options(
            joinedload(Candidate.department),
            joinedload(Candidate.access_codes)
        ).order_by(Candidate.created_at.desc()).all()
        return [cls._to_dto(c) for c in cands]

    @classmethod
    def create_candidate(cls, db: Session, dto: CandidateDto, performed_by: str) -> CandidateDto:
        reg_num = dto.registration_number.strip().upper()
        if db.query(Candidate).filter(Candidate.registration_number.ilike(reg_num)).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Candidate with Registration Number '{reg_num}' already exists"
            )

        email = dto.email.strip().lower()
        if db.query(Candidate).filter(Candidate.email.ilike(email)).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Candidate with email '{email}' already exists"
            )

        dept = None
        if dto.department_id:
            dept = db.query(Department).filter(Department.id == dto.department_id).first()

        c = Candidate(
            registration_number=reg_num,
            full_name=dto.full_name.strip(),
            email=email,
            department_id=dept.id if dept else None,
            status="ACTIVE",
            created_at=datetime.now(timezone.utc)
        )
        db.add(c)
        db.flush()

        db.add(AuditLog(
            action="CREATE_CANDIDATE",
            entity_type="Candidate",
            entity_id=str(c.id),
            performed_by=performed_by,
            details=f"Registered candidate: {c.full_name} ({reg_num})"
        ))
        db.commit()
        db.refresh(c)
        return cls._to_dto(c)

    @classmethod
    def import_candidates_csv_sync(cls, db: Session, file: UploadFile, performed_by: str) -> Dict[str, Any]:
        """
        Imports candidates in bulk from uploaded CSV file.
        Format: RegNumber, FullName, Email, [DepartmentCode]
        """
        content = file.file.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded CSV file is empty")

        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.reader(io.StringIO(text))
        
        created_list: List[CandidateDto] = []
        errors: List[str] = []
        line_num = 0

        # Pre-cache existing registration numbers, emails, and departments
        existing_regs = {r[0].upper() for r in db.query(Candidate.registration_number).all()}
        existing_emails = {e[0].lower() for e in db.query(Candidate.email).all()}
        dept_map = {d.code.upper(): d.id for d in db.query(Department).all()}

        new_candidates = []

        for row in reader:
            line_num += 1
            if not row or all(col.strip() == "" for col in row):
                continue
            
            # Skip header line if detected
            if line_num == 1 and ("registration" in row[0].lower() or "reg" in row[0].lower()):
                continue

            if len(row) < 3:
                errors.append(f"Line {line_num}: Expected at least 3 columns (RegNumber, FullName, Email)")
                continue

            reg_num = row[0].strip().upper()
            full_name = row[1].strip()
            email = row[2].strip().lower()
            dept_code = row[3].strip().upper() if len(row) > 3 else None

            if not reg_num or not full_name or not email:
                errors.append(f"Line {line_num}: Registration number, Full Name, and Email are required.")
                continue

            if reg_num in existing_regs:
                errors.append(f"Line {line_num}: Registration number '{reg_num}' is already in use.")
                continue

            if email in existing_emails:
                errors.append(f"Line {line_num}: Email '{email}' is already in use.")
                continue

            dept_id = dept_map.get(dept_code) if dept_code else None

            c = Candidate(
                registration_number=reg_num,
                full_name=full_name,
                email=email,
                department_id=dept_id,
                status="ACTIVE",
                created_at=datetime.now(timezone.utc)
            )
            new_candidates.append(c)
            existing_regs.add(reg_num)
            existing_emails.add(email)

        if new_candidates:
            db.add_all(new_candidates)
            db.commit()
            for cand in new_candidates:
                db.refresh(cand)
                created_list.append(cls._to_dto(cand))

            db.add(AuditLog(
                action="BATCH_IMPORT_CANDIDATES",
                entity_type="Candidate",
                entity_id="BATCH",
                performed_by=performed_by,
                details=f"Batch imported {len(new_candidates)} candidates via CSV"
            ))
            db.commit()

        return {
            "success": True,
            "totalImported": len(created_list),
            "errorsCount": len(errors),
            "errors": errors,
            "candidates": [c.model_dump(by_alias=True) for c in created_list]
        }

    @classmethod
    def assign_candidate_to_exam(
        cls, db: Session, candidate_id: int, exam_id: int,
        slot_id: Optional[int], set_code: Optional[str], performed_by: str
    ) -> ExamAttempt:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

        # Check existing attempt
        existing = db.query(ExamAttempt).filter(
            ExamAttempt.candidate_id == candidate_id,
            ExamAttempt.exam_id == exam_id
        ).first()
        if existing:
            return existing

        # Choose question set (respecting candidate's department if configured)
        q_sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_id).all()
        if not q_sets:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No question sets configured for this exam")

        if candidate.department_id:
            dept_sets = [qs for qs in q_sets if qs.department_id == candidate.department_id]
            if dept_sets:
                q_sets = dept_sets

        target_set = None
        if set_code:
            for qs in q_sets:
                if qs.set_code == set_code.upper():
                    target_set = qs
                    break
        if not target_set:
            target_set = q_sets[0]

        # Slot check
        slot = None
        if slot_id:
            slot = db.query(ExamSlot).filter(ExamSlot.id == slot_id).first()

        try:
            attempt = ExamAttempt(
                candidate_id=candidate.id,
                exam_id=exam.id,
                slot_id=slot.id if slot else None,
                question_set_id=target_set.id,
                status="ASSIGNED",
                created_at=datetime.now(timezone.utc)
            )
            db.add(attempt)
            db.commit()
            db.refresh(attempt)

            db.add(AuditLog(
                action="ASSIGN_EXAM_CANDIDATE",
                entity_type="ExamAttempt",
                entity_id=str(attempt.id),
                performed_by=performed_by,
                details=f"Assigned candidate {candidate.registration_number} to exam {exam.id} (Set {target_set.set_code})"
            ))
            db.commit()
        except Exception:
            db.rollback()
            raise
        return attempt

    @classmethod
    def generate_access_code(
        cls, db: Session, candidate_id: int, performed_by: str, round_name: str = "ROUND_1", force_new: bool = False
    ) -> CandidateAccessCodeDto:
        """
        Generates/resets a secure Unique Access ID valid for strictly 3 uses for the given round.
        Format:
          Canonical initial: MCQ-<REGISTRATION_NUMBER> or CODE-<REGISTRATION_NUMBER>
          When force_new=True and code exists: increments to MCQ-<REG>-2, MCQ-<REG>-3, etc.
        Deactivates previous codes for this candidate & round, and activates the new Unique ID with 3 fresh attempts.
        """
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        r_upper = round_name.upper()
        prefix = "MCQ" if r_upper == "ROUND_1" else "CODE"

        # Sanitize candidate registration: uppercase, strip accidental leading MCQ- or CODE- prefixes
        raw_reg = candidate.registration_number.strip().upper()
        clean_reg = re.sub(r'^(MCQ|CODE)[-_]', '', raw_reg) or raw_reg
        base_code = f"{prefix}-{clean_reg}"

        now = datetime.now(timezone.utc)

        # Retrieve all existing access codes for this candidate & round
        existing_codes = db.query(CandidateAccessCode).filter(
            CandidateAccessCode.candidate_id == candidate_id,
            CandidateAccessCode.round == r_upper
        ).order_by(CandidateAccessCode.created_at.desc()).all()

        target_code = base_code
        ac = None

        if not existing_codes:
            # First time generating code for this candidate and round: use base canonical code
            taken = db.query(CandidateAccessCode).filter(CandidateAccessCode.code == base_code).first()
            if taken and taken.candidate_id != candidate.id:
                next_v = 2
                while db.query(CandidateAccessCode).filter(CandidateAccessCode.code == f"{base_code}-{next_v}").first():
                    next_v += 1
                target_code = f"{base_code}-{next_v}"
            else:
                target_code = base_code

            ac = CandidateAccessCode(
                candidate_id=candidate.id,
                code=target_code,
                round=r_upper,
                usage_count=0,
                max_uses=3,
                is_active=True,
                created_at=now
            )
            db.add(ac)
            db.flush()
        else:
            if not force_new:
                # If not forcing new, re-activate and reset the canonical or latest code
                canonical_ac = next((c for c in existing_codes if c.code == base_code), None)
                ac = canonical_ac or existing_codes[0]
                ac.is_active = True
                ac.usage_count = 0
                ac.max_uses = 3
                ac.created_at = now
                ac.last_used_at = None
                target_code = ac.code

                for other in existing_codes:
                    if other.id != ac.id:
                        other.is_active = False
            else:
                # force_new == True: Generate a brand new, distinct versioned Unique ID
                versions = [1]
                for c in existing_codes:
                    m = re.match(r"^" + re.escape(base_code) + r"-(\d+)$", c.code)
                    if m:
                        try:
                            versions.append(int(m.group(1)))
                        except ValueError:
                            pass
                    elif c.code == base_code:
                        versions.append(1)

                next_ver = max(versions) + 1
                target_code = f"{base_code}-{next_ver}"

                # Ensure global uniqueness across candidate_access_codes table
                while db.query(CandidateAccessCode).filter(CandidateAccessCode.code == target_code).first():
                    next_ver += 1
                    target_code = f"{base_code}-{next_ver}"

                # Deactivate all previous codes for this candidate & round
                for old in existing_codes:
                    old.is_active = False

                ac = CandidateAccessCode(
                    candidate_id=candidate.id,
                    code=target_code,
                    round=r_upper,
                    usage_count=0,
                    max_uses=3,
                    is_active=True,
                    created_at=now
                )
                db.add(ac)
                db.flush()

        db.add(AuditLog(
            action="GENERATE_ACCESS_CODE",
            entity_type="CandidateAccessCode",
            entity_id=target_code,
            performed_by=performed_by,
            details=f"Generated {r_upper} Unique Access ID {target_code} (3-use limit) for candidate {candidate.registration_number}"
        ))
        db.commit()
        db.refresh(ac)

        return CandidateAccessCodeDto(
            id=ac.id,
            candidate_id=ac.candidate_id,
            code=ac.code,
            usage_count=ac.usage_count,
            max_uses=ac.max_uses,
            is_active=ac.is_active,
            created_at=ac.created_at
        )

    @classmethod
    def get_round_ids_map(cls, db: Session, round_name: str = "ROUND_1") -> Dict[str, str]:
        """
        Returns a dictionary mapping candidate registration numbers to their active Unique ID for the given round.
        """
        r_upper = round_name.upper()
        codes = db.query(CandidateAccessCode).join(Candidate).filter(
            CandidateAccessCode.round == r_upper,
            CandidateAccessCode.is_active == True,
            CandidateAccessCode.usage_count < CandidateAccessCode.max_uses
        ).order_by(CandidateAccessCode.created_at.desc()).all()

        mapping = {}
        for c in codes:
            if c.candidate:
                reg = c.candidate.registration_number.strip().upper()
                if reg not in mapping:
                    mapping[reg] = c.code
        return mapping

    @classmethod
    def batch_generate_round_ids(
        cls, db: Session, round_name: str = "ROUND_1", performed_by: str = "ADMIN", force_new: bool = False
    ) -> Dict[str, Any]:
        """
        Generates Unique Access IDs (strictly 3-use limit) for all eligible candidates in the selected round.
        When force_new=True, generates a new Unique ID for each candidate.
        """
        r_upper = round_name.upper()
        candidates = db.query(Candidate).filter(Candidate.status == "ACTIVE").all()

        # Filter for Round 2 technical departments if applicable
        tech_keywords = ["developer", "tester", "qa", "computer science", "cse", "information technology", "it", "electronics", "ece", "software"]
        eligible_candidates = []
        for c in candidates:
            if r_upper == "ROUND_2":
                dept = (c.department.name if c.department else "").lower()
                if not dept or any(k in dept for k in tech_keywords):
                    eligible_candidates.append(c)
            else:
                eligible_candidates.append(c)

        newly_generated = 0
        already_existed = 0
        round_map: Dict[str, str] = {}

        for cand in eligible_candidates:
            reg_upper = cand.registration_number.strip().upper()

            if not force_new:
                active_code = db.query(CandidateAccessCode).filter(
                    CandidateAccessCode.candidate_id == cand.id,
                    CandidateAccessCode.round == r_upper,
                    CandidateAccessCode.is_active == True,
                    CandidateAccessCode.usage_count < CandidateAccessCode.max_uses
                ).order_by(CandidateAccessCode.created_at.desc()).first()

                if active_code:
                    already_existed += 1
                    round_map[reg_upper] = active_code.code
                    continue

            dto = cls.generate_access_code(db, cand.id, performed_by, round_name=r_upper, force_new=force_new)
            round_map[reg_upper] = dto.code
            newly_generated += 1

        return {
            "success": True,
            "round": r_upper,
            "totalEligible": len(eligible_candidates),
            "newlyGenerated": newly_generated,
            "alreadyExisted": already_existed,
            "roundIds": round_map
        }

    @classmethod
    def send_access_code_email(
        cls, db: Session, candidate_id: int, performed_by: str, round_name: str = "ROUND_1"
    ) -> Dict[str, Any]:
        """
        Generates/fetches the candidate's unique access code and sends it to their email address.
        """
        candidate = db.query(Candidate).options(
            joinedload(Candidate.access_codes)
        ).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        if not candidate.email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidate has no registered email address")

        r_upper = round_name.upper()

        # Fetch current active code with remaining uses for this round, or generate a fresh one
        active_code = next(
            (ac for ac in candidate.access_codes if ac.is_active and ac.round == r_upper and ac.usage_count < ac.max_uses),
            None
        )

        if not active_code:
            code_dto = cls.generate_access_code(db, candidate_id, performed_by, round_name=r_upper)
            active_code = db.query(CandidateAccessCode).filter(CandidateAccessCode.id == code_dto.id).first()

        exam_round_title = "Round 1: Multiple Choice Examination" if r_upper == "ROUND_1" else "Round 2: Technical Coding Assessment"

        # Send email via EmailService
        delivery_res = EmailService.send_unique_id_email(
            to_email=candidate.email,
            candidate_name=candidate.full_name,
            access_code=active_code.code,
            max_uses=active_code.max_uses,
            exam_title=exam_round_title
        )

        # Record sent metadata
        now = datetime.now(timezone.utc)
        active_code.sent_to_email = candidate.email
        active_code.sent_at = now

        db.add(AuditLog(
            action="SEND_ACCESS_CODE_EMAIL",
            entity_type="CandidateAccessCode",
            entity_id=active_code.code,
            performed_by=performed_by,
            details=f"Sent {r_upper} access ID {active_code.code} via {delivery_res.get('provider')} to {candidate.email}"
        ))
        db.commit()

        return {
            "success": delivery_res.get("success", False),
            "candidateId": candidate.id,
            "candidateName": candidate.full_name,
            "email": candidate.email,
            "round": r_upper,
            "accessCode": active_code.code,
            "usageCount": active_code.usage_count,
            "maxUses": active_code.max_uses,
            "provider": delivery_res.get("provider", "unknown"),
            "message": delivery_res.get("message", "Email sent successfully")
        }

    @classmethod
    def generate_selected_round_ids(
        cls, db: Session, candidate_ids: List[int], round_name: str = "ROUND_1", performed_by: str = "ADMIN", force_new: bool = False
    ) -> Dict[str, Any]:
        """
        Generates/resets Unique Access IDs for the specified selected candidate IDs.
        Enforces uniform pattern (MCQ-<REG> or CODE-<REG>), 3-use limits, and database validation.
        """
        if not candidate_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No candidate IDs provided for ID generation.")

        r_upper = round_name.upper()
        round_map: Dict[str, str] = {}
        failed_ids: List[int] = []
        generated_count = 0

        for cid in candidate_ids:
            try:
                dto = cls.generate_access_code(db, cid, performed_by, round_name=r_upper, force_new=force_new)
                cand = db.query(Candidate).filter(Candidate.id == cid).first()
                if cand:
                    round_map[cand.registration_number.strip().upper()] = dto.code
                    generated_count += 1
            except Exception as e:
                failed_ids.append(cid)

        return {
            "success": len(failed_ids) == 0,
            "round": r_upper,
            "totalSelected": len(candidate_ids),
            "generatedCount": generated_count,
            "failedIds": failed_ids,
            "roundIds": round_map
        }

    @classmethod
    def assign_candidate_set(
        cls, db: Session, candidate_id: int, set_code: Optional[str], performed_by: str = "ADMIN"
    ) -> CandidateDto:
        """
        Assigns or updates the question paper set (Set A, Set B, Set C, Set D, or None) for a candidate.
        If the candidate has an existing attempt with status 'ASSIGNED', updates the attempt's question set.
        Preserves 'IN_PROGRESS' and 'SUBMITTED' attempts.
        """
        candidate = db.query(Candidate).options(
            joinedload(Candidate.department),
            joinedload(Candidate.access_codes)
        ).filter(Candidate.id == candidate_id).first()

        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        normalized_set = normalize_set_code(set_code)
        previous_set = candidate.assigned_set
        candidate.assigned_set = normalized_set

        # If candidate has an existing attempt that is pending start (status == "ASSIGNED"),
        # update the attempt to the matching QuestionSet if one exists
        if normalized_set:
            clean_letter = normalized_set.replace("Set ", "").strip().upper()
            pending_attempts = db.query(ExamAttempt).filter(
                ExamAttempt.candidate_id == candidate_id,
                ExamAttempt.status == "ASSIGNED"
            ).all()

            for attempt in pending_attempts:
                dept_id = candidate.department_id
                target_qs = None
                if dept_id:
                    target_qs = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == attempt.exam_id,
                        QuestionSet.department_id == dept_id,
                        func.upper(QuestionSet.set_code) == clean_letter
                    ).first()
                if not target_qs:
                    target_qs = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == attempt.exam_id,
                        func.upper(QuestionSet.set_code) == clean_letter
                    ).first()
                if target_qs:
                    attempt.question_set_id = target_qs.id

        db.add(AuditLog(
            action="ASSIGN_QUESTION_PAPER_SET",
            entity_type="Candidate",
            entity_id=str(candidate.id),
            performed_by=performed_by,
            details=f"Assigned Question Paper Set '{normalized_set or 'Unassigned'}' (previously '{previous_set or 'Unassigned'}') to {candidate.full_name} ({candidate.registration_number})"
        ))
        db.commit()
        db.refresh(candidate)
        return cls._to_dto(candidate)

    @classmethod
    def batch_assign_candidate_set(
        cls, db: Session, candidate_ids: List[int], set_code: Optional[str], performed_by: str = "ADMIN"
    ) -> Dict[str, Any]:
        """
        Batch assigns a question paper set (Set A, Set B, Set C, Set D, or None) to multiple candidates.
        """
        if not candidate_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No candidate IDs provided for batch assignment.")

        normalized_set = normalize_set_code(set_code)
        candidates = db.query(Candidate).filter(Candidate.id.in_(candidate_ids)).all()
        clean_letter = normalized_set.replace("Set ", "").strip().upper() if normalized_set else None

        updated_count = 0
        for cand in candidates:
            cand.assigned_set = normalized_set
            updated_count += 1

            if clean_letter:
                pending_attempts = db.query(ExamAttempt).filter(
                    ExamAttempt.candidate_id == cand.id,
                    ExamAttempt.status == "ASSIGNED"
                ).all()
                for attempt in pending_attempts:
                    dept_id = cand.department_id
                    target_qs = None
                    if dept_id:
                        target_qs = db.query(QuestionSet).filter(
                            QuestionSet.exam_id == attempt.exam_id,
                            QuestionSet.department_id == dept_id,
                            func.upper(QuestionSet.set_code) == clean_letter
                        ).first()
                    if not target_qs:
                        target_qs = db.query(QuestionSet).filter(
                            QuestionSet.exam_id == attempt.exam_id,
                            func.upper(QuestionSet.set_code) == clean_letter
                        ).first()
                    if target_qs:
                        attempt.question_set_id = target_qs.id

        db.add(AuditLog(
            action="BATCH_ASSIGN_QUESTION_PAPER_SET",
            entity_type="Candidate",
            entity_id="BATCH",
            performed_by=performed_by,
            details=f"Batch assigned Question Paper Set '{normalized_set or 'Unassigned'}' to {updated_count} candidates."
        ))
        db.commit()
        return {
            "success": True,
            "updatedCount": updated_count,
            "assignedSet": normalized_set
        }


def normalize_set_code(raw: Optional[str]) -> Optional[str]:
    """
    Normalizes set codes like 'A', 'Set A', 'set_a', 'SET A' to canonical 'Set A', 'Set B', 'Set C', 'Set D'.
    Returns None if empty or unassigned.
    Raises HTTPException 400 if invalid.
    """
    if not raw or not str(raw).strip() or str(raw).strip().lower() in ("none", "unassigned", "null", "", "-"):
        return None
    val = str(raw).strip().upper().replace("SET", "").replace("_", "").replace("-", "").strip()
    if val in ("A", "B", "C", "D"):
        return f"Set {val}"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid question paper set '{raw}'. Permitted options are Set A, Set B, Set C, Set D (or None to unassign)."
    )


