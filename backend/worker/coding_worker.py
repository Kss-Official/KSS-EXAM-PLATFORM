"""
Separate ARQ Execution Worker for Round 2 Coding Round.
Run independently from the API:
    arq app.worker.coding_worker.WorkerSettings
"""
import json
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.coding import CodingAttempt, CodingQuestion, CodingSubmission, CodingTestCase
from app.coding.judge0_client import get_sandbox_executor
from app.coding.metrics import coding_metrics, log_coding_event
from app.coding.scoring import compute_code_hash, compute_question_result_metrics


def _sanitize_for_client(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Strip any hidden test input/output/stderr before storing or publishing."""
    sanitized: List[Dict[str, Any]] = []
    for item in results:
        if item.get("isHidden"):
            sanitized.append({
                "testCaseId": item["testCaseId"],
                "label": item["label"],
                "passed": item["passed"],
                "isHidden": True,
                "verdict": item["verdict"],
                "runtimeMs": item.get("runtimeMs"),
                "memoryKb": item.get("memoryKb"),
            })
        else:
            sanitized.append(item)
    return sanitized


async def evaluate_coding_submission(ctx: Dict[str, Any], submission_id: int, candidate_id: int) -> Dict[str, Any]:
    from app.coding.queue import coding_queue_manager

    start_ts = time.time()
    coding_metrics.worker_active += 1
    db = SessionLocal()
    try:
        sub = db.query(CodingSubmission).filter(CodingSubmission.id == submission_id).first()
        if not sub:
            return {"status": "NOT_FOUND", "submissionId": submission_id}

        sub.status = "RUNNING"
        sub.verdict = "RUNNING"
        now_utc = datetime.now(timezone.utc)
        sub.updated_at = now_utc
        db.commit()

        queue_wait_ms = 0
        if sub.submitted_at:
            sub_ts = sub.submitted_at if sub.submitted_at.tzinfo else sub.submitted_at.replace(tzinfo=timezone.utc)
            queue_wait_ms = max(0, int((now_utc - sub_ts).total_seconds() * 1000))

        await coding_queue_manager.publish_result(submission_id, {
            "submissionId": submission_id,
            "status": "RUNNING",
            "verdict": "RUNNING",
        })

        question = db.query(CodingQuestion).filter(CodingQuestion.id == sub.question_id).first()
        if not question:
            raise RuntimeError(f"CodingQuestion {sub.question_id} not found")

        executor = get_sandbox_executor()
        log_coding_event(
            "submission_executing",
            submission_id=submission_id,
            executor=executor.name,
            language=sub.language,
            is_run_only=bool(sub.is_run_only),
            queue_wait_ms=queue_wait_ms,
        )
        cpu_limit = min(2.0, max(0.5, float(question.time_limit_ms or 2000) / 1000.0))
        wall_limit = min(5.0, cpu_limit + 3.0)
        mem_limit_kb = min(262144, max(16384, int(question.memory_limit_mb or 256) * 1024))

        all_cases = db.query(CodingTestCase).filter(CodingTestCase.question_id == question.id).all()
        if sub.is_run_only:
            sample_cases = [tc for tc in all_cases if not tc.is_hidden]
            sample_idx = 0
            if sub.error_message and sub.error_message.startswith("__SAMPLE_INDEX__:"):
                try:
                    sample_idx = int(sub.error_message[len("__SAMPLE_INDEX__:"):])
                except ValueError:
                    sample_idx = 0
                sub.error_message = None
            # Run executes ONLY ONE sample test case (never all hidden tests)
            if sample_cases:
                cases_to_run = [sample_cases[sample_idx]] if 0 <= sample_idx < len(sample_cases) else [sample_cases[0]]
            else:
                cases_to_run = []
            # If custom input was stored in error_message temporarily or no sample cases exist
            if sub.error_message and sub.error_message.startswith("__CUSTOM_INPUT__:"):
                custom_in = sub.error_message[len("__CUSTOM_INPUT__:"):]
                sub.error_message = None
                res = await executor.execute(
                    language=sub.language,
                    source_code=sub.source_code,
                    stdin=custom_in,
                    expected_output=None,
                    cpu_time_limit_s=cpu_limit,
                    wall_time_limit_s=wall_limit,
                    memory_limit_kb=mem_limit_kb,
                )
                tc_item = {
                    "testCaseId": "custom",
                    "label": "Custom Input",
                    "passed": res.verdict == "ACCEPTED",
                    "isHidden": False,
                    "verdict": res.verdict,
                    "runtimeMs": res.runtime_ms,
                    "memoryKb": res.memory_kb,
                    "input": custom_in,
                    "expectedOutput": None,
                    "actualOutput": res.stdout,
                    "error": res.compile_output or res.stderr or None,
                }
                sub.verdict = res.verdict
                sub.status = "PASSED" if res.verdict == "ACCEPTED" else "FAILED"
                sub.passed_test_cases = 1 if res.verdict == "ACCEPTED" else 0
                sub.total_test_cases = 1
                sub.runtime_ms = res.runtime_ms
                sub.memory_kb = res.memory_kb
                sub.error_message = res.compile_output or res.stderr or None
                sub.test_case_results = json.dumps([tc_item])
                sub.updated_at = datetime.now(timezone.utc)
                db.commit()

                payload = {
                    "submissionId": submission_id,
                    "status": sub.status,
                    "verdict": sub.verdict,
                    "executor": executor.name,
                    "passedCount": sub.passed_test_cases,
                    "totalCount": sub.total_test_cases,
                    "runtimeMs": sub.runtime_ms,
                    "memoryKb": sub.memory_kb,
                }
                await coding_queue_manager.publish_result(submission_id, payload)
                coding_metrics.completed_total += 1
                log_coding_event(
                    "submission_evaluated",
                    submission_id=submission_id,
                    executor=executor.name,
                    verdict=sub.verdict,
                    duration_ms=int((time.time() - start_ts) * 1000),
                )
                return payload
        else:
            cases_to_run = all_cases

        results: List[Dict[str, Any]] = []
        passed_count = 0
        total_marks_awarded = Decimal("0.00")
        max_runtime = 0
        max_memory = 0
        overall_verdict = "ACCEPTED"
        public_error_msg = None

        exec_results = await executor.execute_many(
            language=sub.language,
            source_code=sub.source_code,
            cases=[(tc.input_data or "", tc.expected_output or "") for tc in cases_to_run],
            cpu_time_limit_s=cpu_limit,
            wall_time_limit_s=wall_limit,
            memory_limit_kb=mem_limit_kb,
        )
        for tc, res in zip(cases_to_run, exec_results):
            max_runtime = max(max_runtime, res.runtime_ms)
            max_memory = max(max_memory, res.memory_kb)
            is_pass = res.verdict == "ACCEPTED"
            if is_pass:
                passed_count += 1
                total_marks_awarded += Decimal(str(tc.marks or 0))
            elif overall_verdict == "ACCEPTED":
                overall_verdict = res.verdict

            if not tc.is_hidden and not is_pass and not public_error_msg:
                public_error_msg = res.compile_output or res.stderr or None
            elif tc.is_hidden and res.verdict == "COMPILE_ERROR" and not public_error_msg:
                # Compilation error applies to the user's code itself (not hidden test data)
                public_error_msg = res.compile_output or "Compilation Error"

            if tc.is_hidden:
                results.append({
                    "testCaseId": tc.id,
                    "label": tc.label,
                    "passed": is_pass,
                    "isHidden": True,
                    "verdict": res.verdict,
                    "runtimeMs": res.runtime_ms,
                    "memoryKb": res.memory_kb,
                })
            else:
                results.append({
                    "testCaseId": tc.id,
                    "label": tc.label,
                    "passed": is_pass,
                    "isHidden": False,
                    "verdict": res.verdict,
                    "runtimeMs": res.runtime_ms,
                    "memoryKb": res.memory_kb,
                    "input": tc.input_data,
                    "expectedOutput": tc.expected_output,
                    "actualOutput": res.stdout,
                    "error": res.compile_output or res.stderr or None,
                })

        total_cases = len(cases_to_run)
        if total_cases == 0:
            overall_verdict = "ACCEPTED"
            sub.status = "PASSED"
        elif passed_count == total_cases:
            overall_verdict = "ACCEPTED"
            sub.status = "PASSED"
        elif passed_count > 0:
            sub.status = "PARTIAL"
        else:
            sub.status = "FAILED"

        sub.verdict = overall_verdict
        tc_dicts = [
            {"id": tc.id, "marks": float(tc.marks or 0), "isHidden": bool(tc.is_hidden)}
            for tc in cases_to_run
        ]
        computed = compute_question_result_metrics(
            test_cases=tc_dicts,
            case_results=results,
            question_max_marks=float(question.max_marks or 0),
            language=sub.language,
            attempts_count=1,
            source_code=sub.source_code,
            overall_verdict=overall_verdict,
            compile_error=public_error_msg if overall_verdict == "COMPILE_ERROR" else None,
        )
        sub.passed_test_cases = computed.tests_passed
        sub.total_test_cases = computed.tests_total
        sub.marks_awarded = Decimal(str(computed.score_awarded))
        sub.runtime_ms = computed.max_runtime_ms
        sub.memory_kb = computed.max_memory_kb
        if not sub.code_hash:
            sub.code_hash = computed.code_hash or compute_code_hash(sub.source_code)
        sub.error_message = public_error_msg
        sub.test_case_results = json.dumps(_sanitize_for_client(results))
        sub.updated_at = datetime.now(timezone.utc)

        # Update attempt aggregate score for full submits
        if not sub.is_run_only:
            attempt = db.query(CodingAttempt).filter(CodingAttempt.id == sub.attempt_id).first()
            if attempt:
                best_by_q: Dict[str, Decimal] = {}
                all_subs = db.query(CodingSubmission).filter(
                    CodingSubmission.attempt_id == attempt.id,
                    CodingSubmission.is_run_only == False,  # noqa: E712
                ).all()
                for s in all_subs:
                    val = Decimal(str(s.marks_awarded or 0))
                    if s.question_id not in best_by_q or val > best_by_q[s.question_id]:
                        best_by_q[s.question_id] = val
                total_score = sum(best_by_q.values(), Decimal("0.00"))
                attempt.score = total_score
                if attempt.total_marks and Decimal(str(attempt.total_marks)) > 0:
                    attempt.percentage = (total_score / Decimal(str(attempt.total_marks))) * Decimal("100.00")

        db.commit()

        payload = {
            "submissionId": submission_id,
            "status": sub.status,
            "verdict": sub.verdict,
            "executor": executor.name,
            "passedCount": sub.passed_test_cases,
            "totalCount": sub.total_test_cases,
            "score": float(sub.marks_awarded or 0),
            "runtimeMs": sub.runtime_ms,
            "memoryKb": sub.memory_kb,
        }
        await coding_queue_manager.publish_result(submission_id, payload)
        coding_metrics.completed_total += 1
        log_coding_event(
            "submission_evaluated",
            submission_id=submission_id,
            executor=executor.name,
            verdict=sub.verdict,
            duration_ms=int((time.time() - start_ts) * 1000),
        )
        return payload

    except Exception as exc:
        coding_metrics.failed_total += 1
        log_coding_event("submission_eval_failed", submission_id=submission_id, error=str(exc))
        try:
            sub = db.query(CodingSubmission).filter(CodingSubmission.id == submission_id).first()
            if sub:
                sub.status = "ERROR"
                sub.verdict = "INTERNAL_ERROR"
                sub.error_message = "Execution service encountered an internal error."
                sub.updated_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
        await coding_queue_manager.push_dlq({"submissionId": submission_id, "candidateId": candidate_id, "error": str(exc)})
        await coding_queue_manager.publish_result(submission_id, {
            "submissionId": submission_id,
            "status": "ERROR",
            "verdict": "INTERNAL_ERROR",
        })
        return {"status": "ERROR", "submissionId": submission_id}
    finally:
        coding_metrics.worker_active = max(0, coding_metrics.worker_active - 1)
        await coding_queue_manager.get_guard().release_concurrency(candidate_id)
        db.close()


try:
    from arq.connections import RedisSettings

    class WorkerSettings:
        functions = [evaluate_coding_submission]
        redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
        max_jobs = 16
        job_timeout = settings.CODING_JOB_TIMEOUT_SECONDS
        max_tries = 3
except ImportError:
    class WorkerSettings:  # type: ignore[no-redef]
        functions = [evaluate_coding_submission]
        max_jobs = 16
