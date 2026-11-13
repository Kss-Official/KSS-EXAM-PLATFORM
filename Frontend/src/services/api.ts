function getSanitizedApiBaseUrl(): string {
  let raw = (import.meta.env.VITE_API_BASE_URL as string)?.trim() || "/api";
  if (raw === "/api" || raw === "") return "/api";
  if (!raw.startsWith("http://") && !raw.startsWith("https://") && !raw.startsWith("/")) {
    raw = `https://${raw}`;
  }
  raw = raw.replace(/\/+$/, "");
  if (raw !== "/api" && !raw.endsWith("/api")) {
    raw = `${raw}/api`;
  }
  return raw;
}

export const API_BASE_URL: string = getSanitizedApiBaseUrl();

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
  token?: string;
}

export interface DepartmentDto {
  id: number;
  name: string;
  code: string;
  category?: "TECHNICAL" | "NON_TECHNICAL";
  description?: string;
  active: boolean;
  createdAt?: string;
  associatedExamsCount?: number;
  candidatesCount?: number;
}

export interface ExamDto {
  id: number;
  title: string;
  description?: string;
  durationMinutes: number;
  totalQuestions: number;
  status: "ACTIVATED" | "DEACTIVATED" | "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED";
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
  collegeId?: number;
  collegeName?: string;
  batch?: string;
  examDate?: string;
  status: string;
  createdAt?: string;
}

export interface CollegeDto {
  id: number;
  name: string;
  code?: string;
  description?: string;
  active: boolean;
  createdAt?: string;
  candidatesCount?: number;
}

export interface PaginatedCandidatesResponse {
  items: CandidateDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CandidateQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: number;
  collegeId?: number;
  batch?: string;
  date?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  all?: boolean;
}

export interface CandidateVerifyRequest {
  fullName: string;
  email: string;
  department: string;
  name?: string;
  departmentName?: string;
  departmentId?: number;
  college?: string;
  collegeName?: string;
  collegeId?: number;
  registrationNumber?: string;
}

