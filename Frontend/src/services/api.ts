import type { CodingExamDto } from "./codingExamService";
export type { CodingExamDto };

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string) || "/api";

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: "SUPER_ADMIN" | "EXAM_ADMIN" | "REVIEWER";
}

export interface AuthResponseDto {
  success: boolean;
  message: string;
  user?: AuthUser;
}

export interface DepartmentDto {
  id: number;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  createdAt?: string;
  associatedExamsCount?: number;
}

export interface ExamDto {
  id: number;
  title: string;
  description?: string;
  durationMinutes: number;
  totalQuestions: number;
  status: "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED";
  qualificationMode: "PERCENTAGE" | "ABSOLUTE";
  qualificationThreshold: number;
  timingMode: "DURATION_FROM_START" | "SCHEDULED";
  totalMarks: number;
  marksPerQuestion: number;
  negativeMarks: number;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  resultsPublished: boolean;
  createdAt?: string;
  departmentIds?: number[];
  departmentNames?: string[];
}

export interface QuestionOptionDto {
  id?: number;
  optionText: string;
  correct: boolean;
  displayOrder?: number;
  label?: string;
}

export interface QuestionDto {
  id?: number;
  questionSetId?: number;
  questionText: string;
  marks?: number;
  negativeMarks?: number;
  displayOrder?: number;
  options: QuestionOptionDto[];
  correctOptionId?: number;
}

export interface QuestionSetSummary {
  id: number;
  setCode: "A" | "B" | "C" | "D";
  name: string;
  questionCount: number;
  hasQuestionPaper?: boolean;
  questionPaperName?: string | null;
  hasAnswerKey?: boolean;
  answerKeyName?: string | null;
  isConfigured?: boolean;
}

export interface DepartmentSetSummary {
  id: number;
  setCode: "A" | "B" | "C" | "D";
  name: string;
  questionCount: number;
  hasQuestionPaper: boolean;
  questionPaperName?: string | null;
  hasAnswerKey: boolean;
  answerKeyName?: string | null;
  isConfigured: boolean;
}

export interface ExamDepartmentSummary {
  id: number;
  name: string;
  code: string;
  description?: string;
  configuredSetsCount: number;
}

export interface ParsedOptionDto {
  label: string;
  optionText: string;
  correct: boolean;
}

export interface ParsedQuestionDto {
  displayOrder: number;
  questionText: string;
  options: ParsedOptionDto[];
  correctOption?: string | null;
  marks?: number;
  negativeMarks?: number;
  hasIssue?: boolean;
  issueDescription?: string | null;
}

export interface PdfParseResponseDto {
  success: boolean;
  confidenceScore: number;
  totalQuestions: number;
  mappedAnswersCount: number;
  requiresOcr: boolean;
  ocrReason?: string;
  warnings: string[];
  errors: string[];
  extractedAnswerKey: Record<number, string>;
  questions: ParsedQuestionDto[];
  questionPaperFileName?: string;
  questionPaperSizeBytes?: number;
  answerSheetFileName?: string;
  answerSheetSizeBytes?: number;
}

export interface CreateExamFromParsedDto {
  title: string;
  description?: string;
  durationMinutes?: number;
  totalQuestions?: number;
  qualificationMode?: "PERCENTAGE" | "ABSOLUTE";
  qualificationThreshold?: number;
  timingMode?: "DURATION_FROM_START" | "SCHEDULED";
  totalMarks?: number;
  marksPerQuestion?: number;
  negativeMarks?: number;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  departmentIds?: number[];
  targetSets?: string[];
  publishImmediately?: boolean;
  questions: ParsedQuestionDto[];
}

export interface CandidateDto {
  id: number;
  registrationNumber: string;
  fullName: string;
  email: string;
  departmentId?: number;
  departmentName?: string;
  status: string;
  createdAt?: string;
  currentAccessCode?: string;
  round1AccessCode?: string;
  round2AccessCode?: string;
  accessCodeUses?: number;
  access_code_active?: boolean;
  accessCodeActive?: boolean;
  accessCodeSentAt?: string;
  assignedSet?: string | null;
}

