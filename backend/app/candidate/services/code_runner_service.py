import os
import sys
import time
import tempfile
import subprocess
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.coding import CodingExam, CodingQuestion, CodingTestCase, CodingAttempt, CodingSubmission
from app.schemas.coding import CodeRunRequest, CodeRunResponse, CodeSubmitRequest, CodeSubmitResponse, TestCaseResultItem

class CodeRunnerService:
    @staticmethod
    def _execute_code(language: str, code: str, stdin_data: str, timeout_seconds: float = 3.0) -> Dict[str, Any]:
        """
        Executes code safely in a temporary sandbox directory with subprocess timeouts.
        Supports: python3, python, javascript, cpp, c, java
        """
        lang = language.lower()
        start_time = time.time()

        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                if lang in ("python", "python3", "py"):
                    file_path = os.path.join(tmpdir, "solution.py")
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(code)

                    proc = subprocess.run(
                        [sys.executable, file_path],
                        input=stdin_data,
                        capture_output=True,
                        text=True,
                        timeout=timeout_seconds,
                        cwd=tmpdir
                    )
                    exec_ms = int((time.time() - start_time) * 1000)
                    if proc.returncode != 0:
                        return {
                            "status": "ERROR",
                            "output": proc.stdout or "",
                            "error": proc.stderr or "Runtime Error",
                            "executionTimeMs": exec_ms
                        }
                    return {
                        "status": "SUCCESS",
                        "output": proc.stdout or "",
                        "error": None,
                        "executionTimeMs": exec_ms
                    }

                elif lang in ("javascript", "js", "node"):
                    file_path = os.path.join(tmpdir, "solution.js")
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(code)

                    proc = subprocess.run(
                        ["node", file_path],
                        input=stdin_data,
                        capture_output=True,
                        text=True,
                        timeout=timeout_seconds,
                        cwd=tmpdir
                    )
                    exec_ms = int((time.time() - start_time) * 1000)
                    if proc.returncode != 0:
                        return {
                            "status": "ERROR",
                            "output": proc.stdout or "",
                            "error": proc.stderr or "Runtime Error",
                            "executionTimeMs": exec_ms
                        }
                    return {
                        "status": "SUCCESS",
                        "output": proc.stdout or "",
                        "error": None,
                        "executionTimeMs": exec_ms
                    }

                elif lang in ("cpp", "c++", "c"):
                    compiler = "g++" if "cpp" in lang or "c++" in lang else "gcc"
                    ext = ".cpp" if "cpp" in lang or "c++" in lang else ".c"
                    src_file = os.path.join(tmpdir, f"solution{ext}")
                    bin_file = os.path.join(tmpdir, "solution.exe" if os.name == "nt" else "solution")

                    with open(src_file, "w", encoding="utf-8") as f:
                        f.write(code)

                    # Compile
                    compile_proc = subprocess.run(
                        [compiler, src_file, "-o", bin_file],
                        capture_output=True,
                        text=True,
                        timeout=timeout_seconds + 3.0,
                        cwd=tmpdir
                    )
                    if compile_proc.returncode != 0:
                        return {
                            "status": "ERROR",
                            "output": "",
                            "error": f"Compilation Error:\n{compile_proc.stderr}",
                            "executionTimeMs": int((time.time() - start_time) * 1000)
                        }

                    # Execute
                    run_proc = subprocess.run(
                        [bin_file],
                        input=stdin_data,
                        capture_output=True,
                        text=True,
                        timeout=timeout_seconds,
                        cwd=tmpdir
                    )
                    exec_ms = int((time.time() - start_time) * 1000)
                    if run_proc.returncode != 0:
                        return {
                            "status": "ERROR",
                            "output": run_proc.stdout or "",
                            "error": run_proc.stderr or "Runtime Error",
                            "executionTimeMs": exec_ms
                        }
                    return {
                        "status": "SUCCESS",
                        "output": run_proc.stdout or "",
                        "error": None,
                        "executionTimeMs": exec_ms
                    }

                else:
                    return {
                        "status": "ERROR",
                        "output": "",
                        "error": f"Execution environment for language '{language}' is not locally installed on this host.",
                        "executionTimeMs": 0
                    }

            except subprocess.TimeoutExpired:
                return {
                    "status": "TIMEOUT",
                    "output": "",
                    "error": f"Time Limit Exceeded (>{int(timeout_seconds * 1000)}ms)",
                    "executionTimeMs": int(timeout_seconds * 1000)
                }
            except Exception as e:
                return {
                    "status": "ERROR",
                    "output": "",
                    "error": str(e),
                    "executionTimeMs": int((time.time() - start_time) * 1000)
                }

    @classmethod
    def run_candidate_code(cls, req: CodeRunRequest) -> CodeRunResponse:
        """
        Executes test code against custom or sample inputs.
        """
        timeout = max(1.0, min(req.timeLimitMs / 1000.0, 10.0))
        result = cls._execute_code(req.language, req.code, req.input, timeout_seconds=timeout)
        return CodeRunResponse(
            output=result["output"],
            error=result["error"],
            executionTimeMs=result["executionTimeMs"],
            status=result["status"]
        )

    @classmethod
    def evaluate_and_submit_code(cls, db: Session, req: CodeSubmitRequest) -> CodeSubmitResponse:
        """
        Evaluates candidate submission against ALL test cases (hidden & public).
        Computes marks and persists the attempt and submission records.
        """
        question = db.query(CodingQuestion).filter(CodingQuestion.id == str(req.questionId)).first()
        if not question:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Question {req.questionId} not found")

        exam = db.query(CodingExam).filter(CodingExam.id == question.exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated exam not found")

        test_cases = question.test_cases
        if not test_cases:
            return CodeSubmitResponse(
                success=True,
                status="PASSED",
                passedCount=0,
                totalCount=0,
                score=float(question.max_marks),
                maxMarks=float(question.max_marks),
                testCaseResults=[],
                message="No test cases configured for this question. Full marks awarded."
            )

        passed_count = 0
        total_marks_earned = 0.0
        max_marks_possible = float(question.max_marks or sum(tc.marks for tc in test_cases))
        results: List[TestCaseResultItem] = []

        timeout_sec = (question.time_limit_ms or 2000) / 1000.0

        for tc in test_cases:
            run_res = cls._execute_code(req.language, req.code, tc.input_data or "", timeout_seconds=timeout_sec)
            
            actual_clean = (run_res["output"] or "").strip().replace("\r\n", "\n")
            expected_clean = (tc.expected_output or "").strip().replace("\r\n", "\n")

            is_match = (run_res["status"] == "SUCCESS") and (actual_clean == expected_clean)
            marks_for_tc = float(tc.marks or 0.0) if is_match else 0.0

            if is_match:
                passed_count += 1
                total_marks_earned += marks_for_tc

            results.append(TestCaseResultItem(
                testCaseId=tc.id,
                label=tc.label,
                passed=is_match,
                actualOutput=run_res["output"] if not tc.is_hidden else None,
                expectedOutput=tc.expected_output if not tc.is_hidden else None,
                isHidden=tc.is_hidden,
                marksAwarded=marks_for_tc,
                error=run_res["error"],
                executionTimeMs=run_res["executionTimeMs"]
            ))

        total_count = len(test_cases)
        overall_status = "PASSED" if passed_count == total_count else ("PARTIAL" if passed_count > 0 else "FAILED")

        # Record attempt
        attempt = db.query(CodingAttempt).filter(
            CodingAttempt.candidate_id == req.candidateId,
            CodingAttempt.exam_id == exam.id
        ).first()

        if not attempt:
            attempt = CodingAttempt(
                candidate_id=req.candidateId,
                exam_id=exam.id,
                status="SUBMITTED",
                score=total_marks_earned,
                total_marks=max_marks_possible,
                percentage=(total_marks_earned / max_marks_possible * 100) if max_marks_possible > 0 else 0.0,
                qualification_status="QUALIFIED" if total_marks_earned >= (max_marks_possible * 0.6) else "NOT_QUALIFIED"
            )
            db.add(attempt)
            db.flush()
        else:
            attempt.score = total_marks_earned
            attempt.total_marks = max_marks_possible
            attempt.percentage = (total_marks_earned / max_marks_possible * 100) if max_marks_possible > 0 else 0.0
            attempt.qualification_status = "QUALIFIED" if total_marks_earned >= (max_marks_possible * 0.6) else "NOT_QUALIFIED"
            attempt.status = "SUBMITTED"

        # Record submission
        submission = CodingSubmission(
            attempt_id=attempt.id,
            question_id=question.id,
            language=req.language,
            source_code=req.code,
            status=overall_status,
            passed_test_cases=passed_count,
            total_test_cases=total_count,
            marks_awarded=total_marks_earned,
            test_case_results=""
        )
        db.add(submission)
        db.commit()

        return CodeSubmitResponse(
            success=True,
            status=overall_status,
            passedCount=passed_count,
            totalCount=total_count,
            score=total_marks_earned,
            maxMarks=max_marks_possible,
            testCaseResults=results,
            message=f"Evaluation complete: {passed_count}/{total_count} test cases passed."
        )
