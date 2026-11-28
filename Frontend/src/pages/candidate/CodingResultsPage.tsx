import { useEffect, useState } from "react";
import {
  Award,
  CheckCircle2,
  Clock3,
  XCircle,
  Lock,
  Info,
  Code2,
  FileCheck2,
  FileX2,
} from "lucide-react";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";
import { getMyCodingResults, type CandidateCodingResultsResponse } from "../../services/codingResultsApi";

export default function CodingResultsPage() {
  const params = new URLSearchParams(window.location.search);
  const examId = Number(params.get("examId") || 1);

  const [data, setData] = useState<CandidateCodingResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMyCodingResults(examId);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const handleCloseWindow = () => {
    window.close();
    // Fallback if browser blocks window.close() on non-script-opened tabs
    window.setTimeout(() => {
      window.location.href = "/candidate";
    }, 150);
  };

  const renderHeader = () => (
    <header
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <img
        src={kalpanaaLogo}
        alt="Kalpanaaa Software Solutions"
        style={{ height: "32px", objectFit: "contain" }}
      />
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 12px",
          borderRadius: "999px",
          background: "#eaf6ef",
          border: "1px solid #d9e6df",
          color: "#017846",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        <Lock size={12} /> Secure Candidate Session
      </span>
    </header>
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
        {renderHeader()}
        <div style={{ maxWidth: "960px", width: "100%", margin: "28px auto", padding: "0 20px", boxSizing: "border-box" }}>
          <style>{`@keyframes resPulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.9; } }`}</style>
          <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "32px 28px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ height: "110px", borderRadius: "12px", background: "#e2e8f0", animation: "resPulse 1.3s ease-in-out infinite" }} />
            <div style={{ height: "96px", borderRadius: "12px", background: "#e2e8f0", animation: "resPulse 1.3s ease-in-out infinite" }} />
            <div style={{ height: "96px", borderRadius: "12px", background: "#e2e8f0", animation: "resPulse 1.3s ease-in-out infinite" }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
        {renderHeader()}
        <div style={{ padding: "48px 20px", textAlign: "center", color: "#b91c1c", fontSize: "14px" }}>
          {error || "Result unavailable."}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
      {renderHeader()}

      <main style={{ flex: 1, padding: "28px 20px 44px" }}>
        <div
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)",
            padding: "32px 28px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* Hero Confirmation Header */}
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", paddingBottom: "6px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "#eaf6ef",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#017846",
                marginBottom: "4px",
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
              EXAMINATION FINALIZED
            </div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "#0f172a" }}>
              Assessment <span style={{ color: "#017846" }}>Submitted</span>
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", maxWidth: "460px", lineHeight: 1.5 }}>
              Your answers have been securely submitted and your examination attempt has been recorded.
            </p>
          </div>

          {!data.resultsPublished ? (
            <div
              style={{
                padding: "24px",
                borderRadius: "12px",
                background: "#f3faf6",
                border: "1px solid #d9e6df",
                textAlign: "center",
              }}
            >
              <Clock3 size={28} color="#017846" style={{ marginBottom: "8px" }} />
              <h2 style={{ margin: "0 0 6px", fontSize: "18px", color: "#0f172a" }}>{data.examTitle}</h2>
              <p style={{ margin: 0, color: "#475569", fontSize: "13.5px" }}>
                {data.message || "Results have not been published yet."}
              </p>
            </div>
          ) : (
            <>
              {/* Round 2 Summary Banner */}
              <div
                style={{
                  background: "linear-gradient(90deg, #f3faf6 0%, #eaf6ef 100%)",
                  border: "1px solid #d9e6df",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "#dcfce7",
                      color: "#017846",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Code2 size={18} />
                  </div>
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#017846",
                        background: "#dcfce7",
                        padding: "2px 9px",
                        borderRadius: "999px",
                        marginBottom: "4px",
                      }}
                    >
                      Round 2 Coding Result
                    </span>
                    <div style={{ fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                      {data.examTitle}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#475569", marginTop: "2px" }}>
                      Score: <strong>{data.totalScore} / {data.totalPossible}</strong> &middot; Status:{" "}
                      <strong>{data.qualificationStatus}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "28px", fontWeight: 800, color: "#017846" }}>
                  <Award size={24} />
                  <span>{data.overallPercent?.toFixed(1)}%</span>
                </div>
              </div>

              {/* Per-Question Result Cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {(data.questions || []).map((q) => {
                  const accepted = q.finalVerdict === "ACCEPTED";
                  return (
                    <div
                      key={q.questionId}
                      style={{
                        background: "#ffffff",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        padding: "16px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(210px, 1.2fr) minmax(130px, 0.7fr) minmax(280px, 1.8fr)",
                          gap: "16px",
                          alignItems: "center",
                        }}
                      >
                        {/* Left: Icon + Title + Meta */}
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "8px",
                              background: accepted ? "#eaf6ef" : "#fef2f2",
                              color: accepted ? "#017846" : "#b91c1c",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              marginTop: "2px",
                            }}
                          >
                            {accepted ? <FileCheck2 size={16} /> : <FileX2 size={16} />}
                          </div>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                              {q.title}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px", lineHeight: 1.4 }}>
                              {q.testsPassed} / {q.testsTotal} tests passed ({q.hiddenSummary})
                              <br />
                              {q.language || "—"} &middot; {q.attemptsCount} submit(s)
                            </div>
                          </div>
                        </div>

                        {/* Center: Verdict & Score */}
                        <div style={{ textAlign: "center" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontSize: "12.5px",
                              fontWeight: 700,
                              color: accepted ? "#017846" : "#b91c1c",
                            }}
                          >
                            {accepted ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            {q.finalVerdict}
                          </div>
                          <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a", marginTop: "3px" }}>
                            {q.scoreAwarded} / {q.scorePossible} ({q.scorePercent.toFixed(1)}%)
                          </div>
                        </div>

                        {/* Right: Compact 2-Column Test Case Pills */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: "6px",
                          }}
                        >
                          {q.sampleDetails.map((s) => (
                            <div
                              key={s.testCaseId}
                              style={{
                                padding: "6px 10px",
                                borderRadius: "7px",
                                background: s.passed ? "#f3faf6" : "#fef2f2",
                                border: `1px solid ${s.passed ? "#d9e6df" : "#fecaca"}`,
                                fontSize: "11px",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "6px",
                              }}
                            >
                              {s.passed ? (
                                <CheckCircle2 size={13} color="#017846" style={{ flexShrink: 0, marginTop: "1px" }} />
                              ) : (
                                <XCircle size={13} color="#b91c1c" style={{ flexShrink: 0, marginTop: "1px" }} />
                              )}
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: s.passed ? "#017846" : "#0f172a" }}>
                                  {s.label}: {s.verdict}
                                </div>
                                {!s.passed && (
                                  <div style={{ color: "#64748b", fontSize: "10.5px", marginTop: "2px", wordBreak: "break-word" }}>
                                    Expected: {s.expectedOutput} &middot; Got: {s.actualOutput}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {q.compileErrorShort && (
                        <pre
                          style={{
                            margin: 0,
                            padding: "8px 10px",
                            background: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "#991b1b",
                            overflowX: "auto",
                          }}
                        >
                          {q.compileErrorShort}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Locked Notice Banner */}
          <div
            style={{
              background: "#f3faf6",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "8px",
                background: "#017846",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Lock size={14} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#014d32" }}>
                Your responses are now locked.
              </div>
              <div style={{ fontSize: "12px", color: "#017846" }}>
                You can no longer edit or change answers for this attempt.
              </div>
            </div>
          </div>

          {/* Next Steps Banner */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "8px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#0284c7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Info size={15} />
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                Next Steps
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                A confirmation may be shared by your institution. You may safely leave this page.
              </div>
            </div>
          </div>

          {/* Bottom Action */}
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "6px" }}>
            <button
              type="button"
              onClick={handleCloseWindow}
              style={{
                padding: "9px 22px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close The Window
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
