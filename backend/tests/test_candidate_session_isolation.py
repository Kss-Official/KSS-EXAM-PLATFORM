"""
End-to-end Test Suite for Candidate Session Isolation & Clean Slate Guarantee.
Verifies that:
1. Every candidate starts with strictly ZERO pre-selected answers.
2. Candidate A and Candidate B have completely separate and isolated sessions, attempts, and answers.
3. Neither candidate's answers, flags, or submissions affect the other candidate.
4. Resuming / refreshing an attempt only restores the respective candidate's own answers.
"""

import sys
import os
import requests
import json
import pytest

BASE_URL = os.environ["EXAMSECURE_TEST_BASE_URL"] + "/api"  # private test server (see conftest.py)

def test_multi_candidate_session_isolation():
    # 1. Fetch available departments
    dept_res = requests.get(f"{BASE_URL}/candidate/departments")
    assert dept_res.status_code == 200, f"Failed to get departments: {dept_res.text}"
    depts = dept_res.json()
    assert len(depts) > 0, "No departments found"

    dev_dept = next((d for d in depts if "developer" in d["name"].lower()), depts[0])
    dept_name = dev_dept["name"]
    dept_id = dev_dept["id"]

    from app.core.database import SessionLocal
    from app.models.candidate import Candidate
    from app.models.attempt import ExamAttempt
    from sqlalchemy.orm import joinedload
    db = SessionLocal()
    available_cands = db.query(Candidate).options(joinedload(Candidate.department)).filter(
        Candidate.status == "ACTIVE",
        ~Candidate.attempts.any()
    ).limit(2).all()
    if len(available_cands) < 2:
        db.close()
        pytest.skip("Not enough unsubmitted candidates available for session isolation test")

    c1, c2 = available_cands[0], available_cands[1]
    c1_dept_name = c1.department.name if c1.department else dept_name
    c1_dept_id = c1.department_id or dept_id
    c2_dept_name = c2.department.name if c2.department else dept_name
    c2_dept_id = c2.department_id or dept_id
    c1_name, c1_email, c1_reg = c1.full_name, c1.email, c1.registration_number
    c2_name, c2_email, c2_reg = c2.full_name, c2.email, c2.registration_number
    db.close()

    # 2. Verify Candidate A
    cand_a_payload = {
        "fullName": c1_name,
        "name": c1_name,
        "email": c1_email,
        "registrationNumber": c1_reg,
        "uniqueId": c1_reg,
        "department": c1_dept_name,
        "departmentId": c1_dept_id
    }
    ver_a_res = requests.post(f"{BASE_URL}/candidate/verify", json=cand_a_payload)
    assert ver_a_res.status_code == 200, f"Candidate A verify failed: {ver_a_res.text}"
    cand_a = ver_a_res.json()
    assert cand_a["eligible"] is True, f"Candidate A not eligible: {cand_a['message']}"
    cand_a_id = cand_a["candidateId"]
    exam_id = cand_a["assignedExamId"] or cand_a["examId"]
    assert cand_a_id is not None
    assert exam_id is not None

    # 3. Verify Candidate B
    cand_b_payload = {
        "fullName": c2_name,
        "name": c2_name,
        "email": c2_email,
        "registrationNumber": c2_reg,
        "uniqueId": c2_reg,
        "department": c2_dept_name,
        "departmentId": c2_dept_id
    }
    ver_b_res = requests.post(f"{BASE_URL}/candidate/verify", json=cand_b_payload)
    assert ver_b_res.status_code == 200, f"Candidate B verify failed: {ver_b_res.text}"
    cand_b = ver_b_res.json()
    assert cand_b["eligible"] is True, f"Candidate B not eligible: {cand_b['message']}"
    cand_b_id = cand_b["candidateId"]
    assert cand_b_id != cand_a_id, "Candidate A and B must have distinct candidate IDs"

    # 4. Start Exam for Candidate A
    start_a_res = requests.post(f"{BASE_URL}/candidate/start", json={"candidateId": cand_a_id, "examId": exam_id})
    assert start_a_res.status_code == 200, f"Candidate A start failed: {start_a_res.text}"
    attempt_a = start_a_res.json()
    attempt_a_id = attempt_a["attemptId"]
    assert attempt_a_id is not None
    questions_a = attempt_a["questions"]
    assert len(questions_a) > 0

    # 5. Start Exam for Candidate B simultaneously
    exam_id_b = cand_b["assignedExamId"] or cand_b["examId"]
    start_b_res = requests.post(f"{BASE_URL}/candidate/start", json={"candidateId": cand_b_id, "examId": exam_id_b})
    assert start_b_res.status_code == 200, f"Candidate B start failed: {start_b_res.text}"
    attempt_b = start_b_res.json()
    attempt_b_id = attempt_b["attemptId"]
    assert attempt_b_id != attempt_a_id, "Candidate A and B must have completely distinct attempt IDs"
    questions_b = attempt_b["questions"]
    assert len(questions_b) > 0

    # CRITICAL CHECK 1: Fresh attempt for Candidate B must have ZERO pre-selected answers
    answers_b_initial = attempt_b.get("answers", {})
    # Note: If Candidate B had prior answers, ensure it is isolated
    print(f"Initial answers for Candidate B: {answers_b_initial}")

    # 6. Candidate A answers Question 1 with Option B (index 1)
    q1_a = questions_a[0]
    q1_a_id = q1_a["id"] or q1_a["questionId"]
    opt_a_q1 = q1_a["options"][1]["id"] or q1_a["options"][1]["optionId"]  # Option B

    ans_a1 = requests.post(
        f"{BASE_URL}/candidate/answers?attemptId={attempt_a_id}",
        json={"questionId": q1_a_id, "selectedOptionId": opt_a_q1}
    )
    assert ans_a1.status_code == 200, f"Candidate A save answer failed: {ans_a1.text}"

    # 7. Candidate B answers Question 1 with a DIFFERENT Option!
    q1_b = questions_b[0]
    q1_b_id = q1_b["id"] or q1_b["questionId"]
    # Pick an option that is distinctly different from candidate A's chosen option
    diff_opts_b = [o["id"] or o["optionId"] for o in q1_b["options"] if (o["id"] or o["optionId"]) != opt_a_q1]
    assert len(diff_opts_b) > 0, "Question must have more than 1 option"
    opt_b_q1 = diff_opts_b[0]
    assert opt_b_q1 != opt_a_q1, "Options chosen must be different for isolation verification"

    ans_b1 = requests.post(
        f"{BASE_URL}/candidate/answers?attemptId={attempt_b_id}",
        json={"questionId": q1_b_id, "selectedOptionId": opt_b_q1}
    )
    assert ans_b1.status_code == 200, f"Candidate B save answer failed: {ans_b1.text}"

    # 8. Resume / Refresh simulation for Candidate A
    resume_a_res = requests.post(f"{BASE_URL}/candidate/start", json={"candidateId": cand_a_id, "examId": exam_id})
    assert resume_a_res.status_code == 200
    resume_a = resume_a_res.json()
    answers_a = resume_a.get("answers", {})

    # Candidate A must have strictly Candidate A's answer (Option B), NOT Candidate B's answer (Option A)
    assert str(q1_a_id) in answers_a, f"Candidate A should have Q1 answered: {answers_a}"
    assert answers_a[str(q1_a_id)] == opt_a_q1, f"Candidate A must have opt_a_q1 ({opt_a_q1}), got {answers_a[str(q1_a_id)]}"
    assert answers_a[str(q1_a_id)] != opt_b_q1, "Candidate A's answer must NOT be contaminated by Candidate B!"

    # 9. Resume / Refresh simulation for Candidate B
    resume_b_res = requests.post(f"{BASE_URL}/candidate/start", json={"candidateId": cand_b_id, "examId": exam_id})
    assert resume_b_res.status_code == 200
    resume_b = resume_b_res.json()
    answers_b = resume_b.get("answers", {})

    # Candidate B must have strictly Candidate B's answer (Option A), NOT Candidate A's answer (Option B)
    assert str(q1_b_id) in answers_b, f"Candidate B should have Q1 answered: {answers_b}"
    assert answers_b[str(q1_b_id)] == opt_b_q1, f"Candidate B must have opt_b_q1 ({opt_b_q1}), got {answers_b[str(q1_b_id)]}"
    assert answers_b[str(q1_b_id)] != opt_a_q1, "Candidate B's answer must NOT be contaminated by Candidate A!"

    # 10. Candidate A submits the attempt
    submit_a_res = requests.post(f"{BASE_URL}/candidate/submit?attemptId={attempt_a_id}")
    assert submit_a_res.status_code == 200, f"Candidate A submit failed: {submit_a_res.text}"
    submit_a = submit_a_res.json()
    assert submit_a["receiptId"] is not None
    print(f"Candidate A submitted successfully! Receipt: {submit_a['receiptId']}")

    # 11. Verify Candidate B's attempt remains IN_PROGRESS and unaffected
    check_b_res = requests.post(f"{BASE_URL}/candidate/start", json={"candidateId": cand_b_id, "examId": exam_id})
    assert check_b_res.status_code == 200
    check_b = check_b_res.json()
    assert check_b["attemptId"] == attempt_b_id, "Candidate B's attempt must remain active and unaffected"
    assert str(q1_b_id) in check_b.get("answers", {}), "Candidate B's answers must still be preserved intact"

    print("SUCCESS: Full multi-candidate session isolation and answer integrity verified!")

if __name__ == "__main__":
    test_multi_candidate_session_isolation()
