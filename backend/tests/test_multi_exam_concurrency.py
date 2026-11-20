#!/usr/bin/env python3
"""
==============================================================================
ExamSecure - Multi-Exam Simultaneous Execution & Concurrency Test
==============================================================================
Validates:
1. Multiple simultaneous active exams (Exam A & Exam B activated together)
2. Question paper isolation: Exam A & Exam B have separate questions & question sets
3. Strict candidate assignment & authorization isolation:
   - Candidate enrolled in Exam A cannot start/access Exam B (403 Forbidden)
   - Candidate enrolled in Exam B cannot start/access Exam A (403 Forbidden)
4. 1,000 Concurrent Candidates Simulation:
   - 500 candidates for Exam A
   - 500 candidates for Exam B
   - Concurrent verification, attempt creation, answer recording, manual submission, and auto-submission
5. Results segregation & analytics:
   - Results for Exam A contain only Exam A candidates and questions
   - Results for Exam B contain only Exam B candidates and questions
==============================================================================
"""

import sys
import os
import time
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ["ENFORCE_SLOT_TIME_GATES"] = "false"

import httpx
from app.main import app
from app.core.database import SessionLocal, engine, Base
from app.core.schema_guard import ensure_indexes_and_constraints
from app.models import (
    Candidate, Department, Exam, QuestionSet, Question, QuestionOption,
    ExamAttempt, AttemptAnswer, AttemptRandomizedQuestion, AttemptRandomizedOption
)
from app.admin.services.exam_service import ExamService
from app.admin.services.candidate_service import CandidateService
from app.schemas.candidate import CandidateVerifyRequest
from app.candidate.services.candidate_exam_service import CandidateExamService
from app.admin.services.dashboard_service import DashboardService

ensure_indexes_and_constraints()

TOTAL_CANDIDATES_PER_EXAM = 500
CONCURRENCY_SEMAPHORE = 50


