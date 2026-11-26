# Round 2 DEMO Coding Round — Manual Test Guide

## 1. Local Startup Commands

### Important Note on Local Sandboxes
- **Production / Staging**: Uses `CODING_SANDBOX_DRIVER=judge0` (real isolated Linux `isolate` containers).
- **Local `mock` mode (`CODING_SANDBOX_DRIVER=mock`)**: Does **NOT** execute arbitrary code; it uses pattern matching (`MockSandboxExecutor`).
- **Local Python-only demo runner (`CODING_SANDBOX_DRIVER=local_python` + `LOCAL_DEMO_SANDBOX=true`)**: Executes **Python 3 only** in an isolated subprocess with stripped env vars, `1s` timeout, and memory guard. It is **strictly blocked** if `DEBUG=False` or `ENVIRONMENT=production`.

### Start Locally
1. **Seed the DEMO exam**:
   ```bash
   cd backend
   python migrations/add_coding_round_v2.py --up
   python migrations/add_coding_drafts_v3.py --up
   python migrations/add_coding_results_v4.py --up
   python scripts/seed_coding_demo.py
   ```
2. **Start Backend** (PowerShell):
   ```powershell
   cd backend
   $env:DEBUG="true"
   $env:CODING_ROUND_ENABLED="true"
   $env:CODING_SANDBOX_DRIVER="local_python"
   $env:LOCAL_DEMO_SANDBOX="true"
   python run.py
   ```
3. **Start Frontend** (PowerShell):
   ```powershell
   cd Frontend
   $env:VITE_CODING_ROUND_ENABLED="true"
   npm run dev
   ```
4. **Log in & Open Round 2**:
   - Visit `http://localhost:5173/candidate` and sign in with the printed `DEMO Coding Candidate` details.
   - Open `http://localhost:5173/candidate/coding?examId=<DEMO_EXAM_ID>`.

---

## 2. Ready-to-Paste Python3 Test Snippets

### Problem 1: DEMO: Sum of Two Numbers (`20` pts)
- **Accepted (100%)**:
  ```python
  import sys
  a, b = map(int, sys.stdin.read().split())
  print(a + b)
  ```
- **Wrong Answer (~20% partial — passes only if hardcoded `8`)**:
  ```python
  print(8)
  ```
- **Compile / Syntax Error (0%)**:
  ```python
  def broken(
  ```
- **Runtime Error (0%)**:
  ```python
  print(1 / 0)
  ```
- **Time Limit Exceeded (0%)**:
  ```python
  while True:
      pass
  ```
- **Memory Limit Exceeded (0% on Linux/Judge0; `MemoryError` locally)**:
  ```python
  x = bytearray(10**10)
  ```

### Problem 2: DEMO: Reverse Words in a Sentence (`30` pts)
- **Accepted (100%)**:
  ```python
  import sys
  words = sys.stdin.read().split()
  print(" ".join(reversed(words)))
  ```
- **Wrong Answer (partial ~83% — fails empty line / extra spaces)**:
  ```python
  import sys
  s = sys.stdin.read().rstrip("\n")
  print(" ".join(reversed(s.split(" "))))
  ```

### Problem 3: DEMO: Longest Substring Without Repeating Characters (`50` pts)
- **Accepted (100%, O(n) sliding window)**:
  ```python
  import sys
  s = sys.stdin.read().strip()
  seen = {}
  left = best = 0
  for right, ch in enumerate(s):
      if ch in seen and seen[ch] >= left:
          left = seen[ch] + 1
      seen[ch] = right
      best = max(best, right - left + 1)
  print(best)
  ```
- **Brute Force O(n^2) (Partial ~82% with `TIME_LIMIT_EXCEEDED` on Hidden 6 `30k` stress case)**:
  ```python
  import sys
  s = sys.stdin.read().strip()
  best = 0
  for i in range(len(s)):
      seen = set()
      for j in range(i, len(s)):
          if s[j] in seen:
              break
          seen.add(s[j])
          best = max(best, j - i + 1)
  print(best)
  ```

---

## 3. Cleanup
```bash
cd backend
python scripts/seed_coding_demo.py --remove
```
