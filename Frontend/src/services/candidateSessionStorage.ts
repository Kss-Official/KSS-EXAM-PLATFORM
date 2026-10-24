import type {
  CandidateProfile,
  CandidateSession,
  SubmissionReceipt
} from "../types/candidate";

/**
 * Versioned storage keys for robust session isolation.
 * Uses sessionStorage for complete per-tab isolation, and candidate-scoped
 * localStorage keys to prevent cross-candidate data leakage.
 */
export const CANDIDATE_STORAGE_KEY = "secureexam:candidate-session:v1";
const SESSION_TAB_KEY = "secureexam:tab-session:v2";
const SESSION_ACTIVE_CANDIDATE_KEY = "secureexam:tab-candidate-id:v2";
const CANDIDATE_STORAGE_PREFIX = "secureexam:candidate-session:v2:";

/** Default demo exam duration: 60 minutes in seconds */
export const DEMO_EXAM_DURATION_SECONDS = 60 * 60;
export const DEMO_EXAM_ID = "EXAM-DEMO-2026";
export const DEMO_TOTAL_QUESTIONS = 60;

/**
 * Normalizes candidate identifier for safe storage keys.
 */
export function normalizeCandidateKey(candidateId?: string | null): string {
  if (!candidateId) return "UNKNOWN";
  return candidateId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
}

function parseAndValidateSession(raw: string | null, expectedCandidateId?: string): CandidateSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CandidateSession>;
    if (
      !parsed ||
      !parsed.sessionId ||
      !parsed.profile ||
      typeof parsed.profile !== "object" ||
      typeof parsed.profile.name !== "string" ||
      typeof parsed.profile.candidateId !== "string"
    ) {
      return null;
    }

    if (expectedCandidateId) {
      const expectedNorm = normalizeCandidateKey(expectedCandidateId);
      const sessionNorm = normalizeCandidateKey(parsed.profile.candidateId);
      if (expectedNorm !== sessionNorm && !sessionNorm.includes(expectedNorm) && !expectedNorm.includes(sessionNorm)) {
        return null;
      }
    }

    if (!parsed.answers || typeof parsed.answers !== "object") {
      parsed.answers = {};
    }
    if (!Array.isArray(parsed.flags)) {
      parsed.flags = [];
    }

    return parsed as CandidateSession;
  } catch {
    return null;
  }
}

/**
 * Loads the active candidate session with strict isolation.
 * 1. Checks tab-isolated sessionStorage first.
 * 2. If candidateId is provided or tab has an active candidate, checks candidate-scoped localStorage.
 * 3. Never returns a session belonging to another candidate.
 */
export function loadCandidateSession(candidateId?: string): CandidateSession | null {
  try {
    const activeTabCandId = candidateId || sessionStorage.getItem(SESSION_ACTIVE_CANDIDATE_KEY) || undefined;

    // Check tab-isolated session storage first
    const tabRaw = sessionStorage.getItem(SESSION_TAB_KEY);
    const tabSession = parseAndValidateSession(tabRaw, activeTabCandId);
    if (tabSession) {
      return tabSession;
    }

    // Check candidate-scoped persistent storage
    if (activeTabCandId) {
      const candKey = normalizeCandidateKey(activeTabCandId);
      const scopedRaw = localStorage.getItem(`${CANDIDATE_STORAGE_PREFIX}${candKey}`);
      const scopedSession = parseAndValidateSession(scopedRaw, activeTabCandId);
      if (scopedSession) {
        // Hydrate current tab session
        sessionStorage.setItem(SESSION_TAB_KEY, JSON.stringify(scopedSession));
        sessionStorage.setItem(SESSION_ACTIVE_CANDIDATE_KEY, scopedSession.profile.candidateId);
        return scopedSession;
      }
    }

    // Check legacy un-scoped key only if no specific candidate is targeted
    if (!candidateId) {
      const legacyRaw = localStorage.getItem(CANDIDATE_STORAGE_KEY);
      const legacySession = parseAndValidateSession(legacyRaw);
      if (legacySession) {
        // Upgrade to candidate-scoped key
        saveCandidateSession(legacySession);
        return legacySession;
      }
    }

    return null;
  } catch (error) {
    console.error("[CandidateSession] Failed to read session storage:", error);
    return null;
  }
}

/**
 * Persists the candidate session with strict isolation across tabs and candidates.
 */
