"""
Phase 12 Verification Matrix against REAL Judge0 CE.

Runs every language (python3, java, cpp, javascript) x every DEMO question x
every outcome case (correct, wrong_answer, compile_error, runtime_error, tle,
mle, huge_output, and brute_force on Hard).

NEVER uses MockSandboxExecutor or LocalPythonDemoExecutor.
If Judge0 is unavailable, marks every cell as "not run" in MATRIX_REPORT.md.
"""
from __future__ import annotations

import asyncio
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.coding.judge0_client import Judge0SandboxExecutor  # noqa: E402
from app.coding.scoring import compute_question_result_metrics  # noqa: E402
from scripts.seed_coding_demo import _build_questions  # noqa: E402

LANGUAGES = ("python3", "java", "cpp", "javascript")


@dataclass(frozen=True)
class MatrixCase:
    case_name: str
    expected_verdict: str
    expected_percent_hint: str


STANDARD_CASES: List[MatrixCase] = [
    MatrixCase("correct", "ACCEPTED", "100.0%"),
    MatrixCase("wrong_answer", "WRONG_ANSWER", "0.0% (or partial)"),
    MatrixCase("compile_error", "COMPILE_ERROR", "0.0%"),
    MatrixCase("runtime_error", "RUNTIME_ERROR", "0.0%"),
    MatrixCase("tle", "TIME_LIMIT_EXCEEDED", "0.0%"),
    MatrixCase("mle", "MEMORY_LIMIT_EXCEEDED", "0.0%"),
    MatrixCase("huge_output", "RUNTIME_ERROR", "0.0%"),
]

BRUTE_FORCE_CASE = MatrixCase("brute_force", "TIME_LIMIT_EXCEEDED", "~82.0% (all except 30k stress)")


