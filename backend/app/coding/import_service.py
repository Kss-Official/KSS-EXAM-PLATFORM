"""
Separate Questions PDF + Test Cases (JSON / CSV / PDF) importer for Round 2 Coding Exams.
Reuses `extract_pdf_text` from `app.admin.services.pdf_service`.
"""
from __future__ import annotations

import csv
import io
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from app.admin.services.pdf_service import extract_pdf_text


def _split_problem_blocks(text: str) -> List[Tuple[str, str]]:
    """Split extracted PDF text into (title, body) pairs."""
    cleaned = (text or "").replace("\r\n", "\n").strip()
    if not cleaned:
        return []

    heading_re = re.compile(
        r"(?m)^(?:\s*(?:Problem|Question|Q)\s*\d+\s*[:.\-–]?\s*(.+)|(\d+)\.\s+([A-Z][^\n]{3,80}))\s*$"
    )
    matches = list(heading_re.finditer(cleaned))
    if not matches:
        first_line = cleaned.splitlines()[0].strip()[:80] or "Imported Problem 1"
        return [(first_line, cleaned)]

    blocks: List[Tuple[str, str]] = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(cleaned)
        title = (m.group(1) or m.group(3) or f"Problem {i + 1}").strip()
        body = cleaned[start:end].strip()
        blocks.append((title, body))
    return blocks


def _extract_section(body: str, names: Tuple[str, ...]) -> str:
    joined = "|".join(re.escape(n) for n in names)
    pat = re.compile(
        rf"(?is)(?:^|\n)\s*(?:{joined})\s*[:\-]?\s*\n?(.*?)(?=\n\s*(?:Input Format|Output Format|Constraints|Examples?|Sample Input|Sample Output|Explanation|Time Limit|Memory Limit|Problem \d+|Question \d+)\b|$)"
    )
    m = pat.search(body)
    return m.group(1).strip() if m else ""


