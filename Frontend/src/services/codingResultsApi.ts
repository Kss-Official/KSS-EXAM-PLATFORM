import { API_BASE_URL } from "./api";

export interface CandidateCodingQuestionResult {
  questionId: string;
  title: string;
  testsPassed: number;
  testsTotal: number;
  samplePassed: number;
  hiddenSummary: string;
  scoreAwarded: number;
  scorePossible: number;
  scorePercent: number;
  finalVerdict: string;
  language?: string | null;
  attemptsCount: number;
  maxRuntimeMs?: number | null;
  maxMemoryKb?: number | null;
  compileErrorShort?: string | null;
  sampleDetails: Array<{
    testCaseId: string;
    label: string;
    passed: boolean;
    verdict: string;
    input?: string | null;
    expectedOutput?: string | null;
    actualOutput?: string | null;
  }>;
}

export interface CandidateCodingResultsResponse {
  examId: number;
  examTitle: string;
  attemptId: number;
  resultsPublished: boolean;
  message?: string;
  totalScore?: number;
  totalPossible?: number;
  overallPercent?: number;
  qualificationStatus?: string;
  finalizedAt?: string | null;
  questions?: CandidateCodingQuestionResult[];
}

export interface AdminCodingResultRow {
  attemptId: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  registrationNumber: string;
  status: string;
  totalScore: number;
  totalPossible: number;
  overallPercent: number;
  qualificationStatus: string;
  finalizedAt?: string | null;
  questionPercents: Record<string, number>;
}

export interface AdminCodingResultsListResponse {
  examId: number;
  examTitle: string;
  resultsPublished: boolean;
  page: number;
  pageSize: number;
  total: number;
  inProgressCount?: number;
  submittedCount?: number;
  questions: Array<{ id: string; title: string; maxMarks: number }>;
  items: AdminCodingResultRow[];
}

export interface AdminCodingAnalyticsResponse {
  examId: number;
  examTitle: string;
  questions: Array<{
    questionId: string;
    title: string;
    submissionsCount: number;
    avgPercent: number;
    passRatePercent: number;
    avgAttempts: number;
    failureDistribution: Record<string, number>;
  }>;
}

function getHeaders(isAdmin: boolean): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const tok = localStorage.getItem(isAdmin ? "examsecure_auth_token" : "examsecure_candidate_token");
  if (tok) h["Authorization"] = `Bearer ${tok}`;
  return h;
}

async function reqJson<T>(path: string, isAdmin: boolean, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...getHeaders(isAdmin), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export function getMyCodingResults(examId: number): Promise<CandidateCodingResultsResponse> {
  return reqJson(`/coding/results/me?examId=${examId}`, false);
}

export function listAdminCodingResults(examId: number, page = 1, pageSize = 25): Promise<AdminCodingResultsListResponse> {
  return reqJson(`/coding/admin/exams/${examId}/results?page=${page}&pageSize=${pageSize}`, true);
}

export function getAdminCodingCandidateDetail(examId: number, candidateId: number): Promise<Record<string, unknown>> {
  return reqJson(`/coding/admin/exams/${examId}/results/${candidateId}`, true);
}

export function getAdminCodingAnalytics(examId: number): Promise<AdminCodingAnalyticsResponse> {
  return reqJson(`/coding/admin/exams/${examId}/analytics`, true);
}

export function toggleAdminCodingResultsPublished(examId: number, published: boolean): Promise<{ resultsPublished: boolean }> {
  return reqJson(`/coding/admin/exams/${examId}/publish-results?published=${published}`, true, { method: "POST" });
}

export function getAdminCodingCsvUrl(examId: number): string {
  return `${API_BASE_URL}/coding/admin/exams/${examId}/results/export.csv`;
}

export function reassignAdminCodingAttempt(
  attemptId: number,
): Promise<{ success: boolean; attemptId: number; message: string }> {
  return reqJson(`/coding/admin/attempts/${attemptId}/reset`, true, { method: "POST" });
}
