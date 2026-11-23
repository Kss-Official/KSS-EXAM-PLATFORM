import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Config ──────────────────────────────────────────────────────────────────
function resolveApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // When running in a web browser on localhost, route to localhost:8000 directly
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }
  }
  return 'https://kss-exam-platform-azad.vercel.app/api';
}

const API_BASE_URL = resolveApiBaseUrl();

// ─── Error Class ─────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Core Request ────────────────────────────────────────────────────────────
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}/${endpoint.replace(/^\//, '')}`;

  // Attach candidate token if available
  const token = await AsyncStorage.getItem('examsecure_candidate_token');
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'bypass-tunnel-reminder': 'true',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  // 30-second timeout to accommodate cold-starts and network fluctuations
  const timer = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (err: unknown) {
    const e = err as Error;
    const isTimeout = e.name === 'AbortError' || e.message?.toLowerCase().includes('abort');

    // Auto-fallback: If 192.168.1.14 failed and we can reach tunnel or localhost, try fallback
    if (!isTimeout) {
      const fallbackUrl = url.includes('192.168.1.14:8000') || url.includes('localhost:8000')
        ? `https://kss-exam-platform-azad.vercel.app/api/${endpoint.replace(/^\//, '')}`
        : null;

      if (fallbackUrl) {
        try {
          const fallbackRes = await fetch(fallbackUrl, { ...options, headers });
          if (fallbackRes.ok) {
            return (await fallbackRes.json()) as T;
          }
        } catch {
          // ignore fallback error and report primary
        }
      }
    }

    throw new ApiError(
      isTimeout
        ? 'Request timed out or cancelled. Check that the backend server is running.'
        : `Network error: ${e.message || 'Could not connect to server'}`,
      0,
      isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let errMsg = `Server error (${response.status})`;
    try {
      const errData = await response.json();
      errMsg = errData.detail || errData.message || errMsg;
    } catch { }
    throw new ApiError(errMsg, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

// ─── Department Endpoints ─────────────────────────────────────────────────────
export interface DepartmentDto {
  id: number;
  name: string;
  code: string;
  category?: 'TECHNICAL' | 'NON_TECHNICAL';
  active: boolean;
}

export async function getCandidateDepartments(): Promise<DepartmentDto[]> {
  return request<DepartmentDto[]>('candidate/departments');
}

// ─── Candidate Verification ──────────────────────────────────────────────────
export interface VerifyEligibilityRequest {
  fullName: string;
  name: string;
  email: string;
  department: string;
  departmentName: string;
  departmentId?: number;
}

export interface VerifyEligibilityResponse {
  eligible: boolean;
  message?: string;
  token?: string;
  candidateName?: string;
  email?: string;
  departmentCategory?: string;
  collegeName?: string;
  registrationNumber?: string;
  candidateId?: number;
  assignedExamId?: number;
  examTitle?: string;
  slotName?: string;
  questionSetCode?: string;
}

export async function verifyCandidateEligibility(
  payload: VerifyEligibilityRequest
): Promise<VerifyEligibilityResponse> {
  return request<VerifyEligibilityResponse>('candidate/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── Exam Start ───────────────────────────────────────────────────────────────
export interface StartAttemptRequest {
  candidateId: number;
  examId: number;
  departmentId?: number;
  questionSetCode?: string;
}

export interface StartAttemptResponse {
  attemptId: number;
  examId: number;
  durationSeconds?: number;
  totalDurationSeconds?: number;
  expiresAt?: string;
  deadlineAt?: string;
  serverTime?: string;
  questions: any[];
  assignedSet?: string;
  setCode?: string;
  questionSetCode?: string;
}

export async function startCandidateAttempt(
  payload: StartAttemptRequest
): Promise<StartAttemptResponse> {
  const res = await request<any>('candidate/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return {
    ...res,
    durationSeconds: res.durationSeconds || res.totalDurationSeconds || 3600,
    assignedSet: res.assignedSet || res.setCode || res.questionSetCode || 'A',
  };
}

// ─── Save Answer ──────────────────────────────────────────────────────────────
export interface SaveAnswerRequest {
  candidateId: number;
  attemptId: number;
  questionId: number;
  selectedOptionId: number;
  questionNumber?: number;
}

export async function saveCandidateAnswer(
  payload: SaveAnswerRequest
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('candidate/answers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── Submit Attempt ───────────────────────────────────────────────────────────
export interface SubmissionResponse {
  receiptId: string;
  attemptId: number;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  qualificationStatus?: string;
  totalQuestions?: number;
  durationSeconds?: number;
  submittedAt?: string;
  isPublished?: boolean;
}

export async function submitCandidateAttempt(
  candidateId: number,
  attemptId: number,
  answers?: Record<string | number, any>
): Promise<SubmissionResponse> {
  return request<SubmissionResponse>(`candidate/submit?attemptId=${attemptId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId, attemptId, answers }),
  });
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────
export interface HeartbeatResponse {
  status: string;
  attemptId?: number;
  expiresAt?: string;
  deadlineMs?: number;
  remainingSeconds?: number;
  extraTimeMinutes?: number;
  serverTime?: string;
  terminationReason?: string;
}

export async function getCandidateHeartbeat(
  candidateId: number,
  attemptId?: number
): Promise<HeartbeatResponse> {
  const params = new URLSearchParams({ candidateId: String(candidateId) });
  if (attemptId) params.set('attemptId', String(attemptId));
  return request<HeartbeatResponse>(`candidate/heartbeat?${params.toString()}`);
}

// ─── Proctor Alert ────────────────────────────────────────────────────────────
export async function reportProctorAlert(payload: {
  candidateId: number;
  attemptId?: number;
  alertType: string;
  message: string;
  severity?: string;
}): Promise<any> {
  return request('candidate/proctor/alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── Optical Proctor Frame Analysis ──────────────────────────────────────────
export async function analyzeProctorFrame(payload: {
  candidateId: number;
  attemptId?: number;
  imageBase64: string;
}): Promise<{
  success: boolean;
  facesDetected?: number;
  alert?: string | null;
  message?: string | null;
}> {
  return request('candidate/proctor/analyze-frame', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