def _snippets() -> Dict[Tuple[str, str, str], str]:
    """Return (question_id, language, case_name) -> source code."""
    out: Dict[Tuple[str, str, str], str] = {}

    correct = {
        ("demo_q1_sum", "python3"): "import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n",
        ("demo_q1_sum", "java"): "import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    long a = sc.nextLong(), b = sc.nextLong();\n    System.out.println(a + b);\n  }\n}\n",
        ("demo_q1_sum", "cpp"): "#include <iostream>\nusing namespace std;\nint main(){ long long a,b; if(cin>>a>>b) cout<<a+b<<\"\\n\"; }\n",
        ("demo_q1_sum", "javascript"): "const fs=require('fs');\nconst [a,b]=fs.readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a+b);\n",

        ("demo_q2_reverse_words", "python3"): "import sys\ns = sys.stdin.read().strip()\nprint(' '.join(reversed(s.split())) if s else '')\n",
        ("demo_q2_reverse_words", "java"): "import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    String line = sc.hasNextLine() ? sc.nextLine().trim() : \"\";\n    if (line.isEmpty()) { System.out.println(); return; }\n    String[] w = line.split(\"\\\\s+\");\n    StringBuilder sb = new StringBuilder();\n    for (int i = w.length - 1; i >= 0; i--) { if (i < w.length - 1) sb.append(' '); sb.append(w[i]); }\n    System.out.println(sb.toString());\n  }\n}\n",
        ("demo_q2_reverse_words", "cpp"): "#include <iostream>\n#include <sstream>\n#include <vector>\nusing namespace std;\nint main(){ string line,w; getline(cin,line); istringstream iss(line); vector<string> v; while(iss>>w) v.push_back(w); for(int i=(int)v.size()-1;i>=0;--i){ cout<<v[i]<<(i?\" \":\"\"); } cout<<\"\\n\"; }\n",
        ("demo_q2_reverse_words", "javascript"): "const fs=require('fs');\nconst s=fs.readFileSync(0,'utf8').trim();\nconsole.log(s ? s.split(/\\s+/).reverse().join(' ') : '');\n",

        ("demo_q3_longest_substr", "python3"): "import sys\ns = sys.stdin.read().rstrip('\\r\\n')\nseen = {}\nl = ans = 0\nfor r, ch in enumerate(s):\n    if ch in seen and seen[ch] >= l:\n        l = seen[ch] + 1\n    seen[ch] = r\n    ans = max(ans, r - l + 1)\nprint(ans)\n",
        ("demo_q3_longest_substr", "java"): "import java.io.*;\nimport java.util.*;\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    String s = br.readLine();\n    if (s == null) s = \"\";\n    int[] last = new int[256]; Arrays.fill(last, -1);\n    int l = 0, ans = 0;\n    for (int r = 0; r < s.length(); r++) {\n      char c = s.charAt(r);\n      if (last[c] >= l) l = last[c] + 1;\n      last[c] = r;\n      ans = Math.max(ans, r - l + 1);\n    }\n    System.out.println(ans);\n  }\n}\n",
        ("demo_q3_longest_substr", "cpp"): "#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\nint main(){ string s; getline(cin,s); vector<int> last(256,-1); int l=0, ans=0; for(int r=0;r<(int)s.size();++r){ unsigned char c=s[r]; if(last[c]>=l) l=last[c]+1; last[c]=r; ans=max(ans,r-l+1);} cout<<ans<<\"\\n\"; }\n",
        ("demo_q3_longest_substr", "javascript"): "const fs=require('fs');\nconst s=fs.readFileSync(0,'utf8').replace(/\\r?\\n$/,'');\nconst last=new Map(); let l=0, ans=0;\nfor(let r=0;r<s.length;r++){ const c=s[r]; if(last.has(c)&&last.get(c)>=l) l=last.get(c)+1; last.set(c,r); ans=Math.max(ans,r-l+1); }\nconsole.log(ans);\n",
    }

    wrong = {
        "python3": "print(999999)\n",
        "java": "public class Main { public static void main(String[] a){ System.out.println(999999); } }\n",
        "cpp": "#include <iostream>\nint main(){ std::cout << 999999 << \"\\n\"; }\n",
        "javascript": "console.log(999999);\n",
    }
    compile_err = {
        "python3": "def broken(:\n    pass\n",
        "java": "public class Main { public static void main(String[] a){ int x = ; } }\n",
        "cpp": "int main() { int x = ; }\n",
        "javascript": "const x = ;\n",
    }
    runtime_err = {
        "python3": "print(1 // 0)\n",
        "java": "public class Main { public static void main(String[] a){ System.out.println(1 / 0); } }\n",
        "cpp": "#include <cstdlib>\nint main(){ abort(); }\n",
        "javascript": "throw new Error('boom');\n",
    }
    tle = {
        "python3": "while True:\n    pass\n",
        "java": "public class Main { public static void main(String[] a){ while(true){} } }\n",
        "cpp": "int main(){ while(true){} }\n",
        "javascript": "while(true){}\n",
    }
    mle = {
        "python3": "a = bytearray(512 * 1024 * 1024)\nprint(len(a))\n",
        "java": "public class Main { public static void main(String[] a){ byte[] b = new byte[512*1024*1024]; System.out.println(b.length); } }\n",
        "cpp": "#include <vector>\n#include <iostream>\nint main(){ std::vector<char> v(512ULL*1024*1024, 1); std::cout<<v.size(); }\n",
        "javascript": "const b = Buffer.alloc(512 * 1024 * 1024, 1); console.log(b.length);\n",
    }
    huge_out = {
        "python3": "print('A' * 2000000)\n",
        "java": "public class Main { public static void main(String[] a){ String s = \"A\".repeat(100000); for(int i=0;i<30;i++) System.out.println(s); } }\n",
        "cpp": "#include <iostream>\n#include <string>\nint main(){ std::string s(100000,'A'); for(int i=0;i<30;i++) std::cout<<s<<'\\n'; }\n",
        "javascript": "const s='A'.repeat(100000); for(let i=0;i<30;i++) console.log(s);\n",
    }
    brute_q3 = {
        "python3": "import sys\ns = sys.stdin.read().rstrip('\\r\\n')\nn = len(s)\nans = 0\nfor i in range(n):\n    for j in range(i + 1, n + 1):\n        sub = s[i:j]\n        if len(set(sub)) == len(sub):\n            ans = max(ans, j - i)\nprint(ans)\n",
        "java": "import java.io.*;\npublic class Main {\n  public static void main(String[] args) throws Exception {\n    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n    String s = br.readLine(); if(s==null) s=\"\";\n    int n = s.length(), ans = 0;\n    for(int i=0;i<n;i++) for(int j=i;j<n;j++){ boolean ok=true; for(int a=i;a<j;a++) for(int b=a+1;b<=j;b++) if(s.charAt(a)==s.charAt(b)) ok=false; if(ok) ans=Math.max(ans,j-i+1); }\n    System.out.println(ans);\n  }\n}\n",
        "cpp": "#include <iostream>\n#include <string>\nusing namespace std;\nint main(){ string s; getline(cin,s); int n=s.size(),ans=0; for(int i=0;i<n;i++) for(int j=i;j<n;j++){ bool ok=true; for(int a=i;a<j;a++) for(int b=a+1;b<=j;b++) if(s[a]==s[b]) ok=false; if(ok) ans=max(ans,j-i+1);} cout<<ans<<\"\\n\"; }\n",
        "javascript": "const fs=require('fs');\nconst s=fs.readFileSync(0,'utf8').replace(/\\r?\\n$/,'');\nlet ans=0;\nfor(let i=0;i<s.length;i++) for(let j=i;j<s.length;j++){ let ok=true; for(let a=i;a<j;a++) for(let b=a+1;b<=j;b++) if(s[a]===s[b]) ok=false; if(ok) ans=Math.max(ans,j-i+1); }\nconsole.log(ans);\n",
    }

    for qid in ("demo_q1_sum", "demo_q2_reverse_words", "demo_q3_longest_substr"):
        for lang in LANGUAGES:
            out[(qid, lang, "correct")] = correct[(qid, lang)]
            out[(qid, lang, "wrong_answer")] = wrong[lang]
            out[(qid, lang, "compile_error")] = compile_err[lang]
            out[(qid, lang, "runtime_error")] = runtime_err[lang]
            out[(qid, lang, "tle")] = tle[lang]
            out[(qid, lang, "mle")] = mle[lang]
            out[(qid, lang, "huge_output")] = huge_out[lang]
    for lang in LANGUAGES:
        out[("demo_q3_longest_substr", lang, "brute_force")] = brute_q3[lang]
    return out


