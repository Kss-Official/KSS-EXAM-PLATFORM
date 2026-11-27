import { API_BASE_URL } from "./api";

export interface AdminTestCaseInput {
  id: string;
  label: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  marks: number;
}

export interface AdminCodingQuestionInput {
  id: string;
  title: string;
  problemStatement: string;
  difficulty: string;
  maxMarks: number;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  allowedLanguages: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: AdminTestCaseInput[];
}

export interface AdminCodingExamDto {
  id?: number;
  title: string;
  description?: string;
  instructions?: string;
  durationMinutes: number;
  allowedLanguages: string[];
  qualificationPercentage: number;
  totalMarks: number;
  status: string;
  questions: AdminCodingQuestionInput[];
  createdAt?: string | null;
}

function getAdminHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("examsecure_admin_token") || localStorage.getItem("examsecure_auth_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function adminCodingReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...getAdminHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.detail || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

export function listAdminCodingExams(): Promise<AdminCodingExamDto[]> {
  return adminCodingReq<AdminCodingExamDto[]>("/admin/exams/coding");
}

export function createAdminCodingExam(payload: AdminCodingExamDto): Promise<AdminCodingExamDto> {
  return adminCodingReq<AdminCodingExamDto>("/admin/exams/coding", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function publishAdminCodingExam(examId: number): Promise<AdminCodingExamDto> {
  return adminCodingReq<AdminCodingExamDto>(`/admin/exams/coding/${examId}/publish`, {
    method: "POST",
  });
}

export function deleteAdminCodingExam(examId: number): Promise<{ success: boolean }> {
  return adminCodingReq<{ success: boolean }>(`/admin/exams/coding/${examId}`, {
    method: "DELETE",
  });
}

export function getCodingEligibilitySetting(): Promise<{ requireRound1Qualified: boolean }> {
  return adminCodingReq<{ requireRound1Qualified: boolean }>("/admin/exams/coding/eligibility-setting");
}

export function setCodingEligibilitySetting(requireRound1Qualified: boolean): Promise<{ requireRound1Qualified: boolean }> {
  return adminCodingReq<{ requireRound1Qualified: boolean }>("/admin/exams/coding/eligibility-setting", {
    method: "POST",
    body: JSON.stringify({ requireRound1Qualified }),
  });
}

export async function importCodingExamFiles(
  questionsPdf: File,
  testcasesFile?: File | null
): Promise<{ questions: AdminCodingQuestionInput[]; warnings: string[] }> {
  const form = new FormData();
  form.append("questions_pdf", questionsPdf);
  if (testcasesFile) {
    form.append("testcases_file", testcasesFile);
  }
  const token = localStorage.getItem("examsecure_admin_token") || localStorage.getItem("examsecure_auth_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/admin/exams/coding/import-files`, {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  });
  if (!res.ok) {
    let msg = `Import failed (${res.status})`;
    try {
      const err = await res.json();
      msg = err.message || err.detail || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}
