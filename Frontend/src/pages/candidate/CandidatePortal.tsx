import { useState, useEffect, useCallback } from "react";
import { useRouter } from "../../router";
import type { CandidateProfile, SubmissionReceipt } from "../../types/candidate";
import { type SubmissionResponse, submitCandidateAttempt } from "../../services/api";
import {
  loadCandidateSession,
  createCandidateSession,
  finalizeCandidateSession,
  clearCandidateSession,
  DEMO_TOTAL_QUESTIONS
} from "../../services/candidateSessionStorage";

import CandidateEntryPage from "./CandidateEntryPage";
import SystemCheckPage from "./SystemCheckPage";
import CandidateExamPage from "./CandidateExamPage";
import CandidateCodingExamPage from "./CandidateCodingExamPage";
import SubmissionConfirmationPage from "./SubmissionConfirmationPage";

export default function CandidatePortal() {
  const { path, navigate } = useRouter();

  // Temporary draft profile before starting exam
  const [draftProfile, setDraftProfile] = useState<CandidateProfile | null>(null);

  // Sync state with storage
  const [activeSession, setActiveSession] = useState(() => loadCandidateSession());

  // Function to build a SubmissionReceipt from a finalized CandidateSession
  const buildReceiptFromSession = useCallback((sess: NonNullable<ReturnType<typeof loadCandidateSession>>): SubmissionReceipt => {
    const answeredCount = Object.keys(sess?.answers || {}).length;
    const isBackend = typeof sess?.receiptId === "string" && (sess.receiptId.startsWith("SEB-") || sess.backendAttemptId !== undefined);
    return {
      receiptId: String(sess?.receiptId || `DEMO-REC-2026-${String(sess?.sessionId || "000000").slice(-6).toUpperCase()}`),
      sessionId: String(sess?.sessionId || ""),
      examId: sess?.examId || "EXAM-1",
      candidateName: sess?.profile?.name || "Candidate",
      candidateId: sess?.profile?.candidateId || "MCQ-REG001",
      department: sess?.profile?.department || "General",
      answeredCount,
      unansweredCount: Math.max(0, DEMO_TOTAL_QUESTIONS - answeredCount),
      totalQuestions: DEMO_TOTAL_QUESTIONS,
      submittedAt: typeof sess?.submittedAt === "number" ? sess.submittedAt : Date.now(),
      submissionReason: sess?.submissionReason || "manual_submit",
      isDemoReceipt: !isBackend,
      score: sess?.score,
      totalMarks: sess?.totalMarks,
      percentage: sess?.percentage,
      qualificationStatus: sess?.qualificationStatus,
      isPublished: sess?.isPublished
    };
  }, []);

  // Check state and enforce navigation guard rules
  useEffect(() => {
    const currentStored = loadCandidateSession();
    setActiveSession(currentStored);

    if (currentStored) {
      if (currentStored.isSubmitted) {
        // If already submitted, candidate must only see the confirmation screen
        if (path === "/candidate/exam" || path === "/candidate/system-check") {
          navigate("/candidate/submitted");
        }
      } else {
        // If an active session is in progress and candidate is at /candidate/submitted
        if (path === "/candidate/submitted") {
          navigate("/candidate/exam");
        }
      }
    } else {
      // No session exists: cannot access active exam or submitted page directly
      if (path === "/candidate/exam" || path === "/candidate/submitted") {
        navigate("/candidate");
      } else if (path === "/candidate/system-check" && !draftProfile) {
        navigate("/candidate");
      }
    }
  }, [path, navigate, draftProfile]);

  // Handlers
  const handleContinueToSystemCheck = (profile: CandidateProfile) => {
    setDraftProfile(profile);
    navigate("/candidate/system-check");
  };

  const handleBackToEntry = () => {
    navigate("/candidate");
  };

  const handleStartExam = () => {
    const profileToUse = draftProfile || activeSession?.profile;
    if (!profileToUse) {
      navigate("/candidate");
      return;
    }

    const newSession = createCandidateSession(profileToUse);
    setActiveSession(newSession);
    navigate("/candidate/exam");
  };

  const handleFinalizeExam = async (
    reason: "manual_submit" | "timer_expired" | "candidate_exit",
    backendResult?: SubmissionResponse
  ) => {
    let finalResult = backendResult;
    const currentSession = activeSession || loadCandidateSession();
    if (!finalResult && currentSession?.backendAttemptId) {
      try {
        finalResult = await submitCandidateAttempt(currentSession.backendAttemptId);
      } catch (err) {
        console.warn("[CandidatePortal] Fallback submit error:", err);
      }
    }

    const result = finalizeCandidateSession(reason);
    if (result) {
      if (finalResult) {
        result.session.receiptId = finalResult.receiptId;
        result.session.score = finalResult.score;
        result.session.totalMarks = finalResult.totalMarks;
        result.session.percentage = finalResult.percentage;
        result.session.qualificationStatus = finalResult.qualificationStatus;
        result.session.isPublished = finalResult.isPublished;
      }
      setActiveSession({ ...result.session });
    }
    navigate("/candidate/submitted");
  };

  const handleRestartDemo = () => {
    clearCandidateSession();
    setActiveSession(null);
    setDraftProfile(null);
    navigate("/candidate");
  };

  const handleResumeActiveSession = () => {
    const session = loadCandidateSession();
    if (!session) {
      navigate("/candidate");
      return;
    }
    if (session.isSubmitted) {
      navigate("/candidate/submitted");
    } else {
      navigate("/candidate/exam");
    }
  };

  // Route 1: Submitted Confirmation Screen (Strictly on /candidate/submitted)
  if (path === "/candidate/submitted") {
    const session = activeSession || loadCandidateSession();
    if (session && session.isSubmitted) {
      const receipt = buildReceiptFromSession(session);
      return (
        <SubmissionConfirmationPage
          receipt={receipt}
          onRestartDemo={handleRestartDemo}
        />
      );
    }
  }

  // Route 2: Active Exam Page
  if (path === "/candidate/exam") {
    const session = activeSession || loadCandidateSession();
    if (session && !session.isSubmitted) {
      const isCoding = session.profile?.round === "ROUND_2" || session.profile?.questionSetCode === "CODING";
      if (isCoding) {
        return (
          <CandidateCodingExamPage
            initialSession={session}
            onFinalize={handleFinalizeExam}
          />
        );
      }
      return (
        <CandidateExamPage
          initialSession={session}
          onFinalize={handleFinalizeExam}
        />
      );
    }
  }

  // Route 3: System Compatibility & Hardware Check Page
  if (path === "/candidate/system-check") {
    const profile = draftProfile || activeSession?.profile;
    if (profile) {
      return (
        <SystemCheckPage
          profile={profile}
          onBack={handleBackToEntry}
          onStartExam={handleStartExam}
        />
      );
    }
  }

  // Route 4: Default Candidate Entry Page (/candidate)
  return (
    <CandidateEntryPage
      onContinue={handleContinueToSystemCheck}
      onResumeActiveSession={handleResumeActiveSession}
    />
  );
}
