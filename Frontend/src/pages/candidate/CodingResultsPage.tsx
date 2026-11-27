import { useEffect, useState } from "react";
import { Award, CheckCircle2, Clock3, XCircle } from "lucide-react";
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

  if (loading) {
    return (
      <div style={{ maxWidth: "920px", margin: "32px auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <style>{`@keyframes resPulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.9; } }`}</style>
        <div style={{ height: "110px", borderRadius: "12px", background: "#e2e8f0", animation: "resPulse 1.3s ease-in-out infinite" }} />
        <div style={{ height: "96px", borderRadius: "12px", background: "#e2e8f0", animation: "resPulse 1.3s ease-in-out infinite" }} />
        <div style={{ height: "96px", borderRadius: "12px", background: "#e2e8f0", animation: "resPulse 1.3s ease-in-out infinite" }} />
      </div>
    );
  }
  if (error || !data) return <div style={{ padding: "48px", textAlign: "center", color: "#b91c1c" }}>{error || "Result unavailable."}</div>;

  if (!data.resultsPublished) {
    return (
      <div style={{ maxWidth: "560px", margin: "60px auto", padding: "28px", background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "center" }}>
        <Clock3 size={32} color="#017846" style={{ marginBottom: "12px" }} />
        <h2 style={{ margin: "0 0 8px", fontSize: "20px" }}>{data.examTitle}</h2>
        <p style={{ margin: 0, color: "#475569", fontSize: "14px" }}>{data.message || "Results have not been published yet."}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "920px", margin: "32px auto", padding: "0 20px" }}>
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "24px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#017846", background: "#eaf6ef", padding: "4px 10px", borderRadius: "999px" }}>Round 2 Coding Result</span>
          <h1 style={{ margin: "8px 0 4px", fontSize: "22px", color: "#0f172a" }}>{data.examTitle}</h1>
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            Score: {data.totalScore} / {data.totalPossible} · Status: <strong>{data.qualificationStatus}</strong>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "30px", fontWeight: 800, color: "#017846", display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={26} /> {data.overallPercent?.toFixed(1)}%
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {(data.questions || []).map((q) => (
          <div key={q.questionId} style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>{q.title}</h3>
                <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "2px" }}>
                  {q.testsPassed} / {q.testsTotal} tests passed ({q.hiddenSummary}) · {q.language || "—"} · {q.attemptsCount} submit(s)
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontWeight: 700, color: q.finalVerdict === "ACCEPTED" ? "#017846" : "#b91c1c" }}>
                  {q.finalVerdict === "ACCEPTED" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {q.finalVerdict}
                </span>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                  {q.scoreAwarded} / {q.scorePossible} ({q.scorePercent.toFixed(1)}%)
                </div>
              </div>
            </div>

            {q.compileErrorShort && (
              <pre style={{ padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "12px", color: "#991b1b", overflowX: "auto" }}>
                {q.compileErrorShort}
              </pre>
            )}

            {q.sampleDetails.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", marginTop: "10px" }}>
                {q.sampleDetails.map((s) => (
                  <div key={s.testCaseId} style={{ padding: "8px 10px", borderRadius: "6px", background: s.passed ? "#f0fdf4" : "#fef2f2", border: `1px solid ${s.passed ? "#bbf7d0" : "#fecaca"}`, fontSize: "12px" }}>
                    <strong>{s.label}: {s.verdict}</strong>
                    {!s.passed && (
                      <div style={{ marginTop: "4px", color: "#475569" }}>
                        Expected: <code>{s.expectedOutput}</code> · Got: <code>{s.actualOutput}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