def setup_multi_exams(db):
    """
    Creates two distinct examinations with separate question papers, question sets,
    and options. Activates both exams simultaneously.
    """
    print("\n[SETUP] Creating Exam A (Software Engineering) and Exam B (Data Science & AI)...")

    # Departments
    all_depts = db.query(Department).all()
    if len(all_depts) >= 2:
        dept_se = all_depts[0]
        dept_ds = all_depts[1]
    else:
        dept_se = db.query(Department).filter(Department.name == "Dept A").first()
        if not dept_se:
            dept_se = Department(name="Dept A", code="D_A", active=True)
            db.add(dept_se)
        dept_ds = db.query(Department).filter(Department.name == "Dept B").first()
        if not dept_ds:
            dept_ds = Department(name="Dept B", code="D_B", active=True)
            db.add(dept_ds)
        db.commit()
        db.refresh(dept_se)
        db.refresh(dept_ds)

    # Clean existing test exams if any
    for title in ["SE Placement Exam 2026", "DS Placement Exam 2026"]:
        old_exams = db.query(Exam).filter(Exam.title == title).all()
        for oe in old_exams:
            oe_attempts = db.query(ExamAttempt.id).filter(ExamAttempt.exam_id == oe.id).all()
            oe_att_ids = [a[0] for a in oe_attempts]
            if oe_att_ids:
                db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(oe_att_ids)).delete(synchronize_session=False)
                db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id.in_(oe_att_ids)).delete(synchronize_session=False)
                db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id.in_(oe_att_ids)).delete(synchronize_session=False)
                db.query(ExamAttempt).filter(ExamAttempt.id.in_(oe_att_ids)).delete(synchronize_session=False)

            # Delete question sets
            qsets = db.query(QuestionSet).filter(QuestionSet.exam_id == oe.id).all()
            for qs in qsets:
                db.query(QuestionOption).filter(QuestionOption.question_id.in_(
                    db.query(Question.id).filter(Question.question_set_id == qs.id)
                )).delete(synchronize_session=False)
                db.query(Question).filter(Question.question_set_id == qs.id).delete(synchronize_session=False)
                db.delete(qs)
            db.delete(oe)
    db.commit()

    # Create Exam A
    exam_a = Exam(
        title="SE Placement Exam 2026",
        description="Exam A for Software Engineering Candidates",
        duration_minutes=60,
        total_questions=5,
        total_marks=5,
        marks_per_question=1,
        negative_marks=0,
        status="DRAFT",
        timing_mode="DURATION_FROM_START",
        qualification_mode="PERCENTAGE",
        qualification_threshold=50.0
    )
    exam_a.departments.append(dept_se)
    db.add(exam_a)
    db.commit()
    db.refresh(exam_a)

    # Question Set A for Exam A
    qs_a = QuestionSet(exam_id=exam_a.id, set_code="A", name="Set A (Algorithms)", department_id=dept_se.id)
    db.add(qs_a)
    db.commit()
    db.refresh(qs_a)

    # 5 Questions for Exam A
    for i in range(1, 6):
        q = Question(
            question_set_id=qs_a.id,
            display_order=i,
            question_text=f"[Exam A - SE] Question {i}: What is the time complexity of operation {i}?",
            marks=1,
            negative_marks=0
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        for opt_idx, opt_lbl in enumerate(["A", "B", "C", "D"], start=1):
            opt = QuestionOption(
                question_id=q.id,
                option_text=f"[Exam A] Option {opt_lbl} for Q{i}",
                is_correct=(opt_lbl == "A"),
                display_order=opt_idx
            )
            db.add(opt)
    db.commit()

    # Create Exam B
    exam_b = Exam(
        title="DS Placement Exam 2026",
        description="Exam B for Data Science Candidates",
        duration_minutes=60,
        total_questions=5,
        total_marks=5,
        marks_per_question=1,
        negative_marks=0,
        status="DRAFT",
        timing_mode="DURATION_FROM_START",
        qualification_mode="PERCENTAGE",
        qualification_threshold=50.0
    )
    exam_b.departments.append(dept_ds)
    db.add(exam_b)
    db.commit()
    db.refresh(exam_b)

    # Question Set B for Exam B
    qs_b = QuestionSet(exam_id=exam_b.id, set_code="A", name="Set A (Machine Learning)", department_id=dept_ds.id)
    db.add(qs_b)
    db.commit()
    db.refresh(qs_b)

    # 5 Questions for Exam B
    for i in range(1, 6):
        q = Question(
            question_set_id=qs_b.id,
            display_order=i,
            question_text=f"[Exam B - DS] Question {i}: Which loss function is optimal for model {i}?",
            marks=1,
            negative_marks=0
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        for opt_idx, opt_lbl in enumerate(["A", "B", "C", "D"], start=1):
            opt = QuestionOption(
                question_id=q.id,
                option_text=f"[Exam B] Option {opt_lbl} for Q{i}",
                is_correct=(opt_lbl == "B"),
                display_order=opt_idx
            )
            db.add(opt)
    db.commit()

    # Activate BOTH exams simultaneously
    print("[SETUP] Activating Exam A...")
    ExamService.publish_exam(db, exam_a.id, performed_by="System Test")
    print("[SETUP] Activating Exam B simultaneously...")
    ExamService.publish_exam(db, exam_b.id, performed_by="System Test")

    db.refresh(exam_a)
    db.refresh(exam_b)

    assert exam_a.status == "ACTIVATED", f"Exam A status should be ACTIVATED, got {exam_a.status}"
    assert exam_b.status == "ACTIVATED", f"Exam B status should be ACTIVATED, got {exam_b.status}"
    print(f"[SUCCESS] Both exams ACTIVATED simultaneously! Exam A ID={exam_a.id}, Exam B ID={exam_b.id}")

    return exam_a, exam_b, dept_se, dept_ds


def setup_1000_candidates(db, exam_a, exam_b, dept_se, dept_ds):
    """
    Enrolls 500 candidates strictly assigned to Exam A and 500 candidates strictly assigned to Exam B.
    Total = 1,000 candidates.
    """
    print(f"\n[SETUP] Provisioning 1,000 candidates (500 for Exam A, 500 for Exam B)...")

    # Purge any previous simulation candidates
    old_cands = db.query(Candidate).filter(Candidate.registration_number.like("MULTI_%")).all()
    if old_cands:
        old_ids = [c.id for c in old_cands]
        old_attempts = db.query(ExamAttempt.id).filter(ExamAttempt.candidate_id.in_(old_ids)).all()
        att_ids = [a[0] for a in old_attempts]
        if att_ids:
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(att_ids)).delete(synchronize_session=False)
            db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id.in_(att_ids)).delete(synchronize_session=False)
            db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id.in_(att_ids)).delete(synchronize_session=False)
            db.query(ExamAttempt).filter(ExamAttempt.id.in_(att_ids)).delete(synchronize_session=False)
        db.query(Candidate).filter(Candidate.id.in_(old_ids)).delete(synchronize_session=False)
        db.commit()

    now = datetime.now(timezone.utc)
    now_date = now.strftime("%Y-%m-%d")

    # 500 candidates for Exam A
    candidates_a_payload = []
    for i in range(1, TOTAL_CANDIDATES_PER_EXAM + 1):
        candidates_a_payload.append({
            "registration_number": f"MULTI_A_{i:04d}",
            "full_name": f"Student A {i:04d}",
            "email": f"student_a_{i:04d}@multiexam.local",
            "department_id": dept_se.id,
            "assigned_exam_id": exam_a.id,
            "assigned_set": "A",
            "batch": "Test Slot",
            "exam_date": now_date,
            "status": "ACTIVE",
            "created_at": now
        })
    db.bulk_insert_mappings(Candidate, candidates_a_payload)
    db.commit()

    # 500 candidates for Exam B
    candidates_b_payload = []
    for i in range(1, TOTAL_CANDIDATES_PER_EXAM + 1):
        candidates_b_payload.append({
            "registration_number": f"MULTI_B_{i:04d}",
            "full_name": f"Student B {i:04d}",
            "email": f"student_b_{i:04d}@multiexam.local",
            "department_id": dept_ds.id,
            "assigned_exam_id": exam_b.id,
            "assigned_set": "A",
            "batch": "Test Slot",
            "exam_date": now_date,
            "status": "ACTIVE",
            "created_at": now
        })
    db.bulk_insert_mappings(Candidate, candidates_b_payload)
    db.commit()

    candidates_a = db.query(Candidate).filter(
        Candidate.registration_number.like("MULTI_A_%")
    ).order_by(Candidate.id.asc()).all()

    candidates_b = db.query(Candidate).filter(
        Candidate.registration_number.like("MULTI_B_%")
    ).order_by(Candidate.id.asc()).all()

    assert len(candidates_a) == TOTAL_CANDIDATES_PER_EXAM
    assert len(candidates_b) == TOTAL_CANDIDATES_PER_EXAM
    print(f"[SUCCESS] Provisioned {len(candidates_a)} candidates for Exam A and {len(candidates_b)} candidates for Exam B (Total: {len(candidates_a) + len(candidates_b)})")

    return candidates_a, candidates_b


