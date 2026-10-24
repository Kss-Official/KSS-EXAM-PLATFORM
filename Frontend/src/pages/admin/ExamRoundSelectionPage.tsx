import { 
  CheckSquare, 
  Code2, 
  ArrowRight, 
  Layers, 
  Clock, 
  FileText, 
  Building2, 
  Terminal, 
  ShieldCheck, 
  HelpCircle,
  Sparkles,
  GitBranch,
  BookOpen
} from "lucide-react";
import { useRouter } from "../../router";

export default function ExamRoundSelectionPage() {
  const { navigate } = useRouter();

  return (
    <div className="admin-page-container" style={{ padding: "28px 32px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
          <Layers size={20} color="#017846" />
          <h1 
            style={{ 
              fontSize: "22px", 
              fontWeight: 800, 
              color: "#0f172a", 
              margin: 0,
              fontFamily: "Plus Jakarta Sans, sans-serif" 
            }}
          >
            Create Examination — Select Assessment Round
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b" }}>
          Choose the assessment round to configure. Configure rounds independently per academic department according to your hiring pipeline.
        </p>
      </div>

      {/* Pipeline Information Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #eaf6ef 0%, #f0fdf4 100%)",
          border: "1px solid #bbf7d0",
          borderRadius: "14px",
          padding: "16px 20px",
          marginBottom: "32px",
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
          boxShadow: "0 1px 3px rgba(1, 120, 70, 0.05)"
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "#017846",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "2px"
          }}
        >
          <GitBranch size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: "13.5px", color: "#0f172a", display: "block", marginBottom: "4px" }}>
            Multi-Round Department Routing
          </strong>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#166534", lineHeight: 1.55 }}>
            Each department can have rounds configured independently. For example, <strong>Developer</strong> and <strong>Tester</strong> candidates can be assigned both <strong>Round 1 (MCQ)</strong> and <strong>Round 2 (Coding)</strong>, while <strong>HR</strong>, <strong>UI/UX</strong>, or <strong>Marketing</strong> candidates can be routed through <strong>Round 1 (MCQ) only</strong>. Candidates will only see and be tested on the rounds configured for their department.
          </p>
        </div>
      </div>

      {/* 2 Separate Round Selection Cards */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", 
          gap: "28px",
          alignItems: "stretch"
        }}
      >
        {/* Card 1: Round 1 — MCQ Assessment */}
        <div
          style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "16px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
            transition: "all 0.2s ease",
            position: "relative",
            overflow: "hidden"
          }}
          className="round-select-card"
        >
          {/* Top highlight bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "#017846" }} />

          <div>
            {/* Header pill & icon */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    background: "#eaf6ef",
                    border: "1px solid #bbf7d0",
                    color: "#017846",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    letterSpacing: "0.5px"
                  }}
                >
                  ROUND 1
                </span>
                <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600 }}>
                  Objective Evaluation
                </span>
              </div>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "#eaf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#017846"
                }}
              >
                <CheckSquare size={22} />
              </div>
            </div>

            {/* Title & Description */}
            <h2 style={{ fontSize: "19px", fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
              MCQ Assessment
            </h2>
            <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.55, margin: "0 0 20px" }}>
              Create and configure a multiple-choice examination. Configure examination name, description, timing, marking scheme, departments, MCQ question sets, and answer keys.
            </p>

            {/* Key Features List */}
            <div 
              style={{ 
                background: "#f8fafc", 
                border: "1px solid #eef2f6", 
                borderRadius: "12px", 
                padding: "16px",
                marginBottom: "24px"
              }}
            >
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginBottom: "10px" }}>
                Configuration Features
              </span>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "9px" }}>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#017846" }} />
                  <span><strong>Examination Identity & Timing:</strong> Title, description, duration, and flexible/scheduled windows</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#017846" }} />
                  <span><strong>Marking Scheme & Qualification:</strong> Marks per question, negative marking, and cutoffs</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#017846" }} />
                  <span><strong>Academic Departments:</strong> Developer, Tester, HR, UI/UX, Marketing, CSE, IT, etc.</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#017846" }} />
                  <span><strong>4-Set Question Assignment:</strong> Automated PDF parsing or manual question entry for Sets A, B, C, D</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#017846" }} />
                  <span><strong>Answer Key Management:</strong> Automated key extraction and verification table</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => navigate("/admin/exams/new/mcq")}
            style={{
              width: "100%",
              background: "#017846",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "12px 20px",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 2px 8px rgba(1, 120, 70, 0.25)",
              transition: "all 0.15s ease"
            }}
          >
            <span>Configure MCQ Round</span>
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Card 2: Round 2 — Coding Assessment */}
        <div
          style={{
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: "16px",
            padding: "28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
            transition: "all 0.2s ease",
            position: "relative",
            overflow: "hidden"
          }}
          className="round-select-card"
        >
          {/* Top highlight bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, #0284c7, #017846)" }} />

          <div>
            {/* Header pill & icon */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1d4ed8",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    letterSpacing: "0.5px"
                  }}
                >
                  ROUND 2
                </span>
                <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600 }}>
                  Hands-on Programming
                </span>
              </div>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "#eff6ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1d4ed8"
                }}
              >
                <Code2 size={22} />
              </div>
            </div>

            {/* Title & Description */}
            <h2 style={{ fontSize: "19px", fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
              Coding Assessment
            </h2>
            <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.55, margin: "0 0 20px" }}>
              Create and configure a programming assessment with coding questions, sample inputs and outputs, hidden test cases, programming languages, and evaluation rules. Configure the coding round independently of the MCQ round.
            </p>

            {/* Key Features List */}
            <div 
              style={{ 
                background: "#f8fafc", 
                border: "1px solid #eef2f6", 
                borderRadius: "12px", 
                padding: "16px",
                marginBottom: "24px"
              }}
            >
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.4px", display: "block", marginBottom: "10px" }}>
                Configuration Features
              </span>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "9px" }}>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0284c7" }} />
                  <span><strong>Independent Coding Identity:</strong> Title, instructions, custom duration, and evaluation modes</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0284c7" }} />
                  <span><strong>Coding Problems Manager:</strong> Title, problem statement, difficulty, I/O formats, and constraints</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0284c7" }} />
                  <span><strong>Sample & Hidden Test Cases:</strong> Public sample test cases + secure hidden evaluation test cases</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0284c7" }} />
                  <span><strong>Multi-Language Runtimes:</strong> C++, Java, Python3, Python, JavaScript, TypeScript, C#, C</span>
                </li>
                <li style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "12.5px", color: "#334155" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0284c7" }} />
                  <span><strong>Department Selectivity:</strong> Enable coding strictly for tech departments (e.g. Dev, QA)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => navigate("/admin/exams/new/coding")}
            style={{
              width: "100%",
              background: "#017846",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "12px 20px",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 2px 8px rgba(1, 120, 70, 0.25)",
              transition: "all 0.15s ease"
            }}
          >
            <span>Configure Coding Round</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Candidate Examination Flow Guide */}
      <div
        style={{
          marginTop: "36px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569"
            }}
          >
            <HelpCircle size={18} />
          </div>
          <div>
            <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>
              Standard Candidate Flow
            </strong>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Round 1 (MCQ Assessment) ➔ Round 2 (Coding Assessment, when enabled for department) ➔ Final Submission
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/admin/exams")}
          style={{
            background: "none",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "12px",
            fontWeight: 600,
            color: "#334155",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <BookOpen size={13} /> View Existing Examinations
        </button>
      </div>
    </div>
  );
}