export interface CandidateVerifyResponse {
  eligible: boolean;
  message: string;
  candidateId?: number;
  registrationNumber?: string;
  fullName?: string;
  candidateName?: string;
  email?: string;
  departmentName?: string;
  departmentCategory?: "TECHNICAL" | "NON_TECHNICAL" | string;
  collegeName?: string;
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
  token?: string;
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
  serverTime?: string;
  durationMinutes?: number;
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
  totalQuestions?: number;
  questionsAnswered?: number;
  correctAnswers?: number;
  incorrectAnswers?: number;
  unansweredQuestions?: number;
  durationSeconds?: number;
  startedAt?: string;
  createdAt?: string;
  examDate?: string;
  candidateCode?: string;
  questionSetCode?: string;
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
  slotNumber?: number | null;
  attemptStatus: string;
  answeredCount: number;
  unansweredCount: number;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  qualificationThreshold?: number;
  qualificationStatus?: string;
  resultsPublished: boolean;
  isPublished?: boolean;
  submittedAt?: string;
  receiptId?: string;
  candidateEmail?: string;
  candidateBatch?: string;
  totalQuestions?: number;
  questionsAnswered?: number;
  correctAnswers?: number;
  incorrectAnswers?: number;
  durationSeconds?: number;
  startedAt?: string;
  createdAt?: string;
  examDate?: string;
  candidateCode?: string;
  questionSetCode?: string;
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

interface AdminCacheItem<T> {
  data: T;
  timestamp: number;
}
const adminGetCache = new Map<string, AdminCacheItem<any>>();
const inFlightAdminRequests = new Map<string, Promise<any>>();

export function invalidateAdminCache(prefix?: string): void {
  if (!prefix) {
    adminGetCache.clear();
    return;
  }
  for (const k of adminGetCache.keys()) {
    if (k.startsWith(prefix)) {
      adminGetCache.delete(k);
    }
  }
}

/**
 * Common fetch wrapper with HttpOnly cookie credentials support
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const isCandidateRoute = cleanEndpoint.startsWith("candidate/");
  const method = (options.method || "GET").toUpperCase();
  const isGetMethod = method === "GET";
  const isLiveMonitoring = cleanEndpoint.startsWith("admin/live-monitoring");

  // Invalidate admin cache on any mutation (POST, PUT, DELETE)
  if (!isCandidateRoute && !isGetMethod) {
    adminGetCache.clear();
  }

  // Fast Memory SWR Cache for Admin GET calls (maxAge 15s for standard pages). Never cache live-monitoring routes so proctor alerts and timers are always real-time!
  if (!isCandidateRoute && isGetMethod && !isLiveMonitoring && options.cache !== "no-store") {
    const cached = adminGetCache.get(cleanEndpoint);
    if (cached && (Date.now() - cached.timestamp < 15000)) {
      return Promise.resolve(cached.data as T);
    }

    if (inFlightAdminRequests.has(cleanEndpoint)) {
      return inFlightAdminRequests.get(cleanEndpoint) as Promise<T>;
    }
  }

  const url = `${API_BASE_URL.replace(/\/+$/, "")}/${cleanEndpoint}`;
  
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  const token = isCandidateRoute
    ? (localStorage.getItem("examsecure_candidate_token") || localStorage.getItem("examsecure_auth_token"))
    : (localStorage.getItem("examsecure_admin_token") || localStorage.getItem("examsecure_auth_token"));

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const executeFetch = async (): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        credentials: "include",
        headers,
      });
    } catch (err: unknown) {
      inFlightAdminRequests.delete(cleanEndpoint);
      throw new ApiError(
        "Temporary network hiccup on your device. Please ensure your Wi-Fi is connected, wait 3 seconds, and try again.",
        0,
        { isCorsOrNetworkError: true }
      );
    }

    if (!response.ok) {
      inFlightAdminRequests.delete(cleanEndpoint);
      let errorDetail = "";
      try {
        const data = await response.json();
        const detailStr = typeof data.detail === "string" 
          ? data.detail 
          : (Array.isArray(data.detail) ? data.detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join("; ") : null);
        errorDetail = detailStr || data.message || data.error || JSON.stringify(data);
      } catch {
        try {
          errorDetail = await response.text();
        } catch {
          errorDetail = response.statusText;
        }
      }

      if (response.status === 401) {
        if (!isCandidateRoute) {
          localStorage.removeItem("examsecure_admin_token");
          localStorage.removeItem("examsecure_auth_token");
        } else {
          localStorage.removeItem("examsecure_candidate_token");
        }
        throw new ApiError(
          errorDetail || "401 Unauthorized: Authentication is required for this endpoint.",
          401,
          { isAuthError: true, backendMessage: errorDetail }
        );
      }

      if (response.status === 403) {
        throw new ApiError(
          errorDetail || "403 Forbidden: Access denied. SUPER_ADMIN role is required.",
          403,
          { isAuthError: true, backendMessage: errorDetail }
        );
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new ApiError(
          "Temporary network delay. Please wait a few seconds and try again.",
          response.status,
          { isCorsOrNetworkError: true, backendMessage: errorDetail }
        );
      }

      const cleanDetail = (errorDetail && !errorDetail.includes("<html") && !errorDetail.includes("<!DOCTYPE") && errorDetail.length < 150)
        ? errorDetail
        : "Unable to process request right now. Please try again.";
      throw new ApiError(
        cleanDetail,
        response.status,
        { backendMessage: errorDetail }
      );
    }

    const result = await response.json() as T;
    if (!isCandidateRoute && isGetMethod) {
      adminGetCache.set(cleanEndpoint, { data: result, timestamp: Date.now() });
      inFlightAdminRequests.delete(cleanEndpoint);
    }
    return result;
  };

  if (!isCandidateRoute && isGetMethod && options.cache !== "no-store") {
    const promise = executeFetch();
    inFlightAdminRequests.set(cleanEndpoint, promise);
    return promise;
  }

  return executeFetch();
}

/* =========================================================================
   1. AUTHENTICATION APIS
   ========================================================================= */

export async function loginAdmin(email: string, password: string): Promise<AuthResponseDto> {
  const res = await request<AuthResponseDto>("auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password })
  });
  if (res.token) {
    localStorage.setItem("examsecure_admin_token", res.token);
    localStorage.setItem("examsecure_auth_token", res.token);
  }
  return res;
}

export async function getAuthMe(): Promise<AuthUser> {
  return request<AuthUser>("auth/me");
}

