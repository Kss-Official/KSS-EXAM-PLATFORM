import pytest
from sqlalchemy.orm import Session

from app.models import Candidate, CandidateAccessCode
from app.models.coding import CodingExam, CodingQuestion, CodingTestCase
from app.schemas.coding import CodingExamDto, CodingQuestionDto, TestCaseDto, CodeRunRequest, CodeSubmitRequest
from app.admin.services.coding_exam_service import CodingExamService
from app.admin.services.candidate_service import CandidateService
from app.candidate.services.code_runner_service import CodeRunnerService
from app.admin.services.batch_email_service import BatchEmailService
from app.core.database import SessionLocal

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_coding_exam_crud_and_publishing(db: Session):
    """Verifies complete lifecycle of Round 2 Coding Assessments."""
    tc1 = TestCaseDto(
        id="tc-test-1",
        label="Public Sample Case",
        input="5\n1 2 3 4 5",
        expectedOutput="15",
        isHidden=False,
        marks=10.0,
        explanation="Sum of first 5 natural numbers"
    )
    tc2 = TestCaseDto(
        id="tc-test-2",
        label="Hidden Evaluation Case",
        input="3\n10 20 30",
        expectedOutput="60",
        isHidden=True,
        marks=10.0,
        explanation="Hidden boundary evaluation"
    )

    q1 = CodingQuestionDto(
        id="q-test-sum",
        title="Array Element Accumulation",
        problemStatement="Read N and N integers, print their sum.",
        difficulty="Easy",
        maxMarks=20,
        inputFormat="First line N, second line space-separated integers",
        outputFormat="Single integer sum",
        allowedLanguages=["python3", "javascript", "cpp"],
        testCases=[tc1, tc2]
    )

    exam_dto = CodingExamDto(
        title="Technical Campus Coding Round 2026",
        description="Comprehensive technical problem-solving assessment",
        instructions="Complete the algorithm within the allocated time.",
        durationMinutes=90,
        timingMode="DURATION_FROM_START",
        selectedDepartments=["Developer", "Computer Science & Engineering"],
        allowedLanguages=["python3", "javascript"],
        evaluationMode="PARTIAL_PER_TESTCASE",
        qualificationPercentage=60.0,
        totalMarks=20.0,
        status="DRAFT",
        questions=[q1]
    )

    # 1. Create
    created = CodingExamService.create_coding_exam(db, exam_dto, "SUPER_ADMIN")
    assert created.id is not None
    assert created.title == "Technical Campus Coding Round 2026"
    assert len(created.questions) == 1
    assert len(created.questions[0].testCases) == 2
    assert created.status == "DRAFT"

    # 2. List
    all_exams = CodingExamService.get_all_coding_exams(db)
    assert any(e.id == created.id for e in all_exams)

    # 3. Retrieve by ID
    fetched = CodingExamService.get_coding_exam_by_id(db, created.id)
    assert fetched.id == created.id
    assert fetched.questions[0].title == "Array Element Accumulation"

    # 4. Update
    created.title = "Technical Campus Coding Round 2026 (Updated)"
    updated = CodingExamService.update_coding_exam(db, created.id, created, "SUPER_ADMIN")
    assert updated.title == "Technical Campus Coding Round 2026 (Updated)"

    # 5. Publish
    published = CodingExamService.publish_coding_exam(db, created.id, "SUPER_ADMIN")
    assert published.status == "PUBLISHED"