export interface CandidateVerifyRequest {
  registrationNumber?: string;
  uniqueId?: string;
  accessCode?: string;
  fullName?: string;
  name?: string;
  departmentId?: number;
  departmentName?: string;
  department?: string;
  round?: string;
}

export interface CandidateVerifyResponse {
  eligible: boolean;
  message: string;
  candidateId?: number;
  registrationNumber?: string;
  fullName?: string;
  candidateName?: string;
  departmentName?: string;
  examId?: number;
  assignedExamId?: number;
  examTitle?: string;
  slotName?: string;
  durationMinutes?: number;
  totalQuestions?: number;
  timingMode?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  setCode?: string;
  questionSetCode?: string;
  accessCode?: string;
  accessCodeUses?: number;
  accessCodeMaxUses?: number;
  round?: string;
}

export interface CandidateOptionDto {
  optionId: number;
  id?: number;
  label: string;
  optionText: string;
}

export interface CandidateQuestionDto {
  questionId: number;
  id?: number;
  displayIndex: number;
  questionText: string;
  marks: number;
  options: CandidateOptionDto[];
  selectedOptionId?: number;
}

export interface CandidateStartAttemptResponse {
  attemptId: number;
  examId: number;
  examTitle: string;
  setCode: string;
  questionSetCode?: string;
  startedAt: string;
  deadlineAt: string;
  expiresAt?: string;
  totalDurationSeconds: number;
  questions: CandidateQuestionDto[];
  answers?: Record<string | number, number>;
}

export interface SubmissionResponse {
  success: boolean;
  message: string;
  receiptId: string;
  submittedAt: string;
  attemptId: number;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  isPublished?: boolean;
  qualificationStatus?: string;
}

export interface ExamResultDto {
  attemptId: number;
  candidateId: number;
  candidateName: string;
  registrationNumber: string;
  departmentName: string;
  examId: number;
  examTitle: string;
  setCode: string;
  slotNumber: number;
  attemptStatus: string;
  answeredCount: number;
  unansweredCount: number;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  qualificationThreshold?: number;
  qualificationStatus?: string;
  resultsPublished: boolean;
  submittedAt?: string;
}

export interface AdminDashboardResponse {
  application: string;
  status: string;
  totalExams: number;
  activeExams: number;
  totalCandidates: number;
  totalDepartments: number;
  totalAttempts: number;
  submittedAttempts: number;
  qualifiedCandidates: number;
  message: string;
}

export interface AuditLogDto {
  id: number;
  action: string;
  entityType: string;
  entityId?: string;
  performedBy: string;
  details?: string;
  createdAt?: string;
}

export interface AuditLogResponse {
  items: AuditLogDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}


export class ApiError extends Error {
  statusCode: number;
  status: number;
  isAuthError: boolean;
  isCorsOrNetworkError: boolean;
  backendMessage?: string;

  constructor(
    message: string,
    statusCode: number = 0,
    options?: { isAuthError?: boolean; isCorsOrNetworkError?: boolean; backendMessage?: string }
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.status = statusCode;
    this.isAuthError = !!options?.isAuthError;
    this.isCorsOrNetworkError = !!options?.isCorsOrNetworkError;
    this.backendMessage = options?.backendMessage;
  }
}

/**
 * Common fetch wrapper with HttpOnly cookie credentials support
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
  
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: "include", // Send and receive session cookies (JSESSIONID)
      headers,
    });
  } catch (err: unknown) {
    const error = err as Error;
    throw new ApiError(
      `Cannot connect to backend at ${url}. Either the FastAPI server is offline or browser CORS restrictions blocked the connection (${error.message}).`,
      0,
      { isCorsOrNetworkError: true }
    );
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") {
        errorDetail = data.detail;
      } else if (Array.isArray(data.detail)) {
        errorDetail = data.detail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
      } else {
        errorDetail = data.message || data.error || (typeof data === "string" ? data : JSON.stringify(data));
      }
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = response.statusText;
      }
    }

    if (response.status === 401) {
      throw new ApiError(
        errorDetail || "401 Unauthorized: Authentication required for this endpoint.",
        401,
        { isAuthError: true, backendMessage: errorDetail }
      );
    }

    if (response.status === 403) {
      throw new ApiError(
        errorDetail || "403 Forbidden: Access denied.",
        403,
        { isAuthError: true, backendMessage: errorDetail }
      );
    }

    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new ApiError(
        "ExamSecure Backend server at http://127.0.0.1:8000 is offline. Please start the backend with 'python run.py'.",
        response.status,
        { isCorsOrNetworkError: true, backendMessage: errorDetail }
      );
    }

    throw new ApiError(
      `Backend error ${response.status}: ${errorDetail || response.statusText}`,
      response.status,
      { backendMessage: errorDetail }
    );
  }

  return response.json() as Promise<T>;
}

/* =========================================================================
   1. AUTHENTICATION APIS
   ========================================================================= */

