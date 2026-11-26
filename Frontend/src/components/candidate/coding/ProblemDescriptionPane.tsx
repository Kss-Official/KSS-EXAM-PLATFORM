import { useState } from "react";
import { Clock, Cpu, FileText, History } from "lucide-react";
import type { CodingProblemPublic, CodingSubmissionStatus } from "../../../services/codingApi";

interface ProblemDescriptionPaneProps {
  problem: CodingProblemPublic;
  submissions: CodingSubmissionStatus[];
  onRefreshSubmissions: () => void;
}

export default function ProblemDescriptionPane({
  problem,
  submissions,
  onRefreshSubmissions,
}: ProblemDescriptionPaneProps) {
  const [tab, setTab] = useState<"description" | "submissions">("description");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
      <div
        role="tablist"
        aria-label="Problem tabs"
        style={{
          display: "flex",
          gap: "4px",
          padding: "8px 14px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "description"}
          onClick={() => setTab("description")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "none",
            fontWeight: 600,
            fontSize: "13px",
            background: tab === "description" ? "#017846" : "transparent",
            color: tab === "description" ? "#ffffff" : "#475569",
          }}
        >
          <FileText size={14} /> Description
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "submissions"}
          onClick={() => {
            setTab("submissions");
            onRefreshSubmissions();
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "none",
            fontWeight: 600,
            fontSize: "13px",
            background: tab === "submissions" ? "#017846" : "transparent",
            color: tab === "submissions" ? "#ffffff" : "#475569",
          }}
        >
          <History size={14} /> Submissions ({submissions.length})
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {tab === "description" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#0f172a" }}>{problem.title}</h2>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "999px",
                  background: "#eaf6ef",
                  color: "#017846",
                }}
              >
                {problem.difficulty} · {problem.maxMarks} pts
              </span>
            </div>

            <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Clock size={13} /> Time Limit: {problem.timeLimitMs} ms
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Cpu size={13} /> Memory Limit: {problem.memoryLimitMb} MB
              </span>
            </div>

            <div style={{ fontSize: "14px", lineHeight: 1.65, color: "#1e293b", whiteSpace: "pre-wrap", marginBottom: "18px" }}>
              {problem.problemStatement}
            </div>

            {problem.inputFormat && (
              <section style={{ marginBottom: "14px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Input Format</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap" }}>{problem.inputFormat}</p>
              </section>
            )}

            {problem.outputFormat && (
              <section style={{ marginBottom: "14px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>Output Format</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "#334155", whiteSpace: "pre-wrap" }}>{problem.outputFormat}</p>
              </section>
            )}

            {problem.constraints && (
              <section style={{ marginBottom: "18px" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>Constraints</h3>
                <pre style={{ margin: 0, padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12.5px", overflowX: "auto" }}>
                  {problem.constraints}
                </pre>
              </section>
            )}

            {problem.sampleTestCases.length > 0 && (
              <section>
                <h3 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>Examples</h3>
                {problem.sampleTestCases.map((tc, i) => (
                  <div
                    key={tc.id}
                    style={{
                      marginBottom: "12px",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                      Example {i + 1}: {tc.label}
                    </div>
                    <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                      <strong>Input:</strong>
                      <pre style={{ margin: "4px 0", padding: "6px 8px", background: "#ffffff", borderRadius: "4px", overflowX: "auto" }}>{tc.input}</pre>
                    </div>
                    <div style={{ fontSize: "12px" }}>
                      <strong>Expected Output:</strong>
                      <pre style={{ margin: "4px 0", padding: "6px 8px", background: "#ffffff", borderRadius: "4px", overflowX: "auto" }}>{tc.expectedOutput}</pre>
                    </div>
                    {tc.explanation && (
                      <div style={{ fontSize: "12px", color: "#475569", marginTop: "6px" }}>
                        <strong>Explanation:</strong> {tc.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </section>
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
    </div>
  );
}
