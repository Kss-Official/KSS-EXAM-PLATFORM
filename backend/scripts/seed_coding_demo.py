"""
Idempotent seed & cleanup script for Round 2 DEMO Coding Round.
All created entities carry a 'DEMO' prefix so they are never confused with real exams.

Usage:
    python scripts/seed_coding_demo.py
    python scripts/seed_coding_demo.py --remove
    python scripts/seed_coding_demo.py --force
"""
import argparse
import json
import os
import sys
from typing import Any, Dict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.attempt import ExamAttempt
from app.models.candidate import Candidate
from app.models.coding import (
    CodingAttempt,
    CodingDraft,
    CodingExam,
    CodingQuestion,
    CodingQuestionResult,
    CodingSubmission,
    CodingTestCase,
)
from app.models.department import Department
from app.models.exam import Exam
from app.models.question import QuestionSet

DEMO_EXAM_TITLE = "DEMO Coding Round"
DEMO_R1_TITLE = "DEMO Round 1 Qualifier"
DEMO_CAND_EMAIL = "demo.coder@example.local"
DEMO_CAND_NAME = "DEMO Coding Candidate"
DEMO_CAND_REG = "DEMO-R2-001"


def _guard_production(force: bool) -> None:
    is_prod = settings.ENVIRONMENT.lower() == "production"
    is_neon_non_debug = (not settings.DEBUG) and ("neon" in (settings.DATABASE_URL or "").lower())
    if (is_prod or is_neon_non_debug) and not force:
        raise RuntimeError(
            "Refusing to run demo seed against production/non-DEBUG Neon database. Pass --force to override."
        )


def _build_questions() -> list[Dict[str, Any]]:
    large_str = ("abcdefghijklmnopqrstuvwxyz" * 1200)[:30000]
    return [
        {
            "id": "demo_q1_sum",
            "title": "DEMO: Sum of Two Numbers",
            "difficulty": "Easy",
            "max_marks": 20,
            "time_limit_ms": 1000,
            "memory_limit_mb": 256,
            "problem_statement": "Given two integers A and B separated by whitespace on standard input, print their sum A + B.",
            "input_format": "Two space-separated integers A and B.",
            "output_format": "A single integer representing A + B.",
            "constraints": "-10^9 <= A, B <= 10^9",
            "sample_input": "3 5",
            "sample_output": "8",
            "starter": {
                "python3": "import sys\nparts = sys.stdin.read().split()\n# Write your solution\n",
                "javascript": "const fs = require('fs');\nconst parts = fs.readFileSync(0, 'utf8').trim().split(/\\s+/);\n",
                "cpp": "#include <iostream>\nusing namespace std;\nint main() {\n    long long a, b;\n    if (cin >> a >> b) cout << (a + b) << '\\n';\n    return 0;\n}\n",
                "java": "import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextLong()) System.out.println(sc.nextLong() + sc.nextLong());\n    }\n}\n",
            },
            "cases": [
                ("demo_q1_s1", "Sample 1", "3 5", "8", False, 2.0),
                ("demo_q1_s2", "Sample 2", "-4 10", "6", False, 2.0),
                ("demo_q1_h1", "Hidden 1 (zeros)", "0 0", "0", True, 4.0),
                ("demo_q1_h2", "Hidden 2 (negatives)", "-100 -250", "-350", True, 4.0),
                ("demo_q1_h3", "Hidden 3 (large)", "1000000000 1000000000", "2000000000", True, 4.0),
                ("demo_q1_h4", "Hidden 4 (newlines)", "42\n58", "100", True, 4.0),
            ],
        },
        {
            "id": "demo_q2_reverse_words",
            "title": "DEMO: Reverse Words in a Sentence",
            "difficulty": "Medium",
            "max_marks": 30,
            "time_limit_ms": 1000,
            "memory_limit_mb": 256,
            "problem_statement": "Given a line of text, reverse the order of words. Normalize multiple spaces into single spaces and trim leading/trailing spaces. For an empty or whitespace-only line, print an empty line.",
            "input_format": "A single line string S.",
            "output_format": "Words in reversed order separated by a single space.",
            "constraints": "0 <= |S| <= 10^5",
            "sample_input": "the sky is blue",
            "sample_output": "blue is sky the",
            "starter": {
                "python3": "import sys\nline = sys.stdin.read()\n# Write your solution\n",
                "javascript": "const fs = require('fs');\nconst s = fs.readFileSync(0, 'utf8');\n",
                "cpp": "#include <iostream>\n#include <sstream>\n#include <vector>\nusing namespace std;\nint main() { return 0; }\n",
                "java": "import java.util.*;\npublic class Main { public static void main(String[] args) {} }\n",
            },
            "cases": [
                ("demo_q2_s1", "Sample 1", "the sky is blue", "blue is sky the", False, 2.0),
                ("demo_q2_s2", "Sample 2", "hello world", "world hello", False, 2.0),
                ("demo_q2_h1", "Hidden 1 (extra spaces)", "  hello   world  ", "world hello", True, 5.0),
                ("demo_q2_h2", "Hidden 2 (empty line)", "", "", True, 5.0),
                ("demo_q2_h3", "Hidden 3 (single word)", "   ExamSecure   ", "ExamSecure", True, 5.0),
                ("demo_q2_h4", "Hidden 4 (tabs & spaces)", "a\t b   c", "c b a", True, 5.0),
                ("demo_q2_h5", "Hidden 5 (punctuation)", "one, two! three?", "three? two! one,", True, 6.0),
            ],
        },
        {
            "id": "demo_q3_longest_substr",
            "title": "DEMO: Longest Substring Without Repeating Characters",
            "difficulty": "Hard",
            "max_marks": 50,
            "time_limit_ms": 1000,
            "memory_limit_mb": 256,
            "problem_statement": "Given a string S on standard input, find and print the length of the longest substring without repeating characters. An O(n) sliding-window solution is expected; O(n^2) brute force will time out on large inputs.",
            "input_format": "A single string S (may be empty).",
            "output_format": "An integer: length of the longest substring with all unique characters.",
            "constraints": "0 <= |S| <= 50,000",
            "sample_input": "abcabcbb",
            "sample_output": "3",
            "starter": {
                "python3": "import sys\ns = sys.stdin.read().strip()\n# Write your O(n) sliding window solution\n",
                "javascript": "const fs = require('fs');\nconst s = fs.readFileSync(0, 'utf8').trim();\n",
                "cpp": "#include <iostream>\n#include <string>\nusing namespace std;\nint main() { return 0; }\n",
                "java": "import java.util.*;\npublic class Main { public static void main(String[] args) {} }\n",
            },
            "cases": [
                ("demo_q3_s1", "Sample 1", "abcabcbb", "3", False, 2.0),
                ("demo_q3_s2", "Sample 2", "bbbbb", "1", False, 2.0),
                ("demo_q3_h1", "Hidden 1 (pwwkew)", "pwwkew", "3", True, 7.0),
                ("demo_q3_h2", "Hidden 2 (empty)", "", "0", True, 7.0),
                ("demo_q3_h3", "Hidden 3 (all unique)", "abcdefg", "7", True, 7.0),
                ("demo_q3_h4", "Hidden 4 (dvdf)", "dvdf", "3", True, 7.0),
                ("demo_q3_h5", "Hidden 5 (abba)", "abba", "2", True, 9.0),
                ("demo_q3_h6", "Hidden 6 (large 30k stress)", large_str, "26", True, 9.0),
            ],
        },
    ]


