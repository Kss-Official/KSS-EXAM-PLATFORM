import asyncio
import base64
import hashlib
import random
import re
import time
import weakref
from abc import ABC, abstractmethod
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.core.config import settings
from app.coding.metrics import log_coding_event

# Judge0 CE standard language IDs (Judge0 CE v1.13.x)
JUDGE0_LANGUAGE_IDS = {
    "c": 50,           # C (GCC 9.2.0)
    "cpp": 54,         # C++ (GCC 9.2.0)
    "java": 62,        # Java (OpenJDK 13.0.1)
    "javascript": 63,  # JavaScript (Node.js 12.14.0)
    "python3": 71,     # Python (3.8.1)
}

_POLL_DELAYS_S = [0.15, 0.25, 0.35, 0.5, 0.5, 0.75, 1.0]
_POLL_HARD_CAP_S = 20.0
_CACHE_TTL_S = 300.0
_CACHE_MAX_ENTRIES = 500
_RETRYABLE_STATUS_CODES = {429, 502, 503, 504}
_RETRY_BACKOFFS_S = [0.5, 1.5]
_JUDGE0_FIELDS = "status,stdout,stderr,compile_output,time,memory"
_JUDGE0_BATCH_FIELDS = "token,status,stdout,stderr,compile_output,time,memory"

# Module-level per-event-loop HTTP keep-alive clients
_LOOP_CLIENTS: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, httpx.AsyncClient]" = weakref.WeakKeyDictionary()

# 5-minute in-memory result cache & in-flight deduplication map
_RESULT_CACHE: "OrderedDict[str, Tuple[float, SandboxResult]]" = OrderedDict()
_IN_FLIGHT: Dict[str, asyncio.Future] = {}


def _get_shared_client(timeout_s: float = 25.0) -> httpx.AsyncClient:
    loop = asyncio.get_running_loop()
    client = _LOOP_CLIENTS.get(loop)
    if client is None or client.is_closed:
        limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
        client = httpx.AsyncClient(timeout=timeout_s, limits=limits)
        _LOOP_CLIENTS[loop] = client
    return client


def _needs_base64(*texts: Optional[str]) -> bool:
    for t in texts:
        if not t:
            continue
        # Use base64=true if non-ASCII or control chars (except \n, \r, \t) exist
        for ch in t:
            code = ord(ch)
            if code > 127 or (code < 32 and ch not in ("\n", "\r", "\t")):
                return True
    return False


def _make_cache_key(language: str, source_code: str, stdin: str, expected_output: Optional[str]) -> str:
    lang_id = JUDGE0_LANGUAGE_IDS.get((language or "").lower(), (language or "").lower())
    raw = f"{lang_id}\x00{source_code or ''}\x00{stdin or ''}\x00{expected_output if expected_output is not None else ''}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> Optional["SandboxResult"]:
    entry = _RESULT_CACHE.get(key)
    if not entry:
        return None
    exp_ts, res = entry
    if time.monotonic() > exp_ts:
        _RESULT_CACHE.pop(key, None)
        return None
    _RESULT_CACHE.move_to_end(key)
    return SandboxResult(
        verdict=res.verdict,
        stdout=res.stdout,
        stderr=res.stderr,
        compile_output=res.compile_output,
        runtime_ms=res.runtime_ms,
        memory_kb=res.memory_kb,
        status_id=res.status_id,
        status_text=res.status_text,
        cached=True,
    )


def _cache_set(key: str, res: "SandboxResult") -> None:
    if res.verdict == "INTERNAL_ERROR":
        return
    _RESULT_CACHE[key] = (time.monotonic() + _CACHE_TTL_S, res)
    _RESULT_CACHE.move_to_end(key)
    while len(_RESULT_CACHE) > _CACHE_MAX_ENTRIES:
        _RESULT_CACHE.popitem(last=False)