export async function loginAdmin(email: string, password: string): Promise<AuthResponseDto> {
  return request<AuthResponseDto>("auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password })
  });
}

export async function getAuthMe(): Promise<AuthUser> {
  return request<AuthUser>("auth/me");
}

export async function logoutAdmin(): Promise<void> {
  try {
    await request<AuthResponseDto>("auth/logout", { method: "POST" });
  } catch (err) {
    console.warn("[API] Logout warning:", err);
  }
}

/* =========================================================================
   2. DASHBOARD APIS
   ========================================================================= */

export async function getAdminDashboard(): Promise<AdminDashboardResponse> {
  return request<AdminDashboardResponse>("admin/dashboard");
}

export async function getAuditLogs(params?: {
  page?: number;
  pageSize?: number;
  action?: string;
  entityType?: string;
  search?: string;
}): Promise<AuditLogResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  if (params?.action) query.set("action", params.action);
  if (params?.entityType) query.set("entityType", params.entityType);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return request<AuditLogResponse>(qs ? `admin/audit-logs?${qs}` : "admin/audit-logs");
}


/* =========================================================================
   3. DEPARTMENT MANAGEMENT APIS
   ========================================================================= */

export async function getAllDepartments(): Promise<DepartmentDto[]> {
  return request<DepartmentDto[]>("admin/departments");
}

export async function getActiveDepartments(): Promise<DepartmentDto[]> {
  return request<DepartmentDto[]>("admin/departments/active");
}

export async function createDepartment(dept: Partial<DepartmentDto>): Promise<DepartmentDto> {
  return request<DepartmentDto>("admin/departments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dept)
  });
}

export async function updateDepartment(id: number, dept: Partial<DepartmentDto>): Promise<DepartmentDto> {
  return request<DepartmentDto>(`admin/departments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dept)
  });
}

export async function deleteDepartment(id: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`admin/departments/${id}`, {
    method: "DELETE"
  });
}

/* =========================================================================
   4. EXAM MANAGEMENT APIS
   ========================================================================= */

export async function getAllExams(): Promise<ExamDto[]> {
  return request<ExamDto[]>("admin/exams");
}

export async function getExamById(id: number): Promise<ExamDto> {
  return request<ExamDto>(`admin/exams/${id}`);
}

export async function createExam(examData: Partial<ExamDto>): Promise<ExamDto> {
  return request<ExamDto>("admin/exams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(examData)
  });
}

export async function updateExam(id: number, examData: Partial<ExamDto>): Promise<ExamDto> {
  return request<ExamDto>(`admin/exams/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(examData)
  });
}

export async function publishExam(id: number): Promise<ExamDto> {
  return request<ExamDto>(`admin/exams/${id}/publish`, { method: "POST" });
}

export async function closeExam(id: number): Promise<ExamDto> {
  return request<ExamDto>(`admin/exams/${id}/close`, { method: "POST" });
}

export async function deleteExam(id: number, force: boolean = false): Promise<{ success: boolean; message: string; requiresConfirmation?: boolean }> {
  return request<{ success: boolean; message: string; requiresConfirmation?: boolean }>(`admin/exams/${id}?force=${force}`, {
    method: "DELETE"
  });
}

/**
 * In-Memory PDF Upload and Extraction API
 * Uploads question paper and answer sheet PDFs strictly in-memory.
 */