export function saveCandidateSession(session: CandidateSession): boolean {
  try {
    const candId = session?.profile?.candidateId;
    if (!candId) return false;

    const candKey = normalizeCandidateKey(candId);
    const jsonStr = JSON.stringify(session);

    // Save to tab-isolated sessionStorage
    sessionStorage.setItem(SESSION_TAB_KEY, jsonStr);
    sessionStorage.setItem(SESSION_ACTIVE_CANDIDATE_KEY, candId);

    // Save to candidate-scoped localStorage for cross-refresh persistence
    localStorage.setItem(`${CANDIDATE_STORAGE_PREFIX}${candKey}`, jsonStr);

    // Mirror to legacy key for compatibility with components referencing it
    localStorage.setItem(CANDIDATE_STORAGE_KEY, jsonStr);

    return true;
  } catch (error) {
    console.error("[CandidateSession] Failed to persist session:", error);
    return false;
  }
}

/**
 * Creates a fresh CandidateSession with clean answers ({}) and flags ([]).
 * Guarantees zero pre-selected options or answer cross-contamination.
 */
export function createCandidateSession(
  profile: CandidateProfile,
  durationSeconds: number = DEMO_EXAM_DURATION_SECONDS
): CandidateSession {
  const now = Date.now();
  const sessionId = `sess_${now}_${Math.random().toString(36).substring(2, 8)}`;
  const deadline = now + durationSeconds * 1000;

  // Clear any existing session in the current tab from a different candidate
  try {
    sessionStorage.removeItem(SESSION_TAB_KEY);
    sessionStorage.removeItem(SESSION_ACTIVE_CANDIDATE_KEY);
  } catch {}

  const session: CandidateSession = {
    version: "v1",
    sessionId,
    examId: String(profile.assignedExamId || DEMO_EXAM_ID),
    backendAttemptId: undefined,
    profile: {
      ...profile,
      name: profile.name.trim(),
      department: profile.department,
      candidateId: profile.candidateId.trim().toUpperCase()
    },
    answers: {}, // Clean slate: no pre-selected answers
    flags: [],   // Clean slate: no pre-selected flags
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
 * Finalizes the candidate session and produces an authentic submission receipt.
 */
export function finalizeCandidateSession(
  reason: "manual_submit" | "timer_expired" | "candidate_exit",
  targetSession?: CandidateSession
): { session: CandidateSession; receipt: SubmissionReceipt } | null {
  const session = targetSession || loadCandidateSession();
  if (!session) return null;

  // Idempotency check: if already submitted, return existing finalized receipt
  if (session.isSubmitted && session.receiptId && session.submittedAt) {
    const answeredCount = Object.keys(session.answers || {}).length;
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
      isDemoReceipt: !session.backendAttemptId,
      score: session.score,
      totalMarks: session.totalMarks,
      percentage: session.percentage,
      qualificationStatus: session.qualificationStatus,
      isPublished: session.isPublished
    };
    return { session, receipt };
  }

  const now = Date.now();
  const receiptId = session.receiptId || `REC-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const finalizedSession: CandidateSession = {
    ...session,
    isSubmitted: true,
    submittedAt: now,
    receiptId,
    submissionReason: reason
  };

  saveCandidateSession(finalizedSession);

  const answeredCount = Object.keys(finalizedSession.answers || {}).length;
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
    isDemoReceipt: !finalizedSession.backendAttemptId,
    score: finalizedSession.score,
    totalMarks: finalizedSession.totalMarks,
    percentage: finalizedSession.percentage,
    qualificationStatus: finalizedSession.qualificationStatus,
    isPublished: finalizedSession.isPublished
  };

  return { session: finalizedSession, receipt };
}

/**
 * Clears the candidate session from current tab and candidate-scoped storage.
 */
export function clearCandidateSession(candidateId?: string): void {
  try {
    sessionStorage.removeItem(SESSION_TAB_KEY);
    sessionStorage.removeItem(SESSION_ACTIVE_CANDIDATE_KEY);

    if (candidateId) {
      const candKey = normalizeCandidateKey(candidateId);
      localStorage.removeItem(`${CANDIDATE_STORAGE_PREFIX}${candKey}`);
    }
    localStorage.removeItem(CANDIDATE_STORAGE_KEY);
  } catch (error) {
    console.error("[CandidateSession] Failed to clear session:", error);
  }
}
