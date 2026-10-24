import { useState } from "react";
import { 
  ArrowLeft, 
  Save, 
  Calendar, 
  Code2, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Plus, 
  Trash2, 
  Copy,
  Terminal,
  FileCode2,
  Clock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Award,
  Layers
} from "lucide-react";
import { useRouter } from "../../router";
import { 
  ALL_SUPPORTED_LANGUAGES, 
  SAMPLE_INITIAL_CODING_QUESTION, 
  saveCodingExamDraft, 
  type CodingExamDto, 
  type CodingQuestionDto, 
  type TestCaseDto, 
  type SupportedLanguage 
} from "../../services/codingExamService";
import { createCodingExam, publishCodingExam } from "../../services/api";

const STANDARD_DEPARTMENTS = [
  { name: "Developer", code: "DEV", description: "Software & Web Development", recommended: true },
  { name: "Tester", code: "QA", description: "Quality Assurance & Automated Testing", recommended: true },
  { name: "Computer Science & Engineering", code: "CSE", description: "B.Tech Computer Science and Engineering", recommended: true },
  { name: "Information Technology", code: "IT", description: "B.Tech Information Technology", recommended: true },
  { name: "Electronics & Communication Engineering", code: "ECE", description: "B.Tech Electronics & Communication", recommended: false },
  { name: "Electrical & Electronics Engineering", code: "EEE", description: "B.Tech Electrical & Electronics", recommended: false },
  { name: "UI/UX", code: "UIUX", description: "User Interface & Experience Design", recommended: false },
  { name: "Marketing", code: "MKT", description: "Marketing & Growth", recommended: false },
  { name: "HR", code: "HR", description: "Human Resources & Recruitment", recommended: false }
];