def seed_demo(force: bool = False) -> Dict[str, Any]:
    _guard_production(force)
    db = SessionLocal()
    try:
        dept = db.query(Department).filter(Department.active == True).first()  # noqa: E712
        if not dept:
            dept = Department(name="Computer Science & Engineering (CSE)", code="CSE", active=True)
            db.add(dept)
            db.commit()
            db.refresh(dept)

        cand = db.query(Candidate).filter(Candidate.email == DEMO_CAND_EMAIL).first()
        if not cand:
            cand = Candidate(
                registration_number=DEMO_CAND_REG,
                full_name=DEMO_CAND_NAME,
                email=DEMO_CAND_EMAIL,
                department_id=dept.id,
                status="ACTIVE",
            )
            db.add(cand)
            db.commit()
            db.refresh(cand)

        r1_exam = db.query(Exam).filter(Exam.title == DEMO_R1_TITLE).first()
        if not r1_exam:
            r1_exam = Exam(title=DEMO_R1_TITLE, duration_minutes=30, total_questions=1, status="PUBLISHED")
            db.add(r1_exam)
            db.commit()
            db.refresh(r1_exam)
            qset = QuestionSet(exam_id=r1_exam.id, set_code="A", name="Set A")
            db.add(qset)
            db.commit()
            db.refresh(qset)
        else:
            qset = db.query(QuestionSet).filter(QuestionSet.exam_id == r1_exam.id).first()

        r1_att = (
            db.query(ExamAttempt)
            .filter(ExamAttempt.candidate_id == cand.id, ExamAttempt.exam_id == r1_exam.id)
            .first()
        )
        if not r1_att:
            db.add(ExamAttempt(
                candidate_id=cand.id,
                exam_id=r1_exam.id,
                question_set_id=qset.id,
                status="SUBMITTED",
                qualification_status="QUALIFIED",
            ))
            db.commit()

        ce = db.query(CodingExam).filter(CodingExam.title == DEMO_EXAM_TITLE).first()
        if not ce:
            ce = CodingExam(
                title=DEMO_EXAM_TITLE,
                description="Manual verification demo exam (3 problems: Easy, Medium, Hard).",
                duration_minutes=30,
                status="PUBLISHED",
                results_published=True,
                total_marks=100,
                qualification_percentage=60,
                allowed_languages=json.dumps(["python3", "java", "cpp", "javascript"]),
            )
            db.add(ce)
            db.commit()
            db.refresh(ce)
        else:
            ce.results_published = True
            ce.status = "PUBLISHED"
            ce.duration_minutes = 30
            db.commit()

        for q_def in _build_questions():
            q = db.query(CodingQuestion).filter(CodingQuestion.id == q_def["id"]).first()
            if not q:
                q = CodingQuestion(
                    id=q_def["id"],
                    exam_id=ce.id,
                    title=q_def["title"],
                    problem_statement=q_def["problem_statement"],
                    difficulty=q_def["difficulty"],
                    max_marks=q_def["max_marks"],
                    input_format=q_def["input_format"],
                    output_format=q_def["output_format"],
                    constraints=q_def["constraints"],
                    sample_input=q_def["sample_input"],
                    sample_output=q_def["sample_output"],
                    allowed_languages=json.dumps(["python3", "java", "cpp", "javascript"]),
                    time_limit_ms=q_def["time_limit_ms"],
                    memory_limit_mb=q_def["memory_limit_mb"],
                    starter_code_json=json.dumps(q_def["starter"]),
                )
                db.add(q)
                db.commit()

            for tc_id, label, inp, exp, hidden, marks in q_def["cases"]:
                if not db.query(CodingTestCase).filter(CodingTestCase.id == tc_id).first():
                    db.add(CodingTestCase(
                        id=tc_id,
                        question_id=q_def["id"],
                        label=label,
                        input_data=inp,
                        expected_output=exp,
                        is_hidden=hidden,
                        marks=marks,
                    ))
            db.commit()

        return {
            "examId": int(ce.id),
            "examTitle": ce.title,
            "candidateEmail": cand.email,
            "candidateName": cand.full_name,
            "department": dept.name,
            "questionIds": [q["id"] for q in _build_questions()],
        }
    finally:
        db.close()


