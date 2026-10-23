/**
 * Candidate Examination Types
 * Strictly defined for the Candidate Examination Portal workflow.
 */

export type Department = string;

export interface CandidateProfile {
  name: string;
  department: Department;
  departmentId?: number;
  candidateId: string;
  dbCandidateId?: number;
  assignedExamId?: number;
  examTitle?: string;
  slotName?: string;
  questionSetCode?: string;
}

export interface ExamQuestion {
  id: number;
  topic: string;
  question: string;
  options: string[];
}

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface CandidateSession {
  version: "v1";
  sessionId: string;
  examId: string;
  backendAttemptId?: number;
  profile: CandidateProfile;
  /** Map of question number (1-based) to selected option index (0-based) */
  answers: Record<number, number>;
  /** List of flagged question numbers (1-based) */
  flags: number[];
  /** Current active question index (0-based) */
  currentQuestionIndex: number;
  /** Unix timestamp in ms when the exam was started */
  startTime: number;
  /** Unix timestamp in ms when the exam must automatically end */
  deadline: number;
  /** Total exam duration in seconds */
  durationSeconds: number;
  /** Whether the attempt has been finalized / submitted */
  isSubmitted: boolean;
  /** Unix timestamp in ms when finalized */
  submittedAt: number | null;
  /** Durable receipt ID generated upon finalization */
  receiptId: string | null;
  /** Reason for finalization (manual_submit, timer_expired, candidate_exit) */
  submissionReason: "manual_submit" | "timer_expired" | "candidate_exit" | null;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  qualificationStatus?: string;
  isPublished?: boolean;
}

export interface SubmissionReceipt {
  receiptId: string;
  sessionId: string;
  examId: string | number;
  candidateName: string;
  candidateId: string;
  department: Department;
  answeredCount: number;
  unansweredCount: number;
  totalQuestions: number;
  submittedAt: number;
  submissionReason: "manual_submit" | "timer_expired" | "candidate_exit";
  isDemoReceipt?: boolean;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  qualificationStatus?: string;
  isPublished?: boolean;
}

export interface ReadinessCheckState {
  javascript: "ready" | "error";
  responsiveness: "ready" | "needs_attention";
  secureContext: "ready" | "needs_attention";
  sebEnvironment: "ready" | "not_detected";
  camera: "idle" | "requesting" | "granted" | "denied" | "unsupported";
  microphone: "idle" | "requesting" | "granted" | "denied" | "unsupported";
}
