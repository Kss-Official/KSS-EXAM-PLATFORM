import { useEffect, useState } from "react";
import { BarChart3, Download, Eye, Users } from "lucide-react";
import {
  getAdminCodingAnalytics,
  getAdminCodingCandidateDetail,
  getAdminCodingCsvUrl,
  listAdminCodingResults,
  toggleAdminCodingResultsPublished,
  type AdminCodingAnalyticsResponse,
  type AdminCodingResultsListResponse,
} from "../../services/codingResultsApi";

export default function CodingResultsAdminPage() {
  const params = new URLSearchParams(window.location.search);
  const [examId, setExamId] = useState<number>(Number(params.get("examId") || 1));
  const [tab, setTab] = useState<"candidates" | "analytics">("candidates");
  const [page, setPage] = useState(1);

  const [listData, setListData] = useState<AdminCodingResultsListResponse | null>(null);
  const [analytics, setAnalytics] = useState<AdminCodingAnalyticsResponse | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    setError(null);
    try {
      const [res, an] = await Promise.all([
        listAdminCodingResults(examId, page, 25),
        getAdminCodingAnalytics(examId),
      ]);
      setListData(res);
      setAnalytics(an);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [examId, page]);

  const handleTogglePublish = async () => {
    if (!listData) return;
    await toggleAdminCodingResultsPublished(examId, !listData.resultsPublished);
    await loadAll();
  };

  const handleViewDetail = async (candidateId: number) => {
    const d = await getAdminCodingCandidateDetail(examId, candidateId);
    setDetail(d);
  };

  return (
    <div className="admin-page-container" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px" }}>Round 2 Coding Results & Analytics</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            {listData ? `${listData.examTitle} (${listData.total} attempts)` : "Select Coding Exam ID"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px" }}>
            Exam ID:{" "}
            <input
              type="number"
              min={1}
              value={examId}
              onChange={(e) => { setPage(1); setExamId(Number(e.target.value) || 1); }}
              style={{ width: "70px", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </label>
          {listData && (
            <button type="button" className="admin-btn-secondary" onClick={() => void handleTogglePublish()}>
              {listData.resultsPublished ? "Unpublish Results" : "Publish Results"}
            </button>
          )}
          <a href={getAdminCodingCsvUrl(examId)} className="admin-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
            <Download size={14} /> Export CSV
          </a>
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button type="button" onClick={() => setTab("candidates")} className={tab === "candidates" ? "admin-btn-primary" : "admin-btn-secondary"} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Users size={14} /> Candidates
        </button>
        <button type="button" onClick={() => setTab("analytics")} className={tab === "analytics" ? "admin-btn-primary" : "admin-btn-secondary"} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <BarChart3 size={14} /> Question Analytics
        </button>
      </div>

      {error && <div style={{ padding: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#b91c1c", marginBottom: "16px" }}>{error}</div>}

      {tab === "candidates" && listData && (
        <div className="admin-card" style={{ overflowX: "auto" }}>
          <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Reg No</th>
                <th>Total</th>
                <th>Overall %</th>
                <th>Status</th>
                {listData.questions.map((q) => <th key={q.id}>{q.title} (%)</th>)}
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {listData.items.map((row) => (
                <tr key={row.attemptId}>
                  <td>
                    <strong>{row.candidateName}</strong>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>{row.candidateEmail}</div>
                  </td>
                  <td>{row.registrationNumber}</td>
                  <td>{row.totalScore} / {row.totalPossible}</td>
                  <td><strong>{row.overallPercent.toFixed(1)}%</strong></td>
                  <td>{row.qualificationStatus}</td>
                  {listData.questions.map((q) => (
                    <td key={q.id}>{(row.questionPercents[q.id] ?? 0).toFixed(1)}%</td>
                  ))}
                  <td>
                    <button type="button" className="admin-btn-secondary" onClick={() => void handleViewDetail(row.candidateId)} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <Eye size={13} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "13px" }}>
            <span>Page {listData.page} · Total {listData.total}</span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="admin-btn-secondary">Prev</button>
              <button type="button" disabled={page * listData.pageSize >= listData.total} onClick={() => setPage((p) => p + 1)} className="admin-btn-secondary">Next</button>
            </div>
          </div>
        </div>
      )}

      {tab === "analytics" && analytics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
          {analytics.questions.map((q) => (
            <div key={q.questionId} className="admin-card" style={{ padding: "16px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "16px" }}>{q.title}</h3>
              <div style={{ fontSize: "13px", color: "#475569", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div>Avg Score: <strong>{q.avgPercent}%</strong></div>
                <div>Full Pass Rate: <strong>{q.passRatePercent}%</strong> ({q.submissionsCount} evaluated)</div>
                <div>Avg Attempts: <strong>{q.avgAttempts}</strong></div>
                <div>Failures: <code>{JSON.stringify(q.failureDistribution)}</code></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div style={{ marginTop: "18px", padding: "16px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <strong>Candidate Breakdown: {String(detail.candidateName || "")}</strong>
            <button type="button" onClick={() => setDetail(null)} className="admin-btn-secondary">Close</button>
          </div>
          <pre style={{ margin: 0, fontSize: "12px", overflowX: "auto" }}>{JSON.stringify(detail.questions, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