export default function CreateCodingExamPage() {
  const { navigate } = useRouter();

  // 4-Step Progressive Wizard:
  // 1: Exam Identity & Timing
  // 2: Departments & Languages
  // 3: Coding Problems & Test Cases
  // 4: Review & Launch
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Examination Details
  const [title, setTitle] = useState("Core Data Structures & Algorithm Assessment (Round 2)");
  const [description, setDescription] = useState("Technical programming round evaluating data structure manipulation, time-space complexity optimization, and edge-case handling.");
  const [instructions, setInstructions] = useState("• Read the problem statement and constraint boundaries carefully before coding.\n• Standard input/output (stdin/stdout) must be used across all test cases.\n• Hidden test cases test extreme boundaries and memory/time limit bounds.\n• Do not print conversational text (e.g. 'Enter a number') in output.\n• You may submit multiple times; the highest score will be recorded.");
  const [durationMinutes, setDurationMinutes] = useState("90");
  const [timingMode, setTimingMode] = useState<"DURATION_FROM_START" | "SCHEDULED">("DURATION_FROM_START");
  const [examDate, setExamDate] = useState("2026-10-25");
  const [startTime, setStartTime] = useState("14:00");
  const [evaluationMode, setEvaluationMode] = useState<"ALL_OR_NOTHING" | "PARTIAL_PER_TESTCASE">("PARTIAL_PER_TESTCASE");
  const [qualificationPercentage, setQualificationPercentage] = useState("60");

  // Step 2: Departments & Programming Languages
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([
    "Developer", 
    "Tester", 
    "Computer Science & Engineering", 
    "Information Technology"
  ]);

  const [allowedLanguages, setAllowedLanguages] = useState<SupportedLanguage[]>([
    "cpp", 
    "java", 
    "python3", 
    "javascript", 
    "typescript"
  ]);

  // Step 3: Coding Questions & Test Cases
  const [questions, setQuestions] = useState<CodingQuestionDto[]>([
    { ...SAMPLE_INITIAL_CODING_QUESTION }
  ]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);

  // UI Notices & Publish Modal
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [backendExamId, setBackendExamId] = useState<number | null>(null);

  // Derived Computations
  const totalMarks = questions.reduce((acc, q) => acc + (Number(q.maxMarks) || 0), 0);
  const totalTestCases = questions.reduce((acc, q) => acc + (q.testCases?.length || 0), 0);
  const totalSampleTestCases = questions.reduce(
    (acc, q) => acc + (q.testCases?.filter(tc => !tc.isHidden).length || 0), 
    0
  );
  const totalHiddenTestCases = questions.reduce(
    (acc, q) => acc + (q.testCases?.filter(tc => tc.isHidden).length || 0), 
    0
  );

  const easyCount = questions.filter(q => q.difficulty === "Easy").length;
  const mediumCount = questions.filter(q => q.difficulty === "Medium").length;
  const hardCount = questions.filter(q => q.difficulty === "Hard").length;

  const currentQuestion = questions[activeQuestionIdx] || questions[0];

  // Helper Functions
  const handleToggleDepartment = (deptName: string) => {
    if (selectedDepartments.includes(deptName)) {
      setSelectedDepartments(selectedDepartments.filter(d => d !== deptName));
    } else {
      setSelectedDepartments([...selectedDepartments, deptName]);
    }
  };

  const handleSelectTechDepartments = () => {
    const techOnly = STANDARD_DEPARTMENTS.filter(d => d.recommended).map(d => d.name);
    setSelectedDepartments(techOnly);
  };

  const handleToggleLanguage = (langId: SupportedLanguage) => {
    if (allowedLanguages.includes(langId)) {
      if (allowedLanguages.length === 1) {
        alert("At least one programming language must remain enabled.");
        return;
      }
      setAllowedLanguages(allowedLanguages.filter(l => l !== langId));
    } else {
      setAllowedLanguages([...allowedLanguages, langId]);
    }
  };

  const handleSelectAllLanguages = () => {
    setAllowedLanguages(ALL_SUPPORTED_LANGUAGES.map(l => l.id));
  };

  const handleSelectPopularLanguages = () => {
    const popular = ALL_SUPPORTED_LANGUAGES.filter(l => l.popular).map(l => l.id);
    setAllowedLanguages(popular);
  };

  // Question Management
  const handleAddQuestion = () => {
    const newQ: CodingQuestionDto = {
      id: `q-code-${Date.now()}`,
      title: `Coding Challenge ${questions.length + 1}`,
      problemStatement: "Write a program that accepts the input data and outputs the result meeting the specified constraints.",
      difficulty: "Medium",
      maxMarks: 20,
      inputFormat: "First line contains an integer T...",
      outputFormat: "Print the required output on a single line.",
      constraints: "1 <= N <= 10^5",
      sampleInput: "5\n1 2 3 4 5",
      sampleOutput: "15",
      sampleExplanation: "Sum of the elements is 15.",
      allowedLanguages: [...allowedLanguages],
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      testCases: [
        {
          id: `tc-${Date.now()}-1`,
          label: "Sample Case 1",
          input: "5\n1 2 3 4 5",
          expectedOutput: "15",
          isHidden: false,
          marks: 5,
          explanation: "Basic sample verification"
        },
        {
          id: `tc-${Date.now()}-2`,
          label: "Hidden Evaluation Case",
          input: "3\n10 20 30",
          expectedOutput: "60",
          isHidden: true,
          marks: 15,
          explanation: "Automated scoring hidden test case"
        }
      ]
    };

    setQuestions([...questions, newQ]);
    setActiveQuestionIdx(questions.length);
  };

  const handleUpdateCurrentQuestion = (field: keyof CodingQuestionDto, value: any) => {
    const updated = [...questions];
    updated[activeQuestionIdx] = {
      ...updated[activeQuestionIdx],
      [field]: value
    };
    setQuestions(updated);
  };

  const handleDeleteQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert("A coding assessment must contain at least one question.");
      return;
    }
    const filtered = questions.filter((_, i) => i !== idx);
    setQuestions(filtered);
    setActiveQuestionIdx(Math.max(0, idx - 1));
  };

  // Test Case Management
  const handleAddTestCase = () => {
    const newTc: TestCaseDto = {
      id: `tc-${Date.now()}`,
      label: `Test Case ${currentQuestion.testCases.length + 1}`,
      input: "",
      expectedOutput: "",
      isHidden: true,
      marks: 5,
      explanation: ""
    };

    const updated = [...questions];
    updated[activeQuestionIdx] = {
      ...updated[activeQuestionIdx],
      testCases: [...(updated[activeQuestionIdx].testCases || []), newTc]
    };
    setQuestions(updated);
  };

  const handleUpdateTestCase = (tcIdx: number, field: keyof TestCaseDto, value: any) => {
    const updated = [...questions];
    const cases = [...updated[activeQuestionIdx].testCases];
    cases[tcIdx] = {
      ...cases[tcIdx],
      [field]: value
    };
    updated[activeQuestionIdx] = {
      ...updated[activeQuestionIdx],
      testCases: cases
    };
    setQuestions(updated);
  };

  const handleDeleteTestCase = (tcIdx: number) => {
    const updated = [...questions];
    const cases = updated[activeQuestionIdx].testCases.filter((_, i) => i !== tcIdx);
    updated[activeQuestionIdx] = {
      ...updated[activeQuestionIdx],
      testCases: cases
    };
    setQuestions(updated);
  };

  // Save / Publish
  const buildExamPayload = (status: "DRAFT" | "PUBLISHED"): CodingExamDto => {
    return {
      title,
      description,
      instructions,
      durationMinutes: Number(durationMinutes) || 90,
      timingMode,
      examDate,
      startTime,
      selectedDepartments,
      allowedLanguages,
      evaluationMode,
      qualificationPercentage: Number(qualificationPercentage) || 60,
      questions,
      totalMarks,
      status
    };
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const payload = buildExamPayload("DRAFT");
      saveCodingExamDraft(payload);
      const saved = await createCodingExam(payload);
      if (saved && saved.id) {
        setBackendExamId(Number(saved.id));
        saveCodingExamDraft({ ...payload, id: saved.id });
      }
      setSavedNotice("Draft successfully synchronized with database.");
    } catch (err: any) {
      console.warn("Backend draft sync error:", err);
      setSavedNotice("Draft saved to local storage (Backend sync offline).");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSavedNotice(null), 4000);
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      alert("Please provide an examination title.");
      setStep(1);
      return;
    }
    if (selectedDepartments.length === 0) {
      alert("Please select at least one eligible academic department.");
      setStep(2);
      return;
    }
    if (questions.length === 0) {
      alert("Please add at least one coding question.");
      setStep(3);
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildExamPayload("PUBLISHED");
      saveCodingExamDraft(payload);

      let targetId = backendExamId;
      if (!targetId) {
        const created = await createCodingExam(payload);
        targetId = Number(created.id);
        setBackendExamId(targetId);
      }
      if (targetId) {
        await publishCodingExam(targetId);
      }
      setIsPublished(true);
      setShowPublishModal(false);
    } catch (err: any) {
      console.warn("Backend publish error:", err);
      setIsPublished(true);
      setShowPublishModal(false);
      alert("Notice: Exam marked as published locally. (" + (err.message || "Failed to reach server") + ")");
    } finally {
      setIsSaving(false);
    }
  };

  if (isPublished) {
    return (
      <div className="admin-page-container" style={{ padding: "48px 32px", maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
        <div style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          padding: "48px 32px",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)"
        }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#dcfce7",
            color: "#017846",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "20px"
          }}>
            <CheckCircle2 size={36} />
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
            Round 2 Coding Assessment Published!
          </h2>
          <p style={{ fontSize: "14.5px", color: "#64748b", maxWidth: "520px", margin: "0 auto 28px", lineHeight: 1.6 }}>
            <strong>{title}</strong> has been successfully registered and published. Qualified candidates from {selectedDepartments.join(", ")} can now access the assessment during their scheduled window.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={() => navigate("/admin/exams")}
              style={{
                background: "#017846",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              Go to Examinations
            </button>
            <button
              type="button"
              onClick={() => navigate("/admin/candidates")}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              Manage Candidates & Access Codes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page-container" style={{ padding: "24px 32px", maxWidth: "1320px", margin: "0 auto" }}>
      {/* Top Breadcrumb & Action Header */}
      <div 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => navigate("/admin/exams/new")}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <ArrowLeft size={14} /> Back to Round Selection
          </button>
          <span style={{ color: "#cbd5e1" }}>/</span>
          <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#017846" }}>
            Round 2: Coding Assessment
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={handleSaveDraft}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "8px 14px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#334155",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Save size={14} /> Save Draft
          </button>
          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            style={{
              background: "#017846",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 18px",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 6px rgba(1, 120, 70, 0.25)"
            }}
          >
            <CheckCircle2 size={15} /> Publish Coding Assessment
          </button>
        </div>
      </div>

      {savedNotice && (
        <div 
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "12.5px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <CheckCircle2 size={16} />
          <span>{savedNotice}</span>
        </div>
      )}

      {isPublished && (
        <div 
          style={{
            background: "#eaf6ef",
            border: "1.5px solid #017846",
            color: "#014d32",
            borderRadius: "12px",
            padding: "18px 22px",
            fontSize: "13.5px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CheckCircle2 size={24} color="#017846" />
            <div>
              <strong style={{ fontSize: "14px", display: "block" }}>
                Coding Assessment Published Successfully!
              </strong>
              <span>
                Configured with {questions.length} questions ({totalTestCases} total test cases) across {selectedDepartments.length} departments.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/admin/exams")}
            style={{
              background: "#017846",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            View in Examinations List
          </button>
        </div>
      )}

      {/* 4-Step Navigation Tabs */}
      <div 
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "10px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "8px",
          marginBottom: "24px"
        }}
      >
        {[
          { num: 1, label: "Identity & Timing", icon: Clock },
          { num: 2, label: "Departments & Languages", icon: Building2 },
          { num: 3, label: "Problems & Test Cases", icon: Code2 },
          { num: 4, label: "Review & Launch", icon: CheckCircle2 }
        ].map(s => {
          const isActive = step === s.num;
          const isDone = step > s.num;
          const Icon = s.icon;

          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num as any)}
              style={{
                background: isActive ? "#eaf6ef" : "transparent",
                border: isActive ? "1px solid #bbf7d0" : "1px solid transparent",
                borderRadius: "10px",
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                textAlign: "left",
                transition: "all 0.15s ease"
              }}
            >
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "50%",
                  background: isActive ? "#017846" : isDone ? "#dcfce7" : "#f1f5f9",
                  color: isActive ? "#ffffff" : isDone ? "#166534" : "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 800,
                  flexShrink: 0
                }}
              >
                {isDone ? "✓" : s.num}
              </div>
              <div style={{ overflow: "hidden" }}>
                <span style={{ fontSize: "10px", color: isActive ? "#017846" : "#94a3b8", fontWeight: 700, textTransform: "uppercase", display: "block" }}>
                  Step 0{s.num}
                </span>
                <strong style={{ fontSize: "12px", color: isActive ? "#014d32" : "#334155", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.label}
                </strong>
              </div>
            </button>
          );
        })}
      </div>

      {/* ========================================================
          STEP 1: EXAMINATION IDENTITY & TIMING
          ======================================================== */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
              Coding Examination Identity
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", marginBottom: "18px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Coding Examination Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Software Engineer Practical Coding Round"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Short Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Comprehensive hands-on test evaluating algorithmic efficiency and clean coding standards"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Candidate Instructions & Execution Rules
                </label>
                <textarea
                  rows={4}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontFamily: "inherit",
                    outline: "none",
                    boxSizing: "border-box",
                    lineHeight: 1.5
                  }}
                />
              </div>
            </div>
          </div>

          {/* Timing & Scoring Controls */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
              Timing Mode & Evaluation Policy
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              {/* Duration */}
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Total Duration (Minutes) *
                </label>
                <input
                  type="number"
                  min="15"
                  max="360"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
                <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                  {["45", "60", "90", "120"].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDurationMinutes(m)}
                      style={{
                        padding: "3px 8px",
                        fontSize: "11px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        background: durationMinutes === m ? "#eaf6ef" : "#ffffff",
                        color: durationMinutes === m ? "#017846" : "#64748b",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                    >
                      {m} mins
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing Mode */}
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Timer Delivery Mode
                </label>
                <select
                  value={timingMode}
                  onChange={(e: any) => setTimingMode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#ffffff",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                >
                  <option value="DURATION_FROM_START">Flexible Window (Timer starts upon candidate entry)</option>
                  <option value="SCHEDULED">Strict Scheduled Window (Fixed synchronized start/end)</option>
                </select>
              </div>

              {/* Evaluation Policy */}
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Test Case Scoring Policy
                </label>
                <select
                  value={evaluationMode}
                  onChange={(e: any) => setEvaluationMode(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#ffffff",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                >
                  <option value="PARTIAL_PER_TESTCASE">Partial Scoring (Award marks per passed testcase)</option>
                  <option value="ALL_OR_NOTHING">All-or-Nothing (All test cases must pass for full marks)</option>
                </select>
              </div>

              {/* Cutoff Percentage */}
              <div>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Passing / Qualification Cutoff (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={qualificationPercentage}
                  onChange={(e) => setQualificationPercentage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            {/* Scheduled Date/Time if SCHEDULED */}
            {timingMode === "SCHEDULED" && (
              <div 
                style={{ 
                  marginTop: "18px", 
                  padding: "14px", 
                  background: "#f8fafc", 
                  borderRadius: "10px", 
                  border: "1px solid #e2e8f0",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px"
                }}
              >
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Exam Date
                  </label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Start Time (24h)
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Navigation to Next */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                background: "#017846",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 22px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              Continue to Departments & Languages <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 2: DEPARTMENTS & PROGRAMMING LANGUAGES
          ======================================================== */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Department Selection */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Eligible Academic Departments
                </h2>
                <p style={{ fontSize: "12.5px", color: "#64748b", margin: "3px 0 0" }}>
                  Select the departments eligible for Round 2. Coding will only be presented to candidates registered in these selected departments.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleSelectTechDepartments}
                  style={{
                    background: "#eaf6ef",
                    border: "1px solid #bbf7d0",
                    color: "#017846",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Select Tech Departments Only
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDepartments(STANDARD_DEPARTMENTS.map(d => d.name))}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Select All
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {STANDARD_DEPARTMENTS.map(dept => {
                const isSelected = selectedDepartments.includes(dept.name);

                return (
                  <div
                    key={dept.code}
                    onClick={() => handleToggleDepartment(dept.name)}
                    style={{
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      border: isSelected ? "1.5px solid #017846" : "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={{ marginTop: "3px", accentColor: "#017846", cursor: "pointer" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <strong style={{ fontSize: "13px", color: isSelected ? "#014d32" : "#0f172a" }}>
                          {dept.name}
                        </strong>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                          {dept.code}
                        </span>
                      </div>
                      <small style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "2px" }}>
                        {dept.description}
                      </small>
                      {dept.recommended && (
                        <span style={{ display: "inline-block", fontSize: "10px", color: "#017846", fontWeight: 700, marginTop: "4px" }}>
                          ★ Recommended for Coding
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Programming Languages Multi-Select */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Supported Programming Languages
                </h2>
                <p style={{ fontSize: "12.5px", color: "#64748b", margin: "3px 0 0" }}>
                  Select the execution runtimes candidates can choose from in the online code editor.
                </p>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={handleSelectPopularLanguages}
                  style={{
                    background: "#eaf6ef",
                    border: "1px solid #bbf7d0",
                    color: "#017846",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Popular Only (C++, Java, Python, JS)
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllLanguages}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Select All
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
              {ALL_SUPPORTED_LANGUAGES.map(lang => {
                const isSelected = allowedLanguages.includes(lang.id);

                return (
                  <div
                    key={lang.id}
                    onClick={() => handleToggleLanguage(lang.id)}
                    style={{
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      border: isSelected ? "1.5px solid #017846" : "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ accentColor: "#017846", cursor: "pointer" }}
                      />
                      <div>
                        <strong style={{ fontSize: "13.5px", color: isSelected ? "#014d32" : "#0f172a", display: "block" }}>
                          {lang.name}
                        </strong>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {lang.version}
                        </span>
                      </div>
                    </div>

                    <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                      {lang.extension}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ArrowLeft size={14} /> Back to Identity
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                background: "#017846",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "10px 22px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              Continue to Problems & Test Cases <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 3: CODING PROBLEMS & TEST CASES
          ======================================================== */}
      {step === 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: "24px", alignItems: "start" }}>
          {/* Left Column: Questions Sidebar */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>
                Questions ({questions.length})
              </strong>
              <button
                type="button"
                onClick={handleAddQuestion}
                style={{
                  background: "#eaf6ef",
                  border: "1px solid #bbf7d0",
                  color: "#017846",
                  borderRadius: "6px",
                  padding: "5px 10px",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <Plus size={13} /> Add
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {questions.map((q, idx) => {
                const isSelected = activeQuestionIdx === idx;

                return (
                  <div
                    key={q.id || idx}
                    onClick={() => setActiveQuestionIdx(idx)}
                    style={{
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      border: isSelected ? "1.5px solid #017846" : "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "12px",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 800, color: isSelected ? "#017846" : "#64748b" }}>
                        PROBLEM 0{idx + 1}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: q.difficulty === "Easy" ? "#dcfce7" : q.difficulty === "Medium" ? "#fef3c7" : "#fee2e2",
                          color: q.difficulty === "Easy" ? "#166534" : q.difficulty === "Medium" ? "#92400e" : "#991b1b"
                        }}
                      >
                        {q.difficulty}
                      </span>
                    </div>

                    <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {q.title}
                    </strong>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px", fontSize: "11px", color: "#64748b" }}>
                      <span>{q.maxMarks} Marks</span>
                      <span>{q.testCases?.length || 0} Testcases</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddQuestion}
              style={{
                width: "100%",
                marginTop: "14px",
                background: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "8px",
                padding: "9px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#475569",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <Plus size={14} /> Add Another Question
            </button>
          </div>

          {/* Right Column: Active Question Editor */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "#017846", background: "#eaf6ef", padding: "4px 10px", borderRadius: "6px" }}>
                    Editing Problem {activeQuestionIdx + 1} of {questions.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteQuestion(activeQuestionIdx)}
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Trash2 size={13} /> Delete Problem
                </button>
              </div>

              {/* Title & Difficulty & Marks Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 120px", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Problem Title *
                  </label>
                  <input
                    type="text"
                    value={currentQuestion.title}
                    onChange={(e) => handleUpdateCurrentQuestion("title", e.target.value)}
                    placeholder="e.g. Find Longest Common Subsequence"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Difficulty
                  </label>
                  <select
                    value={currentQuestion.difficulty}
                    onChange={(e: any) => handleUpdateCurrentQuestion("difficulty", e.target.value)}
                    style={{ width: "100%", padding: "9px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", background: "#ffffff", boxSizing: "border-box" }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Max Marks *
                  </label>
                  <input
                    type="number"
                    value={currentQuestion.maxMarks}
                    onChange={(e) => handleUpdateCurrentQuestion("maxMarks", Number(e.target.value) || 0)}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Problem Statement */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                  Problem Statement (Markdown Supported) *
                </label>
                <textarea
                  rows={5}
                  value={currentQuestion.problemStatement}
                  onChange={(e) => handleUpdateCurrentQuestion("problemStatement", e.target.value)}
                  placeholder="Provide complete problem context, definitions, and operational expectations..."
                  style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box" }}
                />
              </div>

              {/* I/O Format & Constraints Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Input Format
                  </label>
                  <textarea
                    rows={3}
                    value={currentQuestion.inputFormat}
                    onChange={(e) => handleUpdateCurrentQuestion("inputFormat", e.target.value)}
                    placeholder="e.g. First line contains integer N..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Output Format
                  </label>
                  <textarea
                    rows={3}
                    value={currentQuestion.outputFormat}
                    onChange={(e) => handleUpdateCurrentQuestion("outputFormat", e.target.value)}
                    placeholder="e.g. Return the computed value as a single line..."
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Constraints */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                  Constraints
                </label>
                <input
                  type="text"
                  value={currentQuestion.constraints}
                  onChange={(e) => handleUpdateCurrentQuestion("constraints", e.target.value)}
                  placeholder="e.g. 1 <= N <= 10^5, -10^9 <= A[i] <= 10^9"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }}
                />
              </div>

              {/* Sample Input & Expected Output */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Sample Input (Candidate Visible)
                  </label>
                  <textarea
                    rows={3}
                    value={currentQuestion.sampleInput}
                    onChange={(e) => handleUpdateCurrentQuestion("sampleInput", e.target.value)}
                    placeholder="4&#10;2 7 11 15&#10;9"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "monospace", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Sample Expected Output
                  </label>
                  <textarea
                    rows={3}
                    value={currentQuestion.sampleOutput}
                    onChange={(e) => handleUpdateCurrentQuestion("sampleOutput", e.target.value)}
                    placeholder="1 2"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", fontFamily: "monospace", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              {/* Sample Explanation */}
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                  Sample Case Explanation
                </label>
                <input
                  type="text"
                  value={currentQuestion.sampleExplanation}
                  onChange={(e) => handleUpdateCurrentQuestion("sampleExplanation", e.target.value)}
                  placeholder="e.g. Indices 1 and 2 give values 2 + 7 = 9 matching target."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Test Case Management Section */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
                    Test Cases ({currentQuestion.testCases?.length || 0})
                  </h3>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                    Configure sample test cases (candidate console preview) and hidden test cases (private evaluation).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddTestCase}
                  style={{
                    background: "#017846",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "7px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Plus size={14} /> Add Test Case
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {currentQuestion.testCases?.map((tc, tcIdx) => (
                  <div
                    key={tc.id || tcIdx}
                    style={{
                      background: tc.isHidden ? "#fbfcfe" : "#f0fdf4",
                      border: tc.isHidden ? "1px solid #e2e8f0" : "1px solid #bbf7d0",
                      borderRadius: "10px",
                      padding: "16px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                          #{tcIdx + 1}:
                        </strong>
                        <input
                          type="text"
                          value={tc.label}
                          onChange={(e) => handleUpdateTestCase(tcIdx, "label", e.target.value)}
                          placeholder="Test case label"
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 600,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #cbd5e1"
                          }}
                        />

                        {/* Visibility Pill Toggle */}
                        <button
                          type="button"
                          onClick={() => handleUpdateTestCase(tcIdx, "isHidden", !tc.isHidden)}
                          style={{
                            background: tc.isHidden ? "#eff6ff" : "#dcfce7",
                            border: tc.isHidden ? "1px solid #bfdbfe" : "1px solid #86efac",
                            color: tc.isHidden ? "#1d4ed8" : "#166534",
                            borderRadius: "999px",
                            padding: "3px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}
                        >
                          {tc.isHidden ? (
                            <>
                              <EyeOff size={11} /> Hidden (Private Evaluation)
                            </>
                          ) : (
                            <>
                              <Eye size={11} /> Sample (Public Preview)
                            </>
                          )}
                        </button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <span style={{ fontSize: "11.5px", color: "#64748b" }}>Marks:</span>
                          <input
                            type="number"
                            value={tc.marks}
                            onChange={(e) => handleUpdateTestCase(tcIdx, "marks", Number(e.target.value) || 0)}
                            style={{ width: "50px", padding: "4px 6px", fontSize: "12px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteTestCase(tcIdx)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: "4px"
                          }}
                          title="Delete test case"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                          Input Data (stdin)
                        </label>
                        <textarea
                          rows={3}
                          value={tc.input}
                          onChange={(e) => handleUpdateTestCase(tcIdx, "input", e.target.value)}
                          placeholder="Raw stdin input..."
                          style={{
                            width: "100%",
                            padding: "8px",
                            fontSize: "12px",
                            fontFamily: "monospace",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            boxSizing: "border-box"
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
                          Expected Output (stdout)
                        </label>
                        <textarea
                          rows={3}
                          value={tc.expectedOutput}
                          onChange={(e) => handleUpdateTestCase(tcIdx, "expectedOutput", e.target.value)}
                          placeholder="Raw expected stdout..."
                          style={{
                            width: "100%",
                            padding: "8px",
                            fontSize: "12px",
                            fontFamily: "monospace",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            boxSizing: "border-box"
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3 Navigation Controls */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <ArrowLeft size={14} /> Back to Departments
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                style={{
                  background: "#017846",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 22px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                Review & Launch <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          STEP 4: REVIEW & LAUNCH
          ======================================================== */}
      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Summary Dashboard Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
              <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, display: "block" }}>
                Coding Questions
              </span>
              <strong style={{ fontSize: "22px", color: "#0f172a", display: "block", margin: "4px 0" }}>
                {questions.length}
              </strong>
              <small style={{ fontSize: "11px", color: "#017846", fontWeight: 700 }}>
                {easyCount} Easy · {mediumCount} Medium · {hardCount} Hard
              </small>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
              <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, display: "block" }}>
                Total Score Weightage
              </span>
              <strong style={{ fontSize: "22px", color: "#0f172a", display: "block", margin: "4px 0" }}>
                {totalMarks} Marks
              </strong>
              <small style={{ fontSize: "11px", color: "#64748b" }}>
                Pass Cutoff: {qualificationPercentage}% ({Math.round((totalMarks * Number(qualificationPercentage)) / 100)} marks)
              </small>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
              <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, display: "block" }}>
                Duration & Delivery
              </span>
              <strong style={{ fontSize: "22px", color: "#0f172a", display: "block", margin: "4px 0" }}>
                {durationMinutes} mins
              </strong>
              <small style={{ fontSize: "11px", color: "#64748b" }}>
                {timingMode === "DURATION_FROM_START" ? "Flexible Start" : `Scheduled: ${examDate} at ${startTime}`}
              </small>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px" }}>
              <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, display: "block" }}>
                Evaluation Test Cases
              </span>
              <strong style={{ fontSize: "22px", color: "#0f172a", display: "block", margin: "4px 0" }}>
                {totalTestCases} Cases
              </strong>
              <small style={{ fontSize: "11px", color: "#2563eb", fontWeight: 700 }}>
                {totalSampleTestCases} Sample · {totalHiddenTestCases} Hidden (Private)
              </small>
            </div>
          </div>

          {/* Full Specifications Review Card */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "24px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "0 0 16px" }}>
              Coding Examination Configuration Overview
            </h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "11.5px", color: "#64748b", display: "block" }}>Title</span>
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>{title}</strong>
              </div>
              <div>
                <span style={{ fontSize: "11.5px", color: "#64748b", display: "block" }}>Evaluation Mode</span>
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                  {evaluationMode === "PARTIAL_PER_TESTCASE" ? "Partial Scoring per Test Case" : "All-or-Nothing Requirement"}
                </strong>
              </div>
            </div>

            {/* Target Departments */}
            <div style={{ marginBottom: "20px" }}>
              <span style={{ fontSize: "11.5px", color: "#64748b", display: "block", marginBottom: "6px" }}>
                Target Departments ({selectedDepartments.length})
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {selectedDepartments.map(d => (
                  <span
                    key={d}
                    style={{
                      background: "#eaf6ef",
                      border: "1px solid #bbf7d0",
                      color: "#017846",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "6px"
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {/* Supported Languages */}
            <div style={{ marginBottom: "20px" }}>
              <span style={{ fontSize: "11.5px", color: "#64748b", display: "block", marginBottom: "6px" }}>
                Enabled Compilers & Runtimes ({allowedLanguages.length})
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {allowedLanguages.map(lid => {
                  const meta = ALL_SUPPORTED_LANGUAGES.find(l => l.id === lid);
                  return (
                    <span
                      key={lid}
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        color: "#334155",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "6px"
                      }}
                    >
                      {meta?.name || lid} ({meta?.version || "Standard"})
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Questions Table */}
            <div>
              <span style={{ fontSize: "11.5px", color: "#64748b", display: "block", marginBottom: "6px" }}>
                Configured Questions
              </span>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>#</th>
                    <th style={{ padding: "10px" }}>Problem Title</th>
                    <th style={{ padding: "10px" }}>Difficulty</th>
                    <th style={{ padding: "10px" }}>Marks</th>
                    <th style={{ padding: "10px" }}>Sample Cases</th>
                    <th style={{ padding: "10px" }}>Hidden Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={q.id || i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px", fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: "10px", fontWeight: 600, color: "#0f172a" }}>{q.title}</td>
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: q.difficulty === "Easy" ? "#dcfce7" : q.difficulty === "Medium" ? "#fef3c7" : "#fee2e2",
                            color: q.difficulty === "Easy" ? "#166534" : q.difficulty === "Medium" ? "#92400e" : "#991b1b"
                          }}
                        >
                          {q.difficulty}
                        </span>
                      </td>
                      <td style={{ padding: "10px", fontWeight: 700 }}>{q.maxMarks}</td>
                      <td style={{ padding: "10px" }}>{q.testCases?.filter(tc => !tc.isHidden).length || 0}</td>
                      <td style={{ padding: "10px", color: "#1d4ed8", fontWeight: 600 }}>{q.testCases?.filter(tc => tc.isHidden).length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 4 Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "10px 18px",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <ArrowLeft size={14} /> Back to Problems
            </button>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={handleSaveDraft}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Save size={15} /> Save as Draft
              </button>
              <button
                type="button"
                onClick={() => setShowPublishModal(true)}
                style={{
                  background: "#017846",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 24px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(1, 120, 70, 0.25)"
                }}
              >
                <CheckCircle2 size={16} /> Publish & Launch Coding Assessment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showPublishModal && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 100
          }}
          onClick={() => setShowPublishModal(false)}
        >
          <div 
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "min(460px, 100%)",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#eaf6ef",
                color: "#017846",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "14px"
              }}
            >
              <Code2 size={24} />
            </div>

            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
              Publish Coding Assessment?
            </h3>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px", lineHeight: 1.5 }}>
              This will publish <strong>{title}</strong> with {questions.length} questions ({totalMarks} total marks) across {selectedDepartments.length} academic departments.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                style={{
                  background: "#017846",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Confirm & Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
