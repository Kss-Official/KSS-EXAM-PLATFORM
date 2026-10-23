import { useState, useEffect, useCallback, useRef } from "react";
import { 
  ShieldCheck, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  RotateCcw, 
  Menu, 
  LockKeyhole, 
  Check, 
  AlertCircle,
  LogOut,
  Loader2
} from "lucide-react";
import type { 
  CandidateSession, 
  AutosaveStatus,
  Department
} from "../../types/candidate";
import { 
  saveCandidateSession, 
  DEMO_TOTAL_QUESTIONS 
} from "../../services/candidateSessionStorage";
import {
  startCandidateAttempt,
  saveCandidateAnswer,
  submitCandidateAttempt,
  type SubmissionResponse
} from "../../services/api";
import ExamTimer from "../../components/candidate/ExamTimer";
import QuestionNavigator from "../../components/candidate/QuestionNavigator";
import SubmitConfirmationDialog from "../../components/candidate/SubmitConfirmationDialog";
import ExitConfirmationDialog from "../../components/candidate/ExitConfirmationDialog";

/** Fallback sample question pool if backend attempt has no questions */
const FALLBACK_QUESTIONS = [
  { 
    id: 1,
    topic: "ENGINEERING · CORE CONCEPTS", 
    questionText: "Which principle of object-oriented programming allows one class to acquire properties and methods from another class?", 
    options: [
      { id: 101, optionLabel: "A", optionText: "Encapsulation" },
      { id: 102, optionLabel: "B", optionText: "Inheritance" },
      { id: 103, optionLabel: "C", optionText: "Polymorphism" },
      { id: 104, optionLabel: "D", optionText: "Abstraction" }
    ] 
  },
  { 
    id: 2,
    topic: "DATABASE · SQL", 
    questionText: "Which SQL command is commonly used to retrieve records from a database table?", 
    options: [
      { id: 201, optionLabel: "A", optionText: "FETCH ONLY" },
      { id: 202, optionLabel: "B", optionText: "OPEN TABLE" },
      { id: 203, optionLabel: "C", optionText: "SELECT" },
      { id: 204, optionLabel: "D", optionText: "PULL ROWS" }
    ] 
  },
  { 
    id: 3,
    topic: "DATA STRUCTURES", 
    questionText: "Which data structure follows the Last In, First Out (LIFO) principle?", 
    options: [
      { id: 301, optionLabel: "A", optionText: "Queue" },
      { id: 302, optionLabel: "B", optionText: "Stack" },
      { id: 303, optionLabel: "C", optionText: "Linked list" },
      { id: 304, optionLabel: "D", optionText: "Binary tree" }
    ] 
  },
  { 
    id: 4,
    topic: "WEB FUNDAMENTALS", 
    questionText: "Which HTTP method is typically used to retrieve a resource without modifying it?", 
    options: [
      { id: 401, optionLabel: "A", optionText: "POST" },
      { id: 402, optionLabel: "B", optionText: "PATCH" },
      { id: 403, optionLabel: "C", optionText: "DELETE" },
      { id: 404, optionLabel: "D", optionText: "GET" }
    ] 
  },
  { 
    id: 5,
    topic: "ARCHITECTURE & FRAMEWORKS", 
    questionText: "What is the main purpose of dependency injection in modular application design?", 
    options: [
      { id: 501, optionLabel: "A", optionText: "Manually create every object" },
      { id: 502, optionLabel: "B", optionText: "Provide required dependencies to a component" },
      { id: 503, optionLabel: "C", optionText: "Convert Java into SQL" },
      { id: 504, optionLabel: "D", optionText: "Encrypt every response automatically" }
    ] 
  }
];

interface CandidateExamPageProps {
  initialSession: CandidateSession;
  onFinalize: (
    reason: "manual_submit" | "timer_expired" | "candidate_exit",
    backendResult?: SubmissionResponse
  ) => void;
}