export async function parsePdfInMemory(formData: FormData): Promise<PdfParseResponseDto> {
  return request<PdfParseResponseDto>("admin/exams/parse-pdf", {
    method: "POST",
    body: formData
  });
}

/**
 * Persists structured MCQ exam created from parsed PDF after admin review and verification.
 */
export async function createExamFromParsed(payload: CreateExamFromParsedDto): Promise<ExamDto> {
  return request<ExamDto>("admin/exams/create-from-parsed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

/* =========================================================================
   5. QUESTION BANK & 4-SET APIS
   ========================================================================= */

export async function getExamQuestionSets(examId: number): Promise<QuestionSetSummary[]> {
  return request<QuestionSetSummary[]>(`admin/exams/${examId}/sets`);
}

export async function getQuestionsBySet(examId: number, setCode: string): Promise<QuestionDto[]> {
  return request<QuestionDto[]>(`admin/exams/${examId}/sets/${setCode}/questions`);
}

export async function addQuestionToSet(questionSetId: number, question: Partial<QuestionDto>): Promise<QuestionDto> {
  return request<QuestionDto>(`admin/sets/${questionSetId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(question)
  });
}

export async function deleteQuestion(questionId: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`admin/questions/${questionId}`, {
    method: "DELETE"
  });
}

export async function importQuestionsText(questionSetId: number, rawText: string): Promise<QuestionDto[]> {
  return request<QuestionDto[]>(`admin/sets/${questionSetId}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText })
  });
}

export async function applyAnswerKey(questionSetId: number, answerKeyText: string): Promise<any> {
  return request<any>(`admin/sets/${questionSetId}/answer-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answerKeyText })
  });
}

export async function getExamDepartments(examId: number): Promise<ExamDepartmentSummary[]> {
  return request<ExamDepartmentSummary[]>(`admin/exams/${examId}/departments`);
}

export async function getExamDepartmentSets(examId: number, departmentId: number): Promise<DepartmentSetSummary[]> {
  return request<DepartmentSetSummary[]>(`admin/exams/${examId}/departments/${departmentId}/sets`);
}

export async function getQuestionsByDeptAndSet(examId: number, departmentId: number, setCode: string): Promise<QuestionDto[]> {
  return request<QuestionDto[]>(`admin/exams/${examId}/departments/${departmentId}/sets/${setCode}/questions`);
}

export async function bulkUpdateSetQuestions(questionSetId: number, questions: Partial<QuestionDto>[]): Promise<QuestionDto[]> {
  return request<QuestionDto[]>(`admin/sets/${questionSetId}/bulk`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(questions)
  });
}

export async function deleteAllQuestionsInSet(questionSetId: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`admin/sets/${questionSetId}/questions`, {
    method: "DELETE"
  });
}

export async function deleteQuestionSet(questionSetId: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`admin/sets/${questionSetId}`, {
    method: "DELETE"
  });
}

export async function uploadDeptSetDocument(
  examId: number, 
  departmentId: number,
  questionSetId: number, 
  file: File, 
  documentType: "QUESTION_PAPER" | "ANSWER_KEY" = "QUESTION_PAPER"
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  const url = `${API_BASE_URL.replace(/\/+$/, "")}/admin/exams/${examId}/departments/${departmentId}/sets/${questionSetId}/upload-document`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(`Document upload failed: ${text}`, response.status);
  }
  return response.json();
}

export async function removeSetDocument(
  examId: number, 
  questionSetId: number, 
  documentType: "QUESTION_PAPER" | "ANSWER_KEY"
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`admin/exams/${examId}/sets/${questionSetId}/documents/${documentType}`, {
    method: "DELETE"
  });
}

export async function initializeDeptSets(examId: number, departmentId: number): Promise<DepartmentSetSummary[]> {
  return request<DepartmentSetSummary[]>(`admin/exams/${examId}/departments/${departmentId}/initialize-sets`, {
    method: "POST"
  });
}

export async function uploadSetDocument(
  examId: number, 
  questionSetId: number, 
  file: File, 
  documentType: "QUESTION_PAPER" | "ANSWER_KEY" = "QUESTION_PAPER"
): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  const url = `${API_BASE_URL.replace(/\/+$/, "")}/admin/exams/${examId}/sets/${questionSetId}/upload-document`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(`Document upload failed: ${text}`, response.status);
  }
  return response.json();
}

/* =========================================================================
   6. CANDIDATE MANAGEMENT APIS
   ========================================================================= */

export async function getAllCandidates(): Promise<CandidateDto[]> {
  return request<CandidateDto[]>("admin/candidates");
}

export async function createCandidate(cand: Partial<CandidateDto>): Promise<CandidateDto> {
  return request<CandidateDto>("admin/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cand)
  });
}

export async function uploadCandidatesCsv(file: File): Promise<{
  success: boolean;
  totalImported: number;
  errorsCount: number;
  errors: string[];
  candidates: CandidateDto[];
}> {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE_URL.replace(/\/+$/, "")}/admin/candidates/batch`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(`Batch CSV upload failed: ${text}`, response.status);
  }
  return response.json();
}