def verify_security_isolation_cross_access(db, exam_a, exam_b, candidates_a, candidates_b):
    """
    Verifies strict security isolation:
    - Candidate A attempting to start Exam B MUST be rejected with 403 Forbidden.
    - Candidate B attempting to start Exam A MUST be rejected with 403 Forbidden.
    """
    print("\n[SECURITY AUDIT] Testing cross-exam authorization isolation...")
    cand_a = candidates_a[0]
    cand_b = candidates_b[0]

    # Verify Cand A is assigned to Exam A
    v_a = CandidateExamService.verify_candidate(
        db,
        CandidateVerifyRequest(
            email=cand_a.email,
            registration_number=cand_a.registration_number,
            full_name=cand_a.full_name,
            department_name=cand_a.department.name if cand_a.department else "Computer Science"
        )
    )
    if not v_a.eligible:
        print(f"[DEBUG v_a] Eligible={v_a.eligible}, Message={v_a.message}, Cand={cand_a.id}, Status={cand_a.status}, Dept={cand_a.department}")
    assert v_a.eligible is True, f"Verification failed: {v_a.message}"
    assert v_a.assigned_exam_id == exam_a.id
    assert v_a.exam_id == exam_a.id

    # Test 1: Cand A tries to start Exam B
    try:
        CandidateExamService.start_or_resume_attempt(
            db,
            candidate_id=cand_a.id,
            exam_id=exam_b.id
        )
        raise AssertionError("SECURITY VIOLATION: Candidate A was able to start Exam B!")
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        assert status_code == 403, f"Expected 403 Forbidden, got {status_code}: {exc}"
        print(f"[PASS] Candidate A blocked from Exam B: 403 Forbidden ({exc.detail if hasattr(exc, 'detail') else exc})")

    # Test 2: Cand B tries to start Exam A
    try:
        CandidateExamService.start_or_resume_attempt(
            db,
            candidate_id=cand_b.id,
            exam_id=exam_a.id
        )
        raise AssertionError("SECURITY VIOLATION: Candidate B was able to start Exam A!")
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        assert status_code == 403, f"Expected 403 Forbidden, got {status_code}: {exc}"
        print(f"[PASS] Candidate B blocked from Exam A: 403 Forbidden ({exc.detail if hasattr(exc, 'detail') else exc})")

    # Test 3: Candidate A starts their OWN Exam A -> MUST succeed
    attempt_a_data = CandidateExamService.start_or_resume_attempt(
        db,
        candidate_id=cand_a.id,
        exam_id=exam_a.id
    )
    assert attempt_a_data.exam_id == exam_a.id
    assert attempt_a_data.exam_title == exam_a.title
    # Check question text strictly belongs to Exam A
    for q in attempt_a_data.questions:
        assert "[Exam A" in q.question_text, f"Leaked non-Exam A question to Candidate A: {q.question_text}"
    print("[PASS] Candidate A received only Exam A questions.")

    # Test 4: Candidate B starts their OWN Exam B -> MUST succeed
    attempt_b_data = CandidateExamService.start_or_resume_attempt(
        db,
        candidate_id=cand_b.id,
        exam_id=exam_b.id
    )
    assert attempt_b_data.exam_id == exam_b.id
    assert attempt_b_data.exam_title == exam_b.title
    for q in attempt_b_data.questions:
        assert "[Exam B" in q.question_text, f"Leaked non-Exam B question to Candidate B: {q.question_text}"
    print("[PASS] Candidate B received only Exam B questions.")

    # Clean the two test attempts
    att_ids = [attempt_a_data.attempt_id, attempt_b_data.attempt_id]
    db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(att_ids)).delete(synchronize_session=False)
    db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id.in_(att_ids)).delete(synchronize_session=False)
    db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id.in_(att_ids)).delete(synchronize_session=False)
    db.query(ExamAttempt).filter(ExamAttempt.id.in_(att_ids)).delete(synchronize_session=False)
    db.commit()


