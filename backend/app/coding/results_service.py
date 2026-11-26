import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.coding import (
    CodingAttempt,
    CodingDraft,
    CodingExam,
    CodingQuestion,
    CodingQuestionResult,
    CodingSubmission,
    CodingTestCase,
)
from app.models.proctor import ProctorAlert
from app.coding.scoring import (
    compute_code_hash,
    compute_overall_attempt_score,
    compute_question_result_metrics,
)


def _parse_retention_days(policy: str) -> Optional[int]:
    p = (policy or "none").strip().lower()
    if p.startswith("days:"):
        try:
            return max(0, int(p.split(":", 1)[1]))
        except ValueError:
            return 0
    return None


def apply_code_retention_for_attempt(
    attempt: CodingAttempt,
    db: Session,
    policy: Optional[str] = None,
) -> int:
    """
    Applies CODING_CODE_RETENTION AFTER result rows are committed:
    - Deletes coding_drafts for this attempt.
    - 'none' (default): nulls source_code on coding_submissions while keeping code_hash.
    - 'flagged_only': retains source_code only if candidate has a ProctorAlert, else nulls it.
    - 'days:N': sets retention_expires_at = now + N days (keeps code_hash).
    """
    eff_policy = (policy or settings.CODING_CODE_RETENTION or "none").strip().lower()
    now = datetime.now(timezone.utc)

    # Always remove drafts after finalization
    db.query(CodingDraft).filter(CodingDraft.attempt_id == attempt.id).delete(synchronize_session=False)

    subs = db.query(CodingSubmission).filter(CodingSubmission.attempt_id == attempt.id).all()
    affected = 0
    if eff_policy == "none":
        for s in subs:
            if s.source_code is not None:
                if not s.code_hash:
                    s.code_hash = compute_code_hash(s.source_code)
                s.source_code = None
                affected += 1
    elif eff_policy == "flagged_only":
        has_flag = (
            db.query(ProctorAlert.id)
            .filter(ProctorAlert.candidate_id == attempt.candidate_id)
            .first()
            is not None
        )
        for s in subs:
            if not s.code_hash and s.source_code is not None:
                s.code_hash = compute_code_hash(s.source_code)
            if has_flag:
                s.retention_expires_at = now + timedelta(days=30)
            elif s.source_code is not None:
                s.source_code = None
                affected += 1
    else:
        days = _parse_retention_days(eff_policy)
        exp = now + timedelta(days=days if days is not None else 0)
        for s in subs:
            if not s.code_hash and s.source_code is not None:
                s.code_hash = compute_code_hash(s.source_code)
            s.retention_expires_at = exp
            if days == 0 and s.source_code is not None:
                s.source_code = None
                affected += 1

    db.commit()
    return affected


def purge_expired_submission_code(db: Session, batch_size: int = 200) -> int:
    """Batch-limited purge job nulling source_code whose retention_expires_at has passed."""
    now = datetime.now(timezone.utc)
    rows = (
        db.query(CodingSubmission)
        .filter(
            CodingSubmission.source_code != None,  # noqa: E711
            CodingSubmission.retention_expires_at != None,  # noqa: E711
            CodingSubmission.retention_expires_at <= now,
        )
        .limit(batch_size)
        .all()
    )
    purged = 0
    for s in rows:
        if not s.code_hash and s.source_code is not None:
            s.code_hash = compute_code_hash(s.source_code)
        s.source_code = None
        purged += 1
    if purged:
        db.commit()
    return purged


