import base64
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import httpx

from app.core.config import settings

# Judge0 CE standard language IDs (Judge0 CE v1.13.x)
JUDGE0_LANGUAGE_IDS = {
    "c": 50,           # C (GCC 9.2.0)
    "cpp": 54,         # C++ (GCC 9.2.0)
    "java": 62,        # Java (OpenJDK 13.0.1)
    "javascript": 63,  # JavaScript (Node.js 12.14.0)
    "python3": 71,     # Python (3.8.1)
}


@dataclass
class SandboxResult:
    verdict: str  # ACCEPTED, WRONG_ANSWER, COMPILE_ERROR, RUNTIME_ERROR, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, INTERNAL_ERROR
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    runtime_ms: int = 0
    memory_kb: int = 0


class SandboxExecutor(ABC):
    @abstractmethod
    async def execute(
        self,
        language: str,
        source_code: str,
        stdin: str,
        expected_output: Optional[str] = None,
        cpu_time_limit_s: float = 2.0,
        wall_time_limit_s: float = 5.0,
        memory_limit_kb: int = 262144,
        max_processes: int = 32,
        max_file_size_kb: int = 1024,
    ) -> SandboxResult:
        raise NotImplementedError


def _b64(text: str) -> str:
    return base64.b64encode((text or "").encode("utf-8")).decode("ascii")


def _unb64(val: Optional[str]) -> str:
    if not val:
        return ""
    try:
        return base64.b64decode(val).decode("utf-8", errors="replace")
    except Exception:
        return val


