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
  questionIds: string[];
}

function getCandidateHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("examsecure_candidate_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function codingFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...getCandidateHeaders(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.detail || msg;
    } catch {
      // ignore parse error
    }
    const retryAfter = res.headers.get("Retry-After");
    const error = new Error(retryAfter ? `${msg} (Retry after ${retryAfter}s)` : msg) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export function getCodingAttemptInfo(examId: number): Promise<CodingAttemptInfo> {
  return codingFetch<CodingAttemptInfo>(`/coding/exams/${examId}/attempt`);
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

export function watchSubmissionResult(
  submissionId: number,
  onStatus: (data: CodingSubmissionStatus) => void,
  onError: (err: string) => void
): () => void {
  let stopped = false;
  let pollTimer: number | null = null;
  let es: EventSource | null = null;

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
      if (!stopped) onError((e as Error).message);
    }
  };

  const cleanup = () => {
    stopped = true;
    if (pollTimer !== null) window.clearInterval(pollTimer);
    if (es) es.close();
  };

  try {
    es = new EventSource(`${API_BASE_URL}/coding/events/${submissionId}`, { withCredentials: true });
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.status && msg.status !== "QUEUED" && msg.status !== "RUNNING") {
          void fetchLatest();
        }
      } catch {
        // ignore malformed event
      }
    };
    es.onerror = () => {
      if (es) {
        es.close();
        es = null;
      }
    };
  } catch {
    // fallback to polling
  }

  pollTimer = window.setInterval(fetchLatest, 1200);
  void fetchLatest();
  return cleanup;
}
