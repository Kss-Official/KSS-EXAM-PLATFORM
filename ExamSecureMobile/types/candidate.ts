/**
 * ExamSecure Mobile — Candidate Types
 * Identical to the web app types for API compatibility
 */

export type Department = string;

export interface CandidateProfile {
  name: string;
  email: string;
  department: Department;
  departmentId?: number;
  departmentCategory?: 'TECHNICAL' | 'NON_TECHNICAL';
  collegeName?: string;
  collegeId?: number;
  candidateId?: string;
  dbCandidateId?: number;
  assignedExamId?: number;
  examTitle?: string;
  slotName?: string;
  questionSetCode?: string;
  jobRole?: string;
  skills?: string[];
  degreeBranch?: string;
  graduationYear?: string;
}

export interface ExamQuestion {
  id: number;
  displayOrder?: number;
  questionText: string;
  question?: string;
  topic?: string;
  options: ExamQuestionOption[];
  marks?: number;
  negativeMarks?: number;
}

export interface ExamQuestionOption {
  id: number;
  optionText: string;
  displayOrder?: number;
  label?: string;
}

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

export interface CandidateSession {
  version: 'v1';
  sessionId: string;
  examId: string;
  backendAttemptId?: number;
  profile: CandidateProfile;
  answers: Record<number, number>;
  flags: number[];
  currentQuestionIndex: number;
  startTime: number;
  deadline: number;
  durationSeconds: number;
  isSubmitted: boolean;
  submittedAt: number | null;
  receiptId: string | null;
  submissionReason: 'manual_submit' | 'timer_expired' | 'candidate_exit' | null;
  timeTakenSeconds?: number;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  qualificationStatus?: string;
  isPublished?: boolean;
  questions?: ExamQuestion[];
  assignedSet?: string;
  serverOffset?: number;
}

export interface SubmissionReceipt {
  receiptId: string;
  sessionId: string;
  examId: string | number;
  candidateName: string;
  candidateEmail?: string;
  candidateId?: string;
  department: Department;
  answeredCount: number;
  unansweredCount: number;
  totalQuestions: number;
  submittedAt: number;
  timeTakenSeconds?: number;
  submissionReason: 'manual_submit' | 'timer_expired' | 'candidate_exit';
  isDemoReceipt?: boolean;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  qualificationStatus?: string;
  isPublished?: boolean;
}

export interface DepartmentDto {
  id: number;
  name: string;
  code: string;
  category?: 'TECHNICAL' | 'NON_TECHNICAL';
  active: boolean;
}
