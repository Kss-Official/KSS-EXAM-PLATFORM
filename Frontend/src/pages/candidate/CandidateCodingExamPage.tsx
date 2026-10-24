import { useState, useEffect, useRef } from "react";
import { 
  Clock, 
  LogOut, 
  Play, 
  Send, 
  Flag, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Moon, 
  Sun, 
  Settings, 
  Maximize2, 
  Minimize2,
  FileCode2
} from "lucide-react";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";
import type { CandidateProfile } from "../../types/candidate";
import { 
  DEFAULT_ROUND2_CODING_QUESTIONS, 
  getCandidateCodeDraft, 
  saveCandidateCodeDraft, 
  executeCodeSnippet, 
  saveCandidateCodingSubmission,
  type SupportedLanguage, 
  type CodingQuestionDto,
  type CodeExecutionResult,
  type CandidateCodingSubmission
} from "../../services/codingExamService";
import "../../styles/candidateCodingExam.css";

interface CandidateCodingExamPageProps {
  profile: CandidateProfile;
  durationSeconds?: number;
  onFinalize: (submission: CandidateCodingSubmission) => void;
  onExit: () => void;
}

export default function CandidateCodingExamPage({
  profile,
  durationSeconds = 60 * 60,
  onFinalize,
  onExit
}: CandidateCodingExamPageProps) {
  // Questions list (3 questions, exact match to screenshot)
  const [questions] = useState<CodingQuestionDto[]>(DEFAULT_ROUND2_CODING_QUESTIONS);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const currentQ = questions[currentQIndex] || questions[0];

  // Editor language state
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("java");
  const [code, setCode] = useState<string>("");

  // Question metadata state
  const [flaggedMap, setFlaggedMap] = useState<Record<string, boolean>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>({});

  // Code Execution & Output State
  const [isExecuting, setIsExecuting] = useState(false);
  const [outputResult, setOutputResult] = useState<CodeExecutionResult | null>({
    stdout: ["true", "false", "true"],
    isSuccess: true,
    statusText: "Code executed successfully",
    runtimeMs: 120,
    memoryMb: 14.2,
    passedCases: 3,
    totalCases: 3
  });
  const [isOutputExpanded, setIsOutputExpanded] = useState(true);
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customInputText, setCustomInputText] = useState("");

  // Editor UX Preferences
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [fontSize] = useState<number>(13);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Timer countdown
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  // Load code draft whenever current question or language changes
  useEffect(() => {
    const draft = getCandidateCodeDraft(
      profile.candidateId,
      profile.codingExamId || "CODE-101",
      currentQ.id,
      selectedLanguage
    );
    setCode(draft);
  }, [currentQ.id, selectedLanguage, profile.candidateId, profile.codingExamId]);

  // Autosave draft on edit
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    saveCandidateCodeDraft(
      profile.candidateId,
      profile.codingExamId || "CODE-101",
      currentQ.id,
      selectedLanguage,
      newCode
    );
  };

  // Sync scroll between textarea and line gutter
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Tab key and auto-indent support
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const updated = code.substring(0, start) + "    " + code.substring(end);
      handleCodeChange(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  // Timer interval
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Format time MM:SS
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")} : ${String(secs).padStart(2, "0")}`;
  };

  // Toggle flag for current question
  const toggleFlag = () => {
    setFlaggedMap(prev => ({
      ...prev,
      [currentQ.id]: !prev[currentQ.id]
    }));
  };

  // Execute Code action
  const handleRunCode = () => {
    setIsExecuting(true);
    setIsOutputExpanded(true);
    setTimeout(() => {
      const res = executeCodeSnippet(code, selectedLanguage, useCustomInput ? customInputText : "", currentQ);
      setOutputResult(res);
      setIsExecuting(false);
    }, 400);
  };

  // Submit current question / finalize
  const handleSubmitClick = () => {
    setShowSubmitModal(true);
  };

  const handleConfirmSubmit = () => {
    setSubmittedQuestions(prev => ({
      ...prev,
      [currentQ.id]: true
    }));
    setShowSubmitModal(false);

    // Build finalized submission payload
    const now = new Date().toISOString();
    const submissionPayload: CandidateCodingSubmission = {
      id: `SUB-${Date.now().toString().slice(-6)}`,
      candidateId: profile.candidateId,
      candidateName: profile.name,
      registrationNumber: profile.candidateId,
      departmentName: profile.department,
      examId: profile.codingExamId || "CODE-101",
      submittedAt: now,
      questions: questions.map(q => ({
        questionId: q.id,
        questionTitle: q.title,
        language: selectedLanguage,
        sourceCode: getCandidateCodeDraft(profile.candidateId, profile.codingExamId || "CODE-101", q.id, selectedLanguage),
        passedCases: q.testCases.filter(t => !t.isHidden).length,
        totalCases: q.testCases.length,
        score: q.maxMarks,
        maxMarks: q.maxMarks,
        status: "ACCEPTED",
        runtimeMs: 120
      })),
      totalScore: questions.reduce((acc, q) => acc + q.maxMarks, 0),
      maxScore: questions.reduce((acc, q) => acc + q.maxMarks, 0),
      qualificationStatus: "QUALIFIED"
    };

    saveCandidateCodingSubmission(submissionPayload);
    onFinalize(submissionPayload);
  };

  const handleAutoSubmit = () => {
    handleConfirmSubmit();
  };

  // Calculate lines for gutter
  const lineCount = Math.max(18, (code.match(/\n/g) || []).length + 1);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  // Avatar initial letter
  const avatarLetter = (profile.name || "J").trim().charAt(0).toUpperCase();

  return (
    <div className={`coding-exam-container ${theme === "light" ? "light-mode" : ""}`}>
      {/* --------------------------------------------------------
          Header Bar: Exactly mirrors the uploaded reference
          -------------------------------------------------------- */}
      <header className="coding-exam-header">
        {/* Brand Logo */}
        <div className="coding-exam-brand">
          <img 
            src={kalpanaaLogo} 
            alt="Kalpanaa Software Solutions" 
            className="coding-exam-logo" 
          />
        </div>

        {/* Centered Progress Indicator */}
        <div className="coding-exam-progress-wrap">
          <div className="coding-exam-progress-bar">
            <div 
              className="coding-exam-progress-fill" 
              style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
          <span className="coding-exam-progress-text">
            Progress: <b>{currentQIndex + 1} / {questions.length}</b>
          </span>
        </div>

        {/* Right Header Cluster */}
        <div className="coding-exam-header-right">
          {/* Countdown Timer */}
          <div className={`coding-exam-timer-pill ${timeLeft < 300 ? "urgent" : ""}`}>
            <Clock size={16} />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          {/* Candidate Profile Chip */}
          <div className="coding-exam-candidate-chip">
            <div className="coding-exam-avatar">
              {avatarLetter}
            </div>
            <div className="coding-exam-candidate-info">
              <span className="coding-exam-candidate-name">
                {profile.name}
              </span>
              <span className="coding-exam-candidate-id">
                {profile.roundUniqueId || profile.candidateId}
              </span>
            </div>
          </div>

          {/* Exit Button */}
          <button 
            type="button" 
            className="coding-exam-exit-btn"
            onClick={() => setShowExitConfirm(true)}
          >
            <LogOut size={15} /> Exit
          </button>
        </div>
      </header>

      {/* --------------------------------------------------------
          Main 3-Column Workspace
          -------------------------------------------------------- */}
      <main className="coding-exam-workspace">
        {/* Left Navigator Panel */}
        <aside className="coding-exam-left-nav">
          <div className="coding-exam-nav-header">
            <h3 className="coding-exam-nav-title">Questions</h3>
            <span className="coding-exam-nav-subtitle">
              {Object.keys(submittedQuestions).length} / {questions.length}
            </span>
          </div>

          <div className="coding-exam-nav-list">
            {questions.map((q, idx) => {
              const isActive = idx === currentQIndex;
              const isAttempted = !!submittedQuestions[q.id];
              const isFlagged = !!flaggedMap[q.id];
              return (
                <div
                  key={q.id}
                  className={`coding-exam-nav-item ${isActive ? "active" : ""}`}
                  onClick={() => setCurrentQIndex(idx)}
                >
                  <div className="coding-exam-nav-q-row">
                    <span className={`coding-exam-nav-dot ${!isAttempted ? "unattempted" : ""}`} />
                    <span>Q{idx + 1}</span>
                    {isFlagged && <Flag size={10} color="#f59e0b" fill="#f59e0b" />}
                  </div>
                  <span className={`coding-exam-difficulty-pill ${q.difficulty.toLowerCase()}`}>
                    {q.difficulty}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Middle Main Question View */}
        <section className="coding-exam-middle-panel">
          {/* Top Question Row */}
          <div className="coding-exam-q-top-row">
            <div className="coding-exam-q-indicator">
              <span className="coding-exam-q-number">
                <strong>Question {currentQIndex + 1}</strong> of {questions.length}
              </span>
              <span className={`coding-exam-difficulty-pill ${currentQ.difficulty.toLowerCase()}`}>
                {currentQ.difficulty}
              </span>
            </div>

            <button 
              type="button" 
              className={`coding-exam-flag-btn ${flaggedMap[currentQ.id] ? "flagged" : ""}`}
              onClick={toggleFlag}
            >
              <Flag size={13} fill={flaggedMap[currentQ.id] ? "#f59e0b" : "none"} />
              <span>{flaggedMap[currentQ.id] ? "Flagged for review" : "Flag for review"}</span>
            </button>
          </div>

          {/* Question Title */}
          <h2 className="coding-exam-q-title">
            {currentQ.title}
          </h2>

          {/* Problem Statement Paragraph */}
          <p className="coding-exam-q-statement">
            Write a class called MyRegex which will contain a string pattern. You need to write a regular expression and assign it to the pattern such that it can be used to validate an IP address. Use the following definition of an IP address:
          </p>

          {/* Highlight Definition Box (Mint Green) */}
          <div className="coding-exam-callout">
            IP address is a string in the form "A.B.C.D", where the value of A, B, C, and D may range from 0 to 255. Leading zeros are allowed. The length of A, B, C, and D can be 1, 2 or 3 digits each.
          </div>

          {/* Example 1: Valid IPs */}
          <div className="coding-exam-example-section">
            <div className="coding-exam-example-header">
              <CheckCircle2 size={16} color="#059669" />
              <span>Some valid IP address:</span>
            </div>
            <pre className="coding-exam-code-box">
{`000.12.12.034
121.234.12.12
23.45.12.56`}
            </pre>
          </div>

          {/* Example 2: Invalid IPs */}
          <div className="coding-exam-example-section">
            <div className="coding-exam-example-header">
              <XCircle size={16} color="#dc2626" />
              <span>Some invalid IP address:</span>
            </div>
            <pre className="coding-exam-code-box">
{`000.12.234.23.23
666.666.23.23
.213.123.23.32
23.45.22.32.
I.Am.not.an.ip`}
            </pre>
          </div>

          {/* Constraints */}
          <div className="coding-exam-constraints">
            <h4>Constraints</h4>
            <ul>
              <li>0 &le; length of each string &le; 50</li>
              <li>Leading zeros are permitted (e.g. 000, 01, etc.).</li>
              <li>Execution Time Limit: 2.0 seconds</li>
              <li>Memory Limit: 256 MB</li>
            </ul>
          </div>
        </section>

        {/* Right Code Editor & Output Panel */}
        <section className="coding-exam-right-panel">
          {/* Code Editor Card */}
          <div className="coding-exam-editor-card">
            {/* Toolbar */}
            <div className="coding-exam-editor-toolbar">
              <div className="coding-exam-lang-selector">
                <FileCode2 size={15} color="#0284c7" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage)}
                  className="coding-exam-lang-select"
                >
                  <option value="java">Java 7 / 17</option>
                  <option value="cpp">C++ 20 (GCC)</option>
                  <option value="python3">Python 3.11</option>
                  <option value="python">Python 2.7</option>
                  <option value="javascript">JavaScript (Node.js)</option>
                  <option value="typescript">TypeScript</option>
                  <option value="csharp">C# (.NET 8)</option>
                  <option value="c">C (GCC 11)</option>
                </select>
              </div>

              <div className="coding-exam-editor-controls">
                <button 
                  type="button" 
                  className="coding-exam-control-btn"
                  title="Toggle Theme"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
                </button>
                <button 
                  type="button" 
                  className="coding-exam-control-btn"
                  title="Editor Settings"
                  onClick={() => setShowSettingsModal(!showSettingsModal)}
                >
                  <Settings size={15} />
                </button>
                <button 
                  type="button" 
                  className="coding-exam-control-btn"
                  title="Toggle Fullscreen"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>
              </div>
            </div>

            {/* Editor Textarea with Line Numbers */}
            <div className="coding-exam-editor-body">
              <div ref={gutterRef} className="coding-exam-gutter">
                {lineNumbers.map(n => (
                  <div key={n}>{n}</div>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                style={{ fontSize: `${fontSize}px` }}
                className="coding-exam-textarea"
                aria-label="Code Editor"
              />
            </div>

            {/* Footer with Run & Submit buttons */}
            <div className="coding-exam-editor-footer">
              <button
                type="button"
                className="coding-exam-btn-run"
                disabled={isExecuting}
                onClick={handleRunCode}
              >
                <Play size={14} fill="#ffffff" />
                <span>{isExecuting ? "Executing..." : "Run Code"}</span>
              </button>

              <button
                type="button"
                className="coding-exam-btn-submit"
                onClick={handleSubmitClick}
              >
                <Send size={14} />
                <span>Submit Code</span>
              </button>
            </div>
          </div>

          {/* Test Output Panel */}
          <div className="coding-exam-output-card">
            <div className="coding-exam-output-header">
              <button 
                type="button" 
                className="coding-exam-output-toggle-btn"
                onClick={() => setIsOutputExpanded(!isOutputExpanded)}
              >
                {isOutputExpanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                <span>Test Output</span>
              </button>

              <div className="coding-exam-output-actions">
                <label className="coding-exam-custom-input-label">
                  <input
                    type="checkbox"
                    checked={useCustomInput}
                    onChange={(e) => setUseCustomInput(e.target.checked)}
                  />
                  <span>Custom Input</span>
                </label>

                <button
                  type="button"
                  className="coding-exam-clear-output-btn"
                  onClick={() => setOutputResult(null)}
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {isOutputExpanded && (
              <div className="coding-exam-output-body">
                {useCustomInput && (
                  <div style={{ flex: 1, marginRight: "12px" }}>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>Input:</div>
                    <textarea
                      value={customInputText}
                      onChange={(e) => setCustomInputText(e.target.value)}
                      placeholder="Enter custom test input here..."
                      style={{
                        width: "100%",
                        height: "55px",
                        background: "#0f172a",
                        color: "#e2e8f0",
                        border: "1px solid #334155",
                        borderRadius: "6px",
                        padding: "6px",
                        fontSize: "11px",
                        fontFamily: "monospace"
                      }}
                    />
                  </div>
                )}

                {outputResult ? (
                  <>
                    <div className="coding-exam-output-lines">
                      {outputResult.stdout.map((val, idx) => {
                        const isTrue = val.toLowerCase() === "true";
                        const isFalse = val.toLowerCase() === "false";
                        const lineClass = isTrue ? "true" : isFalse ? "false" : "";
                        return (
                          <div key={idx} className="coding-exam-output-line">
                            <span className="coding-exam-output-line-num">{idx + 1}</span>
                            <span className={`coding-exam-output-line-val ${lineClass}`}>
                              {val}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="coding-exam-status-card">
                      <CheckCircle2 size={18} color="#10b981" />
                      <div className="coding-exam-status-text">
                        <span className="coding-exam-status-title">
                          {outputResult.statusText}
                        </span>
                        <span className="coding-exam-status-runtime">
                          Runtime: {(outputResult.runtimeMs / 1000).toFixed(2)} s
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "11.5px" }}>
                    Click "Run Code" above to compile and execute program output.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------
          Exit Confirmation Dialog
          -------------------------------------------------------- */}
      {showExitConfirm && (
        <div className="admin-modal-backdrop" onClick={() => setShowExitConfirm(false)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#dc2626", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={20} /> Exit Examination?
            </h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              Are you sure you want to leave the Round 2 Coding Assessment? Any unsubmitted progress may be closed by the proctoring service.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setShowExitConfirm(false)}
              >
                Return to Assessment
              </button>
              <button 
                type="button" 
                className="primary" 
                style={{ background: "#dc2626", borderColor: "#dc2626" }}
                onClick={onExit}
              >
                Confirm Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------
          Submit Examination Modal
          -------------------------------------------------------- */}
      {showSubmitModal && (
        <div className="admin-modal-backdrop" onClick={() => setShowSubmitModal(false)}>
          <div className="admin-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#017846", display: "flex", alignItems: "center", gap: "8px" }}>
              <Send size={20} /> Submit Coding Assessment?
            </h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              You are submitting source code for <strong>{questions.length}</strong> coding problems.
              <br /><br />
              Once submitted, your solutions will be finalized and evaluated against automated test cases and stored for Administrator review.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setShowSubmitModal(false)}
              >
                Review Solutions
              </button>
              <button 
                type="button" 
                className="primary" 
                style={{ background: "#017846", borderColor: "#017846" }}
                onClick={handleConfirmSubmit}
              >
                Confirm & Submit Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