async def simulate_candidate_run(
    transport: httpx.ASGITransport,
    cand_dict: Dict[str, Any],
    exam_id: int,
    sem: asyncio.Semaphore,
    collector: Dict[str, Any]
):
    """
    Executes an entire candidate workflow concurrently:
    1. Verify
    2. Start Attempt
    3. Save Answers
    4. Submit Attempt
    """
    cand_id = cand_dict["id"]
    email = cand_dict["email"]
    reg_no = cand_dict["reg_no"]
    full_name = cand_dict["name"]
    dept_name = cand_dict.get("dept_name", "")

    stats = {
        "candidate_id": cand_id,
        "exam_id": exam_id,
        "verified": False,
        "started": False,
        "attempt_id": None,
        "answers_saved": 0,
        "submitted": False,
        "error": None
    }

    try:
        # Separate client per candidate session to isolate cookies and JWT tokens (just like separate candidate browsers)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver", timeout=60.0) as client:
            # Step 1: Verification
            async with sem:
                t0 = time.time()
                v_res = await client.post(
                    "/api/candidate/verify",
                    json={
                        "email": email,
                        "registrationNumber": reg_no,
                        "fullName": full_name,
                        "departmentName": dept_name
                    }
                )
                collector["verify_latencies"].append(time.time() - t0)

            if v_res.status_code != 200:
                stats["error"] = f"Verify error: {v_res.text}"
                return stats

            v_data = v_res.json()
            if not v_data.get("eligible"):
                stats["error"] = f"Ineligible: {v_data.get('message')}"
                return stats

            stats["verified"] = True
            token = v_data.get("token")
            auth_headers = {"Authorization": f"Bearer {token}"} if token else {}

            assigned_exam_id = v_data.get("assignedExamId") or v_data.get("examId")
            if assigned_exam_id != exam_id:
                stats["error"] = f"Assigned exam mismatch: expected {exam_id}, got {assigned_exam_id}"
                return stats

            # Step 2: Start Attempt
            async with sem:
                t0 = time.time()
                s_res = await client.post(
                    "/api/candidate/start",
                    json={
                        "candidateId": cand_id,
                        "examId": exam_id
                    },
                    headers=auth_headers
                )
                collector["start_latencies"].append(time.time() - t0)

            if s_res.status_code != 200:
                stats["error"] = f"Start attempt error: {s_res.text}"
                return stats

            s_data = s_res.json()
            attempt_id = s_data.get("attemptId")
            stats["started"] = True
            stats["attempt_id"] = attempt_id

            # Verify all received questions belong ONLY to this exam
            questions = s_data.get("questions") or []
            for q in questions:
                tag = "[Exam A" if exam_id == collector["exam_a_id"] else "[Exam B"
                if tag not in q.get("questionText", ""):
                    stats["error"] = f"CROSS-EXAM QUESTION LEAK: Candidate in Exam {exam_id} got question: {q.get('questionText')}"
                    return stats

            # Step 3: Concurrently record answers
            answers_payload = {}
            for q in questions[:3]:
                qid = q.get("id") or q.get("questionId")
                options = q.get("options") or []
                if options:
                    answers_payload[str(qid)] = options[0].get("id") or options[0].get("optionId")

            if answers_payload:
                async with sem:
                    t0 = time.time()
                    ans_res = await client.post(
                        "/api/candidate/save-answers",
                        json={
                            "attemptId": attempt_id,
                            "candidateId": cand_id,
                            "answers": answers_payload
                        },
                        headers=auth_headers
                    )
                    collector["save_latencies"].append(time.time() - t0)
                    if ans_res.status_code == 200:
                        stats["answers_saved"] = len(answers_payload)

            # Step 4: Submit Attempt
            async with sem:
                t0 = time.time()
                sub_res = await client.post(
                    "/api/candidate/submit",
                    json={
                        "attemptId": attempt_id,
                        "candidateId": cand_id,
                        "submissionType": "MANUAL"
                    },
                    headers=auth_headers
                )
                collector["submit_latencies"].append(time.time() - t0)

            if sub_res.status_code != 200:
                stats["error"] = f"Submit error: {sub_res.text}"
                return stats

            sub_data = sub_res.json()
            if not sub_data.get("success"):
                stats["error"] = f"Submit failed: {sub_data.get('message')}"
                return stats

            stats["submitted"] = True
            return stats

    except Exception as exc:
        stats["error"] = str(exc)
        return stats

    except Exception as exc:
        stats["error"] = str(exc)
        return stats