class Judge0SandboxExecutor(SandboxExecutor):
    """Calls self-hosted Judge0 CE (isolate sandbox) with network disabled and strict resource limits."""

    def __init__(self, base_url: Optional[str] = None, auth_token: Optional[str] = None) -> None:
        self.base_url = (base_url or settings.JUDGE0_URL).rstrip("/")
        self.auth_token = auth_token if auth_token is not None else settings.JUDGE0_AUTH_TOKEN

    async def execute(
        self,
        language: str,
        source_code: str,
        stdin: str,
        expected_output: Optional[str] = None,
        cpu_time_limit_s: float = 2.0,
        wall_time_limit_s: float = 5.0,
        memory_limit_kb: int = 262144,
        max_processes: int = 32,
        max_file_size_kb: int = 1024,
    ) -> SandboxResult:
        lang_id = JUDGE0_LANGUAGE_IDS.get(language.lower())
        if not lang_id:
            return SandboxResult(verdict="INTERNAL_ERROR", stderr=f"Unsupported language: {language}")

        payload = {
            "language_id": lang_id,
            "source_code": _b64(source_code),
            "stdin": _b64(stdin),
            "cpu_time_limit": cpu_time_limit_s,
            "wall_time_limit": wall_time_limit_s,
            "memory_limit": memory_limit_kb,
            "max_processes_and_or_threads": max_processes,
            "max_file_size": max_file_size_kb,
            "enable_network": False,
        }
        if expected_output is not None:
            payload["expected_output"] = _b64(expected_output)

        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["X-Auth-Token"] = self.auth_token

        try:
            async with httpx.AsyncClient(timeout=wall_time_limit_s + 10.0) as client:
                resp = await client.post(
                    f"{self.base_url}/submissions?base64_encoded=true&wait=true",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            return SandboxResult(verdict="INTERNAL_ERROR", stderr=f"Sandbox communication error: {exc}")

        status_id = int((data.get("status") or {}).get("id") or 13)
        stdout = _unb64(data.get("stdout"))
        stderr = _unb64(data.get("stderr"))
        compile_out = _unb64(data.get("compile_output"))
        runtime_ms = int(float(data.get("time") or 0.0) * 1000)
        memory_kb = int(data.get("memory") or 0)

        if status_id == 3:
            verdict = "ACCEPTED"
        elif status_id == 4:
            verdict = "WRONG_ANSWER"
        elif status_id == 5:
            verdict = "TIME_LIMIT_EXCEEDED"
        elif status_id == 6:
            verdict = "COMPILE_ERROR"
        elif status_id in (7, 8, 9, 10, 11, 12):
            # Signal SIGKILL/SIGSEGV on memory exhaustion
            if "memory" in (stderr or "").lower() or memory_kb >= memory_limit_kb:
                verdict = "MEMORY_LIMIT_EXCEEDED"
            else:
                verdict = "RUNTIME_ERROR"
        else:
            verdict = "INTERNAL_ERROR"

        return SandboxResult(
            verdict=verdict,
            stdout=stdout,
            stderr=stderr,
            compile_output=compile_out,
            runtime_ms=runtime_ms,
            memory_kb=memory_kb,
        )


class MockSandboxExecutor(SandboxExecutor):
    """
    Deterministic, host-safe mock sandbox for local dev and automated tests when Docker/Judge0 is unavailable.
    Never spawns subprocesses or evaluates arbitrary user code on the host.
    """

    async def execute(
        self,
        language: str,
        source_code: str,
        stdin: str,
        expected_output: Optional[str] = None,
        cpu_time_limit_s: float = 2.0,
        wall_time_limit_s: float = 5.0,
        memory_limit_kb: int = 262144,
        max_processes: int = 32,
        max_file_size_kb: int = 1024,
    ) -> SandboxResult:
        code = source_code or ""
        lower = code.lower()

        # Security / resource-limit simulation patterns (never executed on host)
        if "# mock_huge_output" in lower or ("while" in lower and "print(" in lower and "1000000" in lower):
            return SandboxResult(
                verdict="RUNTIME_ERROR",
                stdout="[truncated to 64KB]",
                stderr="Output limit exceeded (OLE)",
                runtime_ms=45,
                memory_kb=10240,
            )
        if "while true:" in lower or "while(true)" in lower or "while (1)" in lower or "# mock_tle" in lower:
            return SandboxResult(
                verdict="TIME_LIMIT_EXCEEDED",
                stderr="Time Limit Exceeded inside sandbox",
                runtime_ms=int(cpu_time_limit_s * 1000),
                memory_kb=12288,
            )
        if "os.fork" in lower or "fork()" in lower or ":(){ :|:& };:" in code or "# mock_mle" in lower or "bytearray(10**10)" in lower:
            if "# mock_mle" in lower or "bytearray(10**10)" in lower:
                return SandboxResult(
                    verdict="MEMORY_LIMIT_EXCEEDED",
                    stderr="Memory limit exceeded (Killed)",
                    runtime_ms=80,
                    memory_kb=memory_limit_kb + 1024,
                )
            return SandboxResult(
                verdict="RUNTIME_ERROR",
                stderr="ResourceExhausted: process limit (nproc) exceeded inside sandbox",
                runtime_ms=25,
                memory_kb=8192,
            )
        if any(tok in lower for tok in ("socket.", "urllib", "requests.get", "curl ", "/etc/passwd", "open('/etc/")):
            return SandboxResult(
                verdict="RUNTIME_ERROR",
                stderr="SandboxSecurityError: network/filesystem access denied",
                runtime_ms=12,
                memory_kb=8192,
            )
        if "syntaxerror" in lower or "# mock_ce" in lower or "invalid syntax" in lower:
            return SandboxResult(
                verdict="COMPILE_ERROR",
                compile_output="SyntaxError: invalid syntax at line 1",
                runtime_ms=0,
                memory_kb=0,
            )
        if "1/0" in code or "raise " in lower or "# mock_re" in lower:
            return SandboxResult(
                verdict="RUNTIME_ERROR",
                stderr="ZeroDivisionError / RuntimeError inside sandbox",
                runtime_ms=15,
                memory_kb=9216,
            )

        # Deterministic output extraction for simple print("...") or echo-stdin mock
        stdout = ""
        m = re.search(r'print\(\s*["\']([^"\']*)["\']\s*\)', code)
        if m:
            stdout = m.group(1) + "\n"
        elif "input()" in code or "sys.stdin" in code or "scanf" in code or "cin" in code:
            stdout = (stdin or "").strip() + ("\n" if (stdin or "").strip() else "")
        elif expected_output is not None and "# mock_pass" in lower:
            stdout = expected_output

        if expected_output is not None:
            passed = stdout.strip() == expected_output.strip()
            return SandboxResult(
                verdict="ACCEPTED" if passed else "WRONG_ANSWER",
                stdout=stdout,
                runtime_ms=24,
                memory_kb=14336,
            )

        return SandboxResult(
            verdict="ACCEPTED",
            stdout=stdout,
            runtime_ms=20,
            memory_kb=14336,
        )


def get_sandbox_executor() -> SandboxExecutor:
    if settings.CODING_SANDBOX_DRIVER.lower() == "judge0":
        return Judge0SandboxExecutor()
    return MockSandboxExecutor()