export async function assignCandidateToExam(candidateId: number, examId: number, slotId?: number, setCode?: string): Promise<any> {
  return request<any>(`admin/candidates/${candidateId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ examId, slotId, setCode })
  });
}

export async function generateCandidateAccessCode(
  candidateId: number,
  round: "ROUND_1" | "ROUND_2" = "ROUND_1",
  forceNew: boolean = true
): Promise<{
  id: number;
  candidateId: number;
  code: string;
  usageCount: number;
  maxUses: number;
  isActive: boolean;
  createdAt: string;
}> {
  return request<any>(`admin/candidates/${candidateId}/generate-access-code?round=${round}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force_new: forceNew, forceNew })
  });
}

export async function sendCandidateAccessCodeEmail(candidateId: number, round: "ROUND_1" | "ROUND_2" = "ROUND_1"): Promise<{
  success: boolean;
  candidateId: number;
  candidateName: string;
  email: string;
  accessCode: string;
  usageCount: number;
  maxUses: number;
  provider: string;
  message: string;
}> {
  return request<any>(`admin/candidates/${candidateId}/send-access-code?round=${round}`, {
    method: "POST"
  });
}

export async function batchGenerateRoundUniqueIds(
  round: "ROUND_1" | "ROUND_2" = "ROUND_1",
  forceNew: boolean = true
): Promise<{
  success: boolean;
  round: string;
  totalEligible: number;
  newlyGenerated: number;
  alreadyExisted: number;
  roundIds: Record<string, string>;
  count?: number;
  mapping?: Record<string, string>;
}> {
  return request<any>("admin/candidates/round-ids/batch-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round, force_new: forceNew, forceNew })
  });
}

export async function generateSelectedRoundUniqueIds(
  candidateIds: number[],
  round: "ROUND_1" | "ROUND_2" = "ROUND_1",
  forceNew: boolean = true
): Promise<{
  success: boolean;
  round: string;
  totalSelected: number;
  generatedCount: number;
  failedIds: number[];
  roundIds: Record<string, string>;
}> {
  return request<any>("admin/candidates/round-ids/generate-selected", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, round, force_new: forceNew, forceNew })
  });
}

export async function assignCandidateSet(
  candidateId: number,
  setCode: string | null
): Promise<CandidateDto> {
  return request<CandidateDto>(`admin/candidates/${candidateId}/assign-set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setCode })
  });
}

export async function batchAssignCandidateSet(
  candidateIds: number[],
  setCode: string | null
): Promise<{
  success: boolean;
  updatedCount: number;
  assignedSet: string | null;
}> {
  return request<any>("admin/candidates/batch-assign-set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, setCode })
  });
}

export async function getRoundUniqueIds(round: "ROUND_1" | "ROUND_2" = "ROUND_1"): Promise<Record<string, string>> {
  return request<Record<string, string>>(`admin/candidates/round-ids?round=${round}`);
}

export async function batchSendAccessCodesEmail(req: {
  round: "ROUND_1" | "ROUND_2";
  candidateIds?: number[];
  examTitle?: string;
  delaySeconds?: number;
}): Promise<{
  success: boolean;
  jobId: string;
  status: string;
  totalCandidates: number;
}> {
  return request<any>("admin/candidates/batch-send-access-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
}

export async function getBatchEmailStatus(jobId: string): Promise<{
  jobId: string;
  round: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  totalCandidates: number;
  sentCount: number;
  failedCount: number;
  provider: string;
}> {
  return request<any>(`admin/candidates/batch-send-status/${jobId}`);
}

/* =========================================================================
   7. RESULTS APIS
   ========================================================================= */

export async function getAllResults(examId?: number): Promise<ExamResultDto[]> {
  const endpoint = examId ? `admin/results/exam/${examId}` : "admin/results";
  return request<ExamResultDto[]>(endpoint);
}

export async function publishResults(examId: number, published: boolean): Promise<any> {
  return request<any>(`admin/results/exam/${examId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published })
  });
}