async def run_matrix() -> int:
    executor = Judge0SandboxExecutor()
    reachable = await executor.is_reachable()
    questions = _build_questions()
    snippets = _snippets()

    rows: List[str] = []
    passed = 0
    failed = 0
    not_run = 0

    for q in questions:
        qid = q["id"]
        cases_for_q = list(STANDARD_CASES)
        if qid == "demo_q3_longest_substr":
            cases_for_q.append(BRUTE_FORCE_CASE)

        for lang in LANGUAGES:
            for mc in cases_for_q:
                if not reachable:
                    not_run += 1
                    rows.append(
                        f"| `{qid}` | `{lang}` | `{mc.case_name}` | `{mc.expected_verdict}` ({mc.expected_percent_hint}) | — | **not run** (Judge0 unavailable) |"
                    )
                    continue

                code = snippets[(qid, lang, mc.case_name)]
                cpu_s = max(0.5, float(q["time_limit_ms"]) / 1000.0)
                mem_kb = max(16384, int(q["memory_limit_mb"]) * 1024)

                tc_dicts = []
                case_results = []
                overall_verdict = "ACCEPTED"
                for tc_id, label, inp, exp, hidden, marks in q["cases"]:
                    res = await executor.execute(
                        language=lang,
                        source_code=code,
                        stdin=inp,
                        expected_output=exp,
                        cpu_time_limit_s=cpu_s,
                        wall_time_limit_s=cpu_s + 3.0,
                        memory_limit_kb=mem_kb,
                    )
                    tc_dicts.append({"id": tc_id, "marks": marks, "isHidden": hidden})
                    is_pass = res.verdict == "ACCEPTED"
                    if not is_pass and overall_verdict == "ACCEPTED":
                        overall_verdict = res.verdict
                    case_results.append({
                        "testCaseId": tc_id,
                        "label": label,
                        "passed": is_pass,
                        "isHidden": hidden,
                        "verdict": res.verdict,
                        "runtimeMs": res.runtime_ms,
                        "memoryKb": res.memory_kb,
                    })

                metrics = compute_question_result_metrics(
                    test_cases=tc_dicts,
                    case_results=case_results,
                    question_max_marks=float(q["max_marks"]),
                    language=lang,
                    attempts_count=1,
                    source_code=code,
                    overall_verdict=overall_verdict,
                )
                ok = overall_verdict == mc.expected_verdict
                if ok:
                    passed += 1
                    status_str = "PASS"
                else:
                    failed += 1
                    status_str = "FAIL"
                rows.append(
                    f"| `{qid}` | `{lang}` | `{mc.case_name}` | `{mc.expected_verdict}` ({mc.expected_percent_hint}) | `{overall_verdict}` ({metrics.score_percent:.1f}%) | **{status_str}** |"
                )

    report_path = Path(__file__).resolve().parent / "MATRIX_REPORT.md"
    now_iso = datetime.now(timezone.utc).isoformat()
    header = [
        "# Phase 12 Judge0 E2E Verification Matrix Report",
        "",
        f"- **Generated at:** `{now_iso}`",
        f"- **Judge0 URL:** `{executor.base_url}`",
        f"- **Judge0 Reachable:** `{reachable}`",
        f"- **Summary:** `{passed} PASS` · `{failed} FAIL` · `{not_run} not run`",
        "",
        "| Question | Language | Case | Expected | Actual | Status |",
        "|---|---|---|---|---|---|",
    ]
    report_path.write_text("\n".join(header + rows) + "\n", encoding="utf-8")
    print(f"Matrix report written to {report_path}: {passed} PASS, {failed} FAIL, {not_run} not run")
    return 1 if failed > 0 else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run_matrix()))
