import time
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import (
    Candidate, Exam, ExamAttempt, AttemptAnswer, Question, QuestionOption, AppUser
)

def test_full_database_persistence_flow():
    client = TestClient(app)
    db = SessionLocal()

    print("\n--- 1. Testing System & Database Health Check ---")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    print("Health Status:", health_data.get("status"), "Database:", health_data.get("database"))
    assert health_data.get("status") in ("UP", "HEALTHY", "DEGRADED"), f"Unexpected health status: {health_data}"

    print("\n--- 2. Testing Candidate Verification & Exam Matching ---")
    dynamic_cand_reg = f"CAND-PERSIST-{int(time.time() * 1000)}"
    cand = Candidate(
        registration_number=dynamic_cand_reg,
        full_name="Persist Test Candidate",
        email=f"{dynamic_cand_reg.lower()}@campus.edu",
        department_id=1,
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    verify_payload = {
        "fullName": cand.full_name,
        "email": cand.email,
        "department": "Developer",
        "departmentId": 1
    }
    res = client.post("/api/candidate/verify", json=verify_payload)
    assert res.status_code == 200, f"Verification failed: {res.text}"
    verify_data = res.json()
    print("Candidate Verified:", verify_data.get("fullName"), "Assigned Exam:", verify_data.get("examTitle"))
    assert verify_data.get("eligible") is True
    cand_id = verify_data.get("candidateId")
    exam_id = verify_data.get("assignedExamId") or verify_data.get("examId")
    assert cand_id is not None
    assert exam_id is not None

    print("\n--- 3. Testing Start/Resume Attempt ---")
    start_payload = {
        "candidateId": cand_id,
        "examId": exam_id
    }
    res = client.post("/api/candidate/start", json=start_payload)
    assert res.status_code == 200, f"Start attempt failed: {res.text}"
    attempt_data = res.json()
    attempt_id = attempt_data.get("attemptId")
    questions = attempt_data.get("questions")
    print(f"Attempt started successfully! Attempt ID={attempt_id}, Questions count={len(questions)}")
    assert attempt_id is not None
    assert len(questions) > 0, "No questions returned for attempt"

    print("\n--- 4. Testing Answer Saving to Database (Question 5 Option C) ---")
    # Find Question 5 in returned questions
    q5 = questions[4] if len(questions) >= 5 else questions[0]
    q5_id = q5.get("id") or q5.get("questionId")
    # Select Option C (index 2)
    opt_c = q5["options"][2] if len(q5["options"]) > 2 else q5["options"][0]
    opt_c_id = opt_c.get("id") or opt_c.get("optionId")

    safe_opt_text = opt_c.get("optionText", "").encode("ascii", "replace").decode()
    print(f"Saving answer for Question {q5.get('displayIndex')}: Question ID={q5_id}, Selected Option ID={opt_c_id} ('{safe_opt_text}')")
    ans_res = client.post(
        f"/api/candidate/answers?attemptId={attempt_id}",
        json={"questionId": q5_id, "selectedOptionId": opt_c_id, "candidateId": cand_id}
    )
    assert ans_res.status_code == 200, f"Answer save failed: {ans_res.text}"
    ans_data = ans_res.json()
    print("Answer API response:", ans_data)
    assert ans_data.get("success") is True

    # Direct database check
    saved_db_ans = db.query(AttemptAnswer).filter(
        AttemptAnswer.attempt_id == attempt_id,
        AttemptAnswer.question_id == q5_id
    ).first()
    assert saved_db_ans is not None, "AttemptAnswer row was NOT found in database!"
    assert saved_db_ans.selected_option_id == opt_c_id, f"Stored option ID mismatch: expected {opt_c_id}, got {saved_db_ans.selected_option_id}"
    print(f"Verified AttemptAnswer row persisted in DB! ID={saved_db_ans.id}, Attempt={saved_db_ans.attempt_id}, Question={saved_db_ans.question_id}, Option={saved_db_ans.selected_option_id}")

    print("\n--- 5. Testing Candidate Exam Submission & Scoring ---")
    sub_res = client.post(f"/api/candidate/submit?attemptId={attempt_id}", json={"candidateId": cand_id})
    assert sub_res.status_code == 200, f"Submit attempt failed: {sub_res.text}"
    sub_data = sub_res.json()
    print("Submit API response:")
    print(f"  Success: {sub_data.get('success')}")
    print(f"  Receipt ID: {sub_data.get('receiptId')}")
    print(f"  Score: {sub_data.get('score')}")
    print(f"  Percentage: {sub_data.get('percentage')}%")
    print(f"  Qualification Status: {sub_data.get('qualificationStatus')}")
    assert sub_data.get("success") is True
    assert sub_data.get("receiptId") != ""

    # Direct database check for submitted status and receipt
    db_attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    assert db_attempt is not None
    assert db_attempt.status == "SUBMITTED"
    assert db_attempt.receipt_id == sub_data.get("receiptId")
    assert db_attempt.score is not None
    assert db_attempt.percentage is not None
    print(f"Verified ExamAttempt table updated! Status={db_attempt.status}, Receipt={db_attempt.receipt_id}, Score={db_attempt.score}, Percentage={db_attempt.percentage}%")

    print("\n--- 6. Testing Admin Portal Reading Candidate Results ---")
    # Login as admin to get auth token
    admin_login_res = client.post(
        "/api/auth/login",
        json={"email": "d.koushik@kalpanaaasoftwaresolutions.in", "password": "Admin@ExamSecure2026!"}
    )
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
    token = admin_login_res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch results from admin endpoint
    results_res = client.get("/api/admin/results", headers=headers)
    assert results_res.status_code == 200, f"Admin results failed: {results_res.text}"
    all_results = results_res.json()
    print(f"Admin results returned: {len(all_results)} attempts recorded in system.")
    
    # Check if dynamic candidate's attempt is in admin results
    cand_result = next((r for r in all_results if r.get("registrationNumber") == dynamic_cand_reg), None)
    assert cand_result is not None, f"Candidate {dynamic_cand_reg} result not found in Admin results endpoint!"
    print(f"Found {dynamic_cand_reg} in Admin Results! Attempt ID={cand_result.get('attemptId')}, Score={cand_result.get('score')}, Status={cand_result.get('qualificationStatus')}, Receipt={cand_result.get('receiptId')}")

    db.close()
    print("\n>>> ALL BACKEND DATABASE PERSISTENCE CHECKS PASSED 100%! <<<")

if __name__ == "__main__":
    test_full_database_persistence_flow()