/* =========================================================================
   8. CANDIDATE PORTAL APIS (REAL BACKEND EXAM FLOW)
   ========================================================================= */

export async function getEligibleDepartments(): Promise<DepartmentDto[]> {
  return request<DepartmentDto[]>("candidate/departments");
}

export async function verifyCandidateEligibility(req: CandidateVerifyRequest): Promise<CandidateVerifyResponse> {
  return request<CandidateVerifyResponse>("candidate/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
}

export async function startCandidateAttempt(candidateId: number, examId: number): Promise<CandidateStartAttemptResponse> {
  return request<CandidateStartAttemptResponse>("candidate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId, examId })
  });
}

export async function saveCandidateAnswer(attemptId: number, questionId: number, selectedOptionId: number | null): Promise<any> {
  return request<any>(`candidate/answers?attemptId=${attemptId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, selectedOptionId })
  });
}

export async function submitCandidateAttempt(attemptId: number): Promise<SubmissionResponse> {
  return request<SubmissionResponse>(`candidate/submit?attemptId=${attemptId}`, {
    method: "POST"
  });
}

/* =========================================================================
   9. ROUND 2: CODING ASSESSMENT APIS (ADMIN & CANDIDATE)
   ========================================================================= */

export async function getAllCodingExams(): Promise<CodingExamDto[]> {
  return request<CodingExamDto[]>("admin/exams/coding");
}

export async function getCodingExamById(id: number | string): Promise<CodingExamDto> {
  return request<CodingExamDto>(`admin/exams/coding/${id}`);
}

export async function createCodingExam(exam: CodingExamDto): Promise<CodingExamDto> {
  return request<CodingExamDto>("admin/exams/coding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exam)
  });
}

export async function updateCodingExam(id: number | string, exam: CodingExamDto): Promise<CodingExamDto> {
  return request<CodingExamDto>(`admin/exams/coding/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(exam)
  });
}

export async function publishCodingExam(id: number | string): Promise<CodingExamDto> {
  return request<CodingExamDto>(`admin/exams/coding/${id}/publish`, {
    method: "POST"
  });
}

export async function deleteCodingExam(id: number | string): Promise<{ success: boolean; message: string }> {
  return request<any>(`admin/exams/coding/${id}`, {
    method: "DELETE"
  });
}

export async function getCandidateCodingExam(examId: number | string): Promise<CodingExamDto> {
  return request<CodingExamDto>(`candidate/coding/exam/${examId}`);
}

export async function runCandidateCode(req: {
  language: string;
  code: string;
  input?: string;
  timeLimitMs?: number;
}): Promise<{
  output: string;
  error?: string | null;
  executionTimeMs: number;
  status: "SUCCESS" | "ERROR" | "TIMEOUT";
}> {
  return request<any>("candidate/coding/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
}

export async function submitCandidateCode(req: {
  examId: any;
  questionId: string;
  candidateId: number;
  language: string;
  code: string;
}): Promise<{
  success: boolean;
  status: "PASSED" | "PARTIAL" | "FAILED" | "ERROR";
  passedCount: number;
  totalCount: number;
  score: number;
  maxMarks: number;
  testCaseResults: any[];
  message: string;
}> {
  return request<any>("candidate/coding/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
}

/* Legacy helpers for compatibility with existing status banner */
export function setAdminCredentials(_u: string, _p: string): void {}
export function clearAdminCredentials(): void {}
export function hasAdminCredentials(): boolean { return false; }