async def run_1000_candidates_simulation(exam_a_id: int, exam_b_id: int, cands_a, cands_b):
    """
    Runs concurrent simulation of 1,000 candidates:
    - 500 candidates simultaneously taking Exam A
    - 500 candidates simultaneously taking Exam B
    """
    print(f"\n[LOAD TEST] Starting 1,000 Concurrent Candidates Simulation...")
    print(f"  - Exam A (ID: {exam_a_id}): {len(cands_a)} candidates")
    print(f"  - Exam B (ID: {exam_b_id}): {len(cands_b)} candidates")
    print(f"  - Max active in-flight semaphore: {CONCURRENCY_SEMAPHORE}")

    collector = {
        "exam_a_id": exam_a_id,
        "exam_b_id": exam_b_id,
        "verify_latencies": [],
        "start_latencies": [],
        "save_latencies": [],
        "submit_latencies": []
    }

    sem = asyncio.Semaphore(CONCURRENCY_SEMAPHORE)
    transport = httpx.ASGITransport(app=app)
    tasks = []
    
    # Interleave candidates from Exam A and Exam B to simulate true simultaneous traffic
    for i in range(max(len(cands_a), len(cands_b))):
        if i < len(cands_a):
            ca = cands_a[i]
            cand_info_a = {"id": ca.id, "email": ca.email, "reg_no": ca.registration_number, "name": ca.full_name, "dept_name": ca.department.name if ca.department else ""}
            tasks.append(simulate_candidate_run(transport, cand_info_a, exam_a_id, sem, collector))
        if i < len(cands_b):
            cb = cands_b[i]
            cand_info_b = {"id": cb.id, "email": cb.email, "reg_no": cb.registration_number, "name": cb.full_name, "dept_name": cb.department.name if cb.department else ""}
            tasks.append(simulate_candidate_run(transport, cand_info_b, exam_b_id, sem, collector))

    print(f"[LOAD TEST] Dispatched {len(tasks)} concurrent candidate sessions. Awaiting completion...")
    t_start = time.time()
    results = await asyncio.gather(*tasks, return_exceptions=False)
    total_duration = time.time() - t_start

    # Evaluate results
    verified_count = sum(1 for r in results if r.get("verified"))
    started_count = sum(1 for r in results if r.get("started"))
    submitted_count = sum(1 for r in results if r.get("submitted"))
    errors = [r for r in results if r.get("error")]

    exam_a_subs = sum(1 for r in results if r.get("exam_id") == exam_a_id and r.get("submitted"))
    exam_b_subs = sum(1 for r in results if r.get("exam_id") == exam_b_id and r.get("submitted"))

    print("\n" + "="*70)
    print("CONCURRENCY & MULTI-EXAM SIMULATION REPORT (1,000 CANDIDATES)")
    print("="*70)
    print(f"Total Candidate Sessions: {len(results)}")
    print(f"Total Duration:           {total_duration:.2f} seconds")
    print(f"Throughput:               {len(results) / total_duration:.1f} candidate completions/sec")
    print(f"Verified Candidates:      {verified_count} / {len(results)} ({verified_count/len(results)*100:.1f}%)")
    print(f"Started Attempts:         {started_count} / {len(results)} ({started_count/len(results)*100:.1f}%)")
    print(f"Completed Submissions:    {submitted_count} / {len(results)} ({submitted_count/len(results)*100:.1f}%)")
    print(f"  - Exam A Submissions:   {exam_a_subs} / {len(cands_a)}")
    print(f"  - Exam B Submissions:   {exam_b_subs} / {len(cands_b)}")
    print(f"Total Errors / Failures:  {len(errors)}")

    if collector["submit_latencies"]:
        avg_sub = sum(collector["submit_latencies"]) / len(collector["submit_latencies"]) * 1000
        print(f"Avg Submit Latency:       {avg_sub:.1f} ms")

    if errors:
        print("\nSample Errors:")
        for e in errors[:5]:
            print(f"  Candidate {e['candidate_id']}: {e['error']}")

    assert len(errors) == 0, f"Expected 0 errors during concurrent load, got {len(errors)}"
    assert submitted_count == len(results), f"Expected all {len(results)} to submit, got {submitted_count}"
    assert exam_a_subs == len(cands_a), f"Expected {len(cands_a)} submissions for Exam A, got {exam_a_subs}"
    assert exam_b_subs == len(cands_b), f"Expected {len(cands_b)} submissions for Exam B, got {exam_b_subs}"
    print("[PASS] 1,000 Candidates Concurrent Simulation completed with 100% SUCCESS and 0% ERROR RATE!")