export async function logoutAdmin(): Promise<void> {
  localStorage.removeItem("examsecure_admin_token");
  localStorage.removeItem("examsecure_auth_token");
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

/* =========================================================================
   3. DEPARTMENT MANAGEMENT APIS
   ========================================================================= */

export async function getAllDepartments(params?: { type?: "academic" | "college" | "all" }): Promise<DepartmentDto[]> {
  const query = params?.type ? `?type=${params.type}` : "";
  return request<DepartmentDto[]>(`admin/departments${query}`);
}

export async function getActiveDepartments(params?: { type?: "academic" | "college" | "all" }): Promise<DepartmentDto[]> {
  const query = params?.type ? `?type=${params.type}` : "";
  return request<DepartmentDto[]>(`admin/departments/active${query}`);
}

export async function getAllColleges(): Promise<DepartmentDto[]> {
  return request<DepartmentDto[]>("admin/departments/colleges");
}

export async function getCandidateDepartments(): Promise<DepartmentDto[]> {
  return request<DepartmentDto[]>("candidate/departments");
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
   3b. COLLEGE / INSTITUTION MANAGEMENT APIS
   ========================================================================= */

export async function getColleges(): Promise<CollegeDto[]> {
  return request<CollegeDto[]>("admin/colleges");
}

export async function getActiveColleges(): Promise<CollegeDto[]> {
  return request<CollegeDto[]>("admin/colleges/active");
}

export async function createCollege(college: Partial<CollegeDto>): Promise<CollegeDto> {
  return request<CollegeDto>("admin/colleges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(college)
  });
}

export async function updateCollege(id: number, college: Partial<CollegeDto>): Promise<CollegeDto> {
  return request<CollegeDto>(`admin/colleges/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(college)
  });
}

export async function deleteCollege(id: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`admin/colleges/${id}`, {
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

export const activateExam = publishExam;

export async function closeExam(id: number): Promise<ExamDto> {
  return request<ExamDto>(`admin/exams/${id}/close`, { method: "POST" });
}

export const deactivateExam = closeExam;

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
  const headers = new Headers();
  const token = localStorage.getItem("examsecure_auth_token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
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
  const headers = new Headers();
  const token = localStorage.getItem("examsecure_auth_token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
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

export async function getCandidates(params?: CandidateQueryParams): Promise<PaginatedCandidatesResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search && params.search.trim()) query.set("search", params.search.trim());
  if (params?.departmentId !== undefined) query.set("departmentId", String(params.departmentId));
  if (params?.collegeId !== undefined) query.set("collegeId", String(params.collegeId));
  if (params?.batch && params.batch !== "ALL") query.set("batch", params.batch);
  if (params?.date && params.date !== "ALL") query.set("date", params.date);
  if (params?.status && params.status !== "ALL") query.set("status", params.status);
  if (params?.sortBy) query.set("sortBy", params.sortBy);
  if (params?.sortOrder) query.set("sortOrder", params.sortOrder);
  if (params?.all) query.set("all", "true");

  const qs = query.toString();
  return request<PaginatedCandidatesResponse>(`admin/candidates${qs ? `?${qs}` : ""}`);
}

export async function getAllCandidates(date?: string): Promise<CandidateDto[]> {
  const query = new URLSearchParams();
  query.set("all", "true");
  if (date && date !== "ALL") query.set("date", date);
  const res = await request<PaginatedCandidatesResponse | CandidateDto[]>(`admin/candidates?${query.toString()}`);
  if (Array.isArray(res)) return res;
  return res.items || [];
}

export async function getAvailableCandidateDates(): Promise<string[]> {
  return request<string[]>("admin/candidates/dates");
}

export async function getCandidateDateCounts(): Promise<{ [d: string]: number }> {
  return request<{ [d: string]: number }>("admin/candidates/date-counts");
}

export async function getCandidateSlotCounts(date?: string): Promise<{ total: number; slot1: number; slot2: number; slot3: number; unassigned?: number }> {
  const query = new URLSearchParams();
  if (date && date !== "ALL") query.set("date", date);
  const qs = query.toString();
  return request<{ total: number; slot1: number; slot2: number; slot3: number; unassigned?: number }>(`admin/candidates/slot-counts${qs ? `?${qs}` : ""}`);
}

export async function createCandidate(cand: Partial<CandidateDto>): Promise<CandidateDto> {
  return request<CandidateDto>("admin/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cand)
  });
}

export async function updateCandidate(id: number, cand: Partial<CandidateDto>): Promise<CandidateDto> {
  return request<CandidateDto>(`admin/candidates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cand)
  });
}

