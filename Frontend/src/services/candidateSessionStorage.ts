import type {
  CandidateProfile,
  CandidateSession,
  SubmissionReceipt
} from "../types/candidate";

/**
 * Storage key versioned to prevent collisions and schema incompatibility.
 */
export const CANDIDATE_STORAGE_KEY = "secureexam:candidate-session:v1";

/** Default demo exam duration: 60 minutes in seconds */
export const DEMO_EXAM_DURATION_SECONDS = 60 * 60;
export const DEMO_EXAM_ID = "EXAM-DEMO-2026";
export const DEMO_TOTAL_QUESTIONS = 100;

/**
 * Loads the stored candidate session from localStorage.
 * Handles schema validation and corrupted JSON safely.
 */
export function loadCandidateSession(): CandidateSession | null {
  try {
    const raw = localStorage.getItem(CANDIDATE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CandidateSession>;

    // Validate schema shape and version
    if (
      !parsed ||
      parsed.version !== "v1" ||
      !parsed.sessionId ||
      !parsed.profile ||
      typeof parsed.profile !== "object" ||
      typeof parsed.profile.name !== "string" ||
      typeof parsed.profile.candidateId !== "string"
    ) {
      console.warn("[CandidateSession] Incompatible or malformed session found in storage. Clearing corrupted session.");
      try { localStorage.removeItem(CANDIDATE_STORAGE_KEY); } catch {}
      return null;
    }

    // Ensure answers and flags are guaranteed to be valid objects
    if (!parsed.answers || typeof parsed.answers !== "object") {
      parsed.answers = {};
    }
    if (!Array.isArray(parsed.flags)) {
      parsed.flags = [];
    }

    return parsed as CandidateSession;
  } catch (error) {
    console.error("[CandidateSession] Failed to read from localStorage:", error);
    try { localStorage.removeItem(CANDIDATE_STORAGE_KEY); } catch {}
    return null;
  }
}

/**
 * Persists the candidate session to localStorage.
 * Returns true if successful, false if quota exceeded or storage disabled.
 *
 * NOTE: localStorage is a browser-only client-side storage mechanism.
 * It is NOT tamper-proof, does not replace server-side persistence,
 * and should never store passwords, security tokens, or media streams.
 */
export function saveCandidateSession(session: CandidateSession): boolean {
  try {
    localStorage.setItem(CANDIDATE_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch (error) {
    console.error("[CandidateSession] Failed to persist session to localStorage:", error);
    return false;
  }
}

/**
 * Creates a fresh CandidateSession with computed start timestamp and absolute deadline.
 */
export function createCandidateSession(
  profile: CandidateProfile,
  durationSeconds: number = DEMO_EXAM_DURATION_SECONDS
): CandidateSession {
  const now = Date.now();
  const sessionId = `sess_${now}_${Math.random().toString(36).substring(2, 8)}`;
  const deadline = now + durationSeconds * 1000;

  const session: CandidateSession = {
    version: "v1",
    sessionId,
    examId: DEMO_EXAM_ID,
    profile: {
      name: profile.name.trim(),
      department: profile.department,
      candidateId: profile.candidateId.trim().toUpperCase()
    },
    answers: {},
    flags: [],
    currentQuestionIndex: 0,
    startTime: now,
    deadline,
    durationSeconds,
    isSubmitted: false,
    submittedAt: null,
    receiptId: null,
    submissionReason: null
  };

  saveCandidateSession(session);
  return session;
}

/**
 * Shared, idempotent finalization function.
 * Called identically by:
 * 1. Candidate clicking Submit and confirming.
 * 2. Exam countdown timer reaching 0.
 * 3. Candidate clicking Exit and confirming.
 *
 * If the session is already submitted, this returns the existing finalized session
 * and receipt without mutating state or creating duplicate submissions.
 */
export function finalizeCandidateSession(
  reason: "manual_submit" | "timer_expired" | "candidate_exit"
): { session: CandidateSession; receipt: SubmissionReceipt } | null {
  const session = loadCandidateSession();
  if (!session) return null;

  // Idempotency check: if already submitted, do not re-finalize or generate new receipt
  if (session.isSubmitted && session.receiptId && session.submittedAt) {
    const answeredCount = Object.keys(session.answers).length;
    const receipt: SubmissionReceipt = {
      receiptId: session.receiptId,
      sessionId: session.sessionId,
      examId: session.examId,
      candidateName: session.profile.name,
      candidateId: session.profile.candidateId,
      department: session.profile.department,
      answeredCount,
      unansweredCount: Math.max(0, DEMO_TOTAL_QUESTIONS - answeredCount),
      totalQuestions: DEMO_TOTAL_QUESTIONS,
      submittedAt: session.submittedAt,
      submissionReason: session.submissionReason || reason,
      isDemoReceipt: true
    };
    return { session, receipt };
  }

  const now = Date.now();
  const receiptId = `DEMO-REC-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const finalizedSession: CandidateSession = {
    ...session,
    isSubmitted: true,
    submittedAt: now,
    receiptId,
    submissionReason: reason
  };

  saveCandidateSession(finalizedSession);

  const answeredCount = Object.keys(finalizedSession.answers).length;
  const receipt: SubmissionReceipt = {
    receiptId,
    sessionId: finalizedSession.sessionId,
    examId: finalizedSession.examId,
    candidateName: finalizedSession.profile.name,
    candidateId: finalizedSession.profile.candidateId,
    department: finalizedSession.profile.department,
    answeredCount,
    unansweredCount: Math.max(0, DEMO_TOTAL_QUESTIONS - answeredCount),
    totalQuestions: DEMO_TOTAL_QUESTIONS,
    submittedAt: now,
    submissionReason: reason,
    isDemoReceipt: true
  };

  return { session: finalizedSession, receipt };
}

/**
 * Removes the candidate session from storage to allow demo restart.
 * Can only be called upon user confirmation outside active exam.
 */
export function clearCandidateSession(): void {
  try {
    localStorage.removeItem(CANDIDATE_STORAGE_KEY);
  } catch (error) {
    console.error("[CandidateSession] Failed to clear localStorage:", error);
  }
}
