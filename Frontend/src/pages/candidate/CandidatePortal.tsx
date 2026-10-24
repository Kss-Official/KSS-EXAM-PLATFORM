import { useState, useEffect, useCallback } from "react";
import { useRouter } from "../../router";
import type { CandidateProfile, SubmissionReceipt } from "../../types/candidate";
import type { SubmissionResponse } from "../../services/api";
import {
  loadCandidateSession,
  createCandidateSession,
  finalizeCandidateSession,
  clearCandidateSession,
  DEMO_TOTAL_QUESTIONS
} from "../../services/candidateSessionStorage";

import CandidateEntryPage from "./CandidateEntryPage";
import RoleApplicationPage from "./RoleApplicationPage";
import SystemCheckPage from "./SystemCheckPage";
import CandidateExamPage from "./CandidateExamPage";
import CandidateCodingExamPage from "./CandidateCodingExamPage";
import SubmissionConfirmationPage from "./SubmissionConfirmationPage";
import type { CandidateCodingSubmission } from "../../services/codingExamService";

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
    const isRound2 = sess?.profile?.assessmentRound === "ROUND_2";
    return {
      receiptId: String(sess?.receiptId || (isRound2 ? `CODE-REC-2026-${String(sess?.sessionId || "000000").slice(-6).toUpperCase()}` : `DEMO-REC-2026-${String(sess?.sessionId || "000000").slice(-6).toUpperCase()}`)),
      sessionId: String(sess?.sessionId || ""),
      examId: sess?.examId || (isRound2 ? "CODE-101" : "EXAM-1"),
      candidateName: sess?.profile?.name || "Candidate",
      candidateId: sess?.profile?.candidateId || "CAND-001",
      department: sess?.profile?.department || "General",
      answeredCount: isRound2 ? 3 : answeredCount,
      unansweredCount: isRound2 ? 0 : Math.max(0, DEMO_TOTAL_QUESTIONS - answeredCount),
      totalQuestions: isRound2 ? 3 : DEMO_TOTAL_QUESTIONS,
      submittedAt: typeof sess?.submittedAt === "number" ? sess.submittedAt : Date.now(),
      submissionReason: sess?.submissionReason || "manual_submit",
      isDemoReceipt: !isBackend,
      score: sess?.score,
      totalMarks: sess?.totalMarks,
      percentage: sess?.percentage,
      qualificationStatus: sess?.qualificationStatus,
      isPublished: sess?.isPublished,
      assessmentRound: sess?.profile?.assessmentRound,
      roundUniqueId: sess?.profile?.roundUniqueId,
      codingAttemptedCount: isRound2 ? 3 : undefined,
      codingSubmittedCount: isRound2 ? 3 : undefined
    };
  }, []);

  // Check state and enforce navigation guard rules
  useEffect(() => {
    const currentStored = loadCandidateSession();
    setActiveSession(currentStored);

    if (currentStored) {
      if (currentStored.isSubmitted) {
        // If already submitted, candidate must only see the confirmation screen
        if (path === "/candidate/exam" || path === "/candidate/coding" || path === "/candidate/system-check" || path === "/candidate/role-application") {
          navigate("/candidate/submitted");
        }
      } else {
        // If an active session is in progress and candidate is at /candidate/submitted
        if (path === "/candidate/submitted") {
          navigate(currentStored.profile?.assessmentRound === "ROUND_2" ? "/candidate/coding" : "/candidate/exam");
        }
      }
    } else {
      // No session exists: cannot access active exam, coding or submitted page directly
      if (path === "/candidate/exam" || path === "/candidate/coding" || path === "/candidate/submitted") {
        navigate("/candidate");
      } else if ((path === "/candidate/system-check" || path === "/candidate/role-application") && !draftProfile) {
        navigate("/candidate");
      }
    }
  }, [path, navigate, draftProfile]);

  // Handlers
  const handleContinueFromEntry = (profile: CandidateProfile) => {
    setDraftProfile(profile);
    // Round 2 navigates directly to Device Compatibility Check
    if (profile.assessmentRound === "ROUND_2") {
      navigate("/candidate/system-check");
    } else {
      navigate("/candidate/role-application");
    }
  };

  const handleBackToEntry = () => {
    navigate("/candidate");
  };

  const handleRoleApplicationContinue = (updatedProfile: CandidateProfile) => {
    setDraftProfile(updatedProfile);
    navigate("/candidate/system-check");
  };

  const handleBackToRoleApplication = () => {
    if (draftProfile?.assessmentRound === "ROUND_2") {
      navigate("/candidate");
    } else {
      navigate("/candidate/role-application");
    }
  };

  const handleStartExam = () => {
    const profileToUse = draftProfile || activeSession?.profile;
    if (!profileToUse) {
      navigate("/candidate");
      return;
    }

    const newSession = createCandidateSession(profileToUse);
    setActiveSession(newSession);
    if (profileToUse.assessmentRound === "ROUND_2") {
      navigate("/candidate/coding");
    } else {
      navigate("/candidate/exam");
    }
  };

  const handleFinalizeExam = (
    reason: "manual_submit" | "timer_expired" | "candidate_exit",
    backendResult?: SubmissionResponse
  ) => {
    const result = finalizeCandidateSession(reason);
    if (result) {
      if (backendResult) {
        result.session.receiptId = backendResult.receiptId;
        result.session.score = backendResult.score;
        result.session.totalMarks = backendResult.totalMarks;
        result.session.percentage = backendResult.percentage;
        result.session.qualificationStatus = backendResult.qualificationStatus;
        result.session.isPublished = backendResult.isPublished;
      }
      setActiveSession({ ...result.session });
    }
    navigate("/candidate/submitted");
  };

  const handleFinalizeCodingExam = (submission: CandidateCodingSubmission) => {
    const result = finalizeCandidateSession("manual_submit");
    if (result) {
      result.session.receiptId = submission.id;
      result.session.score = submission.totalScore;
      result.session.totalMarks = submission.maxScore;
      result.session.percentage = 100;
      result.session.qualificationStatus = "QUALIFIED";
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
      navigate(session.profile?.assessmentRound === "ROUND_2" ? "/candidate/coding" : "/candidate/exam");
    }
  };

  // Route 1: Submitted Confirmation Screen
  if (path === "/candidate/submitted" || (activeSession && activeSession.isSubmitted && path.startsWith("/candidate"))) {
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

  // Route 2: Round 2 Active Coding Exam Page
  if (path === "/candidate/coding") {
    const profile = draftProfile || activeSession?.profile;
    if (profile) {
      return (
        <CandidateCodingExamPage
          profile={profile}
          onFinalize={handleFinalizeCodingExam}
          onExit={handleRestartDemo}
        />
      );
    }
  }

  // Route 3: Round 1 Active Exam Page
  if (path === "/candidate/exam") {
    const session = activeSession || loadCandidateSession();
    if (session && !session.isSubmitted) {
      return (
        <CandidateExamPage
          initialSession={session}
          onFinalize={handleFinalizeExam}
        />
      );
    }
  }

  // Route 3: Role & Application Details Page (Between Login & System Compatibility)
  if (path === "/candidate/role-application") {
    const profile = draftProfile || activeSession?.profile;
    if (profile) {
      return (
        <RoleApplicationPage
          profile={profile}
          onBack={handleBackToEntry}
          onContinue={handleRoleApplicationContinue}
        />
      );
    }
  }

  // Route 4: System Compatibility & Hardware Check Page
  if (path === "/candidate/system-check") {
    const profile = draftProfile || activeSession?.profile;
    if (profile) {
      return (
        <SystemCheckPage
          profile={profile}
          onBack={handleBackToRoleApplication}
          onStartExam={handleStartExam}
        />
      );
    }
  }

  // Route 5: Default Candidate Entry Page (/candidate)
  return (
    <CandidateEntryPage
      onContinue={handleContinueFromEntry}
      onResumeActiveSession={handleResumeActiveSession}
    />
  );
}
