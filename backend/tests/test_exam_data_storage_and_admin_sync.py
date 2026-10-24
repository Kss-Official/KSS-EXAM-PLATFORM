import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import Department, Exam, QuestionSet, Candidate, ExamAttempt, AttemptAnswer
from app.core import get_db

client = TestClient(app)

def test_full_exam_flow_data_storage_and_admin_sync(db: Session):
    """
    End-to-end test verifying:
    1. Candidate verification (Full Name, Department, Email)
    2. Exam attempt start (storing attempt in PostgreSQL)
    3. Real-time answer saving (storing answers in PostgreSQL with idempotent upserts)
    4. Final submission (computing scores, persisting receipt, updating status)
    5. Admin panel retrieval (dashboard telemetry, results table matching exact DB records)
    6. Admin publication toggle (synchronizing is_published state)
    """
    uid = uuid.uuid4().hex[:6].upper()
    admin_email = "d.koushik@kalpanaaasoftwaresolutions.in"
    admin_password = "Admin@ExamSecure2026!"

    # 1. Setup Department & Exam in DB
    dept = Department(name=f"DataSync Dept {uid}", code=f"DS{uid[:4]}", active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    # Admin Login to get session cookie
    login_resp = client.post("/api/auth/login", json={
        "email": admin_email,
        "password": admin_password
    })
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"

    # Create Exam via Admin API
    exam_payload = {
        "title": f"Live Sync Exam {uid}",
        "description": "Verification of exam data storage and admin sync",
        "durationMinutes": 45,
        "totalQuestions": 2,
        "status": "DRAFT",
        "qualificationMode": "PERCENTAGE",
        "qualificationThreshold": 50.0,
        "timingMode": "DURATION_FROM_START",
        "totalMarks": 20.0,
        "marksPerQuestion": 10.0,
        "negativeMarks": 0.0,
        "departmentIds": [dept.id]
    }
    create_exam_resp = client.post("/api/admin/exams", json=exam_payload)
    assert create_exam_resp.status_code == 200, f"Create exam failed: {create_exam_resp.text}"
    exam_id = create_exam_resp.json()["id"]

    # Add Questions to Set A
    q_sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_id).all()
    set_a = next(s for s in q_sets if s.set_code == "A")

    q1_resp = client.post(f"/api/admin/sets/{set_a.id}/questions", json={
        "questionText": "What is 2 + 2 in computing?",
        "marks": 10.0,
        "negativeMarks": 0.0,
        "displayOrder": 1,
        "options": [
            {"optionText": "3", "correct": False, "displayOrder": 1},
            {"optionText": "4", "correct": True, "displayOrder": 2},
            {"optionText": "5", "correct": False, "displayOrder": 3}
        ]
    })
    assert q1_resp.status_code == 200

    q2_resp = client.post(f"/api/admin/sets/{set_a.id}/questions", json={
        "questionText": "Is PostgreSQL an ACID compliant relational database?",
        "marks": 10.0,
        "negativeMarks": 0.0,
        "displayOrder": 2,
        "options": [
            {"optionText": "Yes, fully ACID compliant", "correct": True, "displayOrder": 1},
            {"optionText": "No", "correct": False, "displayOrder": 2}
        ]
    })
    assert q2_resp.status_code == 200

    # Publish Exam
    pub_resp = client.post(f"/api/admin/exams/{exam_id}/publish")
    assert pub_resp.status_code == 200, f"Publish exam failed: {pub_resp.text}"

    # Register Candidate
    cand_reg = f"SYNC-{uid}"
    cand_email = f"sync_{uid.lower()}@campus.edu"
    cand_name = f"Data Sync Candidate {uid}"

    cand = Candidate(
        registration_number=cand_reg,
        full_name=cand_name,
        email=cand_email,
        department_id=dept.id,
        assigned_set="Set A",
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    # 2. Candidate Verification Flow
    verify_resp = client.post("/api/candidate/verify", json={
        "fullName": cand_name,
        "email": cand_email,
        "department": dept.name,
        "departmentId": dept.id
    })
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["eligible"] is True, f"Verify candidate failed: {v_data}"
    assert v_data["candidateId"] == cand.id

    # 3. Candidate Starts Attempt
    start_resp = client.post("/api/candidate/start", json={
        "candidateId": cand.id,
        "examId": exam_id
    })
    assert start_resp.status_code == 200
    start_data = start_resp.json()
    attempt_id = start_data["attemptId"]
    assert attempt_id is not None
    assert len(start_data["questions"]) == 2

    # Verify attempt exists in database with status IN_PROGRESS
    db_attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    assert db_attempt is not None
    assert db_attempt.status == "IN_PROGRESS"
    assert db_attempt.candidate_id == cand.id
    assert db_attempt.exam_id == exam_id

    # 4. Candidate Saves Answers
    # Answer Q1 correctly
    q1_data = next(q for q in start_data["questions"] if "2 + 2" in q["questionText"])
    correct_opt1 = next(o for o in q1_data["options"] if o["optionText"] == "4")

    save1_resp = client.post("/api/candidate/answers", json={
        "attemptId": attempt_id,
        "questionId": q1_data["id"],
        "selectedOptionId": correct_opt1["id"]
    })
    assert save1_resp.status_code == 200
    assert save1_resp.json()["success"] is True

    # Answer Q2 correctly
    q2_data = next(q for q in start_data["questions"] if "PostgreSQL" in q["questionText"])
    correct_opt2 = next(o for o in q2_data["options"] if "Yes" in o["optionText"])

    save2_resp = client.post("/api/candidate/answers", json={
        "attemptId": attempt_id,
        "questionId": q2_data["id"],
        "selectedOptionId": correct_opt2["id"]
    })
    assert save2_resp.status_code == 200

    # Verify answers are persisted in database
    db_answers = db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt_id).all()
    assert len(db_answers) == 2
    ans_map = {a.question_id: a.selected_option_id for a in db_answers}
    assert ans_map[q1_data["id"]] == correct_opt1["id"]
    assert ans_map[q2_data["id"]] == correct_opt2["id"]

    # 5. Candidate Submits Exam
    submit_resp = client.post("/api/candidate/submit", json={
        "attemptId": attempt_id,
        "reason": "manual_submit"
    })
    assert submit_resp.status_code == 200
    sub_data = submit_resp.json()
    assert sub_data["success"] is True
    receipt_id = sub_data["receiptId"]
    assert receipt_id.startswith("SEB-REC-")
    # Immediate candidate submission feedback confirms submission receipt; score is kept confidential until admin publishes
    assert sub_data["resultsPublished"] is False
    assert sub_data["isPublished"] is False

    # Verify database state after submission
    db.expire_all()
    final_db_attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    assert final_db_attempt.status == "SUBMITTED"
    assert final_db_attempt.receipt_id == receipt_id
    assert float(final_db_attempt.score) == 20.0
    assert float(final_db_attempt.total_marks) == 20.0
    assert float(final_db_attempt.percentage) == 100.0
    assert final_db_attempt.qualification_status == "QUALIFIED"
    assert final_db_attempt.submitted_at is not None

    # 6. Admin Panel Real-Time Retrieval Verification
    # A. Dashboard Telemetry Endpoint
    dash_resp = client.get("/api/admin/dashboard")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert dash_data["submittedAttempts"] >= 1
    assert dash_data["qualifiedCandidates"] >= 1

    # B. Results & Scoring Analytics Endpoint
    results_resp = client.get(f"/api/admin/results/exam/{exam_id}")
    assert results_resp.status_code == 200
    results_data = results_resp.json()
    assert len(results_data) == 1

    admin_record = results_data[0]
    assert admin_record["attemptId"] == attempt_id
    assert admin_record["candidateName"] == cand_name
    assert admin_record["candidateEmail"] == cand_email
    assert admin_record["registrationNumber"] == cand_reg
    assert admin_record["departmentName"] == dept.name
    assert admin_record["examTitle"] == f"Live Sync Exam {uid}"
    assert admin_record["setCode"] == "A"
    assert admin_record["attemptStatus"] == "SUBMITTED"
    assert admin_record["score"] == 20.0
    assert admin_record["totalMarks"] == 20.0
    assert admin_record["percentage"] == 100.0
    assert admin_record["qualificationStatus"] == "QUALIFIED"
    assert admin_record["receiptId"] == receipt_id
    assert admin_record["submittedAt"] is not None

    # 7. Admin Score Publication Toggle
    pub_res_resp = client.post(f"/api/admin/results/exam/{exam_id}/publish", json={"published": True})
    assert pub_res_resp.status_code == 200

    # Re-verify results endpoint returns resultsPublished = True
    refreshed_results = client.get(f"/api/admin/results/exam/{exam_id}").json()
    assert refreshed_results[0]["resultsPublished"] is True
    assert refreshed_results[0]["isPublished"] is True
