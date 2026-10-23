export interface AdminDashboardResponse {
  application: string;
  status: string;
  totalExams: number;
  totalCandidates: number;
  activeExams: number;
  message: string;
}

export type ExamStatus = "UPCOMING" | "LIVE" | "COMPLETED" | "DRAFT";

export interface Exam {
  id: string;
  title: string;
  description?: string;
  examDate: string;
  startTime: string;
  durationMinutes: number;
  totalQuestions: number;
  candidateCount: number;
  status: ExamStatus;
  timingMode?: "SCHEDULED" | "DURATION_FROM_START";
  totalMarks: number;
  marksPerCorrect: number;
  negativeMarking: number;
  candidateAssignment: "ALL" | "BATCH" | "MANUAL";
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOption: number; // 0, 1, 2, 3 -> A, B, C, D
  subject: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  marks: number;
}

export type CandidateAttemptStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "DISQUALIFIED";
export type CandidateSubmissionStatus = "PENDING" | "SUBMITTED" | "EXPIRED";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  assignedExam: string;
  attemptStatus: CandidateAttemptStatus;
  submissionStatus: CandidateSubmissionStatus;
  submittedAt?: string;
  score?: number;
}

export interface RecentActivity {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  type: "EXAM" | "CANDIDATE" | "SECURITY" | "SYSTEM";
}

export interface UpcomingSchedule {
  id: string;
  title: string;
  date: string;
  time: string;
  candidateCount: number;
  durationMinutes: number;
}

export * from "./candidate";
export * from "./adminExam";