@dataclass
class SandboxResult:
    verdict: str  # ACCEPTED, WRONG_ANSWER, COMPILE_ERROR, RUNTIME_ERROR, TIME_LIMIT_EXCEEDED, MEMORY_LIMIT_EXCEEDED, INTERNAL_ERROR
    stdout: str = ""
    stderr: str = ""
    compile_output: str = ""
    runtime_ms: int = 0
    memory_kb: int = 0
    status_id: int = 0
    status_text: str = ""
    cached: bool = False


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

    async def execute_many(
        self,
        language: str,
        source_code: str,
        cases: List[Tuple[str, Optional[str]]],
        cpu_time_limit_s: float = 2.0,
        wall_time_limit_s: float = 5.0,
        memory_limit_kb: int = 262144,
        max_processes: int = 32,
        max_file_size_kb: int = 1024,
        max_concurrency: int = 8,
    ) -> List[SandboxResult]:
        """Execute multiple (stdin, expected_output) test cases concurrently."""
        if not cases:
            return []
        sem = asyncio.Semaphore(max(1, max_concurrency))

        async def _run_one(stdin: str, expected: Optional[str]) -> SandboxResult:
            async with sem:
                return await self.execute(
                    language=language,
                    source_code=source_code,
                    stdin=stdin,
                    expected_output=expected,
                    cpu_time_limit_s=cpu_time_limit_s,
                    wall_time_limit_s=wall_time_limit_s,
                    memory_limit_kb=memory_limit_kb,
                    max_processes=max_processes,
                    max_file_size_kb=max_file_size_kb,
                )

        return list(await asyncio.gather(*(_run_one(s, e) for s, e in cases)))


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
    """Calls shared/self-hosted Judge0 CE with batching, keep-alive, caching, retries, and fallback."""
    name: str = "judge0"

    def __init__(
        self,
        base_url: Optional[str] = None,
        auth_token: Optional[str] = None,
        fallback_url: Optional[str] = None,
    ) -> None:
        self.base_url = (base_url or settings.JUDGE0_URL).rstrip("/")
        self.fallback_url = (fallback_url if fallback_url is not None else settings.JUDGE0_FALLBACK_URL).rstrip("/")
        self.auth_token = auth_token if auth_token is not None else settings.JUDGE0_AUTH_TOKEN

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["X-Auth-Token"] = self.auth_token
        return headers

    async def is_reachable(self) -> bool:
        try:
            client = _get_shared_client(timeout_s=3.0)
            resp = await client.get(f"{self.base_url}/about", headers=self._headers(), timeout=2.0)
            return 200 <= resp.status_code < 300
        except Exception:
            return False

    def _build_submission_payload(
        self,
        lang_id: int,
        source_code: str,
        stdin: str,
        expected_output: Optional[str],
        use_b64: bool,
        cpu_time_limit_s: float,
        wall_time_limit_s: float,
        memory_limit_kb: int,
        max_processes: int,
        max_file_size_kb: int,
    ) -> Dict[str, Any]:
        enc = _b64 if use_b64 else (lambda s: s or "")
        payload: Dict[str, Any] = {
            "language_id": lang_id,
            "source_code": enc(source_code),
            "stdin": enc(stdin),
            "cpu_time_limit": min(float(cpu_time_limit_s), 2.0),
            "wall_time_limit": min(float(wall_time_limit_s), 5.0),
            "memory_limit": min(int(memory_limit_kb), 262144),
            "max_processes_and_or_threads": max_processes,
            "max_file_size": max_file_size_kb,
            "enable_network": False,
        }
        if expected_output is not None:
            payload["expected_output"] = enc(expected_output)
        return payload

    def _parse_judge0_result(
        self,
        data: Dict[str, Any],
        use_b64: bool,
        memory_limit_kb: int,
    ) -> SandboxResult:
        dec = _unb64 if use_b64 else (lambda v: v or "")
        status_obj = data.get("status") or {}
        status_id = int(status_obj.get("id") or 13)
        status_text = str(status_obj.get("description") or "")
        stdout = dec(data.get("stdout"))
        stderr = dec(data.get("stderr"))
        compile_out = dec(data.get("compile_output"))
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
            status_id=status_id,
            status_text=status_text,
            cached=False,
        )

    async def _request_with_retry(
        self,
        client: httpx.AsyncClient,
        method: str,
        path: str,
        json_body: Optional[Dict[str, Any]] = None,
        timeout_s: float = 15.0,
    ) -> Tuple[Optional[httpx.Response], int, Optional[str]]:
        """
        Execute an HTTP request against Judge0 with up to 2 retries on 429/502/503/504
        (exponential backoff 500ms, 1500ms + jitter, honoring Retry-After) and optional fallback URL.
        Returns (response, retry_count, error_message).
        """
        urls = [self.base_url]
        if self.fallback_url and self.fallback_url != self.base_url:
            urls.append(self.fallback_url)

        retries_used = 0
        last_err: Optional[str] = None

        for base in urls:
            url = f"{base}{path}"
            for attempt in range(len(_RETRY_BACKOFFS_S) + 1):
                try:
                    resp = await client.request(
                        method,
                        url,
                        json=json_body,
                        headers=self._headers(),
                        timeout=timeout_s,
                    )
                    if resp.status_code in _RETRYABLE_STATUS_CODES:
                        last_err = f"HTTP {resp.status_code}"
                        if attempt < len(_RETRY_BACKOFFS_S):
                            retry_after_hdr = resp.headers.get("Retry-After")
                            delay = _RETRY_BACKOFFS_S[attempt] + random.uniform(0.05, 0.25)
                            if retry_after_hdr:
                                try:
                                    delay = max(delay, min(float(retry_after_hdr), 5.0))
                                except ValueError:
                                    pass
                            retries_used += 1
                            await asyncio.sleep(delay)
                            continue
                        break  # Try fallback URL if available
                    return resp, retries_used, None
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    last_err = str(exc)
                    if attempt < len(_RETRY_BACKOFFS_S):
                        retries_used += 1
                        await asyncio.sleep(_RETRY_BACKOFFS_S[attempt] + random.uniform(0.05, 0.25))
                        continue
                    break
        return None, retries_used, last_err

    async def _poll_single_token(
        self,
        client: httpx.AsyncClient,
        token: str,
        use_b64: bool,
        memory_limit_kb: int,
        deadline: float,
    ) -> Tuple[SandboxResult, int]:
        b64_flag = "true" if use_b64 else "false"
        path = f"/submissions/{token}?base64_encoded={b64_flag}&fields={_JUDGE0_FIELDS}"
        idx = 0
        total_retries = 0
        while time.monotonic() < deadline:
            delay = _POLL_DELAYS_S[min(idx, len(_POLL_DELAYS_S) - 1)]
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            await asyncio.sleep(min(delay, remaining))
            idx += 1

            resp, retries, err = await self._request_with_retry(client, "GET", path, timeout_s=8.0)
            total_retries += retries
            if resp is None or resp.status_code >= 400:
                return SandboxResult(
                    verdict="INTERNAL_ERROR",
                    stderr="The code runner is busy. Please try again in a few seconds.",
                    status_text=err or "Runner busy",
                ), total_retries
            data = resp.json()
            status_id = int((data.get("status") or {}).get("id") or 1)
            if status_id > 2:
                return self._parse_judge0_result(data, use_b64, memory_limit_kb), total_retries

        return SandboxResult(
            verdict="TIME_LIMIT_EXCEEDED",
            stderr="Execution timed out, try again",
            status_text="Execution timed out, try again",
        ), total_retries

    async def _execute_uncached(
        self,
        language: str,
        source_code: str,
        stdin: str,
        expected_output: Optional[str],
        cpu_time_limit_s: float,
        wall_time_limit_s: float,
        memory_limit_kb: int,
        max_processes: int,
        max_file_size_kb: int,
    ) -> SandboxResult:
        t0 = time.monotonic()
        lang_id = JUDGE0_LANGUAGE_IDS.get(language.lower())
        if not lang_id:
            return SandboxResult(verdict="INTERNAL_ERROR", stderr=f"Unsupported language: {language}")

        use_b64 = _needs_base64(source_code, stdin, expected_output)
        b64_flag = "true" if use_b64 else "false"
        payload = self._build_submission_payload(
            lang_id, source_code, stdin, expected_output, use_b64,
            cpu_time_limit_s, wall_time_limit_s, memory_limit_kb, max_processes, max_file_size_kb,
        )
        client = _get_shared_client()
        deadline = t0 + _POLL_HARD_CAP_S
        total_retries = 0

        # Try wait=true first for lowest latency
        wait_path = f"/submissions?base64_encoded={b64_flag}&wait=true&fields={_JUDGE0_FIELDS}"
        resp, retries, err = await self._request_with_retry(client, "POST", wait_path, json_body=payload, timeout_s=12.0)
        total_retries += retries

        if resp is None:
            log_coding_event("judge0_run", cache_hit=False, retries=total_retries, judge0_ms=int((time.monotonic() - t0) * 1000), error=err)
            return SandboxResult(
                verdict="INTERNAL_ERROR",
                stderr="The code runner is busy. Please try again in a few seconds.",
                status_text="Runner busy",
            )

        # If wait=true is rejected (400/422) or disabled, fall back to async create + poll
        if resp.status_code in (400, 422):
            async_path = f"/submissions?base64_encoded={b64_flag}"
            resp, retries2, err2 = await self._request_with_retry(client, "POST", async_path, json_body=payload, timeout_s=10.0)
            total_retries += retries2
            if resp is None or resp.status_code >= 400:
                return SandboxResult(
                    verdict="INTERNAL_ERROR",
                    stderr="The code runner is busy. Please try again in a few seconds.",
                    status_text=err2 or f"HTTP {resp.status_code if resp else 503}",
                )
            token = resp.json().get("token")
            if not token:
                return SandboxResult(verdict="INTERNAL_ERROR", stderr="The code runner is busy. Please try again in a few seconds.")
            res, poll_retries = await self._poll_single_token(client, token, use_b64, memory_limit_kb, deadline)
            total_retries += poll_retries
            log_coding_event("judge0_run", cache_hit=False, retries=total_retries, judge0_ms=int((time.monotonic() - t0) * 1000), verdict=res.verdict)
            return res

        if resp.status_code >= 400:
            return SandboxResult(
                verdict="INTERNAL_ERROR",
                stderr="The code runner is busy. Please try again in a few seconds.",
                status_text=f"HTTP {resp.status_code}",
            )

        data = resp.json()
        status_id = int((data.get("status") or {}).get("id") or 0)
        if status_id <= 2 and data.get("token"):
            res, poll_retries = await self._poll_single_token(client, data["token"], use_b64, memory_limit_kb, deadline)
            total_retries += poll_retries
            log_coding_event("judge0_run", cache_hit=False, retries=total_retries, judge0_ms=int((time.monotonic() - t0) * 1000), verdict=res.verdict)
            return res

        res = self._parse_judge0_result(data, use_b64, memory_limit_kb)
        log_coding_event("judge0_run", cache_hit=False, retries=total_retries, judge0_ms=int((time.monotonic() - t0) * 1000), verdict=res.verdict)
        return res

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
        cache_key = _make_cache_key(language, source_code, stdin, expected_output)
        cached = _cache_get(cache_key)
        if cached is not None:
            log_coding_event("judge0_run", cache_hit=True, retries=0, judge0_ms=0, verdict=cached.verdict)
            return cached

        # In-flight deduplication: share the same Future if identical request is already running
        existing_fut = _IN_FLIGHT.get(cache_key)
        if existing_fut is not None and not existing_fut.done():
            res = await asyncio.shield(existing_fut)
            return SandboxResult(
                verdict=res.verdict,
                stdout=res.stdout,
                stderr=res.stderr,
                compile_output=res.compile_output,
                runtime_ms=res.runtime_ms,
                memory_kb=res.memory_kb,
                status_id=res.status_id,
                status_text=res.status_text,
                cached=True,
            )

        loop = asyncio.get_running_loop()
        fut: asyncio.Future = loop.create_future()
        _IN_FLIGHT[cache_key] = fut
        try:
            res = await self._execute_uncached(
                language, source_code, stdin, expected_output,
                cpu_time_limit_s, wall_time_limit_s, memory_limit_kb, max_processes, max_file_size_kb,
            )
            _cache_set(cache_key, res)
            if not fut.done():
                fut.set_result(res)
            return res
        except Exception as exc:
            if not fut.done():
                fut.set_exception(exc)
            raise
        finally:
            _IN_FLIGHT.pop(cache_key, None)

    async def execute_many(
        self,
        language: str,
        source_code: str,
        cases: List[Tuple[str, Optional[str]]],
        cpu_time_limit_s: float = 2.0,
        wall_time_limit_s: float = 5.0,
        memory_limit_kb: int = 262144,
        max_processes: int = 32,
        max_file_size_kb: int = 1024,
        max_concurrency: int = 8,
    ) -> List[SandboxResult]:
        """Submit all test cases in ONE POST /submissions/batch call and poll with ONE batch GET."""
        if not cases:
            return []
        if len(cases) == 1:
            s, e = cases[0]
            return [await self.execute(
                language, source_code, s, e,
                cpu_time_limit_s, wall_time_limit_s, memory_limit_kb, max_processes, max_file_size_kb,
            )]

        lang_id = JUDGE0_LANGUAGE_IDS.get(language.lower())
        if not lang_id:
            return [SandboxResult(verdict="INTERNAL_ERROR", stderr=f"Unsupported language: {language}") for _ in cases]

        t0 = time.monotonic()
        use_b64 = _needs_base64(source_code, *(s for s, _ in cases), *(e for _, e in cases))
        b64_flag = "true" if use_b64 else "false"
        submissions_payload = [
            self._build_submission_payload(
                lang_id, source_code, stdin, expected, use_b64,
                cpu_time_limit_s, wall_time_limit_s, memory_limit_kb, max_processes, max_file_size_kb,
            )
            for stdin, expected in cases
        ]
        client = _get_shared_client()
        total_retries = 0

        resp, retries, err = await self._request_with_retry(
            client,
            "POST",
            f"/submissions/batch?base64_encoded={b64_flag}",
            json_body={"submissions": submissions_payload},
            timeout_s=12.0,
        )
        total_retries += retries

        # Fallback to concurrent single submissions if /submissions/batch is unsupported
        if resp is not None and resp.status_code in (400, 404, 405, 422):
            return await super().execute_many(
                language, source_code, cases,
                cpu_time_limit_s, wall_time_limit_s, memory_limit_kb, max_processes, max_file_size_kb, max_concurrency,
            )

        if resp is None or resp.status_code >= 400:
            log_coding_event("judge0_batch", cache_hit=False, retries=total_retries, judge0_ms=int((time.monotonic() - t0) * 1000), error=err)
            return [
                SandboxResult(
                    verdict="INTERNAL_ERROR",
                    stderr="The code runner is busy. Please try again in a few seconds.",
                    status_text=err or "Runner busy",
                )
                for _ in cases
            ]

        raw_tokens = resp.json()
        tokens = [item.get("token") for item in raw_tokens if isinstance(item, dict) and item.get("token")]
        if len(tokens) != len(cases):
            return [
                SandboxResult(
                    verdict="INTERNAL_ERROR",
                    stderr="The code runner is busy. Please try again in a few seconds.",
                )
                for _ in cases
            ]

        token_csv = ",".join(tokens)
        poll_path = f"/submissions/batch?tokens={token_csv}&base64_encoded={b64_flag}&fields={_JUDGE0_BATCH_FIELDS}"
        deadline = t0 + _POLL_HARD_CAP_S
        idx = 0
        while time.monotonic() < deadline:
            delay = _POLL_DELAYS_S[min(idx, len(_POLL_DELAYS_S) - 1)]
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            await asyncio.sleep(min(delay, remaining))
            idx += 1

            poll_resp, p_retries, p_err = await self._request_with_retry(client, "GET", poll_path, timeout_s=10.0)
            total_retries += p_retries
            if poll_resp is None or poll_resp.status_code >= 400:
                return [
                    SandboxResult(
                        verdict="INTERNAL_ERROR",
                        stderr="The code runner is busy. Please try again in a few seconds.",
                        status_text=p_err or "Runner busy",
                    )
                    for _ in cases
                ]
            batch_data = poll_resp.json().get("submissions") or []
            if len(batch_data) == len(cases) and all(int((item.get("status") or {}).get("id") or 1) > 2 for item in batch_data):
                by_tok = {item.get("token"): item for item in batch_data if isinstance(item, dict)}
                ordered = [by_tok.get(tok, batch_data[i]) for i, tok in enumerate(tokens)]
                results = [self._parse_judge0_result(item, use_b64, memory_limit_kb) for item in ordered]
                log_coding_event("judge0_batch", cases=len(cases), cache_hit=False, retries=total_retries, judge0_ms=int((time.monotonic() - t0) * 1000))
                return results

        log_coding_event("judge0_batch_timeout", cases=len(cases), retries=total_retries, judge0_ms=int((time.monotonic() - t0) * 1000))
        return [
            SandboxResult(
                verdict="TIME_LIMIT_EXCEEDED",
                stderr="Execution timed out, try again",
                status_text="Execution timed out, try again",
            )
            for _ in cases
        ]


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