def test_code_runner_sandbox_and_grading(db: Session):
    """Tests sandboxed Python execution and automated test case evaluation."""
    # 1. Direct Code Run
    py_code = (
        "import sys\n"
        "data = sys.stdin.read().split()\n"
        "if data:\n"
        "    n = int(data[0])\n"
        "    nums = [int(x) for x in data[1:]]\n"
        "    print(sum(nums))\n"
    )
    run_req = CodeRunRequest(
        language="python3",
        code=py_code,
        input="4\n10 20 30 40\n"
    )
    run_res = CodeRunnerService.run_candidate_code(run_req)
    assert run_res.status == "SUCCESS"
    assert run_res.output.strip() == "100"
    assert run_res.executionTimeMs >= 0

    # 2. Setup candidate and exam for evaluation
    cand = db.query(Candidate).filter(Candidate.registration_number == "CODE-TEST-CAND-01").first()
    if not cand:
        cand = Candidate(
            registration_number="CODE-TEST-CAND-01",
            full_name="Algorithm Candidate",
            email="algocand@secureexam.local",
            status="ACTIVE"
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)

    exam = CodingExamService.get_all_coding_exams(db)[0]
    q = exam.questions[0]

    # Evaluate correct submission
    sub_req = CodeSubmitRequest(
        examId=exam.id,
        questionId=q.id,
        candidateId=cand.id,
        language="python3",
        code=py_code
    )
    eval_res = CodeRunnerService.evaluate_and_submit_code(db, sub_req)
    assert eval_res.success is True
    assert eval_res.status == "PASSED"
    assert eval_res.passedCount == 2
    assert eval_res.totalCount == 2
    assert eval_res.score == 20.0

def test_round_specific_unique_ids_and_batch_email(db: Session):
    """Verifies Round 1 vs Round 2 unique ID generation, 3-use limits, and batch email service."""
    # 1. Register test candidates
    for i in range(1, 4):
        reg = f"BATCH-REG-00{i}"
        if not db.query(Candidate).filter(Candidate.registration_number == reg).first():
            db.add(Candidate(
                registration_number=reg,
                full_name=f"Batch Student {i}",
                email=f"batch_student_{i}@campus.edu",
                status="ACTIVE"
            ))
    db.commit()

    # 2. Batch generate Round 1 IDs
    r1_res = CandidateService.batch_generate_round_ids(db, round_name="ROUND_1", performed_by="ADMIN")
    assert r1_res["success"] is True
    assert r1_res["round"] == "ROUND_1"
    assert "BATCH-REG-001" in r1_res["roundIds"]
    assert r1_res["roundIds"]["BATCH-REG-001"].startswith("MCQ-")

    # 3. Batch generate Round 2 IDs
    r2_res = CandidateService.batch_generate_round_ids(db, round_name="ROUND_2", performed_by="ADMIN")
    assert r2_res["success"] is True
    assert r2_res["round"] == "ROUND_2"
    assert "BATCH-REG-001" in r2_res["roundIds"]
    assert r2_res["roundIds"]["BATCH-REG-001"].startswith("CODE-")

    # 4. Verify 3-use limit strictly configured on all generated codes
    code_record = db.query(CandidateAccessCode).filter(
        CandidateAccessCode.code == r1_res["roundIds"]["BATCH-REG-001"]
    ).first()
    assert code_record is not None
    assert code_record.max_uses == 3
    assert code_record.usage_count == 0
    assert code_record.round == "ROUND_1"

    # 5. Check mapping lookup
    map_lookup = CandidateService.get_round_ids_map(db, round_name="ROUND_1")
    assert "BATCH-REG-001" in map_lookup

    # 6. Test Batch Email Service Initiation
    c1 = db.query(Candidate).filter(Candidate.registration_number == "BATCH-REG-001").first()
    dispatch_res = BatchEmailService.start_batch_dispatch(
        round_name="ROUND_1",
        candidate_ids=[c1.id],
        exam_title="Batch Integration Exam",
        provider="mock_logger",
        delay_seconds=0.0,
        performed_by="TEST_ADMIN"
    )
    assert dispatch_res["success"] is True
    assert "jobId" in dispatch_res

    # Check status
    status_res = BatchEmailService.get_job_status(dispatch_res["jobId"])
    assert status_res is not None
    assert status_res["round"] == "ROUND_1"
