import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Send, Clock3, AlertCircle } from "lucide-react";
import {
  getCodingAttemptInfo,
  getCodingProblem,
  listProblemSubmissions,
  runCodingCode,
  submitCodingCode,
  watchSubmissionResult,
  type CodingAttemptInfo,
  type CodingProblemPublic,
  type CodingSubmissionStatus,
} from "../../services/codingApi";
import { reportProctorAlert } from "../../services/api";
import { loadCandidateSession } from "../../services/candidateSessionStorage";
import SplitPane from "../../components/candidate/coding/SplitPane";
import ProblemDescriptionPane from "../../components/candidate/coding/ProblemDescriptionPane";
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

  const stopWatchRef = useRef<(() => void) | null>(null);
  const lastAlertRef = useRef<Record<string, number>>({});

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
      } catch (e) {
        if (!cancelled) setPageError((e as Error).message);
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

  // Load problem & restore autosaved code
  useEffect(() => {
    if (!activeProblemId) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await getCodingProblem(activeProblemId);
        if (cancelled) return;
        setProblem(p);
        const firstLang = p.allowedLanguages[0] || "python3";
        setLanguage(firstLang);
        const saved = localStorage.getItem(`coding_autosave_${examId}_${p.id}_${firstLang}`);
        setCode(saved ?? p.starterCode[firstLang] ?? DEFAULT_STARTER_TEMPLATES[firstLang] ?? "");
        const subs = await listProblemSubmissions(p.id);
        if (!cancelled) setSubmissions(subs);
      } catch (e) {
        if (!cancelled) setPageError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProblemId, examId]);

  // Debounced autosave
  useEffect(() => {
    if (!problem) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(`coding_autosave_${examId}_${problem.id}_${language}`, code);
      } catch {
        // ignore storage quota errors
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [code, language, problem, examId]);

  // Warn before leaving
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
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
    const onPaste = () => report("CLIPBOARD_PASTE", "Candidate pasted content during Coding Round");

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
    setLanguage(newLang);
    if (!problem) return;
    const saved = localStorage.getItem(`coding_autosave_${examId}_${problem.id}_${newLang}`);
    setCode(saved ?? problem.starterCode[newLang] ?? DEFAULT_STARTER_TEMPLATES[newLang] ?? "");
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
    try {
      const res = await submitCodingCode({
        examId,
        questionId: problem.id,
        language,
        code,
        idempotencyKey: `sub-${problem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading Round 2 Coding Workspace...</div>;
  }

  if (pageError || !problem) {
    return (
      <div style={{ padding: "40px", maxWidth: "560px", margin: "40px auto", background: "#fff", borderRadius: "12px", border: "1px solid #fecaca" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#b91c1c", fontWeight: 700, marginBottom: "8px" }}>
          <AlertCircle size={18} /> Unable to open Coding Round
        </div>
        <p style={{ margin: 0, color: "#475569", fontSize: "14px" }}>{pageError || "No coding problems available."}</p>
      </div>
    );
  }

  const isBusy = uiState === "queued" || uiState === "running";

  return (
    <div className="coding-exam-container" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="coding-exam-top-nav">
        <div className="coding-exam-nav-left">
          <span className="coding-exam-tag">Round 2: Coding</span>
          {attemptInfo && attemptInfo.questionIds.length > 1 && (
            <select
              aria-label="Select problem"
              value={activeProblemId}
              onChange={(e) => setActiveProblemId(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            >
              {attemptInfo.questionIds.map((qid, idx) => (
                <option key={qid} value={qid}>
                  Problem {idx + 1}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="coding-exam-nav-right">
          <div
            aria-label="Remaining time"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "8px",
              background: remainingMs < 300000 ? "#fef2f2" : "#f1f5f9",
              color: remainingMs < 300000 ? "#b91c1c" : "#0f172a",
              fontWeight: 700,
              fontSize: "13.5px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Clock3 size={15} /> {formatRemaining(remainingMs)}
          </div>

          <label style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#475569" }}>
            <input type="checkbox" checked={useCustomInput} onChange={(e) => setUseCustomInput(e.target.checked)} />
            Custom Input
          </label>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleRun()}
            title="Run Sample Tests (Ctrl+')"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontWeight: 600,
              fontSize: "13px",
              color: "#0f172a",
            }}
          >
            <Play size={14} /> Run
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
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "#017846",
              fontWeight: 600,
              fontSize: "13px",
              color: "#ffffff",
            }}
          >
            <Send size={14} /> Submit
          </button>
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0 }}>
        <SplitPane
          direction="horizontal"
          initialPercent={42}
          first={
            <ProblemDescriptionPane
              problem={problem}
              submissions={submissions}
              onRefreshSubmissions={() => void listProblemSubmissions(problem.id).then(setSubmissions).catch(() => {})}
            />
          }
          second={
            <SplitPane
              direction="vertical"
              initialPercent={62}
              first={
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
              }
              second={
                <TestcaseResultPane
                  sampleCases={problem.sampleTestCases}
                  customInput={customInput}
                  onCustomInputChange={setCustomInput}
                  uiState={uiState}
                  result={result}
                  errorMsg={execError}
                />
              }
            />
          }
        />
      </main>
    </div>
  );
}