export async function batchAssignCandidateBatch(
  candidateIds: number[], 
  batch: string | null
): Promise<{ success: boolean; updatedCount: number; batch?: string }> {
  return request<{ success: boolean; updatedCount: number; batch?: string }>("admin/candidates/batch-assign-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateIds, batch })
  });
}

export async function assignCandidateBatch(
  candidateId: number, 
  batch: string | null
): Promise<{ success: boolean; candidateId: number; batch?: string }> {
  return request<{ success: boolean; candidateId: number; batch?: string }>(`admin/candidates/${candidateId}/assign-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch })
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
  const headers = new Headers();
  const token = localStorage.getItem("examsecure_auth_token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
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

/* =========================================================================
   7. RESULTS APIS
   ========================================================================= */

export async function getAllResults(examId?: number, date?: string): Promise<ExamResultDto[]> {
  const params = new URLSearchParams();
  if (date && date !== "ALL") {
    params.set("date", date);
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  const endpoint = examId ? `admin/results/exam/${examId}${qs}` : `admin/results${qs}`;
  return request<ExamResultDto[]>(endpoint);
}

export async function getAvailableResultDates(): Promise<string[]> {
  return request<string[]>("admin/results/dates");
}

export async function getResultDateCounts(): Promise<Record<string, number>> {
  return request<Record<string, number>>("admin/results/date-counts");
}

export async function publishResults(examId: number, published: boolean): Promise<any> {
  return request<any>(`admin/results/exam/${examId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ published })
  });
}

export async function resetCandidateAttempt(attemptId: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`admin/results/attempt/${attemptId}/reset`, {
    method: "POST"
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

export async function saveCandidateAnswer(
  attemptId: number,
  questionId: number,
  selectedOptionId: number | null,
  candidateId?: number | null
): Promise<any> {
  return request<any>(`candidate/answers?attemptId=${attemptId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, selectedOptionId, candidateId })
  });
}

export async function submitCandidateAttempt(
  attemptId: number,
  answers?: Record<number, number>,
  candidateId?: number | null
): Promise<SubmissionResponse> {
  return request<SubmissionResponse>(`candidate/submit?attemptId=${attemptId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId, answers, candidateId })
  });
}

export async function rescheduleCandidateSlot(
  candidateId: number,
  data: { targetSlot?: string; resetAttempt?: boolean; reason?: string }
): Promise<{ success: boolean; message: string; candidateId: number; newSlot: string }> {
  return request<{ success: boolean; message: string; candidateId: number; newSlot: string }>(
    `admin/candidates/${candidateId}/reschedule-slot`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetSlot: data.targetSlot || "Slot 2",
        resetAttempt: data.resetAttempt ?? true,
        reason: data.reason || "Admin slot reschedule"
      })
    }
  );
}

export async function batchRescheduleCandidateSlot(
  data: { candidateIds: number[]; targetSlot?: string; resetAttempt?: boolean; reason?: string }
): Promise<{ success: boolean; rescheduledCount: number; message: string }> {
  return request<{ success: boolean; rescheduledCount: number; message: string }>(
    `admin/candidates/batch-reschedule-slot`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateIds: data.candidateIds,
        targetSlot: data.targetSlot || "Slot 2",
        resetAttempt: data.resetAttempt ?? true,
        reason: data.reason || "Batch slot reschedule"
      })
    }
  );
}

export interface SlotInfo {
  header: string;
  sub: string;
  btn: string;
  startTime: string;
  cutoffTime: string;
  startMinutes?: number;
  cutoffMinutes?: number;
}

export interface SlotTimingsConfig {
  slot1: SlotInfo;
  slot2: SlotInfo;
  slot3?: SlotInfo;
}

export async function getSlotTimings(): Promise<SlotTimingsConfig> {
  const result = await request<SlotTimingsConfig>("admin/candidates/slot-timings", { cache: "no-store" });
  if (result && result.slot1) {
    try {
      localStorage.setItem("examsecure_slot_timings_v1", JSON.stringify(result));
    } catch {}
  }
  return result;
}