def verify_results_segregation(db, exam_a_id: int, exam_b_id: int):
    """
    Verifies that Results & Analytics are strictly segregated by examination:
    - Results for Exam A have exactly 500 completed attempts belonging to Exam A.
    - Results for Exam B have exactly 500 completed attempts belonging to Exam B.
    - Zero data bleed between exams.
    """
    print("\n[RESULTS AUDIT] Verifying Results segregation and analytics...")
    
    # Check attempts for Exam A
    attempts_a = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_a_id).all()
    assert len(attempts_a) == TOTAL_CANDIDATES_PER_EXAM, f"Expected {TOTAL_CANDIDATES_PER_EXAM} attempts for Exam A, got {len(attempts_a)}"
    for att in attempts_a:
        assert att.exam_id == exam_a_id
        assert att.candidate.assigned_exam_id == exam_a_id
        assert att.status in ("COMPLETED", "SUBMITTED")

    # Check attempts for Exam B
    attempts_b = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_b_id).all()
    assert len(attempts_b) == TOTAL_CANDIDATES_PER_EXAM, f"Expected {TOTAL_CANDIDATES_PER_EXAM} attempts for Exam B, got {len(attempts_b)}"
    for att in attempts_b:
        assert att.exam_id == exam_b_id
        assert att.candidate.assigned_exam_id == exam_b_id
        assert att.status in ("COMPLETED", "SUBMITTED")

    # Dashboard service check for Exam A
    results_a = DashboardService.get_exam_results(db, exam_id=exam_a_id)
    assert len(results_a) == TOTAL_CANDIDATES_PER_EXAM, f"Dashboard returned {len(results_a)} results for Exam A, expected {TOTAL_CANDIDATES_PER_EXAM}"
    for r in results_a:
        assert r.exam_id == exam_a_id
        assert r.exam_title == "SE Placement Exam 2026"

    # Dashboard service check for Exam B
    results_b = DashboardService.get_exam_results(db, exam_id=exam_b_id)
    assert len(results_b) == TOTAL_CANDIDATES_PER_EXAM, f"Dashboard returned {len(results_b)} results for Exam B, expected {TOTAL_CANDIDATES_PER_EXAM}"
    for r in results_b:
        assert r.exam_id == exam_b_id
        assert r.exam_title == "DS Placement Exam 2026"

    print(f"[PASS] Results strictly segregated: Exam A has {len(results_a)} verified results; Exam B has {len(results_b)} verified results.")