export default function CandidateExamPage({
  initialSession,
  onFinalize
}: CandidateExamPageProps) {
  // Session state initialized from persisted storage
  const [session, setSession] = useState<CandidateSession>(initialSession);
  const [idx, setIdx] = useState<number>(initialSession?.currentQuestionIndex || 0);
  const [answers, setAnswers] = useState<Record<number, number>>(initialSession?.answers || {});
  const [flags, setFlags] = useState<number[]>(initialSession?.flags || []);

  const [backendAttemptId, setBackendAttemptId] = useState<number | undefined>(initialSession?.backendAttemptId);
  const [assignedSet, setAssignedSet] = useState<string>(initialSession?.profile?.questionSetCode || "A");
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("saved");

  // Load questions from backend attempt on mount
  useEffect(() => {
    let isCancelled = false;

    const initializeAttempt = async () => {
      const dbCandId = session?.profile?.dbCandidateId;
      const assignedExamId = session?.profile?.assignedExamId;

      if (dbCandId && assignedExamId) {
        try {
          const attemptData = await startCandidateAttempt(dbCandId, assignedExamId);
          if (!isCancelled) {
            setBackendAttemptId(attemptData.attemptId);
            setAssignedSet(attemptData.questionSetCode || "A");

            if (attemptData.questions && attemptData.questions.length > 0) {
              setQuestions(attemptData.questions);
            } else {
              setQuestions(FALLBACK_QUESTIONS);
            }

            // If attempt has server deadline, sync with session
            const deadlineStr = attemptData.deadlineAt || attemptData.expiresAt;
            if (deadlineStr) {
              const serverDeadline = new Date(deadlineStr).getTime();
              setSession(prev => ({
                ...prev,
                backendAttemptId: attemptData.attemptId,
                deadline: serverDeadline
              }));
            }

            // Restore previously saved answers if any
            if (attemptData.answers) {
              const answersMap = attemptData.answers;
              const restoredAnswers: Record<number, number> = {};
              attemptData.questions.forEach((q, qIndex) => {
                const qKey = q.id ?? q.questionId;
                const selectedOptId = qKey !== undefined ? answersMap[qKey] : undefined;
                if (selectedOptId !== undefined && selectedOptId !== null) {
                  const optIdx = q.options.findIndex(o => (o.id ?? o.optionId) === selectedOptId);
                  if (optIdx !== -1) {
                    restoredAnswers[qIndex + 1] = optIdx;
                  }
                }
              });
              if (Object.keys(restoredAnswers).length > 0) {
                setAnswers(restoredAnswers);
              }
            }
          }
        } catch (err) {
          console.warn("[CandidateExamPage] Could not load backend attempt, fallback to local pool:", err);
          if (!isCancelled) {
            setQuestions(FALLBACK_QUESTIONS);
          }
        }
      } else {
        setQuestions(FALLBACK_QUESTIONS);
      }

      if (!isCancelled) {
        setLoadingQuestions(false);
      }
    };

    initializeAttempt();

    return () => {
      isCancelled = true;
    };
  }, []);

  const total = questions.length > 0 ? questions.length : DEMO_TOTAL_QUESTIONS;
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[idx] || FALLBACK_QUESTIONS[idx % FALLBACK_QUESTIONS.length];

  // Helper to format department-specific assessment header
  const getDepartmentHeading = (dept: Department) => {
    return `${dept} — Assessment`;
  };

  // Sync and persist session changes locally
  const persistChanges = useCallback(
    (newAnswers: Record<number, number>, newFlags: number[], newIdx: number) => {
      const updatedSession: CandidateSession = {
        ...session,
        backendAttemptId,
        answers: newAnswers,
        flags: newFlags,
        currentQuestionIndex: newIdx
      };

      const success = saveCandidateSession(updatedSession);
      if (success) {
        setSession(updatedSession);
      }
    },
    [session, backendAttemptId]
  );

  // Answer selection handler (saves to backend PostgreSQL and locally)
  const handleSelectAnswer = async (optionIndex: number) => {
    const qNum = idx + 1;
    const updated = { ...answers, [qNum]: optionIndex };
    setAnswers(updated);
    persistChanges(updated, flags, idx);

    // Live auto-save to backend PostgreSQL
    if (backendAttemptId && currentQuestion) {
      setAutosaveStatus("saving");
      const selectedOption = currentQuestion.options[optionIndex];
      const optId = selectedOption ? (selectedOption.optionId ?? selectedOption.id) : null;
      const qId = currentQuestion.questionId ?? currentQuestion.id;

      try {
        await saveCandidateAnswer(backendAttemptId, qId, optId);
        setAutosaveStatus("saved");
      } catch (err) {
        console.warn("[CandidateExamPage] Live answer save warning:", err);
        setAutosaveStatus("error");
      }
    } else {
      setAutosaveStatus("saved");
    }
  };

  // Clear choice handler
  const handleClearChoice = async () => {
    const qNum = idx + 1;
    const updated = { ...answers };
    delete updated[qNum];
    setAnswers(updated);
    persistChanges(updated, flags, idx);

    if (backendAttemptId && currentQuestion) {
      setAutosaveStatus("saving");
      try {
        const qId = currentQuestion.questionId ?? currentQuestion.id;
        await saveCandidateAnswer(backendAttemptId, qId, null);
        setAutosaveStatus("saved");
      } catch (err) {
        console.warn("[CandidateExamPage] Clear choice warning:", err);
        setAutosaveStatus("error");
      }
    }
  };

  // Toggle flag handler
  const handleToggleFlag = () => {
    const qNum = idx + 1;
    const updatedFlags = flags.includes(qNum)
      ? flags.filter((f) => f !== qNum)
      : [...flags, qNum];
    setFlags(updatedFlags);
    persistChanges(answers, updatedFlags, idx);
  };

  // Question navigation handler
  const handleNavigateQuestion = (newIdx: number) => {
    const clamped = Math.max(0, Math.min(total - 1, newIdx));
    setIdx(clamped);
    persistChanges(answers, flags, clamped);
  };

  // Finalization wrappers (idempotent, submits to backend and calls parent onFinalize)
  const isFinalizingRef = useRef(false);

  const triggerFinalization = useCallback(
    async (reason: "manual_submit" | "timer_expired" | "candidate_exit") => {
      if (isFinalizingRef.current) return;
      isFinalizingRef.current = true;

      // Close all modals
      setShowSubmitModal(false);
      setShowExitModal(false);

      let backendResult: SubmissionResponse | undefined;

      // Backend authoritative grading and finalization
      if (backendAttemptId) {
        try {
          backendResult = await submitCandidateAttempt(backendAttemptId);
        } catch (err) {
          console.warn("[CandidateExamPage] Backend submission failed, proceeding with local fallback:", err);
        }
      }

      // Persist final snapshot before finalizing
      saveCandidateSession({
        ...session,
        backendAttemptId,
        answers,
        flags,
        currentQuestionIndex: idx,
        receiptId: backendResult?.receiptId || null,
        score: backendResult?.score,
        totalMarks: backendResult?.totalMarks,
        percentage: backendResult?.percentage,
        qualificationStatus: backendResult?.qualificationStatus,
        isPublished: backendResult?.isPublished
      });

      onFinalize(reason, backendResult);
    },
    [session, backendAttemptId, answers, flags, idx, onFinalize]
  );

  // Hook for pagehide and visibilitychange to safely save local state
  useEffect(() => {
    const handleVisibilityOrPageHide = () => {
      saveCandidateSession({
        ...session,
        backendAttemptId,
        answers,
        flags,
        currentQuestionIndex: idx
      });
    };

    window.addEventListener("visibilitychange", handleVisibilityOrPageHide);
    window.addEventListener("pagehide", handleVisibilityOrPageHide);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityOrPageHide);
      window.removeEventListener("pagehide", handleVisibilityOrPageHide);
    };
  }, [session, backendAttemptId, answers, flags, idx]);

  if (loadingQuestions) {
    return (
      <main className="exam" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", color: "#64748b" }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: "0 auto 12px" }} />
          <h3>Initializing Secure Examination Session...</h3>
          <p>Assigning question set and synchronizing server timer...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="exam">
      {/* 
        Candidate Examination Header:
        - Prominently displays selected department heading
        - Shows candidate name & ID
        - Countdown timer calculated from absolute deadline
        - Autosave indicator
        - Exit control (with strict confirmation modal)
        - Strictly NO admin links or shortcuts
      */}
      <header className="examnav">
        <div className="brand">
          <div className="logo">
            <ShieldCheck size={20} />
          </div>
          <div>
            <b>ExamSecure</b>
            <small>CANDIDATE EXAMINATION</small>
          </div>
        </div>

        <div className="examnav-center">
          <span className="exam-mode-badge">
            <BookOpen size={12} /> {getDepartmentHeading(session.profile.department)}
          </span>
          <span style={{
            padding: "3px 8px",
            background: "#eff6ff",
            color: "#2563eb",
            border: "1px solid #bfdbfe",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: 700
          }}>
            Set {assignedSet}
          </span>
          <div className="nav-progress">
            <span>
              Progress: <b>{answeredCount}</b>/{total}
            </span>
            <div className="nav-track">
              <span style={{ width: `${(answeredCount / total) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="navright">
          {/* Autosave status indicator */}
          <div className="autosave-indicator" title="Exam persistence status">
            {autosaveStatus === "saved" && (
              <span className="autosave-badge saved">
                <Check size={12} /> {backendAttemptId ? "Saved to server" : "Saved locally"}
              </span>
            )}
            {autosaveStatus === "saving" && (
              <span className="autosave-badge saving">
                <span className="spin-dot" /> Saving to server...
              </span>
            )}
            {autosaveStatus === "error" && (
              <span className="autosave-badge error">
                <AlertCircle size={12} /> Unable to save
              </span>
            )}
          </div>

          {/* Exam Timer */}
          <ExamTimer
            deadline={session.deadline}
            isSubmitted={session.isSubmitted}
            onExpire={() => triggerFinalization("timer_expired")}
          />

          {/* Candidate identification info */}
          <div className="candidate">
            <span className="avatar">
              {(session?.profile?.name?.[0] || "C").toUpperCase()}
            </span>
            <div className="cand-info">
              <span className="cand-name">{session?.profile?.name || "Candidate"}</span>
              <small className="cand-id">{session?.profile?.candidateId || "CAND-001"}</small>
            </div>
          </div>

          {/* Exit Exam button */}
          <button
            type="button"
            className="exam-exit-btn"
            onClick={() => setShowExitModal(true)}
            title="Exit examination and finalize attempt"
          >
            <LogOut size={13} /> Exit
          </button>
        </div>
      </header>

      {/* Main Examination Layout */}
      <section className="layout">
        <article className="question card">
          <div className="qheader">
            <div className="qmeta">
              <span className="qbadge">QUESTION {String(idx + 1).padStart(2, "0")}</span>
              <span className="topicbadge">
                <BookOpen size={12} /> {currentQuestion.topic || "EXAMINATION QUESTION"}
              </span>
            </div>
            <button
              type="button"
              className={`flag-btn ${flags.includes(idx + 1) ? "flagged" : ""}`}
              onClick={handleToggleFlag}
              aria-pressed={flags.includes(idx + 1)}
            >
              <Flag size={14} />
              <span>{flags.includes(idx + 1) ? "Flagged for review" : "Flag for review"}</span>
            </button>
          </div>

          <div className="qbody">
            <h2 className="qtitle">{currentQuestion.questionText || currentQuestion.q}</h2>
            <p className="qhint">Select one answer from the options below.</p>

            <div className="options" role="radiogroup" aria-label={`Question ${idx + 1} options`}>
              {currentQuestion.options.map((opt: any, i: number) => {
                const isSelected = answers[idx + 1] === i;
                const label = opt.displayLabel || opt.label || opt.optionLabel || String.fromCharCode(65 + i);
                const text = typeof opt === "string" ? opt : (opt.optionText || opt.text || "");
                return (
                  <button
                    key={opt.optionId || opt.id || `${idx}-${i}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectAnswer(i)}
                    className={`option ${isSelected ? "selected" : ""}`}
                  >
                    <span className="letter">{label}</span>
                    <span className="opt-text">{text}</span>
                    <i className="radio">{isSelected && <i />}</i>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="qactions">
            <div className="left-action">
              {answers[idx + 1] !== undefined && (
                <button
                  type="button"
                  className="clear-btn"
                  onClick={handleClearChoice}
                >
                  <RotateCcw size={13} /> Clear choice
                </button>
              )}
            </div>
            <div className="nav-buttons">
              <button
                type="button"
                className="secondary"
                disabled={idx === 0}
                onClick={() => handleNavigateQuestion(idx - 1)}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                type="button"
                className="primary"
                disabled={idx === total - 1}
                onClick={() => handleNavigateQuestion(idx + 1)}
              >
                Next question <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </article>

        {/* Question Palette Sidebar */}
        <QuestionNavigator
          total={total}
          currentIndex={idx}
          answers={answers}
          flags={flags}
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          onSelectQuestion={handleNavigateQuestion}
          onRequestSubmit={() => setShowSubmitModal(true)}
        />
      </section>

      {/* Mobile Drawer Button */}
      <button
        type="button"
        className="mobilepalette"
        onClick={() => setPaletteOpen(true)}
      >
        <Menu size={16} /> Question navigator
      </button>

      <footer className="examfoot">
        <span>
          <LockKeyhole size={12} /> Secure Exam Session · Single-Page Candidate Interface
        </span>
        <span>
          Assigned Department: <strong>{session.profile.department}</strong>
        </span>
      </footer>

      {/* Submit Confirmation Dialog */}
      {showSubmitModal && (
        <SubmitConfirmationDialog
          total={total}
          answeredCount={answeredCount}
          flaggedCount={flags.length}
          onCancel={() => setShowSubmitModal(false)}
          onConfirm={() => triggerFinalization("manual_submit")}
        />
      )}

      {/* Exit Exam Confirmation Dialog */}
      {showExitModal && (
        <ExitConfirmationDialog
          answeredCount={answeredCount}
          total={total}
          onCancel={() => setShowExitModal(false)}
          onConfirmExit={() => triggerFinalization("candidate_exit")}
        />
      )}
    </main>
  );
}