export async function updateSlotTimings(data: Partial<SlotTimingsConfig>): Promise<SlotTimingsConfig> {
  const result = await request<SlotTimingsConfig>("admin/candidates/slot-timings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  adminGetCache.delete("admin/candidates/slot-timings");
  if (result && result.slot1) {
    try {
      localStorage.setItem("examsecure_slot_timings_v1", JSON.stringify(result));
    } catch {}
  }
  return result;
}

/* =========================================================================
   Live Exam Monitoring, Proctoring Cheating Alerts & Live Controls
   ========================================================================= */

export interface LiveExamineeDto {
  candidateId: number;
  registrationNumber: string;
  fullName: string;
  email: string;
  department?: string;
  college?: string;
  batch?: string;
  examDate?: string;
  assignedSet?: string;
  attemptId?: number;
  status: string;
  startedAt?: string;
  expiresAt?: string;
  extraTimeMinutes: number;
  questionsAnswered: number;
  totalQuestions: number;
  remainingSeconds: number;
  alertsCount: number;
  lastAlert?: {
    id: number;
    alertType: string;
    severity: string;
    message: string;
    status: string;
    createdAt?: string;
  };
  terminationReason?: string;
}

export interface ProctorAlertDto {
  id: number;
  candidateId: number;
  candidateName: string;
  registrationNumber: string;
  department?: string;
  attemptId?: number;
  alertType: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  status: "NEW" | "REVIEWED" | "DISMISSED" | "ACTION_TAKEN";
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export async function getLiveExaminees(params?: { date?: string; batch?: string; search?: string }): Promise<LiveExamineeDto[]> {
  const query = new URLSearchParams();
  if (params?.date) query.set("date", params.date);
  if (params?.batch) query.set("batch", params.batch);
  if (params?.search) query.set("search", params.search);
  const qStr = query.toString();
  return request<LiveExamineeDto[]>(`admin/live-monitoring/examinees${qStr ? `?${qStr}` : ""}`);
}

export async function giveExtraTime(candidateId: number, attemptId?: number, extraMinutes: number = 10): Promise<{
  success: boolean;
  message: string;
  attemptId: number;
  expiresAt: string;
  extraTimeMinutes: number;
}> {
  return request("admin/live-monitoring/give-extra-time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId, attemptId, extraMinutes })
  });
}

export async function stopCandidateExam(candidateId: number, attemptId?: number, reason: string = "Examination stopped by administrator."): Promise<{
  success: boolean;
  message: string;
  status: string;
}> {
  return request("admin/live-monitoring/stop-exam", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId, attemptId, reason })
  });
}

export async function getProctorAlerts(params?: { candidateId?: number; status?: string; limit?: number }): Promise<ProctorAlertDto[]> {
  const query = new URLSearchParams();
  if (params?.candidateId) query.set("candidateId", String(params.candidateId));
  if (params?.status) query.set("status", params.status);
  if (params?.limit) query.set("limit", String(params.limit));
  const qStr = query.toString();
  return request<ProctorAlertDto[]>(`admin/live-monitoring/alerts${qStr ? `?${qStr}` : ""}`);
}

export async function reviewProctorAlert(alertId: number, status: string = "REVIEWED"): Promise<{ success: boolean }> {
  return request(`admin/live-monitoring/alerts/${alertId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
}

export async function getCandidateAlertHistory(candidateId: number): Promise<ProctorAlertDto[]> {
  return request<ProctorAlertDto[]>(`admin/live-monitoring/alerts/history/${candidateId}`);
}

export async function getCandidateHeartbeat(candidateId: number, attemptId?: number): Promise<{
  status: string;
  attemptId?: number;
  expiresAt?: string;
  deadlineMs?: number;
  remainingSeconds?: number;
  extraTimeMinutes?: number;
  serverTime?: string;
  terminationReason?: string;
}> {
  const query = new URLSearchParams({ candidateId: String(candidateId) });
  if (attemptId) query.set("attemptId", String(attemptId));
  return request(`candidate/heartbeat?${query.toString()}`);
}

export async function reportProctorAlert(payload: {
  candidateId: number;
  attemptId?: number;
  alertType: string;
  message: string;
  severity?: string;
}): Promise<any> {
  return request("candidate/proctor/alert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}


/* Legacy helpers for compatibility with existing status banner */
export function setAdminCredentials(_u: string, _p: string): void {}
export function clearAdminCredentials(): void {}
export function hasAdminCredentials(): boolean { return false; }

