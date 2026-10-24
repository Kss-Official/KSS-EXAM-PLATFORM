import type { ExamStatus } from "./index";

export type ExamTimingMode = "SCHEDULED" | "DURATION_FROM_START";

export type QuestionSetKey = "SET_A" | "SET_B" | "SET_C" | "SET_D";

export interface QuestionOption {
  id: string; // stable internal ID (e.g. "opt_1", "opt_2")
  label: "A" | "B" | "C" | "D";
  text: string;
}

export interface AdminQuestion {
  id: string; // stable ID (e.g. "Q-101")
  setKey: QuestionSetKey;
  questionNumber: number;
  text: string;
  options: QuestionOption[];
  correctOptionId: string; // references option.id
  marks: number;
  subject?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
}

export interface AnswerKeyEntry {
  questionNumber: number;
  correctLetter: "A" | "B" | "C" | "D";
  resolvedOptionId?: string;
}

export interface AnswerKeyDraft {
  setKey: QuestionSetKey;
  fileName?: string;
  fileSize?: string;
  uploadedAt: string;
  entries: Record<number, "A" | "B" | "C" | "D">;
  isValidated: boolean;
  validationErrors: string[];
  isDemoDraft: true;
}

export interface QuestionSetSummary {
  setKey: QuestionSetKey;
  title: string;
  totalQuestions: number;
  validQuestionsCount: number;
  incompleteQuestionsCount: number;
  totalMarks: number;
  hasAnswerKey: boolean;
  answerKeyStatus: "VALIDATED" | "PENDING" | "MISSING" | "ERROR";
}

export interface ExamBlueprintDraft {
  id: string;
  title: string;
  description: string;
  timingMode: ExamTimingMode;
  examDate: string;
  startTime?: string;
  calculatedEndTime?: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  marksPerCorrect: number;
  negativeMarking: number;
  candidateAssignment: "ALL" | "BATCH" | "MANUAL";
  candidateCount: number;
  status: ExamStatus;
  questionSets: Record<QuestionSetKey, AdminQuestion[]>;
  answerKeys: Partial<Record<QuestionSetKey, AnswerKeyDraft>>;
  isLocalDraft: true;
  createdAt: string;
  updatedAt: string;
}

export interface LocalScoringRule {
  marksPerCorrect: number;
  negativeMarking: number;
  allowNegativeTotal: boolean;
}

export interface LocalScoringResult {
  candidateId: string;
  candidateName: string;
  department: string;
  setKey: QuestionSetKey;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number;
  wrongCount: number;
  calculatedScore: number;
  maxScore: number;
  percentage: number;
  status: "Submitted" | "Scored" | "Pending Review" | "Approved" | "Published";
  isDemoScore: true;
  notes?: string;
}