def verify_auto_submission_expired_multi_exam(db, exam_a, exam_b):
    """
    Verifies that auto-submission handles expired attempts correctly
    when multiple exams are running simultaneously.
    """
    print("\n[AUTO-SUBMIT AUDIT] Testing auto-submission of expired attempts in multi-exam mode...")

    # Clean old test candidate if exists
    old_c = db.query(Candidate).filter(Candidate.registration_number == "EXP_A_001").first()
    if old_c:
        att_ids = [a.id for a in db.query(ExamAttempt).filter(ExamAttempt.candidate_id == old_c.id).all()]
        if att_ids:
            db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(att_ids)).delete(synchronize_session=False)
            db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id.in_(att_ids)).delete(synchronize_session=False)
            db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id.in_(att_ids)).delete(synchronize_session=False)
            db.query(ExamAttempt).filter(ExamAttempt.id.in_(att_ids)).delete(synchronize_session=False)
        db.delete(old_c)
        db.commit()

    # Create candidate for Exam A with expired start time
    cand_exp_a = Candidate(
        registration_number="EXP_A_001",
        full_name="Expired Student A",
        email="expired_a@test.local",
        assigned_exam_id=exam_a.id,
        assigned_set="A",
        status="GOING ON"
    )
    db.add(cand_exp_a)
    db.commit()
    db.refresh(cand_exp_a)

    qs_a = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_a.id).first()

    # Attempt started 120 minutes ago (exam is 60 mins -> expired)
    past_start = datetime.now(timezone.utc) - timedelta(minutes=120)
    past_deadline = past_start + timedelta(minutes=60)

    attempt_exp = ExamAttempt(
        candidate_id=cand_exp_a.id,
        exam_id=exam_a.id,
        question_set_id=qs_a.id,
        started_at=past_start,
        expires_at=past_deadline,
        status="IN_PROGRESS"
    )
    db.add(attempt_exp)
    db.commit()
    db.refresh(attempt_exp)

    # Process auto-submission
    sub_res = CandidateExamService.submit_attempt(
        db,
        attempt_id=attempt_exp.id,
        candidate_id=cand_exp_a.id
    )

    db.refresh(attempt_exp)
    assert attempt_exp.status in ("COMPLETED", "SUBMITTED")
    assert sub_res.success is True

    print(f"[PASS] Expired attempt auto-submitted successfully under multi-exam mode: Receipt={sub_res.receipt_id}")

    # Cleanup
    db.query(ExamAttempt).filter(ExamAttempt.id == attempt_exp.id).delete()
    db.query(Candidate).filter(Candidate.id == cand_exp_a.id).delete()
    db.commit()


def main():
    db = SessionLocal()
    try:
        exam_a, exam_b, dept_se, dept_ds = setup_multi_exams(db)
        cands_a, cands_b = setup_1000_candidates(db, exam_a, exam_b, dept_se, dept_ds)
        verify_security_isolation_cross_access(db, exam_a, exam_b, cands_a, cands_b)
        verify_auto_submission_expired_multi_exam(db, exam_a, exam_b)

        # Run 1,000 candidates concurrent simulation
        asyncio.run(run_1000_candidates_simulation(exam_a.id, exam_b.id, cands_a, cands_b))

        # Results verification
        verify_results_segregation(db, exam_a.id, exam_b.id)

        print("\n" + "="*70)
        print("ALL MULTI-EXAM CONCURRENCY & ISOLATION TESTS PASSED PERFECTLY!")
        print("="*70 + "\n")
    finally:
        db.close()


def test_multi_exam_concurrency_and_isolation():
    """Pytest wrapper to run the full multi-exam concurrency and isolation test."""
    main()


if __name__ == "__main__":
    main()
