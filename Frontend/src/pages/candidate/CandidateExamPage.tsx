import { useState, useEffect, useCallback, useRef } from "react";
import { 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  LogOut,
  Loader2,
  Menu,
  CheckCircle2,
  CloudOff,
  AlertCircle,
  AlertTriangle
} from "lucide-react";
import type { 
  CandidateSession, 
  AutosaveStatus
} from "../../types/candidate";
import { 
  saveCandidateSession
} from "../../services/candidateSessionStorage";
import {
  verifyCandidateEligibility,
  startCandidateAttempt,
  saveCandidateAnswer,
  submitCandidateAttempt,
  type SubmissionResponse
} from "../../services/api";
import ExamTimer from "../../components/candidate/ExamTimer";
import QuestionNavigator from "../../components/candidate/QuestionNavigator";
import SubmitConfirmationDialog from "../../components/candidate/SubmitConfirmationDialog";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";



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
  const [session, setSession] = useState<CandidateSession>(initialSession);
  const [idx, setIdx] = useState<number>(initialSession?.currentQuestionIndex || 0);
  const [answers, setAnswers] = useState<Record<number, number>>(
    initialSession?.answers && Object.keys(initialSession.answers).length > 0
      ? initialSession.answers
      : {}
  );
  const [flags, setFlags] = useState<number[]>(
    initialSession?.flags && initialSession.flags.length > 0
      ? initialSession.flags
      : []
  );

  const [backendAttemptId, setBackendAttemptId] = useState<number | undefined>(initialSession?.backendAttemptId);
  const [assignedSet, setAssignedSet] = useState<string>(initialSession?.profile?.questionSetCode || "A");

  // Helper to load any cached questions for instant render without 1s flickering
  const getCachedQuestions = (aid?: number | null) => {
    try {
      if (aid) {
        const item = sessionStorage.getItem(`examsecure_questions_${aid}`);
        if (item) return JSON.parse(item);
      }
      const generic = sessionStorage.getItem("examsecure_last_questions");
      return generic ? JSON.parse(generic) : [];
    } catch {
      return [];
    }
  };

  const initialAid = initialSession?.backendAttemptId;
  const initialCachedQ = getCachedQuestions(initialAid);

  const [questions, setQuestions] = useState<any[]>(initialCachedQ);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(initialCachedQ.length === 0);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showNavLockedModal, setShowNavLockedModal] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("saved");
  const [submitting, setSubmitting] = useState(false);

  // Attempt-scoped storage key prevents cross-candidate data leakage in shared computer lab terminals
  const getAttemptStorageKey = useCallback((aid?: number | null) => {
    return aid ? `examsecure_pending_answers_${aid}` : "examsecure_pending_answers_session";
  }, []);

  const [pendingQueue, setPendingQueue] = useState<Array<{ qNum: number; qId: number; optId: number }>>(() => {
    try {
      const aid = initialSession?.backendAttemptId;
      const stored = localStorage.getItem(getAttemptStorageKey(aid));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Debounce refs to prevent high-frequency request storm on rapid option clicking
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ aid: number; qNum: number; qId: number; optId: number; cid?: number | null } | null>(null);

  // Flush any pending debounced save immediately to avoid lost answers on navigate/submit
  const flushDebouncedSave = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingSaveRef.current) {
      const toSave = pendingSaveRef.current;
      pendingSaveRef.current = null;
      try {
        await saveCandidateAnswer(toSave.aid, toSave.qId, toSave.optId, toSave.cid);
        setPendingQueue(prev => prev.filter(item => item.qNum !== toSave.qNum));
        setAutosaveStatus("saved");
      } catch (err) {
        console.warn("[CandidateExamPage] Debounced save failed to sync, retained in queue:", err);
      }
    }
  }, []);

  // Persist pendingQueue to attempt-scoped localStorage whenever it changes
  useEffect(() => {
    try {
      const aid = backendAttemptId || session?.backendAttemptId;
      if (aid) {
        localStorage.setItem(getAttemptStorageKey(aid), JSON.stringify(pendingQueue));
      }
    } catch {
      // Local storage quota or security restriction handled safely
    }
  }, [pendingQueue, backendAttemptId, session?.backendAttemptId, getAttemptStorageKey]);

  // Safe retry and background sync for offline pending saves
  useEffect(() => {
    let active = true;

    const flushPendingQueue = async () => {
      const aid = backendAttemptId || session?.backendAttemptId;
      const cid = session?.profile?.dbCandidateId;
      if (!aid || pendingQueue.length === 0) return;

      const itemsToSync = [...pendingQueue];
      const remaining: typeof pendingQueue = [];

      for (const item of itemsToSync) {
        try {
          await saveCandidateAnswer(aid, item.qId, item.optId, cid);
        } catch {
          remaining.push(item);
        }
      }

      if (active) {
        setPendingQueue(remaining);
        setAutosaveStatus(remaining.length === 0 ? "saved" : "offline");
      }
    };

    const handleOnline = () => {
      flushPendingQueue();
    };

    window.addEventListener("online", handleOnline);
    const intervalId = setInterval(() => {
      if (pendingQueue.length > 0 && navigator.onLine) {
        flushPendingQueue();
      }
    }, 4000);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      clearInterval(intervalId);
    };
  }, [backendAttemptId, session?.backendAttemptId, session?.profile?.dbCandidateId, pendingQueue]);

  // Trap browser 'Back' button (popstate) and refresh/tab close (beforeunload)
  useEffect(() => {
    // Push dummy history entry so back button is captured inside exam
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      // Re-push state so user remains on /candidate/exam
      window.history.pushState(null, "", window.location.href);
      setShowNavLockedModal(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Changes you made may not be saved. Are you sure you want to leave the examination?";
      return e.returnValue;
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Load questions from backend attempt on mount
  useEffect(() => {
    let isCancelled = false;

    const initializeAttempt = async () => {
      if (questions.length === 0) {
        setLoadingQuestions(true);
      }
      let dbCandId = session?.profile?.dbCandidateId;
      let assignedExamId = session?.profile?.assignedExamId;

      // Auto-recover candidate profile if dbCandidateId is missing
      if (!dbCandId && session?.profile?.email) {
        try {
          const verifyRes = await verifyCandidateEligibility({
            email: session.profile.email.trim().toLowerCase(),
            fullName: session.profile.name,
            name: session.profile.name,
            departmentId: session.profile.departmentId,
            departmentName: session.profile.department,
            department: session.profile.department
          });
          if (verifyRes.eligible && verifyRes.candidateId && (verifyRes.assignedExamId || verifyRes.examId)) {
            if (verifyRes.token) {
              localStorage.setItem("examsecure_auth_token", verifyRes.token);
            }
            dbCandId = verifyRes.candidateId;
            assignedExamId = verifyRes.assignedExamId || verifyRes.examId;
            setSession(prev => {
              const updated = {
                ...prev,
                profile: {
                  ...prev.profile,
                  dbCandidateId: dbCandId,
                  assignedExamId: assignedExamId,
                  examTitle: verifyRes.examTitle || prev.profile.examTitle,
                  questionSetCode: verifyRes.questionSetCode || prev.profile.questionSetCode
                }
              };
              saveCandidateSession(updated);
              return updated;
            });
          }
        } catch (recoveryErr) {
          console.warn("[CandidateExamPage] Profile recovery notice:", recoveryErr);
        }
      }

      if (dbCandId && assignedExamId) {
        try {
          const attemptData = await startCandidateAttempt(dbCandId, assignedExamId);
          if (!isCancelled) {
            setBackendAttemptId(attemptData.attemptId);
            setAssignedSet(attemptData.questionSetCode || "A");

            let activeQList: any[] = attemptData.questions || [];
            setQuestions(activeQList);
            setLoadingQuestions(false);
            try {
              sessionStorage.setItem("examsecure_last_questions", JSON.stringify(activeQList));
              if (attemptData.attemptId) {
                sessionStorage.setItem(`examsecure_questions_${attemptData.attemptId}`, JSON.stringify(activeQList));
              }
            } catch {}

            const deadlineStr = attemptData.deadlineAt || attemptData.expiresAt;
            const serverDeadline = deadlineStr ? new Date(deadlineStr).getTime() : session.deadline;

            setSession(prev => {
              const updated = {
                ...prev,
                backendAttemptId: attemptData.attemptId,
                deadline: serverDeadline || prev.deadline,
                profile: {
                  ...prev.profile,
                  assignedExamId: attemptData.examId || prev.profile.assignedExamId,
                  examTitle: attemptData.examTitle || prev.profile.examTitle,
                  questionSetCode: attemptData.questionSetCode || prev.profile.questionSetCode
                }
              };
              saveCandidateSession(updated);
              return updated;
            });

            // Map server answers or sync local answers
            if (attemptData.answers && Object.keys(attemptData.answers).length > 0) {
              const answersMap = attemptData.answers;
              const restoredAnswers: Record<number, number> = {};
              activeQList.forEach((q, qIndex) => {
                const qKey = q.id ?? q.questionId;
                const selectedOptId = qKey !== undefined ? (answersMap[qKey] ?? answersMap[String(qKey)]) : undefined;
                if (selectedOptId !== undefined && selectedOptId !== null) {
                  const optIdx = q.options.findIndex((o: any) => (o.id ?? o.optionId) === selectedOptId);
                  if (optIdx !== -1) {
                    restoredAnswers[qIndex + 1] = optIdx;
                  }
                }
              });
              setAnswers(restoredAnswers);
              saveCandidateSession({
                ...session,
                backendAttemptId: attemptData.attemptId,
                answers: restoredAnswers,
                deadline: serverDeadline || session.deadline
              });
            } else if (initialSession?.answers && Object.keys(initialSession.answers).length > 0) {
              // Only sync if initialSession had explicitly saved answers for this candidate
              Object.entries(initialSession.answers).forEach(async ([qNumStr, optIdx]) => {
                const qNum = parseInt(qNumStr, 10);
                const q = activeQList[qNum - 1];
                if (q && q.options && q.options[optIdx]) {
                  const qId = q.id ?? q.questionId ?? qNum;
                  const chosenOpt = q.options[optIdx];
                  const optId = chosenOpt.id ?? chosenOpt.optionId ?? optIdx;
                  try {
                    await saveCandidateAnswer(attemptData.attemptId, qId, optId, dbCandId);
                  } catch (syncErr) {
                    console.warn("[CandidateExamPage] Initial answer sync notice:", syncErr);
                  }
                }
              });
            } else {
              setAnswers({});
            }
          }
        } catch (err) {
          console.warn("[CandidateExamPage] Backend attempt lookup fallback to 60 questions pool:", err);
        } finally {
          if (!isCancelled) {
            setLoadingQuestions(false);
          }
        }
      } else {
        if (!isCancelled) {
          setLoadingQuestions(false);
        }
      }
    };

    initializeAttempt();

    return () => {
      isCancelled = true;
    };
  }, []);

  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[idx] || null;

  // Helper to determine active section info
  const getSectionInfo = (qNum: number) => {
    const q = questions[qNum - 1];
    if (q && q.section) {
      return { id: "S", title: q.section, range: `1 - ${total}` };
    }
    if (total <= 25) {
      return { id: "A", title: "Section A: Questions", range: `1 - ${total}` };
    }
    if (total <= 50) {
      const half = Math.ceil(total / 2);
      if (qNum <= half) {
        return { id: "A", title: "Section A: Part 1", range: `1 - ${half}` };
      } else {
        return { id: "B", title: "Section B: Part 2", range: `${half + 1} - ${total}` };
      }
    }
    const quarter = Math.ceil(total / 4);
    if (qNum <= quarter) {
      return { id: "A", title: "Section A: Quantitative Aptitude", range: `1 - ${quarter}` };
    } else if (qNum <= quarter * 2) {
      return { id: "B", title: "Section B: Logical Reasoning", range: `${quarter + 1} - ${quarter * 2}` };
    } else if (qNum <= quarter * 3) {
      return { id: "C", title: "Section C: Domain Specialization", range: `${quarter * 2 + 1} - ${quarter * 3}` };
    } else {
      return { id: "D", title: "Section D: Specialization", range: `${quarter * 3 + 1} - ${total}` };
    }
  };

  const handleSelectAnswer = useCallback(async (optionIndex: number) => {
    const questionNum = idx + 1;
    let activeAid = backendAttemptId || session?.backendAttemptId;

    setAnswers(prevAnswers => {
      const updatedAnswers = { ...prevAnswers, [questionNum]: optionIndex };
      saveCandidateSession({
        ...session,
        backendAttemptId: activeAid,
        answers: updatedAnswers,
        flags,
        currentQuestionIndex: idx
      });
      return updatedAnswers;
    });

    // Auto-recover active attempt if aid not set yet
    if (!activeAid && (session?.profile?.dbCandidateId || session?.profile?.email)) {
      try {
        let cId = session.profile.dbCandidateId;
        let eId = session.profile.assignedExamId;
        if (!cId && session.profile.email) {
          const v = await verifyCandidateEligibility({ 
            email: session.profile.email.trim().toLowerCase(),
            registrationNumber: session.profile.candidateId,
            fullName: session.profile.name,
            name: session.profile.name,
            departmentId: session.profile.departmentId,
            departmentName: session.profile.department,
            department: session.profile.department
          });
          cId = v.candidateId;
          eId = v.assignedExamId || v.examId;
        }
        if (cId && eId) {
          const res = await startCandidateAttempt(cId, eId);
          activeAid = res.attemptId;
          setBackendAttemptId(activeAid);
        }
      } catch (startErr) {
        console.warn("[CandidateExamPage] On-the-fly attempt start notice:", startErr);
      }
    }

    if (activeAid && currentQuestion) {
      const qId = currentQuestion.id ?? currentQuestion.questionId ?? questionNum;
      const chosenOpt = currentQuestion.options?.[optionIndex];
      const optId = chosenOpt?.id ?? chosenOpt?.optionId ?? optionIndex;
      const cid = session?.profile?.dbCandidateId;

      if (qId !== undefined && optId !== undefined) {
        setAutosaveStatus("saving");

        // Retain pending save locally immediately
        setPendingQueue(prev => [
          ...prev.filter(item => item.qNum !== questionNum),
          { qNum: questionNum, qId, optId }
        ]);

        if (!navigator.onLine) {
          setAutosaveStatus("offline");
          return;
        }

        // 300ms debounce: rapidly clicking options won't flood backend workers
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        pendingSaveRef.current = { aid: activeAid, qNum: questionNum, qId, optId, cid };

        debounceTimerRef.current = setTimeout(async () => {
          if (!pendingSaveRef.current) return;
          const toSave = pendingSaveRef.current;
          pendingSaveRef.current = null;
          try {
            await saveCandidateAnswer(toSave.aid, toSave.qId, toSave.optId, toSave.cid);
            setPendingQueue(prev => prev.filter(item => item.qNum !== toSave.qNum));
            setAutosaveStatus("saved");
          } catch (saveErr) {
            console.warn("[CandidateExamPage] Save interrupted. Answer safely buffered locally:", saveErr);
            setAutosaveStatus("offline");
          }
        }, 300);
      }
    }
  }, [idx, session, backendAttemptId, flags, currentQuestion]);

  const handleToggleFlag = useCallback(() => {
    const questionNum = idx + 1;
    setFlags(prevFlags => {
      const updatedFlags = prevFlags.includes(questionNum)
        ? prevFlags.filter(f => f !== questionNum)
        : [...prevFlags, questionNum];

      setAnswers(currentAnswers => {
        saveCandidateSession({
          ...session,
          backendAttemptId,
          answers: currentAnswers,
          flags: updatedFlags,
          currentQuestionIndex: idx
        });
        return currentAnswers;
      });

      return updatedFlags;
    });
  }, [idx, session, backendAttemptId]);

  const handleNavigateQuestion = useCallback(async (targetIndex: number) => {
    const maxAllowed = Math.max(total, questions.length, 60);
    if (targetIndex >= 0 && targetIndex < maxAllowed) {
      await flushDebouncedSave();
      setIdx(targetIndex);
      saveCandidateSession({
        ...session,
        backendAttemptId,
        answers,
        flags,
        currentQuestionIndex: targetIndex
      });
    }
  }, [total, questions.length, session, backendAttemptId, answers, flags, flushDebouncedSave]);

  const triggerFinalization = useCallback(async (reason: "manual_submit" | "timer_expired" | "candidate_exit") => {
    if (submitting) return;
    setSubmitting(true);
    await flushDebouncedSave();
    let backendResult: SubmissionResponse | undefined;
    const aid = backendAttemptId || session?.backendAttemptId;
    const cid = session?.profile?.dbCandidateId;
    if (aid) {
      try {
        backendResult = await submitCandidateAttempt(aid, answers, cid);
        try {
          localStorage.removeItem(getAttemptStorageKey(aid));
        } catch {}
      } catch (err) {
        console.warn("[CandidateExamPage] Live backend submit attempt error:", err);
      }
    }
    onFinalize(reason, backendResult);
  }, [submitting, backendAttemptId, session, answers, onFinalize, flushDebouncedSave, getAttemptStorageKey]);

  return (
    <main className="exam-fullscreen-view">
      {/* Top Navbar */}
      <header className="exam-top-nav">
        <div className="exam-nav-left">
          <img 
            src={kalpanaaLogo} 
            alt="Kalpanaa Software Solutions" 
            className="exam-nav-logo" 
          />
          <div className="exam-dept-pill">
            <BookOpen size={13} />
            <span>{session.profile.department || "Development"} — Assessment</span>
          </div>
        </div>

        {/* Center: Section Progress Indicator & Live Autosave Status */}
        <div className="exam-nav-center">
          <div className="exam-progress-bar-wrap">
            <div 
              className="exam-progress-bar-fill" 
              style={{ width: `${(((idx % 15) + 1) / 15) * 100}%` }} 
            />
          </div>
          <span className="exam-progress-label">
            Progress: <strong>{((idx % 15) + 1)} / 15</strong>
          </span>

          {/* Real-time Answer Autosave Status */}
          <div 
            className={`exam-autosave-pill ${autosaveStatus}`}
            title={
              autosaveStatus === "offline"
                ? "Network disconnected. Answers are retained safely in browser storage and will sync automatically."
                : "Real-time answer save status"
            }
          >
            {autosaveStatus === "saved" && (
              <>
                <CheckCircle2 size={13} color="#15803d" />
                <span>Saved</span>
              </>
            )}
            {autosaveStatus === "saving" && (
              <>
                <Loader2 size={13} className="animate-spin" color="#0f766e" />
                <span>Saving...</span>
              </>
            )}
            {(autosaveStatus === "offline" || autosaveStatus === "error") && (
              <>
                <CloudOff size={13} color="#b45309" />
                <span>Offline • Saved locally ({pendingQueue.length} pending sync)</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Timer, Profile, Exit */}
        <div className="exam-nav-right">
          <ExamTimer
            deadline={session.deadline}
            isSubmitted={session.isSubmitted}
            onExpire={() => triggerFinalization("timer_expired")}
          />

          <div className="exam-user-badge">
            <span className="exam-user-avatar">
              {(session?.profile?.name?.[0] || "J").toUpperCase()}
            </span>
            <div className="exam-user-info">
              <strong className="exam-user-name">{session?.profile?.name || "Jingyasa Priyadarsini"}</strong>
              <small className="exam-user-id">{session?.profile?.candidateId || "MCQ-REG001"}</small>
            </div>
          </div>
        </div>
      </header>

      {/* Main 2-Column Assessment Workspace */}
      <div className="exam-content-grid">
        {/* Left: Question Card */}
        {loadingQuestions && !currentQuestion ? (
          <article className="exam-question-card" style={{ padding: "64px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "340px" }}>
            <Loader2 size={38} className="animate-spin" color="#017846" style={{ margin: "0 auto 16px" }} />
            <h3 style={{ margin: "0 0 8px", fontSize: "16px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Loading Examination Questions...
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Preparing your questions and initializing proctored session. Please wait a moment.
            </p>
          </article>
        ) : !currentQuestion ? (
          <article className="exam-question-card" style={{ padding: "48px 24px", textAlign: "center" }}>
            <AlertCircle size={40} color="#e11d48" style={{ margin: "0 auto 16px" }} />
            <h3 style={{ margin: "0 0 8px", fontSize: "17px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>No Questions Configured</h3>
            <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b", maxWidth: "480px", marginInline: "auto", lineHeight: "1.5" }}>
              Questions for this examination have not been uploaded yet in the Admin Question Bank. Please contact your examination administrator.
            </p>
          </article>
        ) : (
          <article className="exam-question-card">
            <div className="exam-qcard-header">
              <div className="exam-qmeta-group">
                <span className="exam-qnum-tag">
                  QUESTION {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="exam-qsection-tag">
                  <BookOpen size={12} /> {getSectionInfo(idx + 1).title}
                </span>
              </div>

              <button
                type="button"
                className={`exam-flag-btn ${flags.includes(idx + 1) ? "flagged" : ""}`}
                onClick={handleToggleFlag}
              >
                <Flag size={13} />
                <span>Flag for review</span>
              </button>
            </div>

            <div className="exam-qbody-content">
              <h2 className="exam-question-heading">
                {currentQuestion.questionText || currentQuestion.q}
              </h2>
              <p className="exam-question-hint">Select one answer from the options below.</p>

              {/* Options List */}
              <div className="exam-options-list" role="radiogroup">
                {(currentQuestion.options || []).map((opt: any, i: number) => {
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
                      className={`exam-option-card ${isSelected ? "selected" : ""}`}
                    >
                      <div className="exam-option-left">
                        <span className={`exam-option-letter ${isSelected ? "selected" : ""}`}>
                          {label}
                        </span>
                        <span className="exam-option-text">{text}</span>
                      </div>

                      <span className={`exam-custom-radio ${isSelected ? "selected" : ""}`}>
                        {isSelected && <span className="exam-radio-inner-dot" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Card Actions: Previous & Next */}
            <div className="exam-qcard-footer">
              <button
                type="button"
                className="exam-btn-prev"
                disabled={idx <= 0}
                onClick={() => handleNavigateQuestion(idx - 1)}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <button
                type="button"
                className="exam-btn-next"
                disabled={idx >= total - 1}
                onClick={() => handleNavigateQuestion(idx + 1)}
              >
                Next question <ChevronRight size={16} />
              </button>
            </div>
          </article>
        )}

        {/* Right: Question Navigator Palette & Live Proctor Feed */}
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
      </div>

      {/* Mobile Drawer Trigger */}
      <button
        type="button"
        className="mobilepalette"
        onClick={() => setPaletteOpen(true)}
      >
        <Menu size={16} /> Question navigator
      </button>

      {/* Dialogs */}
      {showSubmitModal && (
        <SubmitConfirmationDialog
          total={total}
          answeredCount={answeredCount}
          flaggedCount={flags.length}
          onCancel={() => setShowSubmitModal(false)}
          onConfirm={() => triggerFinalization("manual_submit")}
        />
      )}

      {/* Navigation Locked Warning Modal */}
      {showNavLockedModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          padding: "16px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "14px",
            maxWidth: "440px",
            width: "100%",
            padding: "24px",
            textAlign: "center",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#fef3c7",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px"
            }}>
              <AlertTriangle size={24} />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "17px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Navigation Locked
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
              Navigation is locked during the active assessment. Going back or leaving the exam room is disabled to protect your examination integrity.
            </p>
            <button
              type="button"
              onClick={() => setShowNavLockedModal(false)}
              style={{
                width: "100%",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 700,
                background: "#017846",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              Continue Assessment
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
