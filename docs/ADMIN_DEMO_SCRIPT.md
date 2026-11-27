# Admin Live Demo Script — Round 2 Coding Platform

## Prerequisites
- Backend running with `ENVIRONMENT=demo`, `CODING_ROUND_ENABLED=true`, `CODING_SANDBOX_DRIVER=judge0`, `LOCAL_DEMO_SANDBOX=false`.
- `python scripts/demo_preflight.py` prints `PASS` on all checks.
- Demo exam seeded (`DEMO Coding Round`).

---

## Part 1: Candidate Entry & Workspace (Click-by-Click)
1. Open `/candidate/coding/login?examId=2` (or your seeded `examId`).
2. Click **Fill Demo Credentials** (`DEMO Coding Candidate` / `demo.coder@example.local` / `AI/ML Developer`).
3. Click **Enter Coding Round →**.
   - Expected: Redirects into `/candidate/coding?examId=2` with Kalpanaaa logo, problem switcher (`Problem 1`, `Problem 2`, `Problem 3`), countdown timer, and Monaco editor.
4. Select **Problem 1** (`DEMO: Sum of Two Numbers`).

---

## Part 2: Paste-Ready Snippets & Expected Verdicts

### Outcome 1 — Correct Solution (Python / Java / C++ / JS)
**Python 3:**
```python
import sys
a, b = map(int, sys.stdin.read().split())
print(a + b)
```
**Java (`Main`):**
```java
import java.util.*;
public class Main {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    long a = sc.nextLong(), b = sc.nextLong();
    System.out.println(a + b);
  }
}
```
- Click **Run** (`Ctrl+'`): Expected `ACCEPTED`, `Passed 2 / 2`, `Executor: judge0`.
- Click **Submit** (`Ctrl+Enter`): Expected `ACCEPTED`, `Passed 6 / 6` (100% of Q1 = 20 / 20 marks).

### Outcome 2 — Wrong Answer
```python
print(999999)
```
- Expected: `WRONG_ANSWER`, `Passed 0 / 6`, sample diff shows `Expected: 8` vs `Actual: 999999`.

### Outcome 3 — Compile Error
```java
public class Main { public static void main(String[] a){ int x = ; } }
```
- Expected: `COMPILE_ERROR`, `0.0%`, sanitized compiler diagnostic shown.

### Outcome 4 — Runtime Error
```python
print(1 // 0)
```
- Expected: `RUNTIME_ERROR`, `0.0%`, `ZeroDivisionError` shown for sample test.

### Outcome 5 — Infinite Loop (TLE)
```python
while True:
    pass
```
- Expected: `TIME_LIMIT_EXCEEDED`, `0.0%`.

### Outcome 6 — Memory Bomb (MLE)
```python
a = bytearray(512 * 1024 * 1024)
print(len(a))
```
- Expected: `MEMORY_LIMIT_EXCEEDED`, `0.0%`.

### Outcome 7 — Hard Question (`Problem 3`: Longest Substring) Brute-Force (Partial + TLE)
Switch to **Problem 3** and paste:
```python
import sys
s = sys.stdin.read().rstrip('\r\n')
n = len(s)
ans = 0
for i in range(n):
    for j in range(i + 1, n + 1):
        sub = s[i:j]
        if len(set(sub)) == len(sub):
            ans = max(ans, j - i)
print(ans)
```
- Expected: `TIME_LIMIT_EXCEEDED` overall; passes small cases and times out on the 30k stress hidden case (~82% partial score).

---

## Part 3: Admin Results & Export
1. Open `/admin/coding-results?examId=2` (or click **Coding Results** in the Admin sidebar).
2. Show the candidate table (score, %, verdict, finalized timestamp).
3. Click a candidate row to inspect per-question breakdown (hidden test counts only — zero hidden inputs/outputs exposed).
4. Click **Question Analytics** tab to show pass rates per question.
5. Click **Export CSV** to download the results sheet.
6. Toggle **Publish Results** / **Unpublish Results** and refresh `/candidate/coding/results?examId=2` to demonstrate candidate result release control.
