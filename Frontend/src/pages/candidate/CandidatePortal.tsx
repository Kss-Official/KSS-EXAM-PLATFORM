import { useState, useEffect, useCallback } from "react";
import { useRouter } from "../../router";
import type { CandidateProfile, SubmissionReceipt } from "../../types/candidate";
import { 
  type SubmissionResponse, 
  startCandidateAttempt, 
  verifyCandidateEligibility 
} from "../../services/api";
import {
  loadCandidateSession,
  saveCandidateSession,
  createCandidateSession,
  finalizeCandidateSession,
  clearCandidateSession,
  DEMO_TOTAL_QUESTIONS,
  DEMO_EXAM_DURATION_SECONDS
} from "../../services/candidateSessionStorage";

import CandidateEntryPage from "./CandidateEntryPage";
import RoleApplicationPage from "./RoleApplicationPage";
import SystemCheckPage from "./SystemCheckPage";
import CandidateExamPage from "./CandidateExamPage";
import SubmissionConfirmationPage from "./SubmissionConfirmationPage";

export default function CandidatePortal() {
  const { path, navigate } = useRouter();

  // Temporary draft profile before starting exam
  const [draftProfile, setDraftProfile] = useState<CandidateProfile | null>(null);
  const [isStartingExam, setIsStartingExam] = useState(false);

  // Sync state with storage
  const [activeSession, setActiveSession] = useState(() => loadCandidateSession());

  // Function to build a SubmissionReceipt from a finalized CandidateSession
  const buildReceiptFromSession = useCallback((sess: NonNullable<ReturnType<typeof loadCandidateSession>>): SubmissionReceipt => {
    const answeredCount = Object.keys(sess?.answers || {}).length;
    const isBackend = typeof sess?.receiptId === "string" && (sess.receiptId.startsWith("SEB-") || sess.backendAttemptId !== undefined);
    const totalQ = isBackend ? 60 : DEMO_TOTAL_QUESTIONS;
    const timeTakenSeconds = sess?.timeTakenSeconds ?? 
      (sess?.submittedAt && sess?.startTime 
        ? Math.max(0, Math.round((sess.submittedAt - sess.startTime) / 1000)) 
        : undefined);

    return {
      receiptId: String(sess?.receiptId || `DEMO-REC-2026-${String(sess?.sessionId || "000000").slice(-6).toUpperCase()}`),
      sessionId: String(sess?.sessionId || ""),
      examId: sess?.examId || "EXAM-1",
      candidateName: sess?.profile?.name || "Candidate",
      candidateEmail: sess?.profile?.email,
      candidateId: sess?.profile?.candidateId || "CAND-001",
      department: sess?.profile?.department || "General",
      answeredCount,
      unansweredCount: Math.max(0, totalQ - answeredCount),
      totalQuestions: totalQ,
      submittedAt: typeof sess?.submittedAt === "number" ? sess.submittedAt : Date.now(),
      timeTakenSeconds,
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
        if (path === "/candidate/exam" || path === "/candidate/system-check" || path === "/candidate/role-application") {
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
      } else if ((path === "/candidate/system-check" || path === "/candidate/role-application") && !draftProfile) {
        navigate("/candidate");
      }
    }
  }, [path, navigate, draftProfile]);

  // Handlers
  const handleContinueFromEntry = (profile: CandidateProfile) => {
    setDraftProfile(profile);
    const existing = loadCandidateSession();
    // If candidate already has an active in-progress assessment, take them straight to exam
    if (existing && !existing.isSubmitted && (existing.profile?.email?.toLowerCase() === profile.email?.toLowerCase())) {
      setActiveSession(existing);
      navigate("/candidate/exam");
      return;
    }
    navigate("/candidate/role-application");
  };

  const handleBackToEntry = () => {
    navigate("/candidate");
  };

  const handleRoleApplicationContinue = (updatedProfile: CandidateProfile) => {
    setDraftProfile(updatedProfile);
    navigate("/candidate/system-check");
  };

  const handleBackToRoleApplication = () => {
    navigate("/candidate/role-application");
  };

  const handleStartExam = async () => {
    const profileToUse = draftProfile || activeSession?.profile;
    if (!profileToUse) {
      navigate("/candidate");
      return;
    }

    // If an active session is already ongoing, resume it rather than overwriting
    const existing = activeSession || loadCandidateSession();
    if (existing && !existing.isSubmitted) {
      setActiveSession(existing);
      navigate("/candidate/exam");
      return;
    }

    setIsStartingExam(true);
    try {
      let dbCandId = profileToUse.dbCandidateId;
      let assignedExamId = profileToUse.assignedExamId;

      // Auto-recover candidate profile if dbCandidateId is missing
      if (!dbCandId && profileToUse.email) {
        try {
          const verifyRes = await verifyCandidateEligibility({
            email: profileToUse.email.trim().toLowerCase(),
            fullName: profileToUse.name,
            name: profileToUse.name,
            departmentId: profileToUse.departmentId,
            departmentName: profileToUse.department,
            department: profileToUse.department
          });
          if (verifyRes.eligible && verifyRes.candidateId && (verifyRes.assignedExamId || verifyRes.examId)) {
            dbCandId = verifyRes.candidateId;
            assignedExamId = verifyRes.assignedExamId || verifyRes.examId;
            profileToUse.dbCandidateId = dbCandId;
            profileToUse.assignedExamId = assignedExamId;
            if (verifyRes.examTitle) profileToUse.examTitle = verifyRes.examTitle;
            if (verifyRes.questionSetCode) profileToUse.questionSetCode = verifyRes.questionSetCode;
            if (verifyRes.token) localStorage.setItem("examsecure_candidate_token", verifyRes.token);
          }
        } catch (recoveryErr) {
          console.warn("[CandidatePortal] Eligibility verification during start notice:", recoveryErr);
        }
      }

      let attemptData: any = null;
      if (dbCandId && assignedExamId) {
        try {
          attemptData = await startCandidateAttempt(dbCandId, assignedExamId);
        } catch (attemptErr) {
          console.warn("[CandidatePortal] Attempt prefetch notice:", attemptErr);
        }
      }

      const durationSecs = attemptData?.totalDurationSeconds || DEMO_EXAM_DURATION_SECONDS;
      const newSession = createCandidateSession(profileToUse, durationSecs);

      if (attemptData) {
        newSession.backendAttemptId = attemptData.attemptId;
        newSession.questions = attemptData.questions || [];
        newSession.assignedSet = attemptData.questionSetCode || attemptData.setCode || profileToUse.questionSetCode;
        if (attemptData.deadlineAt || attemptData.expiresAt) {
          const sDeadline = new Date(attemptData.deadlineAt || attemptData.expiresAt).getTime();
          if (sDeadline > 0) newSession.deadline = sDeadline;
        }
        if (attemptData.serverTime) {
          const serverMs = new Date(attemptData.serverTime).getTime();
          newSession.serverOffset = serverMs - Date.now();
        }
        if (attemptData.attemptId && attemptData.questions) {
          try {
            sessionStorage.setItem(`examsecure_questions_${attemptData.attemptId}`, JSON.stringify(attemptData.questions));
          } catch {}
        }
      }

      // Purge any stale generic questions cache so stale questions from previous sessions never leak
      try {
        sessionStorage.removeItem("examsecure_last_questions");
      } catch {}

      saveCandidateSession(newSession);
      setActiveSession(newSession);
      navigate("/candidate/exam");
    } finally {
      setIsStartingExam(false);
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
        if (backendResult.durationSeconds !== undefined && backendResult.durationSeconds !== null) {
          result.session.durationSeconds = backendResult.durationSeconds;
          result.session.timeTakenSeconds = backendResult.durationSeconds;
        }
        if (backendResult.submittedAt) {
          try {
            result.session.submittedAt = new Date(backendResult.submittedAt).getTime();
          } catch {
            // retain existing timestamp
          }
        }
      }
      if (result.session.timeTakenSeconds === undefined && result.session.startTime && result.session.submittedAt) {
        result.session.timeTakenSeconds = Math.max(0, Math.round((result.session.submittedAt - result.session.startTime) / 1000));
      }
      saveCandidateSession(result.session);
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

  // Route 2: Active Exam Page
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
          isStartingExam={isStartingExam}
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
