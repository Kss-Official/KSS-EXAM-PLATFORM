import { useEffect, useState, type CSSProperties } from "react";
import {
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  Cpu,
  Download,
  Eye,
  FileCode2,
  Globe,
  HardDrive,
  Lock,
  TrendingUp,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { listAdminCodingExams, type AdminCodingExamDto } from "../../services/codingExamsAdminApi";
import {
  getAdminCodingAnalytics,
  getAdminCodingCandidateDetail,
  getAdminCodingCsvUrl,
  listAdminCodingResults,
  toggleAdminCodingResultsPublished,
  type AdminCodingAnalyticsResponse,
  type AdminCodingResultsListResponse,
} from "../../services/codingResultsApi";

interface CandidateQuestionDetail {
  questionId: string;
  title: string;
  testsPassed: number;
  testsTotal: number;
  samplePassed: number;
  hiddenPassed: number;
  scoreAwarded: number;
  scorePossible: number;
  scorePercent: number;
  finalVerdict: string;
  failureSummary?: Record<string, number>;
  firstFailureType?: string | null;
  maxRuntimeMs?: number | null;
  maxMemoryKb?: number | null;
  language?: string | null;
  attemptsCount: number;
  compileErrorShort?: string | null;
  codeHash?: string | null;
}

interface CandidateDetailPayload {
  attemptId: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  registrationNumber: string;
  status: string;
  totalScore: number;
  totalPossible: number;
  overallPercent: number;
  qualificationStatus: string;
  finalizedAt?: string | null;
  questions: CandidateQuestionDetail[];
}

const BTN_PRIMARY: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 15px",
  borderRadius: "8px",
  border: "1px solid #017846",
  background: "#017846",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "13px",
  textDecoration: "none",
  boxShadow: "0 1px 2px rgba(1, 120, 70, 0.2)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const BTN_OUTLINE_GREEN: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid #b7dfd0",
  background: "#f3faf6",
  color: "#017846",
  fontWeight: 700,
  fontSize: "13px",
  textDecoration: "none",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const BTN_NEUTRAL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 13px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 600,
  fontSize: "12.5px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function verdictStyle(verdict: string): { bg: string; color: string; border: string } {
  if (verdict === "ACCEPTED") {
    return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
  }
  if (verdict === "TIME_LIMIT_EXCEEDED" || verdict === "MEMORY_LIMIT_EXCEEDED") {
    return { bg: "#fffbeb", color: "#b45309", border: "#fde68a" };
  }
  if (verdict === "NOT_ATTEMPTED" || verdict === "PENDING") {
    return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
  }
  return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
}

function qualStyle(status: string): { bg: string; color: string; border: string } {
  if (status === "QUALIFIED") return { bg: "#eaf6ef", color: "#017846", border: "#bbf7d0" };
  if (status === "NOT_QUALIFIED") return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
  return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
}

