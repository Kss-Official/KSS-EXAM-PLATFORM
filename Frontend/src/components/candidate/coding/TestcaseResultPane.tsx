import { useState } from "react";
import { CheckCircle2, XCircle, Loader2, Terminal, PlaySquare } from "lucide-react";
import type { SampleTestCase, CodingSubmissionStatus } from "../../../services/codingApi";

interface TestcaseResultPaneProps {
  sampleCases: SampleTestCase[];
  customInput: string;
  onCustomInputChange: (val: string) => void;
  uiState: "idle" | "queued" | "running" | "done" | "error";
  result: CodingSubmissionStatus | null;
  errorMsg: string | null;
}

export default function TestcaseResultPane({
  sampleCases,
  customInput,
  onCustomInputChange,
  uiState,
  result,
  errorMsg,
}: TestcaseResultPaneProps) {
  const [tab, setTab] = useState<"testcases" | "custom" | "result">("testcases");
  const activeTab = uiState !== "idle" && result ? "result" : tab;

  const isBusy = uiState === "queued" || uiState === "running";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#ffffff" }}>
      <div
        role="tablist"
        aria-label="Testcases and Results"
        style={{
          display: "flex",
          gap: "4px",
          padding: "8px 12px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "testcases"}
          onClick={() => setTab("testcases")}
          style={{
            padding: "5px 10px",
            borderRadius: "6px",
            border: "none",
            fontSize: "12.5px",
            fontWeight: 600,
            background: activeTab === "testcases" ? "#017846" : "transparent",
            color: activeTab === "testcases" ? "#ffffff" : "#475569",
          }}
        >
          Testcases ({sampleCases.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "custom"}
          onClick={() => setTab("custom")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "5px 10px",
            borderRadius: "6px",
            border: "none",
            fontSize: "12.5px",
            fontWeight: 600,
            background: activeTab === "custom" ? "#017846" : "transparent",
            color: activeTab === "custom" ? "#ffffff" : "#475569",
          }}
        >
          <Terminal size={13} /> Custom Input
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "result"}
          onClick={() => setTab("result")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "5px 10px",
            borderRadius: "6px",
            border: "none",
            fontSize: "12.5px",
            fontWeight: 600,
            background: activeTab === "result" ? "#017846" : "transparent",
            color: activeTab === "result" ? "#ffffff" : "#475569",
          }}
        >
          <PlaySquare size={13} /> Result
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        {activeTab === "testcases" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {sampleCases.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>No sample test cases configured.</p>
            ) : (
              sampleCases.map((tc) => (
                <div key={tc.id} style={{ padding: "10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "12px" }}>
                  <div style={{ fontWeight: 700, marginBottom: "4px" }}>{tc.label}</div>
                  <div>
                    <strong>Input:</strong>
                    <pre style={{ margin: "2px 0 6px", padding: "6px", background: "#f8fafc", borderRadius: "4px" }}>{tc.input}</pre>
                  </div>
                  <div>
                    <strong>Expected:</strong>
                    <pre style={{ margin: "2px 0 0", padding: "6px", background: "#f8fafc", borderRadius: "4px" }}>{tc.expectedOutput}</pre>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "custom" && (
          <div>
            <label htmlFor="coding-custom-stdin" style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px", color: "#475569" }}>
              Custom Standard Input (stdin)
            </label>
            <textarea
              id="coding-custom-stdin"
              value={customInput}
              onChange={(e) => onCustomInputChange(e.target.value)}
              rows={6}
              placeholder="Enter custom test input here..."
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
              }}
            />
          </div>
        )}

        {activeTab === "result" && (
          <div>
            {isBusy && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#017846", fontWeight: 600, fontSize: "13px" }}>
                <Loader2 size={16} className="animate-spin" />
                {uiState === "queued" ? "Queued in sandbox..." : "Running test cases..."}
              </div>
            )}

            {errorMsg && (
              <div style={{ padding: "10px 12px", borderRadius: "6px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "13px" }}>
                {errorMsg}
              </div>
            )}

            {!isBusy && !errorMsg && !result && (
              <p style={{ color: "#64748b", fontSize: "13px", margin: 0 }}>Click Run (Ctrl+') or Submit (Ctrl+Enter) to see results.</p>
            )}

            {result && !isBusy && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 700,
                      fontSize: "15px",
                      color: result.verdict === "ACCEPTED" ? "#017846" : "#b91c1c",
                    }}
                  >
                    {result.verdict === "ACCEPTED" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    {result.verdict}
                  </span>
                  <span style={{ fontSize: "12.5px", color: "#475569" }}>
                    Passed {result.passedCount} / {result.totalCount}
                    {result.runtimeMs != null ? ` · ${result.runtimeMs} ms` : ""}
                    {result.memoryKb != null ? ` · ${Math.round(result.memoryKb / 1024)} MB` : ""}
                  </span>
                </div>

                {result.errorMessage && (
                  <pre style={{ padding: "10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#991b1b", fontSize: "12px", overflowX: "auto", marginBottom: "12px" }}>
                    {result.errorMessage}
                  </pre>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {result.testCaseResults.map((tc) => (
                    <div
                      key={tc.testCaseId}
                      style={{
                        padding: "10px",
                        borderRadius: "6px",
                        border: `1px solid ${tc.passed ? "#bbf7d0" : "#fecaca"}`,
                        background: tc.passed ? "#f0fdf4" : "#fef2f2",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                        <span>{tc.label} {tc.isHidden ? "(Hidden)" : ""}</span>
                        <span>{tc.verdict}</span>
                      </div>
                      {!tc.isHidden && !tc.passed && (
                        <div style={{ marginTop: "6px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <div>
                            <strong>Expected:</strong>
                            <pre style={{ margin: "2px 0", padding: "4px 6px", background: "#ffffff", borderRadius: "4px" }}>{tc.expectedOutput ?? ""}</pre>
                          </div>
                          <div>
                            <strong>Actual:</strong>
                            <pre style={{ margin: "2px 0", padding: "4px 6px", background: "#ffffff", borderRadius: "4px" }}>{tc.actualOutput ?? ""}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
