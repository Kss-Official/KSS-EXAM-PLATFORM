"""
Documented Round 2 Coding Scoring Engine.

Formula:
1. Per-question weighted test-case pass rate:
   - Each CodingTestCase has weight w_i = float(tc.marks or 0). If sum(w_i) == 0,
     all test cases receive equal weight 1.0.
   - If final_verdict == "COMPILE_ERROR": score_awarded = 0.0, score_percent = 0.0.
   - Otherwise (including TLE / MLE / RUNTIME_ERROR / WRONG_ANSWER):
     raw_ratio = sum(w_i for passed test cases) / sum(w_i for all test cases)
     score_awarded = round(raw_ratio * question_max_marks, 2)
     score_percent = round(raw_ratio * 100.0, 2)
2. Overall attempt score:
   - total_score = sum(q.score_awarded for q in question_results)
   - total_possible = sum(q.score_possible for q in question_results)
   - overall_percent = round((total_score / total_possible) * 100.0, 2) if total_possible > 0 else 0.0
"""
import hashlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class QuestionResultComputed:
    tests_passed: int
    tests_total: int
    sample_passed: int
    hidden_passed: int
    score_awarded: float
    score_possible: float
    score_percent: float
    final_verdict: str
    failure_summary: Dict[str, int]
    first_failure_type: Optional[str]
    max_runtime_ms: int
    max_memory_kb: int
    language: Optional[str]
    attempts_count: int
    compile_error_short: Optional[str]
    code_hash: Optional[str]


def compute_code_hash(source_code: Optional[str]) -> Optional[str]:
    if source_code is None:
        return None
    return hashlib.sha256(source_code.encode("utf-8")).hexdigest()


def sanitize_compile_error(compile_err: Optional[str], max_len: int = 300) -> Optional[str]:
    if not compile_err:
        return None
    cleaned = " ".join(compile_err.strip().split())
    return cleaned[:max_len]


def compute_question_result_metrics(
    test_cases: List[Dict[str, Any]],
    case_results: List[Dict[str, Any]],
    question_max_marks: float,
    language: Optional[str],
    attempts_count: int,
    source_code: Optional[str],
    overall_verdict: str,
    compile_error: Optional[str] = None,
) -> QuestionResultComputed:
    """
    Computes compact per-question result metrics from test-case weights and evaluation results.
    Never stores hidden test input/output/stderr.
    """
    weight_by_id: Dict[str, float] = {
        str(tc["id"]): float(tc.get("marks") or 0.0)
        for tc in test_cases
    }
    total_weight = sum(weight_by_id.values())
    use_equal = total_weight <= 0.0 and len(test_cases) > 0
    if use_equal:
        total_weight = float(len(test_cases))

    tests_total = len(test_cases) if test_cases else len(case_results)
    tests_passed = 0
    sample_passed = 0
    hidden_passed = 0
    passed_weight = 0.0
    max_runtime = 0
    max_memory = 0
    failure_summary: Dict[str, int] = {}
    first_failure_type: Optional[str] = None

    for item in case_results:
        tc_id = str(item.get("testCaseId", ""))
        passed = bool(item.get("passed"))
        is_hidden = bool(item.get("isHidden"))
        verdict = str(item.get("verdict") or ("ACCEPTED" if passed else "WRONG_ANSWER"))
        max_runtime = max(max_runtime, int(item.get("runtimeMs") or 0))
        max_memory = max(max_memory, int(item.get("memoryKb") or 0))

        if passed:
            tests_passed += 1
            if is_hidden:
                hidden_passed += 1
            else:
                sample_passed += 1
            passed_weight += 1.0 if use_equal else weight_by_id.get(tc_id, 0.0)
        else:
            failure_summary[verdict] = failure_summary.get(verdict, 0) + 1
            if first_failure_type is None:
                first_failure_type = verdict

    score_possible = round(float(question_max_marks or 0.0), 2)
    if overall_verdict == "COMPILE_ERROR":
        score_awarded = 0.0
        score_percent = 0.0
        compile_err_short = sanitize_compile_error(compile_error, 300)
        if not failure_summary:
            failure_summary["COMPILE_ERROR"] = max(1, tests_total)
        first_failure_type = "COMPILE_ERROR"
    elif total_weight > 0.0 and tests_total > 0:
        ratio = max(0.0, min(1.0, passed_weight / total_weight))
        score_awarded = round(ratio * score_possible, 2)
        score_percent = round(ratio * 100.0, 2)
        compile_err_short = None
    else:
        score_awarded = 0.0
        score_percent = 0.0
        compile_err_short = None

    return QuestionResultComputed(
        tests_passed=tests_passed,
        tests_total=tests_total,
        sample_passed=sample_passed,
        hidden_passed=hidden_passed,
        score_awarded=score_awarded,
        score_possible=score_possible,
        score_percent=score_percent,
        final_verdict=overall_verdict,
        failure_summary=failure_summary,
        first_failure_type=first_failure_type,
        max_runtime_ms=max_runtime,
        max_memory_kb=max_memory,
        language=language,
        attempts_count=attempts_count,
        compile_error_short=compile_err_short,
        code_hash=compute_code_hash(source_code),
    )


def compute_overall_attempt_score(
    question_scores: List[tuple[float, float]],
    qualification_percentage: float = 60.0,
) -> Dict[str, Any]:
    total_score = round(sum(s for s, _ in question_scores), 2)
    total_possible = round(sum(p for _, p in question_scores), 2)
    overall_percent = round((total_score / total_possible) * 100.0, 2) if total_possible > 0 else 0.0
    qual = "QUALIFIED" if overall_percent >= float(qualification_percentage or 60.0) else "NOT_QUALIFIED"
    return {
        "total_score": total_score,
        "total_possible": total_possible,
        "overall_percent": overall_percent,
        "qualification_status": qual,
    }