def remove_demo(force: bool = False) -> None:
    _guard_production(force)
    db = SessionLocal()
    try:
        ce = db.query(CodingExam).filter(CodingExam.title == DEMO_EXAM_TITLE).first()
        if ce:
            att_ids = [a.id for a in db.query(CodingAttempt.id).filter(CodingAttempt.exam_id == ce.id).all()]
            if att_ids:
                db.query(CodingQuestionResult).filter(CodingQuestionResult.attempt_id.in_(att_ids)).delete(synchronize_session=False)
                db.query(CodingDraft).filter(CodingDraft.attempt_id.in_(att_ids)).delete(synchronize_session=False)
                db.query(CodingSubmission).filter(CodingSubmission.attempt_id.in_(att_ids)).delete(synchronize_session=False)
                db.query(CodingAttempt).filter(CodingAttempt.id.in_(att_ids)).delete(synchronize_session=False)
            q_ids = [q.id for q in db.query(CodingQuestion.id).filter(CodingQuestion.exam_id == ce.id).all()]
            if q_ids:
                db.query(CodingTestCase).filter(CodingTestCase.question_id.in_(q_ids)).delete(synchronize_session=False)
                db.query(CodingQuestion).filter(CodingQuestion.id.in_(q_ids)).delete(synchronize_session=False)
            db.delete(ce)

        cand = db.query(Candidate).filter(Candidate.email == DEMO_CAND_EMAIL).first()
        if cand:
            db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand.id).delete(synchronize_session=False)
            db.delete(cand)

        r1_exam = db.query(Exam).filter(Exam.title == DEMO_R1_TITLE).first()
        if r1_exam:
            db.query(QuestionSet).filter(QuestionSet.exam_id == r1_exam.id).delete(synchronize_session=False)
            db.delete(r1_exam)

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed or remove Round 2 DEMO Coding Round")
    parser.add_argument("--remove", action="store_true", help="Remove only DEMO rows")
    parser.add_argument("--force", action="store_true", help="Allow running even if production guard triggers")
    args = parser.parse_args()
    if args.remove:
        remove_demo(force=args.force)
        print("DEMO rows removed cleanly.")
    else:
        info = seed_demo(force=args.force)
        print("=== DEMO Coding Round Seeded ===")
        print(f"Candidate Name : {info['candidateName']}")
        print(f"Candidate Email: {info['candidateEmail']}")
        print(f"Department     : {info['department']}")
        print(f"Round 2 URL    : http://localhost:5173/candidate/coding?examId={info['examId']}")
        print(f"Results URL    : http://localhost:5173/candidate/coding/results?examId={info['examId']}")