export default function CodingResultsAdminPage() {
  const params = new URLSearchParams(window.location.search);
  const initialParamId = Number(params.get("examId") || 0);
  const [exams, setExams] = useState<AdminCodingExamDto[]>([]);
  const [examId, setExamId] = useState<number>(initialParamId || 2);
  const [tab, setTab] = useState<"candidates" | "analytics">("candidates");
  const [page, setPage] = useState(1);

  const [listData, setListData] = useState<AdminCodingResultsListResponse | null>(null);
  const [analytics, setAnalytics] = useState<AdminCodingAnalyticsResponse | null>(null);
  const [detail, setDetail] = useState<CandidateDetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listAdminCodingExams()
      .then((list) => {
        setExams(list);
        if (!initialParamId && list.length > 0 && list[0].id) {
          setExamId(Number(list[0].id));
        }
      })
      .catch(() => {});
  }, [initialParamId]);

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
    setLoadingDetail(true);
    try {
      const d = (await getAdminCodingCandidateDetail(examId, candidateId)) as unknown as CandidateDetailPayload;
      setDetail(d);
    } finally {
      setLoadingDetail(false);
    }
  };

  const items = listData?.items ?? [];
  const qualifiedCount = items.filter((r) => r.qualificationStatus === "QUALIFIED").length;
  const avgOverall =
    items.length > 0 ? items.reduce((acc, r) => acc + Number(r.overallPercent || 0), 0) / items.length : 0;

  return (
    <div className="admin-page-container" style={{ padding: "24px", maxWidth: "1360px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0f172a" }}>
            Round 2 Coding Results &amp; Analytics
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            {listData ? `${listData.examTitle} · ${listData.total} candidate attempt(s)` : "Select a Coding Exam"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#475569", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            Exam:
            {exams.length > 0 ? (
              <select
                value={examId}
                onChange={(e) => {
                  setPage(1);
                  setDetail(null);
                  setExamId(Number(e.target.value));
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    #{ex.id} — {ex.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min={1}
                value={examId}
                onChange={(e) => {
                  setPage(1);
                  setExamId(Number(e.target.value) || 1);
                }}
                style={{ width: "74px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            )}
          </label>

          {listData && (
            <button
              type="button"
              style={BTN_OUTLINE_GREEN}
              onClick={() => void handleTogglePublish()}
            >
              {listData.resultsPublished ? <Lock size={14} /> : <Globe size={14} />}
              {listData.resultsPublished ? "Unpublish Results" : "Publish Results"}
            </button>
          )}

          <a href={getAdminCodingCsvUrl(examId)} style={BTN_PRIMARY}>
            <Download size={14} /> Export CSV
          </a>
        </div>
      </div>

      {/* KPI Strip */}
      {listData && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
            marginBottom: "20px",
          }}
        >
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Attempts</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>{listData.total}</div>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#eaf6ef", color: "#017846", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={20} />
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Qualified (Page)</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#017846", marginTop: "4px" }}>
                {qualifiedCount} <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748b" }}>/ {items.length}</span>
              </div>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#eaf6ef", color: "#017846", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Award size={20} />
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Average Score</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>{avgOverall.toFixed(1)}%</div>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#eaf6ef", color: "#017846", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={20} />
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Candidate Visibility</div>
              <div style={{ marginTop: "8px" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 700,
                    background: listData.resultsPublished ? "#eaf6ef" : "#f1f5f9",
                    color: listData.resultsPublished ? "#017846" : "#475569",
                  }}
                >
                  {listData.resultsPublished ? <Globe size={12} /> : <Lock size={12} />}
                  {listData.resultsPublished ? "Published" : "Hidden"}
                </span>
              </div>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#eaf6ef", color: "#017846", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Segmented Tabs */}
      <div
        role="tablist"
        style={{
          display: "inline-flex",
          gap: "4px",
          padding: "4px",
          borderRadius: "10px",
          background: "#e2e8f0",
          marginBottom: "18px",
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "candidates"}
          onClick={() => setTab("candidates")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            borderRadius: "7px",
            border: "none",
            fontSize: "13px",
            fontWeight: 700,
            background: tab === "candidates" ? "#017846" : "transparent",
            color: tab === "candidates" ? "#ffffff" : "#475569",
            cursor: "pointer",
          }}
        >
          <Users size={14} /> Candidates
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "analytics"}
          onClick={() => setTab("analytics")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            borderRadius: "7px",
            border: "none",
            fontSize: "13px",
            fontWeight: 700,
            background: tab === "analytics" ? "#017846" : "transparent",
            color: tab === "analytics" ? "#ffffff" : "#475569",
            cursor: "pointer",
          }}
        >
          <BarChart3 size={14} /> Question Analytics
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", color: "#b91c1c", marginBottom: "16px", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {/* Candidates Table */}
      {tab === "candidates" && listData && (
        <div className="admin-table-card" style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Reg No</th>
                  <th>Total</th>
                  <th>Overall %</th>
                  <th>Status</th>
                  {listData.questions.map((q, idx) => (
                    <th key={q.id} title={q.title}>
                      Q{idx + 1} ({q.maxMarks}m)
                    </th>
                  ))}
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6 + listData.questions.length} style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                      No coding attempts recorded for this exam yet.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const qs = qualStyle(row.qualificationStatus);
                    return (
                      <tr key={row.attemptId}>
                        <td>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.candidateName}</div>
                          <div style={{ fontSize: "11.5px", color: "#64748b" }}>{row.candidateEmail}</div>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#475569" }}>{row.registrationNumber}</td>
                        <td style={{ fontWeight: 700 }}>
                          {row.totalScore} <span style={{ color: "#94a3b8", fontWeight: 500 }}>/ {row.totalPossible}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ minWidth: "42px", color: "#0f172a" }}>{row.overallPercent.toFixed(1)}%</strong>
                            <div style={{ width: "52px", height: "6px", borderRadius: "999px", background: "#e2e8f0", overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(100, row.overallPercent)}%`, height: "100%", background: "#017846" }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ padding: "3px 10px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700, background: qs.bg, color: qs.color, border: `1px solid ${qs.border}` }}>
                            {row.qualificationStatus}
                          </span>
                        </td>
                        {listData.questions.map((q) => {
                          const pct = row.questionPercents[q.id] ?? 0;
                          return (
                            <td key={q.id} title={`${q.title}: ${pct.toFixed(1)}%`}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  background: pct >= 100 ? "#eaf6ef" : pct > 0 ? "#fffbeb" : "#f1f5f9",
                                  color: pct >= 100 ? "#017846" : pct > 0 ? "#b45309" : "#64748b",
                                }}
                              >
                                {pct.toFixed(0)}%
                              </span>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            style={{ ...BTN_OUTLINE_GREEN, padding: "6px 12px", fontSize: "12px" }}
                            disabled={loadingDetail}
                            onClick={() => void handleViewDetail(row.candidateId)}
                          >
                            <Eye size={13} /> View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid #e2e8f0", fontSize: "13px", color: "#475569" }}>
            <span>
              Page {listData.page} &middot; Total {listData.total}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ ...BTN_NEUTRAL, opacity: page <= 1 ? 0.5 : 1 }}>
                Prev
              </button>
              <button
                type="button"
                disabled={page * listData.pageSize >= listData.total}
                onClick={() => setPage((p) => p + 1)}
                style={{ ...BTN_NEUTRAL, opacity: page * listData.pageSize >= listData.total ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Analytics Tab */}
      {tab === "analytics" && analytics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: "16px" }}>
          {analytics.questions.map((q) => {
            const failures = Object.entries(q.failureDistribution || {});
            return (
              <div key={q.questionId} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>{q.title}</h3>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {q.submissionsCount} evaluated &middot; Avg {q.avgAttempts} attempt(s)
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "4px" }}>
                    <span style={{ color: "#475569" }}>Average Score</span>
                    <strong style={{ color: "#017846" }}>{q.avgPercent}%</strong>
                  </div>
                  <div style={{ height: "7px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, q.avgPercent)}%`, height: "100%", background: "#017846" }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "4px" }}>
                    <span style={{ color: "#475569" }}>Full Pass Rate</span>
                    <strong style={{ color: "#0f172a" }}>{q.passRatePercent}%</strong>
                  </div>
                  <div style={{ height: "7px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, q.passRatePercent)}%`, height: "100%", background: "#10b981" }} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>Failure Breakdown</div>
                  {failures.length === 0 ? (
                    <span style={{ fontSize: "12px", color: "#017846", fontWeight: 600 }}>No failures recorded</span>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {failures.map(([k, v]) => (
                        <span key={k} style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11.5px", fontWeight: 600, background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Structured Candidate Breakdown Drawer (zero raw JSON) */}
      {detail && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            justifyContent: "flex-end",
            zIndex: 1000,
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              width: "min(680px, 100vw)",
              height: "100vh",
              background: "#f8fafc",
              boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.18)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ background: "#fff", padding: "20px 24px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: "19px", color: "#0f172a" }}>{detail.candidateName}</h2>
                  <span style={{ padding: "3px 9px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700, ...qualStyle(detail.qualificationStatus) }}>
                    {detail.qualificationStatus}
                  </span>
                </div>
                <div style={{ fontSize: "12.5px", color: "#64748b", marginTop: "4px" }}>
                  {detail.candidateEmail} &middot; {detail.registrationNumber}
                  {detail.finalizedAt ? ` · Finalized ${new Date(detail.finalizedAt).toLocaleString()}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close breakdown"
                style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: "8px", padding: "6px", display: "inline-flex", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Score Banner */}
            <div style={{ padding: "14px 24px", background: "#eaf6ef", borderBottom: "1px solid #d9e6df", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "13px", color: "#014d32", fontWeight: 600 }}>
                Total Score: <strong>{detail.totalScore} / {detail.totalPossible}</strong>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "20px", fontWeight: 800, color: "#017846" }}>
                <Award size={20} /> {Number(detail.overallPercent || 0).toFixed(1)}%
              </div>
            </div>

            {/* Problem Cards */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {(detail.questions || []).map((q) => {
                const vs = verdictStyle(q.finalVerdict);
                const failEntries = Object.entries(q.failureSummary || {});
                return (
                  <div key={q.questionId} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "15px", color: "#0f172a" }}>{q.title}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", fontSize: "12px", color: "#64748b", flexWrap: "wrap" }}>
                          {q.language && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#f1f5f9", color: "#334155", padding: "2px 7px", borderRadius: "5px", fontWeight: 600 }}>
                              <FileCode2 size={12} /> {q.language}
                            </span>
                          )}
                          <span>{q.attemptsCount} submit(s)</span>
                          {q.maxRuntimeMs != null && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <Clock3 size={12} /> {q.maxRuntimeMs} ms
                            </span>
                          )}
                          {q.maxMemoryKb != null && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                              <HardDrive size={12} /> {Math.round(q.maxMemoryKb / 1024)} MB
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 9px",
                            borderRadius: "999px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            background: vs.bg,
                            color: vs.color,
                            border: `1px solid ${vs.border}`,
                          }}
                        >
                          {q.finalVerdict === "ACCEPTED" ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          {q.finalVerdict}
                        </span>
                        <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
                          {q.scoreAwarded} / {q.scorePossible} ({Number(q.scorePercent || 0).toFixed(1)}%)
                        </div>
                      </div>
                    </div>

                    <div style={{ height: "6px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, Number(q.scorePercent || 0))}%`,
                          height: "100%",
                          background: q.finalVerdict === "ACCEPTED" ? "#017846" : "#f59e0b",
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", fontSize: "12px" }}>
                      <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#64748b" }}>Total Passed</div>
                        <strong style={{ color: "#0f172a", fontSize: "14px" }}>{q.testsPassed} / {q.testsTotal}</strong>
                      </div>
                      <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#64748b" }}>Sample Tests</div>
                        <strong style={{ color: "#0f172a", fontSize: "14px" }}>{q.samplePassed} passed</strong>
                      </div>
                      <div style={{ padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ color: "#64748b" }}>Hidden Tests</div>
                        <strong style={{ color: "#0f172a", fontSize: "14px" }}>{q.hiddenPassed} passed</strong>
                      </div>
                    </div>

                    {(failEntries.length > 0 || q.codeHash) && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", fontSize: "11.5px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {failEntries.map(([k, v]) => (
                            <span key={k} style={{ padding: "2px 7px", borderRadius: "5px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", fontWeight: 600 }}>
                              {k}: {v}
                            </span>
                          ))}
                        </div>
                        {q.codeHash && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#64748b", fontFamily: "var(--font-mono)" }} title={q.codeHash}>
                            <Cpu size={12} /> sha256:{q.codeHash.slice(0, 12)}
                          </span>
                        )}
                      </div>
                    )}

                    {q.compileErrorShort && (
                      <pre style={{ margin: 0, padding: "8px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", fontSize: "11.5px", color: "#991b1b", overflowX: "auto" }}>
                        {q.compileErrorShort}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
