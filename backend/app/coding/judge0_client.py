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
    name: str = "base"

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
    name: str = "judge0"

    def __init__(self, base_url: Optional[str] = None, auth_token: Optional[str] = None) -> None:
        self.base_url = (base_url or settings.JUDGE0_URL).rstrip("/")
        self.auth_token = auth_token if auth_token is not None else settings.JUDGE0_AUTH_TOKEN

    async def is_reachable(self) -> bool:
        headers = {}
        if self.auth_token:
            headers["X-Auth-Token"] = self.auth_token
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{self.base_url}/about", headers=headers)
                return 200 <= resp.status_code < 300
        except Exception:
            return False

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
    name: str = "mock"

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
        if (language or "").strip().lower() in ("java", "cpp", "c++", "c"):
            return SandboxResult(
                verdict="INTERNAL_ERROR",
                stderr=f"MockSandboxExecutor cannot compile or run {language}; set CODING_SANDBOX_DRIVER=judge0 for real {language} execution.",
                runtime_ms=0,
                memory_kb=0,
            )
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


class LocalPythonDemoExecutor(SandboxExecutor):
    """
    Local-dev-only Python subprocess executor for manual testing when Judge0 is unavailable.
    Strictly forbidden when DEBUG is False or ENVIRONMENT is production.
    Strips environment secrets and enforces timeout + output cap in an isolated temp dir.
    """
    name: str = "local_demo"

    def __init__(self) -> None:
        if not settings.DEBUG or settings.ENVIRONMENT.lower() in ("demo", "production"):
            raise RuntimeError("LOCAL_DEMO_SANDBOX is forbidden when DEBUG is False or in demo/production.")

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
        if not settings.DEBUG or settings.ENVIRONMENT.lower() in ("demo", "production"):
            raise RuntimeError("LOCAL_DEMO_SANDBOX is forbidden when DEBUG is False or in demo/production.")

        lang = (language or "").strip().lower()
        if lang in ("py", "python", "python3"):
            norm_lang = "python3"
        elif lang in ("js", "node", "javascript"):
            norm_lang = "javascript"
        elif lang == "java":
            norm_lang = "java"
        elif lang in ("cpp", "c++", "c"):
            norm_lang = "cpp" if lang in ("cpp", "c++") else "c"
        else:
            return SandboxResult(
                verdict="INTERNAL_ERROR",
                stderr=f"Unsupported language for LOCAL_DEMO_SANDBOX: {language}",
            )

        import asyncio
        import os
        import shutil
        import subprocess
        import sys
        import tempfile
        import time

        def _run_sync() -> SandboxResult:
            t0 = time.time()
            with tempfile.TemporaryDirectory() as tmpdir:
                # Minimal environment: strip all DB/secret env vars while keeping OS basics (SystemRoot needed by Node/Java on Windows)
                safe_env = {
                    "PATH": os.environ.get("PATH", ""),
                    "PYTHONNOUSERSITE": "1",
                    "TEMP": tmpdir,
                    "TMP": tmpdir,
                }
                if os.environ.get("SystemRoot"):
                    safe_env["SystemRoot"] = os.environ["SystemRoot"]
                preexec = None
                if os.name != "nt":
                    import resource
                    def _limits():
                        mem_bytes = int(memory_limit_kb) * 1024
                        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
                        resource.setrlimit(resource.RLIMIT_CPU, (int(cpu_time_limit_s) + 1, int(cpu_time_limit_s) + 1))
                    preexec = _limits

                run_timeout = float(cpu_time_limit_s)
                if norm_lang == "python3":
                    script_path = os.path.join(tmpdir, "main.py")
                    with open(script_path, "w", encoding="utf-8") as f:
                        f.write(source_code or "")
                    cmd = [sys.executable, "-I", script_path]
                elif norm_lang == "javascript":
                    if not shutil.which("node"):
                        return SandboxResult(verdict="INTERNAL_ERROR", stderr="Node.js ('node') is not installed locally.")
                    script_path = os.path.join(tmpdir, "main.js")
                    with open(script_path, "w", encoding="utf-8") as f:
                        f.write(source_code or "")
                    cmd = ["node", script_path]
                elif norm_lang == "java":
                    if not shutil.which("javac") or not shutil.which("java"):
                        return SandboxResult(verdict="INTERNAL_ERROR", stderr="Java JDK ('javac'/'java') is not installed locally.")
                    src_path = os.path.join(tmpdir, "Main.java")
                    with open(src_path, "w", encoding="utf-8") as f:
                        f.write(source_code or "")
                    try:
                        comp = subprocess.run(
                            ["javac", "-J-Xmx128m", src_path],
                            capture_output=True,
                            text=True,
                            timeout=25.0,
                            cwd=tmpdir,
                            env=safe_env,
                        )
                    except subprocess.TimeoutExpired:
                        return SandboxResult(verdict="COMPILE_ERROR", compile_output="javac timed out", runtime_ms=0)
                    if comp.returncode != 0:
                        return SandboxResult(
                            verdict="COMPILE_ERROR",
                            compile_output=((comp.stderr or "") + (comp.stdout or ""))[:16384],
                            runtime_ms=0,
                        )
                    run_timeout = max(run_timeout, 5.0)
                    cmd = ["java", f"-Xmx{max(64, int(memory_limit_kb // 1024))}m", "-cp", tmpdir, "Main"]
                else:
                    compiler = "g++" if norm_lang == "cpp" else "gcc"
                    if not shutil.which(compiler):
                        return SandboxResult(
                            verdict="INTERNAL_ERROR",
                            stderr=f"'{compiler}' is not installed locally. Use Judge0 CE on Docker for {norm_lang}.",
                        )
                    ext = "cpp" if norm_lang == "cpp" else "c"
                    src_path = os.path.join(tmpdir, f"main.{ext}")
                    exe_path = os.path.join(tmpdir, "main.exe" if os.name == "nt" else "main")
                    with open(src_path, "w", encoding="utf-8") as f:
                        f.write(source_code or "")
                    comp = subprocess.run(
                        [compiler, src_path, "-O2", "-o", exe_path],
                        capture_output=True,
                        text=True,
                        timeout=10.0,
                        cwd=tmpdir,
                        env=safe_env,
                    )
                    if comp.returncode != 0:
                        return SandboxResult(
                            verdict="COMPILE_ERROR",
                            compile_output=((comp.stderr or "") + (comp.stdout or ""))[:16384],
                            runtime_ms=0,
                        )
                    cmd = [exe_path]

                try:
                    proc = subprocess.run(
                        cmd,
                        input=stdin or "",
                        capture_output=True,
                        text=True,
                        timeout=run_timeout,
                        cwd=tmpdir,
                        env=safe_env,
                        preexec_fn=preexec,
                    )
                except subprocess.TimeoutExpired:
                    return SandboxResult(
                        verdict="TIME_LIMIT_EXCEEDED",
                        stderr=f"Time Limit Exceeded (>{run_timeout}s)",
                        runtime_ms=int(run_timeout * 1000),
                        memory_kb=0,
                    )

                elapsed_ms = int((time.time() - t0) * 1000)
                stdout = (proc.stdout or "")[:65536]
                stderr = (proc.stderr or "")[:16384]
                if proc.returncode != 0:
                    if "MemoryError" in stderr or "OutOfMemoryError" in stderr:
                        return SandboxResult(verdict="MEMORY_LIMIT_EXCEEDED", stdout=stdout, stderr=stderr, runtime_ms=elapsed_ms)
                    if "SyntaxError" in stderr or "IndentationError" in stderr:
                        return SandboxResult(verdict="COMPILE_ERROR", compile_output=stderr, runtime_ms=elapsed_ms)
                    return SandboxResult(verdict="RUNTIME_ERROR", stdout=stdout, stderr=stderr, runtime_ms=elapsed_ms)

                if expected_output is not None:
                    passed = stdout.strip() == expected_output.strip()
                    return SandboxResult(
                        verdict="ACCEPTED" if passed else "WRONG_ANSWER",
                        stdout=stdout,
                        runtime_ms=elapsed_ms,
                        memory_kb=16384,
                    )
                return SandboxResult(verdict="ACCEPTED", stdout=stdout, runtime_ms=elapsed_ms, memory_kb=16384)

        return await asyncio.to_thread(_run_sync)


def get_sandbox_executor() -> SandboxExecutor:
    driver = settings.CODING_SANDBOX_DRIVER.lower()
    if driver == "judge0":
        return Judge0SandboxExecutor()
    if driver == "local_python" and settings.LOCAL_DEMO_SANDBOX:
        return LocalPythonDemoExecutor()
    return MockSandboxExecutor()
