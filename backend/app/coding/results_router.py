import csv
import io
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.core import get_db, require_super_admin
from app.core.config import settings
from app.models import AppUser, AuditLog, Candidate
from app.models.coding import (
    CodingAttempt,
    CodingDraft,
    CodingExam,
    CodingQuestion,
    CodingQuestionResult,
    CodingSubmission,
)
from app.coding.results_service import finalize_coding_attempt_results

results_router = APIRouter()


def _require_enabled() -> None:
    if not settings.CODING_ROUND_ENABLED:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Round 2 Coding Round is disabled.")


@results_router.post("/finalize/{exam_id}")
def finalize_my_coding_attempt(
    exam_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    from app.coding.router import _require_candidate_from_request

    _require_enabled()
    cand = _require_candidate_from_request(request, db)
    attempt = (
        db.query(CodingAttempt)
        .filter(CodingAttempt.candidate_id == cand.id, CodingAttempt.exam_id == exam_id)
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding attempt not found.")

    finalized = finalize_coding_attempt_results(int(attempt.id), db)
    return {
        "success": True,
        "attemptId": int(finalized.id),
        "status": finalized.status,
        "finalizedAt": finalized.finalized_at.isoformat() if finalized.finalized_at else None,
    }


@results_router.get("/results/me")
def get_my_coding_results(
    examId: int,
    request: Request,
    db: Session = Depends(get_db),
):
    from app.coding.router import _require_candidate_from_request

    _require_enabled()
    cand = _require_candidate_from_request(request, db)
    exam = db.query(CodingExam).filter(CodingExam.id == examId).first()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding exam not found.")

    attempt = (
        db.query(CodingAttempt)
        .filter(CodingAttempt.candidate_id == cand.id, CodingAttempt.exam_id == examId)
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding attempt not found.")

    if not exam.results_published:
        return {
            "examId": int(exam.id),
            "examTitle": exam.title,
            "attemptId": int(attempt.id),
            "resultsPublished": False,
            "status": attempt.status,
            "message": "Results have not been published by the administrator yet.",
        }

    q_results = (
        db.query(CodingQuestionResult)
        .options(joinedload(CodingQuestionResult.question))
        .filter(CodingQuestionResult.attempt_id == attempt.id)
        .order_by(CodingQuestionResult.question_id.asc())
        .all()
    )

    # Fetch latest submission per question ONLY for sample-test details (never hidden test data)
    subs = (
        db.query(CodingSubmission)
        .filter(CodingSubmission.attempt_id == attempt.id, CodingSubmission.is_run_only == False)  # noqa: E712
        .order_by(CodingSubmission.submitted_at.desc())
        .all()
    )
    sample_by_q: Dict[str, List[Dict[str, Any]]] = {}
    for s in subs:
        if s.question_id in sample_by_q:
            continue
        try:
            raw = json.loads(s.test_case_results or "[]")
        except Exception:
            raw = []
        sample_by_q[s.question_id] = [
            {
                "testCaseId": item.get("testCaseId"),
                "label": item.get("label"),
                "passed": bool(item.get("passed")),
                "verdict": item.get("verdict"),
                "input": item.get("input"),
                "expectedOutput": item.get("expectedOutput"),
                "actualOutput": item.get("actualOutput"),
            }
            for item in raw
            if not item.get("isHidden")
        ]

    questions_out = []
    for qr in q_results:
        hidden_total = max(0, int(qr.tests_total or 0) - len(sample_by_q.get(qr.question_id, [])))
        questions_out.append({
            "questionId": qr.question_id,
            "title": qr.question.title if qr.question else qr.question_id,
            "testsPassed": int(qr.tests_passed or 0),
            "testsTotal": int(qr.tests_total or 0),
            "samplePassed": int(qr.sample_passed or 0),
            "hiddenSummary": f"{int(qr.hidden_passed or 0)} of {hidden_total} hidden passed",
            "scoreAwarded": float(qr.score_awarded or 0),
            "scorePossible": float(qr.score_possible or 0),
            "scorePercent": float(qr.score_percent or 0),
            "finalVerdict": qr.final_verdict,
            "language": qr.language,
            "attemptsCount": int(qr.attempts_count or 0),
            "maxRuntimeMs": qr.max_runtime_ms,
            "maxMemoryKb": qr.max_memory_kb,
            "compileErrorShort": qr.compile_error_short,
            "sampleDetails": sample_by_q.get(qr.question_id, []),
        })

    return {
        "examId": int(exam.id),
        "examTitle": exam.title,
        "attemptId": int(attempt.id),
        "resultsPublished": True,
        "totalScore": float(attempt.total_score or 0),
        "totalPossible": float(attempt.total_possible or 0),
        "overallPercent": float(attempt.overall_percent or 0),
        "qualificationStatus": attempt.qualification_status,
        "finalizedAt": attempt.finalized_at.isoformat() if attempt.finalized_at else None,
        "questions": questions_out,
    }


@results_router.post("/admin/exams/{exam_id}/publish-results")
def toggle_coding_results_published(
    exam_id: int,
    published: bool = Query(True),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    _require_enabled()
    exam = db.query(CodingExam).filter(CodingExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding exam not found.")
    exam.results_published = bool(published)
    db.commit()
    return {"examId": int(exam.id), "resultsPublished": bool(exam.results_published)}


@results_router.get("/admin/exams/{exam_id}/results")
def list_coding_exam_results_admin(
    exam_id: int,
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, le=200),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    _require_enabled()
    exam = db.query(CodingExam).options(joinedload(CodingExam.questions)).filter(CodingExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding exam not found.")

    base_q = db.query(CodingAttempt).filter(CodingAttempt.exam_id == exam_id)
    total = base_q.count()
    attempts = (
        base_q.options(joinedload(CodingAttempt.candidate))
        .order_by(CodingAttempt.overall_percent.desc(), CodingAttempt.id.asc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    attempt_ids = [a.id for a in attempts]
    q_results = (
        db.query(CodingQuestionResult)
        .filter(CodingQuestionResult.attempt_id.in_(attempt_ids))
        .all()
        if attempt_ids
        else []
    )
    res_by_att: Dict[int, Dict[str, CodingQuestionResult]] = {}
    for qr in q_results:
        res_by_att.setdefault(int(qr.attempt_id), {})[qr.question_id] = qr

    items = []
    for a in attempts:
        att_map = res_by_att.get(int(a.id), {})
        items.append({
            "attemptId": int(a.id),
            "candidateId": int(a.candidate_id),
            "candidateName": a.candidate.full_name if a.candidate else "Candidate",
            "candidateEmail": a.candidate.email if a.candidate else "",
            "registrationNumber": a.candidate.registration_number if a.candidate else "",
            "status": a.status,
            "totalScore": float(a.total_score or 0),
            "totalPossible": float(a.total_possible or 0),
            "overallPercent": float(a.overall_percent or 0),
            "qualificationStatus": a.qualification_status,
            "finalizedAt": a.finalized_at.isoformat() if a.finalized_at else None,
            "questionPercents": {
                q.id: float(att_map[q.id].score_percent or 0) if q.id in att_map else 0.0
                for q in (exam.questions or [])
            },
        })

    return {
        "examId": int(exam.id),
        "examTitle": exam.title,
        "resultsPublished": bool(exam.results_published),
        "page": page,
        "pageSize": pageSize,
        "total": total,
        "questions": [{"id": q.id, "title": q.title, "maxMarks": q.max_marks} for q in (exam.questions or [])],
        "items": items,
    }


@results_router.get("/admin/exams/{exam_id}/results/export.csv")
def export_coding_results_csv_admin(
    exam_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    _require_enabled()
    exam = db.query(CodingExam).options(joinedload(CodingExam.questions)).filter(CodingExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding exam not found.")

    attempts = (
        db.query(CodingAttempt)
        .options(joinedload(CodingAttempt.candidate))
        .filter(CodingAttempt.exam_id == exam_id)
        .order_by(CodingAttempt.overall_percent.desc())
        .all()
    )
    q_results = db.query(CodingQuestionResult).filter(CodingQuestionResult.exam_id == exam_id).all()
    res_by_att: Dict[int, Dict[str, CodingQuestionResult]] = {}
    for qr in q_results:
        res_by_att.setdefault(int(qr.attempt_id), {})[qr.question_id] = qr

    buf = io.StringIO()
    writer = csv.writer(buf)
    q_ids = [q.id for q in (exam.questions or [])]
    writer.writerow(["AttemptID", "CandidateName", "Email", "RegNo", "TotalScore", "TotalPossible", "OverallPercent", "Status", *q_ids])
    for a in attempts:
        att_map = res_by_att.get(int(a.id), {})
        writer.writerow([
            a.id,
            a.candidate.full_name if a.candidate else "",
            a.candidate.email if a.candidate else "",
            a.candidate.registration_number if a.candidate else "",
            float(a.total_score or 0),
            float(a.total_possible or 0),
            float(a.overall_percent or 0),
            a.qualification_status,
            *[float(att_map[qid].score_percent or 0) if qid in att_map else 0.0 for qid in q_ids],
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="coding_exam_{exam_id}_results.csv"'},
    )


@results_router.get("/admin/exams/{exam_id}/results/{candidate_id}")
def get_coding_candidate_result_detail_admin(
    exam_id: int,
    candidate_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    _require_enabled()
    attempt = (
        db.query(CodingAttempt)
        .options(joinedload(CodingAttempt.candidate))
        .filter(CodingAttempt.exam_id == exam_id, CodingAttempt.candidate_id == candidate_id)
        .first()
    )
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate attempt not found.")

    q_results = (
        db.query(CodingQuestionResult)
        .options(joinedload(CodingQuestionResult.question))
        .filter(CodingQuestionResult.attempt_id == attempt.id)
        .all()
    )
    return {
        "attemptId": int(attempt.id),
        "candidateId": int(attempt.candidate_id),
        "candidateName": attempt.candidate.full_name if attempt.candidate else "",
        "candidateEmail": attempt.candidate.email if attempt.candidate else "",
        "totalScore": float(attempt.total_score or 0),
        "totalPossible": float(attempt.total_possible or 0),
        "overallPercent": float(attempt.overall_percent or 0),
        "qualificationStatus": attempt.qualification_status,
        "finalizedAt": attempt.finalized_at.isoformat() if attempt.finalized_at else None,
        "questions": [
            {
                "questionId": qr.question_id,
                "title": qr.question.title if qr.question else qr.question_id,
                "testsPassed": int(qr.tests_passed or 0),
                "testsTotal": int(qr.tests_total or 0),
                "samplePassed": int(qr.sample_passed or 0),
                "hiddenPassed": int(qr.hidden_passed or 0),
                "scoreAwarded": float(qr.score_awarded or 0),
                "scorePossible": float(qr.score_possible or 0),
                "scorePercent": float(qr.score_percent or 0),
                "finalVerdict": qr.final_verdict,
                "failureSummary": json.loads(qr.failure_summary_json or "{}"),
                "firstFailureType": qr.first_failure_type,
                "maxRuntimeMs": qr.max_runtime_ms,
                "maxMemoryKb": qr.max_memory_kb,
                "language": qr.language,
                "attemptsCount": int(qr.attempts_count or 0),
                "compileErrorShort": qr.compile_error_short,
                "codeHash": qr.code_hash,
            }
            for qr in q_results
        ],
    }


@results_router.get("/admin/exams/{exam_id}/analytics")
def get_coding_exam_question_analytics_admin(
    exam_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    _require_enabled()
    exam = db.query(CodingExam).options(joinedload(CodingExam.questions)).filter(CodingExam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding exam not found.")

    rows = db.query(CodingQuestionResult).filter(CodingQuestionResult.exam_id == exam_id).all()
    by_q: Dict[str, List[CodingQuestionResult]] = {}
    for r in rows:
        by_q.setdefault(r.question_id, []).append(r)

    stats = []
    for q in (exam.questions or []):
        q_rows = by_q.get(q.id, [])
        n = len(q_rows)
        if n == 0:
            stats.append({
                "questionId": q.id,
                "title": q.title,
                "submissionsCount": 0,
                "avgPercent": 0.0,
                "passRatePercent": 0.0,
                "avgAttempts": 0.0,
                "failureDistribution": {},
            })
            continue
        avg_pct = round(sum(float(r.score_percent or 0) for r in q_rows) / n, 2)
        passed_n = sum(1 for r in q_rows if r.final_verdict == "ACCEPTED")
        avg_att = round(sum(int(r.attempts_count or 0) for r in q_rows) / n, 2)
        dist: Dict[str, int] = {}
        for r in q_rows:
            if r.final_verdict != "ACCEPTED":
                k = r.first_failure_type or r.final_verdict or "UNKNOWN"
                dist[k] = dist.get(k, 0) + 1
        stats.append({
            "questionId": q.id,
            "title": q.title,
            "submissionsCount": n,
            "avgPercent": avg_pct,
            "passRatePercent": round((passed_n / n) * 100.0, 2),
            "avgAttempts": avg_att,
            "failureDistribution": dist,
        })

    return {"examId": int(exam.id), "examTitle": exam.title, "questions": stats}


@results_router.post("/admin/attempts/{attempt_id}/reset")
def reset_coding_attempt_admin(
    attempt_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Resets/deletes a candidate's Round 2 coding attempt (submissions, drafts, question results)
    so they can immediately log back in and retake the coding exam.
    """
    _require_enabled()
    attempt = db.query(CodingAttempt).filter(CodingAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Coding attempt #{attempt_id} was not found.",
        )

    cand_id = int(attempt.candidate_id)
    exam_id = int(attempt.exam_id)

    db.query(CodingQuestionResult).filter(CodingQuestionResult.attempt_id == attempt.id).delete()
    db.query(CodingDraft).filter(CodingDraft.attempt_id == attempt.id).delete()
    db.query(CodingSubmission).filter(CodingSubmission.attempt_id == attempt.id).delete()
    db.delete(attempt)

    db.add(
        AuditLog(
            action="RESET_CODING_ATTEMPT",
            entity_type="CodingAttempt",
            entity_id=str(attempt_id),
            performed_by=current_user.email,
            details=f"Admin {current_user.email} reset coding attempt #{attempt_id} for candidate #{cand_id} on coding exam #{exam_id}.",
        )
    )
    db.commit()

    return {
        "success": True,
        "attemptId": int(attempt_id),
        "candidateId": cand_id,
        "examId": exam_id,
        "message": "Coding attempt reset successfully. The candidate can now log in and retake Round 2.",
    }