def parse_questions_pdf(pdf_bytes: bytes) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Parse a Questions PDF into CodingQuestionDto-compatible dicts."""
    warnings: List[str] = []
    text = extract_pdf_text(pdf_bytes)
    if not text or not text.strip():
        return [], ["Could not extract readable text from Questions PDF."]

    blocks = _split_problem_blocks(text)
    questions: List[Dict[str, Any]] = []
    for idx, (title, body) in enumerate(blocks, start=1):
        diff = "Medium"
        dm = re.search(r"\b(Easy|Medium|Hard)\b", body, re.IGNORECASE)
        if dm:
            diff = dm.group(1).capitalize()

        marks = 25
        mm = re.search(r"(\d+)\s*(?:pts|points|marks)\b", body, re.IGNORECASE)
        if mm:
            marks = max(1, int(mm.group(1)))

        time_ms = 2000
        tm = re.search(r"Time\s*Limit\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(ms|s)\b", body, re.IGNORECASE)
        if tm:
            val = float(tm.group(1))
            time_ms = int(val if tm.group(2).lower() == "ms" else val * 1000)

        mem_mb = 256
        mem_m = re.search(r"Memory\s*Limit\s*[:\-]?\s*(\d+)\s*MB\b", body, re.IGNORECASE)
        if mem_m:
            mem_mb = max(64, int(mem_m.group(1)))

        inp_fmt = _extract_section(body, ("Input Format", "Input"))
        out_fmt = _extract_section(body, ("Output Format", "Output"))
        constraints = _extract_section(body, ("Constraints",))
        sample_in = _extract_section(body, ("Sample Input",))
        sample_out = _extract_section(body, ("Sample Output",))

        stmt_end = len(body)
        for marker in ("Input Format", "Output Format", "Constraints", "Sample Input", "Examples"):
            pos = body.lower().find(marker.lower())
            if pos != -1:
                stmt_end = min(stmt_end, pos)
        statement = body[:stmt_end].strip() or body

        qid = f"imp_q{idx}_{re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')[:24] or idx}"
        tcs: List[Dict[str, Any]] = []
        if sample_in or sample_out:
            tcs.append({
                "id": f"{qid}_s1",
                "label": "Sample 1",
                "input": sample_in,
                "expectedOutput": sample_out,
                "isHidden": False,
                "marks": max(1.0, round(marks * 0.2, 2)),
            })

        questions.append({
            "id": qid,
            "title": title,
            "problemStatement": statement,
            "difficulty": diff,
            "maxMarks": marks,
            "inputFormat": inp_fmt or "Standard input",
            "outputFormat": out_fmt or "Standard output",
            "constraints": constraints or "Standard constraints",
            "sampleInput": sample_in,
            "sampleOutput": sample_out,
            "allowedLanguages": ["python3", "java", "cpp", "javascript"],
            "timeLimitMs": time_ms,
            "memoryLimitMb": mem_mb,
            "testCases": tcs,
        })

    return questions, warnings


def _parse_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    return str(val or "").strip().lower() in ("1", "true", "yes", "hidden")


def parse_testcases_file(filename: str, raw_bytes: bytes) -> Tuple[Dict[int, List[Dict[str, Any]]], List[str]]:
    """
    Parse a separate Test Cases file (.json, .csv, or .pdf) into a mapping:
      1-based questionIndex -> list of TestCaseDto dicts.
    """
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    by_q: Dict[int, List[Dict[str, Any]]] = {}
    warnings: List[str] = []

    if ext == "json":
        data = json.loads(raw_bytes.decode("utf-8"))
        if isinstance(data, list):
            for idx, item in enumerate(data, start=1):
                q_idx = int(item.get("questionIndex") or item.get("question_index") or item.get("problem") or 1)
                by_q.setdefault(q_idx, []).append({
                    "id": str(item.get("id") or f"q{q_idx}_tc{idx}"),
                    "label": str(item.get("label") or f"Test {idx}"),
                    "input": str(item.get("input") or ""),
                    "expectedOutput": str(item.get("expectedOutput") if "expectedOutput" in item else item.get("expected_output", "")),
                    "isHidden": _parse_bool(item.get("isHidden") if "isHidden" in item else item.get("is_hidden", False)),
                    "marks": float(item.get("marks") or 5.0),
                })
        elif isinstance(data, dict):
            for k, arr in data.items():
                try:
                    q_idx = int(re.sub(r"\D+", "", str(k)) or "1")
                except ValueError:
                    q_idx = 1
                if not isinstance(arr, list):
                    continue
                for idx, item in enumerate(arr, start=1):
                    by_q.setdefault(q_idx, []).append({
                        "id": str(item.get("id") or f"q{q_idx}_tc{idx}"),
                        "label": str(item.get("label") or f"Test {idx}"),
                        "input": str(item.get("input") or ""),
                        "expectedOutput": str(item.get("expectedOutput") if "expectedOutput" in item else item.get("expected_output", "")),
                        "isHidden": _parse_bool(item.get("isHidden") if "isHidden" in item else item.get("is_hidden", False)),
                        "marks": float(item.get("marks") or 5.0),
                    })
        return by_q, warnings

    if ext == "csv":
        text = raw_bytes.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        for idx, row in enumerate(reader, start=1):
            q_idx = int(row.get("questionIndex") or row.get("question_index") or row.get("problem") or 1)
            by_q.setdefault(q_idx, []).append({
                "id": str(row.get("id") or f"q{q_idx}_tc{idx}"),
                "label": str(row.get("label") or f"Test {idx}"),
                "input": str(row.get("input") or ""),
                "expectedOutput": str(row.get("expectedOutput") if "expectedOutput" in row else row.get("expected_output", "")),
                "isHidden": _parse_bool(row.get("isHidden") if "isHidden" in row else row.get("is_hidden", False)),
                "marks": float(row.get("marks") or 5.0),
            })
        return by_q, warnings

    if ext == "pdf":
        text = extract_pdf_text(raw_bytes)
        if not text.strip():
            return {}, ["Could not extract readable text from Test Cases PDF."]
        blocks = _split_problem_blocks(text)
        tc_pat = re.compile(
            r"(?is)(Sample|Hidden|Test\s*Case)\s*([^\n:]*)\s*:?\s*\n\s*Input\s*:\s*\n?(.*?)\n\s*(?:Expected\s*)?Output\s*:\s*\n?(.*?)(?=\n\s*(?:Sample|Hidden|Test\s*Case)\b|$)"
        )
        for q_idx, (_title, body) in enumerate(blocks, start=1):
            for idx, m in enumerate(tc_pat.finditer(body), start=1):
                kind = m.group(1).strip().lower()
                suffix = m.group(2).strip()
                label = f"{m.group(1).strip()} {suffix}".strip()
                by_q.setdefault(q_idx, []).append({
                    "id": f"q{q_idx}_pdf_tc{idx}",
                    "label": label,
                    "input": m.group(3).strip(),
                    "expectedOutput": m.group(4).strip(),
                    "isHidden": "hidden" in kind,
                    "marks": 10.0 if "hidden" in kind else 5.0,
                })
        if not by_q:
            warnings.append("No Input:/Output: blocks matched in Test Cases PDF; JSON or CSV is recommended for exact test cases.")
        return by_q, warnings

    return {}, [f"Unsupported testcases file extension '.{ext}'. Use .json, .csv, or .pdf."]