def finalize_coding_attempt_results(
    attempt_id: int,
    db: Session,
    retention_policy: Optional[str] = None,
) -> Optional[CodingAttempt]:
    """
    Computes and persists CodingQuestionResult rows + CodingAttempt aggregate totals
    in ONE atomic transaction, idempotently. Never deletes source code until AFTER
    result rows are committed.
    """
    attempt = db.query(CodingAttempt).filter(CodingAttempt.id == attempt_id).first()
    if not attempt:
        return None

    exam = (
        db.query(CodingExam)
        .options(joinedload(CodingExam.questions).joinedload(CodingQuestion.test_cases))
        .filter(CodingExam.id == attempt.exam_id)
        .first()
    )
    if not exam:
        return None

    now = datetime.now(timezone.utc)
    all_subs = (
        db.query(CodingSubmission)
        .filter(
            CodingSubmission.attempt_id == attempt.id,
            CodingSubmission.is_run_only == False,  # noqa: E712
        )
        .order_by(CodingSubmission.submitted_at.desc())
        .all()
    )
    subs_by_q: Dict[str, List[CodingSubmission]] = {}
    for s in all_subs:
        subs_by_q.setdefault(s.question_id, []).append(s)

    question_scores: List[tuple[float, float]] = []

    for q in (exam.questions or []):
        existing_res = (
            db.query(CodingQuestionResult)
            .filter(
                CodingQuestionResult.attempt_id == attempt.id,
                CodingQuestionResult.question_id == q.id,
            )
            .first()
        )
        if existing_res:
            question_scores.append((float(existing_res.score_awarded or 0), float(existing_res.score_possible or 0)))
            continue

        q_subs = subs_by_q.get(q.id, [])
        tc_dicts = [
            {"id": tc.id, "marks": float(tc.marks or 0), "isHidden": bool(tc.is_hidden)}
            for tc in (q.test_cases or [])
        ]

        if not q_subs:
            computed = compute_question_result_metrics(
                test_cases=tc_dicts,
                case_results=[],
                question_max_marks=float(q.max_marks or 0),
                language=None,
                attempts_count=0,
                source_code=None,
                overall_verdict="NOT_ATTEMPTED",
                compile_error=None,
            )
        else:
            # Pick highest scoring submission, tie-breaking by most recent
            best_sub = max(
                q_subs,
                key=lambda s: (float(s.marks_awarded or 0.0), s.submitted_at or now),
            )
            try:
                parsed_cases = json.loads(best_sub.test_case_results or "[]")
            except Exception:
                parsed_cases = []
            comp_err = best_sub.error_message if best_sub.verdict == "COMPILE_ERROR" else None
            computed = compute_question_result_metrics(
                test_cases=tc_dicts,
                case_results=parsed_cases,
                question_max_marks=float(q.max_marks or 0),
                language=best_sub.language,
                attempts_count=len(q_subs),
                source_code=best_sub.source_code,
                overall_verdict=best_sub.verdict or best_sub.status or "FAILED",
                compile_error=comp_err,
            )

        row = CodingQuestionResult(
            attempt_id=attempt.id,
            candidate_id=attempt.candidate_id,
            exam_id=exam.id,
            question_id=q.id,
            tests_passed=computed.tests_passed,
            tests_total=computed.tests_total,
            sample_passed=computed.sample_passed,
            hidden_passed=computed.hidden_passed,
            score_awarded=Decimal(str(computed.score_awarded)),
            score_possible=Decimal(str(computed.score_possible)),
            score_percent=Decimal(str(computed.score_percent)),
            final_verdict=computed.final_verdict,
            failure_summary_json=json.dumps(computed.failure_summary),
            first_failure_type=computed.first_failure_type,
            max_runtime_ms=computed.max_runtime_ms,
            max_memory_kb=computed.max_memory_kb,
            language=computed.language,
            attempts_count=computed.attempts_count,
            compile_error_short=computed.compile_error_short,
            code_hash=computed.code_hash,
            finalized_at=now,
        )
        try:
            with db.begin_nested():
                db.add(row)
                db.flush()
            question_scores.append((computed.score_awarded, computed.score_possible))
        except IntegrityError:
            # Concurrent worker already inserted this result row
            dup = (
                db.query(CodingQuestionResult)
                .filter(
                    CodingQuestionResult.attempt_id == attempt.id,
                    CodingQuestionResult.question_id == q.id,
                )
                .first()
            )
            if dup:
                question_scores.append((float(dup.score_awarded or 0), float(dup.score_possible or 0)))

    agg = compute_overall_attempt_score(
        question_scores=question_scores,
        qualification_percentage=float(exam.qualification_percentage or 60.0),
    )
    attempt.total_score = Decimal(str(agg["total_score"]))
    attempt.total_possible = Decimal(str(agg["total_possible"]))
    attempt.overall_percent = Decimal(str(agg["overall_percent"]))
    attempt.score = attempt.total_score
    attempt.total_marks = attempt.total_possible
    attempt.percentage = attempt.overall_percent
    attempt.qualification_status = agg["qualification_status"]
    attempt.status = "SUBMITTED"
    if attempt.submitted_at is None:
        attempt.submitted_at = now
    if attempt.finalized_at is None:
        attempt.finalized_at = now

    # Step 1: Commit durable result rows FIRST
    db.commit()
    db.refresh(attempt)

    # Step 2: Only AFTER result rows are committed, apply code retention / deletion
    apply_code_retention_for_attempt(attempt, db, policy=retention_policy)
    return attempt
