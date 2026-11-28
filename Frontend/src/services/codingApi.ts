import { API_BASE_URL } from "./api";

export interface SampleTestCase {
  id: string;
  label: string;
  input: string;
  expectedOutput: string;
  explanation?: string | null;
}

export interface CodingProblemPublic {
  id: string;
  examId: number;
  title: string;
  problemStatement: string;
  difficulty: string;
  maxMarks: number;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  sampleExplanation: string;
  allowedLanguages: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
  starterCode: Record<string, string>;
  sampleTestCases: SampleTestCase[];
}

export interface TestCaseVerdict {
  testCaseId: string;
  label: string;
  passed: boolean;
  isHidden: boolean;
  verdict: string;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  input?: string | null;
  expectedOutput?: string | null;
  actualOutput?: string | null;
  error?: string | null;
}

export interface CodingSubmissionStatus {
  submissionId: number;
  attemptId: number;
  questionId: string;
  language: string;
  isRunOnly: boolean;
  verdict: string;
  status: string;
  passedCount: number;
  totalCount: number;
  score: number;
  maxMarks: number;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  errorMessage?: string | null;
  executor?: string | null;
  testCaseResults: TestCaseVerdict[];
  submittedAt?: string | null;
  updatedAt?: string | null;
}

export interface CodingAttemptInfo {
  attemptId: number;
  examId: number;
  title: string;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
  serverTime: string;
  pastePolicy?: "flag" | "ignore" | "block";
  questionIds: string[];
}

export interface CodingDraftDto {
  questionId: string;
  language: string;
  code: string;
  updatedAt?: string | null;
}

let hasRedirectedOn401 = false;

function handleUnauthorizedOnce(): void {
  if (hasRedirectedOn401) return;
  hasRedirectedOn401 = true;
  try {
    localStorage.removeItem("examsecure_candidate_token");
  } catch {
    // ignore storage errors
  }
  const params = new URLSearchParams(window.location.search);
  const examId = params.get("examId") || "2";
  if (!window.location.pathname.startsWith("/candidate/coding/login")) {
    window.location.href = `/candidate/coding/login?examId=${encodeURIComponent(examId)}`;
  }
}

function getCandidateHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token =
    localStorage.getItem("examsecure_candidate_token") ||
    localStorage.getItem("examsecure_auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Shared client api() wrapper used by all coding exam fetches.
 * Sends credentials + Bearer token and redirects once on 401 without retry loops.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE_URL}${cleanPath}`, {
    ...init,
    credentials: "include",
    headers: {
      ...getCandidateHeaders(),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    handleUnauthorizedOnce();
    const err401 = new Error("Session expired. Redirecting to login...") as Error & { status?: number };
    err401.status = 401;
    throw err401;
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.detail || msg;
    } catch {
      // ignore parse error
    }
    if (res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) {
      msg = "The code runner is busy. Please try again in a few seconds.";
    }
    const retryAfter = res.headers.get("Retry-After");
    const error = new Error(retryAfter && res.status !== 429 ? `${msg} (Retry after ${retryAfter}s)` : msg) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

/**
 * Fire-and-forget event/logging call (tab switch, blur, paste).
 * Never awaited, never blocks Run/Submit, and swallows errors.
 */
export function fireAndForgetEvent(path: string, payload: unknown): void {
  try {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    void fetch(`${API_BASE_URL}${cleanPath}`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: getCandidateHeaders(),
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // swallow all fire-and-forget errors
  }
}

async function codingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return api<T>(path, init);
}

export function getCodingAttemptInfo(examId: number): Promise<CodingAttemptInfo> {
  return codingFetch<CodingAttemptInfo>(`/coding/exams/${examId}/attempt`);
}

export interface PublishedCodingExamSummary {
  id: number;
  title: string;
  durationMinutes: number;
}

export function listPublishedCodingExams(): Promise<PublishedCodingExamSummary[]> {
  return codingFetch<PublishedCodingExamSummary[]>(`/coding/exams`);
}

export function finalizeCodingExam(examId: number): Promise<{ attemptId: number; status: string; finalizedAt?: string | null }> {
  return codingFetch(`/coding/finalize/${examId}`, { method: "POST" });
}

export function getCodingProblem(problemId: string): Promise<CodingProblemPublic> {
  return codingFetch<CodingProblemPublic>(`/coding/problems/${encodeURIComponent(problemId)}`);
}

export function listProblemSubmissions(problemId: string): Promise<CodingSubmissionStatus[]> {
  return codingFetch<CodingSubmissionStatus[]>(`/coding/problems/${encodeURIComponent(problemId)}/submissions`);
}

export function runCodingCode(payload: {
  examId: number;
  questionId: string;
  language: string;
  code: string;
  customInput?: string;
  sampleIndex?: number;
  idempotencyKey?: string;
}): Promise<{ submissionId: number; verdict: string; status: string }> {
  return codingFetch(`/coding/run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitCodingCode(payload: {
  examId: number;
  questionId: string;
  language: string;
  code: string;
  idempotencyKey: string;
}): Promise<{ submissionId: number; verdict: string; status: string; idempotentReplay?: boolean }> {
  return codingFetch(`/coding/submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCodingSubmission(submissionId: number): Promise<CodingSubmissionStatus> {
  return codingFetch<CodingSubmissionStatus>(`/coding/submissions/${submissionId}`);
}

export function saveCodingDraft(payload: {
  examId: number;
  questionId: string;
  language: string;
  code: string;
}): Promise<CodingDraftDto> {
  return codingFetch<CodingDraftDto>(`/coding/drafts`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getCodingDrafts(questionId: string, examId: number): Promise<CodingDraftDto[]> {
  return codingFetch<CodingDraftDto[]>(
    `/coding/drafts/${encodeURIComponent(questionId)}?examId=${encodeURIComponent(String(examId))}`
  );
}

export function watchSubmissionResult(
  submissionId: number,
  onStatus: (data: CodingSubmissionStatus) => void,
  onError: (err: string) => void
): () => void {
  let stopped = false;
  let pollTimer: number | null = null;
  let timeoutTimer: number | null = null;
  const abortController = new AbortController();

  const cleanup = () => {
    stopped = true;
    if (pollTimer !== null) window.clearInterval(pollTimer);
    if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
    abortController.abort();
  };

  // 20s hard client timeout
  timeoutTimer = window.setTimeout(() => {
    if (stopped) return;
    cleanup();
    onError("Execution timed out, try again");
  }, 20000);

  const fetchLatest = async () => {
    if (stopped) return;
    try {
      const full = await getCodingSubmission(submissionId);
      if (stopped) return;
      onStatus(full);
      if (full.status !== "QUEUED" && full.status !== "RUNNING") {
        cleanup();
      }
    } catch (e) {
      if (stopped) return;
      const errObj = e as Error & { status?: number };
      if (errObj?.status === 401) {
        cleanup();
      }
      onError(errObj.message);
    }
  };

  void (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/coding/events/${submissionId}`, {
        method: "GET",
        credentials: "include",
        headers: {
          ...getCandidateHeaders(),
          Accept: "text/event-stream",
        },
        signal: abortController.signal,
      });
      if (res.status === 401) {
        handleUnauthorizedOnce();
        cleanup();
        return;
      }
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const msg = JSON.parse(payload);
            if (msg.status === "RUNNING") {
              onStatus({
                submissionId,
                attemptId: 0,
                questionId: "",
                language: "",
                isRunOnly: false,
                verdict: "RUNNING",
                status: "RUNNING",
                passedCount: 0,
                totalCount: 0,
                score: 0,
                maxMarks: 0,
                testCaseResults: [],
              });
            } else if (msg.status && msg.status !== "QUEUED") {
              void fetchLatest();
            }
          } catch {
            // ignore malformed event
          }
        }
      }
    } catch {
      // fallback to polling
    }
  })();

  pollTimer = window.setInterval(fetchLatest, 600);
  void fetchLatest();
  return cleanup;
}
