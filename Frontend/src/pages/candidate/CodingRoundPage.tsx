import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Send,
  Clock3,
  AlertCircle,
  Code2,
  Award,
  CheckCircle2,
  Flag,
  ChevronUp,
  ChevronDown,
  History,
  FileText,
} from "lucide-react";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";
import {
  finalizeCodingExam,
  getCodingAttemptInfo,
  getCodingDrafts,
  getCodingProblem,
  listProblemSubmissions,
  runCodingCode,
  saveCodingDraft,
  submitCodingCode,
  watchSubmissionResult,
  type CodingAttemptInfo,
  type CodingDraftDto,
  type CodingProblemPublic,
  type CodingSubmissionStatus,
} from "../../services/codingApi";
import { reportProctorAlert } from "../../services/api";
import { loadCandidateSession } from "../../services/candidateSessionStorage";
import CodingEditorPane, { DEFAULT_STARTER_TEMPLATES } from "../../components/candidate/coding/CodingEditorPane";
import TestcaseResultPane from "../../components/candidate/coding/TestcaseResultPane";

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CodingRoundPage() {
  const session = loadCandidateSession();
  const params = new URLSearchParams(window.location.search);
  const examId = Number(params.get("examId") || session?.profile?.assignedExamId || 1);

  const [attemptInfo, setAttemptInfo] = useState<CodingAttemptInfo | null>(null);
  const [activeProblemId, setActiveProblemId] = useState<string>("");
  const [problem, setProblem] = useState<CodingProblemPublic | null>(null);
  const [submissions, setSubmissions] = useState<CodingSubmissionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [language, setLanguage] = useState("python3");
  const [code, setCode] = useState(DEFAULT_STARTER_TEMPLATES.python3);
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [fontSize, setFontSize] = useState(14);
  const [customInput, setCustomInput] = useState("");
  const [useCustomInput, setUseCustomInput] = useState(false);

  const [uiState, setUiState] = useState<"idle" | "queued" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<CodingSubmissionStatus | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [serverDrafts, setServerDrafts] = useState<Record<string, CodingDraftDto>>({});
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => new Set());
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(() => new Set());
  const [difficultyMap, setDifficultyMap] = useState<Record<string, string>>({});
  const [problemTab, setProblemTab] = useState<"description" | "submissions">("description");
  const [outputOpen, setOutputOpen] = useState(false);

  const stopWatchRef = useRef<(() => void) | null>(null);
  const lastAlertRef = useRef<Record<string, number>>({});
  const bypassUnloadRef = useRef<boolean>(false);

  // Preload Monaco editor bundle in parallel with attempt API call
  useEffect(() => {
    void import("../../components/candidate/coding/monacoSetup").then(() => import("@monaco-editor/react"));
  }, []);

  // Load attempt & first problem
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const info = await getCodingAttemptInfo(examId);
        if (cancelled) return;
        setAttemptInfo(info);
        if (info.expiresAt && info.serverTime) {
          const rem = new Date(info.expiresAt).getTime() - new Date(info.serverTime).getTime();
          setRemainingMs(Math.max(0, rem));
        }
        if (info.questionIds.length > 0) {
          setActiveProblemId(info.questionIds[0]);
        }
      } catch (e: any) {
        if (!cancelled) {
          // 401 → redirect to coding login (token missing or expired)
          const msg: string = e?.message || "";
          if (msg.includes("401") || msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("unauthorized")) {
            window.location.href = `/candidate/coding/login?examId=${examId}`;
            return;
          }
          setPageError(msg || "Failed to load exam.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  // Countdown tick
  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Load problem & restore autosaved code (server draft primary, localStorage offline fallback)
  useEffect(() => {
    if (!activeProblemId) return;
    let cancelled = false;
    (async () => {
      try {
        const [p, drafts] = await Promise.all([
          getCodingProblem(activeProblemId),
          getCodingDrafts(activeProblemId, examId).catch(() => [] as CodingDraftDto[]),
        ]);
        if (cancelled) return;
        setProblem(p);
        setProblemTab("description");
        setDifficultyMap((prev) => ({ ...prev, [p.id]: p.difficulty }));
        const draftMap: Record<string, CodingDraftDto> = {};
        for (const d of drafts) draftMap[d.language] = d;
        setServerDrafts(draftMap);

        const firstLang = p.allowedLanguages[0] || "python3";
        setLanguage(firstLang);
        const savedLocal = localStorage.getItem(`coding_autosave_${examId}_${p.id}_${firstLang}`);
        const serverCode = draftMap[firstLang]?.code;
        setCode(serverCode ?? savedLocal ?? p.starterCode[firstLang] ?? DEFAULT_STARTER_TEMPLATES[firstLang] ?? "");
        const subs = await listProblemSubmissions(p.id);
        if (!cancelled) {
          setSubmissions(subs);
          if (subs.length > 0) {
            setSubmittedIds((prev) => {
              const next = new Set(prev);
              next.add(p.id);
              return next;
            });
          }
        }
      } catch (e) {
        if (!cancelled) setPageError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProblemId, examId]);

  // Debounced server autosave + localStorage offline fallback
  useEffect(() => {
    if (!problem) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(`coding_autosave_${examId}_${problem.id}_${language}`, code);
      } catch {
        // ignore storage quota errors
      }
      void saveCodingDraft({ examId, questionId: problem.id, language, code })
        .then((saved) => {
          setServerDrafts((prev) => ({ ...prev, [saved.language]: saved }));
        })
        .catch(() => {
          // offline fallback retained in localStorage
        });
    }, 1500);
    return () => window.clearTimeout(t);
  }, [code, language, problem, examId]);

  // Warn before leaving unless exam is being finalized
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (bypassUnloadRef.current) return;
      e.preventDefault();
      e.returnValue = "Your coding assessment is in progress.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Hook into existing proctoring/anti-cheat alerts (no undisclosed tracking)
  useEffect(() => {
    const cid = session?.profile?.dbCandidateId;
    if (!cid) return;
    const report = (alertType: string, message: string) => {
      const now = Date.now();
      if (now - (lastAlertRef.current[alertType] || 0) < 3000) return;
      lastAlertRef.current[alertType] = now;
      void reportProctorAlert({
        candidateId: cid,
        attemptId: attemptInfo?.attemptId,
        alertType,
        message,
        severity: "HIGH",
      }).catch(() => {});
    };

    const onVis = () => {
      if (document.visibilityState === "hidden") report("TAB_SWITCH", "Candidate switched tab during Coding Round");
    };
    const onBlur = () => report("WINDOW_BLUR", "Candidate window lost focus during Coding Round");
    const pastePolicy = (attemptInfo?.pastePolicy || import.meta.env.VITE_CODING_PASTE_POLICY || "flag").toLowerCase();
    const onPaste = (e: ClipboardEvent) => {
      if (pastePolicy === "ignore") return;
      if (pastePolicy === "block") {
        e.preventDefault();
      }
      report("CLIPBOARD_PASTE", `Candidate pasted content during Coding Round (policy=${pastePolicy})`);
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste);
    };
  }, [session?.profile?.dbCandidateId, attemptInfo?.attemptId]);

  const handleLanguageChange = (newLang: string) => {
    if (problem && language && newLang !== language) {
      // Flush current tab edits immediately so rapid tab switches never lose unsaved code
      try {
        localStorage.setItem(`coding_autosave_${examId}_${problem.id}_${language}`, code);
      } catch {
        // ignore storage quota errors
      }
      setServerDrafts((prev) => ({
        ...prev,
        [language]: { questionId: problem.id, language, code, updatedAt: new Date().toISOString() },
      }));
    }
    setLanguage(newLang);
    if (!problem) return;
    const serverCode = serverDrafts[newLang]?.code;
    const savedLocal = localStorage.getItem(`coding_autosave_${examId}_${problem.id}_${newLang}`);
    setCode(serverCode ?? savedLocal ?? problem.starterCode[newLang] ?? DEFAULT_STARTER_TEMPLATES[newLang] ?? "");
  };

  const handleResetCode = () => {
    if (!problem) return;
    const starter = problem.starterCode[language] ?? DEFAULT_STARTER_TEMPLATES[language] ?? "";
    setCode(starter);
  };

  const startWatching = useCallback((submissionId: number) => {
    if (stopWatchRef.current) stopWatchRef.current();
    stopWatchRef.current = watchSubmissionResult(
      submissionId,
      (statusData) => {
        setResult(statusData);
        if (statusData.status === "QUEUED") setUiState("queued");
        else if (statusData.status === "RUNNING") setUiState("running");
        else setUiState("done");
      },
      (err) => {
        setExecError(err);
        setUiState("error");
      }
    );
  }, []);

  const handleRun = useCallback(async () => {
    if (!problem) return;
    setExecError(null);
    setUiState("queued");
    setOutputOpen(true);
    try {
      const res = await runCodingCode({
        examId,
        questionId: problem.id,
        language,
        code,
        customInput: useCustomInput ? customInput : undefined,
        idempotencyKey: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      startWatching(res.submissionId);
    } catch (e) {
      setExecError((e as Error).message);
      setUiState("error");
    }
  }, [problem, examId, language, code, useCustomInput, customInput, startWatching]);

  const handleSubmit = useCallback(async () => {
    if (!problem) return;
    setExecError(null);
    setUiState("queued");
    setOutputOpen(true);
    try {
      const res = await submitCodingCode({
        examId,
        questionId: problem.id,
        language,
        code,
        idempotencyKey: `sub-${problem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      setSubmittedIds((prev) => {
        const next = new Set(prev);
        next.add(problem.id);
        return next;
      });
      startWatching(res.submissionId);
    } catch (e) {
      setExecError((e as Error).message);
      setUiState("error");
    }
  }, [problem, examId, language, code, startWatching]);

  // Keyboard shortcuts: Ctrl+' (Run), Ctrl+Enter (Submit)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        void handleRun();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRun, handleSubmit]);

  if (loading) {
    return (
      <main
        className="exam-fullscreen-view"
        style={{
          height: "100vh",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#f8fafc",
        }}
      >
        <style>{`
          @keyframes codingFadePulse {
            0%, 100% { opacity: 0.45; }
            50% { opacity: 0.9; }
          }
          .coding-skel-pulse {
            animation: codingFadePulse 1.4s ease-in-out infinite;
            background: #e2e8f0;
            border-radius: 8px;
          }
        `}</style>
        <header className="exam-top-nav" style={{ flexShrink: 0, width: "100%", boxSizing: "border-box" }}>
          <div className="exam-nav-left">
            <img src={kalpanaaLogo} alt="Kalpanaaa Software Solutions" className="exam-nav-logo" />
            <div className="exam-dept-pill">
              <Code2 size={13} />
              <span>Round 2 &middot; Coding Assessment</span>
            </div>
          </div>
          <div className="exam-nav-center">
            <div className="coding-skel-pulse" style={{ width: "240px", height: "30px" }} />
          </div>
          <div className="exam-nav-right" style={{ gap: "8px" }}>
            <div className="coding-skel-pulse" style={{ width: "90px", height: "32px" }} />
            <div className="coding-skel-pulse" style={{ width: "76px", height: "32px" }} />
            <div className="coding-skel-pulse" style={{ width: "86px", height: "32px" }} />
          </div>
        </header>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "42% 1fr", gap: "8px", padding: "12px", minHeight: 0 }}>
          <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="coding-skel-pulse" style={{ width: "65%", height: "24px" }} />
            <div className="coding-skel-pulse" style={{ width: "40%", height: "14px" }} />
            <div className="coding-skel-pulse" style={{ width: "100%", height: "14px", marginTop: "8px" }} />
            <div className="coding-skel-pulse" style={{ width: "92%", height: "14px" }} />
            <div className="coding-skel-pulse" style={{ width: "80%", height: "14px" }} />
            <div className="coding-skel-pulse" style={{ width: "100%", height: "110px", marginTop: "12px" }} />
          </div>
          <div style={{ display: "grid", gridTemplateRows: "62% 1fr", gap: "8px", minHeight: 0 }}>
            <div className="coding-skel-pulse" style={{ width: "100%", height: "100%", background: "#1e293b" }} />
            <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div className="coding-skel-pulse" style={{ width: "45%", height: "20px" }} />
              <div className="coding-skel-pulse" style={{ width: "100%", height: "64px" }} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (pageError || !problem) {
    return (
      <div style={{ padding: "32px", maxWidth: "560px", margin: "48px auto", background: "#fff", borderRadius: "12px", border: "1px solid #fecaca", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b91c1c", fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>
          <AlertCircle size={18} /> Unable to open Coding Round
        </div>
        <p style={{ margin: "0 0 18px", color: "#475569", fontSize: "14px" }}>{pageError || "No coding problems available."}</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <a
            href={`/candidate/coding/results?examId=${examId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", background: "#017846", color: "#fff", fontWeight: 600, fontSize: "13px", textDecoration: "none" }}
          >
            <Award size={14} /> View Coding Results
          </a>
          <a
            href={`/candidate/coding/login?examId=${examId}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", color: "#0f172a", fontWeight: 600, fontSize: "13px", textDecoration: "none" }}
          >
            Back to Round 2 Login
          </a>
        </div>
      </div>
    );
  }

  const isBusy = uiState === "queued" || uiState === "running";
  const questionIds = attemptInfo?.questionIds ?? [problem.id];
  const totalQuestions = questionIds.length || 1;
  const activeIndex = Math.max(0, questionIds.indexOf(activeProblemId));
  const completedCount = submittedIds.size;
  const progressPercent = Math.min(100, Math.round(((completedCount > 0 ? completedCount : activeIndex + 1) / totalQuestions) * 100));
  const isFlagged = flaggedIds.has(problem.id);

  const candidateName = session?.profile?.name || "Candidate";
  const candidateReg = session?.profile?.candidateId || "ROUND-2";
  const candidateInitial = candidateName.trim().charAt(0).toUpperCase() || "C";

  const difficultyColors = (diff: string) => {
    const d = (diff || "").toLowerCase();
    if (d === "hard") return { bg: "#fef2f2", text: "#b91c1c" };
    if (d === "medium") return { bg: "#fffbeb", text: "#b45309" };
    return { bg: "#eaf6ef", text: "#017846" };
  };

  const activeDiffColors = difficultyColors(problem.difficulty);

  const toggleFlag = (qid: string) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  };

  return (
    <main
      className="exam-fullscreen-view"
      style={{
        height: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#f8fafc",
      }}
    >
      {/* Top Bar */}
      <header
        className="exam-top-nav"
        style={{
          flexShrink: 0,
          width: "100%",
          boxSizing: "border-box",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <div className="exam-nav-left" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src={kalpanaaLogo}
            alt="Kalpanaaa Software Solutions"
            className="exam-nav-logo"
          />
          <div className="exam-dept-pill">
            <Code2 size={13} />
            <span>Round 2 &middot; Coding Assessment</span>
          </div>
        </div>

        {/* Center Progress Bar */}
        <div
          className="exam-nav-center"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "5px",
            minWidth: "200px",
          }}
        >
          <div
            style={{
              width: "180px",
              height: "5px",
              borderRadius: "999px",
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#017846",
                borderRadius: "999px",
                transition: "width 0.25s ease",
              }}
            />
          </div>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
            Progress: <strong style={{ color: "#0f172a" }}>{completedCount > 0 ? completedCount : activeIndex + 1} / {totalQuestions}</strong>
          </span>
        </div>

        {/* Right Controls: Timer, Candidate Chip, Finish Exam */}
        <div className="exam-nav-right" style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <div
            aria-label="Remaining time"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "999px",
              border: remainingMs < 300000 ? "1px solid #fecaca" : "1px solid #d9e6df",
              background: remainingMs < 300000 ? "#fef2f2" : "#eaf6ef",
              color: remainingMs < 300000 ? "#b91c1c" : "#014d32",
              fontWeight: 700,
              fontSize: "13px",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            <Clock3 size={14} /> {formatRemaining(remainingMs)}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              paddingRight: "4px",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                background: "#eaf6ef",
                color: "#017846",
                fontWeight: 700,
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {candidateInitial}
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                {candidateName}
              </span>
              <span style={{ fontSize: "10.5px", color: "#64748b", whiteSpace: "nowrap" }}>
                {candidateReg}
              </span>
            </div>
          </div>

          <a
            href={`/candidate/coding/results?examId=${examId}`}
            title="View Coding Results"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid #d9e6df",
              background: "#f3faf6",
              color: "#017846",
              fontWeight: 600,
              fontSize: "12px",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            <Award size={13} /> Results
          </a>

          <button
            type="button"
            disabled={finishing}
            onClick={() => setShowFinishModal(true)}
            title="Submit all and end Coding Round"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "7px 14px",
              borderRadius: "8px",
              border: "1px solid #fca5a5",
              background: "#ffffff",
              color: "#b91c1c",
              fontWeight: 700,
              fontSize: "12.5px",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            <CheckCircle2 size={14} /> Finish Exam
          </button>
        </div>
      </header>

      {/* 3-Column Workspace */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "148px minmax(340px, 1fr) minmax(420px, 1.05fr)",
          gap: "14px",
          padding: "14px 18px",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Left Sidebar: Questions Rail */}
        <aside
          aria-label="Coding questions"
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            padding: "14px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            overflowY: "auto",
            minHeight: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", paddingBottom: "4px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>Questions</span>
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 500 }}>
              {activeIndex + 1} / {totalQuestions}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {questionIds.map((qid, idx) => {
              const isActive = qid === activeProblemId;
              const isSolved = submittedIds.has(qid);
              const qFlagged = flaggedIds.has(qid);
              const diffLabel = difficultyMap[qid] || (isActive ? problem.difficulty : "");
              const dCol = difficultyColors(diffLabel);
              return (
                <button
                  key={qid}
                  type="button"
                  onClick={() => setActiveProblemId(qid)}
                  style={{
                    width: "100%",
                    padding: "10px 8px",
                    borderRadius: "10px",
                    border: isActive ? "1.5px solid #017846" : "1px solid #e2e8f0",
                    background: isActive ? "#f3faf6" : "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "5px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        width: "7px",
                        height: "7px",
                        borderRadius: "50%",
                        background: isSolved ? "#017846" : qFlagged ? "#f59e0b" : isActive ? "#017846" : "#cbd5e1",
                      }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                      Q{idx + 1}
                    </span>
                  </div>
                  {diffLabel && (
                    <span
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 600,
                        padding: "1px 8px",
                        borderRadius: "999px",
                        background: dCol.bg,
                        color: dCol.text,
                      }}
                    >
                      {diffLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Middle Column: Problem Card */}
        <section
          aria-label="Problem statement"
          style={{
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {/* Card Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              padding: "12px 18px",
              borderBottom: "1px solid #e2e8f0",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#017846" }}>
                Question {activeIndex + 1} of {totalQuestions}
              </span>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: "999px",
                  background: activeDiffColors.bg,
                  color: activeDiffColors.text,
                }}
              >
                {problem.difficulty}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = problemTab === "description" ? "submissions" : "description";
                  setProblemTab(next);
                  if (next === "submissions") {
                    void listProblemSubmissions(problem.id).then(setSubmissions).catch(() => {});
                  }
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "3px 9px",
                  borderRadius: "999px",
                  border: "1px solid #e2e8f0",
                  background: problemTab === "submissions" ? "#017846" : "#f8fafc",
                  color: problemTab === "submissions" ? "#ffffff" : "#475569",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {problemTab === "submissions" ? <FileText size={12} /> : <History size={12} />}
                {problemTab === "submissions" ? "Description" : `Submissions (${submissions.length})`}
              </button>
            </div>

            <button
              type="button"
              onClick={() => toggleFlag(problem.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 11px",
                borderRadius: "8px",
                border: isFlagged ? "1px solid #f59e0b" : "1px solid #e2e8f0",
                background: isFlagged ? "#fffbeb" : "#ffffff",
                color: isFlagged ? "#b45309" : "#475569",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Flag size={13} /> {isFlagged ? "Flagged" : "Flag for review"}
            </button>
          </div>

          {/* Scrollable Problem Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
            {problemTab === "description" ? (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
                  <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#0f172a" }}>
                    {problem.title}
                  </h2>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>
                    {problem.maxMarks} pts · {problem.timeLimitMs}ms
                  </span>
                </div>

                <div style={{ fontSize: "14px", lineHeight: 1.65, color: "#1e293b", whiteSpace: "pre-wrap", marginBottom: "16px" }}>
                  {problem.problemStatement}
                </div>

                {(problem.inputFormat || problem.outputFormat || problem.constraints) && (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      background: "#f3faf6",
                      borderLeft: "3px solid #017846",
                      marginBottom: "18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#1e293b",
                    }}
                  >
                    {problem.inputFormat && (
                      <div>
                        <strong>Input Format:</strong> {problem.inputFormat}
                      </div>
                    )}
                    {problem.outputFormat && (
                      <div>
                        <strong>Output Format:</strong> {problem.outputFormat}
                      </div>
                    )}
                    {problem.constraints && (
                      <div>
                        <strong>Constraints:</strong>{" "}
                        <code style={{ fontSize: "12.5px", color: "#0f172a" }}>{problem.constraints}</code>
                      </div>
                    )}
                  </div>
                )}

                {problem.sampleTestCases.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {problem.sampleTestCases.map((tc, i) => (
                      <div key={tc.id}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                          Example {i + 1}: {tc.label}
                        </div>
                        <div
                          style={{
                            padding: "10px 12px",
                            borderRadius: "8px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            fontSize: "12.5px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div>
                            <span style={{ color: "#64748b", fontWeight: 600 }}>Input:</span>
                            <pre style={{ margin: "3px 0 0", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{tc.input}</pre>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", fontWeight: 600 }}>Expected Output:</span>
                            <pre style={{ margin: "3px 0 0", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>{tc.expectedOutput}</pre>
                          </div>
                          {tc.explanation && (
                            <div style={{ color: "#475569", fontSize: "12px" }}>
                              <strong>Explanation:</strong> {tc.explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {submissions.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: "13px" }}>No submissions yet for this problem.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {submissions.map((s) => (
                      <div
                        key={s.submissionId}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "13px",
                        }}
                      >
                        <div>
                          <strong style={{ color: s.verdict === "ACCEPTED" ? "#017846" : "#b91c1c" }}>{s.verdict}</strong>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {s.language} · {s.passedCount}/{s.totalCount} tests · {s.score}/{s.maxMarks} pts
                          </div>
                        </div>
                        <div style={{ textAlign: "right", fontSize: "12px", color: "#475569" }}>
                          {s.runtimeMs !== null && s.runtimeMs !== undefined ? `${s.runtimeMs} ms` : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Editor + Run/Submit + Collapsible Test Output */}
        <section
          aria-label="Code editor and output"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {/* Editor Card */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              borderRadius: "12px",
              overflow: "hidden",
              border: theme === "vs-dark" ? "1px solid #1e293b" : "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <CodingEditorPane
              language={language}
              allowedLanguages={problem.allowedLanguages.length ? problem.allowedLanguages : ["python3"]}
              code={code}
              theme={theme}
              fontSize={fontSize}
              onLanguageChange={handleLanguageChange}
              onCodeChange={setCode}
              onThemeToggle={() => setTheme((t) => (t === "vs-dark" ? "light" : "vs-dark"))}
              onFontSizeChange={setFontSize}
              onResetCode={handleResetCode}
            />
          </div>

          {/* Action Bar: Run Code & Submit Code */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", flexShrink: 0 }}>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleRun()}
              title="Run Sample Tests (Ctrl+')"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#017846",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: isBusy ? "not-allowed" : "pointer",
                opacity: isBusy ? 0.7 : 1,
                boxShadow: "0 1px 3px rgba(1, 120, 70, 0.25)",
              }}
            >
              <Play size={14} fill="currentColor" /> Run Code
            </button>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleSubmit()}
              title="Submit Solution (Ctrl+Enter)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 18px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 600,
                fontSize: "13px",
                cursor: isBusy ? "not-allowed" : "pointer",
                opacity: isBusy ? 0.7 : 1,
              }}
            >
              <Send size={14} /> Submit Code
            </button>
          </div>

          {/* Collapsible Test Output Card */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderBottom: outputOpen ? "1px solid #e2e8f0" : "none",
                background: "#ffffff",
              }}
            >
              <button
                type="button"
                onClick={() => setOutputOpen((o) => !o)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#0f172a",
                  cursor: "pointer",
                }}
              >
                {outputOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                Test Output
              </button>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#475569",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Custom Input
                <span
                  role="switch"
                  aria-checked={useCustomInput}
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    const next = !useCustomInput;
                    setUseCustomInput(next);
                    if (next) setOutputOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      const next = !useCustomInput;
                      setUseCustomInput(next);
                      if (next) setOutputOpen(true);
                    }
                  }}
                  style={{
                    width: "34px",
                    height: "18px",
                    borderRadius: "999px",
                    background: useCustomInput ? "#017846" : "#cbd5e1",
                    position: "relative",
                    transition: "background 0.15s ease",
                    display: "inline-block",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: useCustomInput ? "18px" : "2px",
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      transition: "left 0.15s ease",
                    }}
                  />
                </span>
              </label>
            </div>

            {outputOpen && (
              <div style={{ height: "210px", overflow: "hidden" }}>
                <TestcaseResultPane
                  sampleCases={problem.sampleTestCases}
                  customInput={customInput}
                  useCustomInput={useCustomInput}
                  onCustomInputChange={setCustomInput}
                  uiState={uiState}
                  result={result}
                  errorMsg={execError}
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {showFinishModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px",
          }}
        >
          <div style={{ background: "#fff", borderRadius: "14px", maxWidth: "440px", width: "100%", padding: "24px", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", color: "#0f172a" }}>Finish &amp; End Coding Round?</h3>
            <p style={{ margin: "0 0 18px", fontSize: "13.5px", color: "#475569", lineHeight: 1.5 }}>
              Make sure you have clicked <strong>Submit</strong> on every problem you want graded. Once finalized, your attempt is locked and you cannot re-enter.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary"
                disabled={finishing}
                onClick={() => setShowFinishModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={finishing}
                onClick={async () => {
                  setFinishing(true);
                  try {
                    await finalizeCodingExam(examId);
                    bypassUnloadRef.current = true;
                    window.location.assign(`/candidate/coding/results?examId=${examId}`);
                  } catch (e) {
                    setExecError((e as Error).message);
                    setShowFinishModal(false);
                    setFinishing(false);
                  }
                }}
              >
                {finishing ? "Finalizing..." : "Confirm & End Exam"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
