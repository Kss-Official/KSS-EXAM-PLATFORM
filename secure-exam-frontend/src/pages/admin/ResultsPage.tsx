import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Award, 
  Search, 
  FileCheck2,
  RotateCcw,
  Globe
} from "lucide-react";
import { getAllResults, publishResults, getAllExams, type ExamResultDto, type ExamDto } from "../../services/api";

export default function ResultsPage() {
  const [exams, setExams] = useState<ExamDto[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | undefined>(undefined);
  const [results, setResults] = useState<ExamResultDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState<string | null>(null);

  const fetchExams = async () => {
    try {
      const data = await getAllExams();
      setExams(data);
    } catch (e) {
      console.warn("Could not load exams:", e);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const data = await getAllResults(selectedExamId);
      setResults(data);
    } catch (e: unknown) {
      const errorObj = e as Error;
      setNotice("Failed to load results: " + errorObj.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    fetchResults();
  }, [selectedExamId]);

  const handleTogglePublish = async (examId: number, currentlyPublished: boolean) => {
    try {
      await publishResults(examId, !currentlyPublished);
      setNotice(`Results publication status changed to ${!currentlyPublished ? "PUBLISHED" : "UNPUBLISHED"}.`);
      fetchResults();
      fetchExams();
    } catch (e: unknown) {
      const errorObj = e as Error;
      setNotice("Failed to update publication status: " + errorObj.message);
    }
  };

  const filtered = results.filter(r => {
    const matchesSearch = 
      r.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.examTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.departmentName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || r.qualificationStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const qualifiedCount = results.filter(r => r.qualificationStatus === "QUALIFIED").length;
  const avgScore = results.length > 0 
    ? (results.reduce((acc, r) => acc + (r.score || 0), 0) / results.length).toFixed(1)
    : "0.0";

  const selectedExamObj = exams.find(e => e.id === selectedExamId);

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={18} color="#2563eb" />
            <strong style={{ fontSize: "15px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Assessment Results & Scoring Analytics
            </strong>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
            Objective scoring, qualification verification, and authorized candidate release controls
          </p>
        </div>
        <div className="admin-page-actions">
          {selectedExamObj && (
            <button
              type="button"
              className={selectedExamObj.resultsPublished ? "admin-btn secondary" : "admin-btn primary"}
              onClick={() => handleTogglePublish(selectedExamObj.id, selectedExamObj.resultsPublished)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 15px",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                background: selectedExamObj.resultsPublished ? "#ffffff" : "linear-gradient(135deg, #10b981, #059669)",
                color: selectedExamObj.resultsPublished ? "#334155" : "#ffffff",
                border: selectedExamObj.resultsPublished ? "1px solid #cbd5e1" : "none",
                boxShadow: selectedExamObj.resultsPublished ? "0 1px 2px rgba(0,0,0,0.05)" : "0 2px 8px rgba(16, 185, 129, 0.25)"
              }}
            >
              <Globe size={14} />
              {selectedExamObj.resultsPublished ? "Unpublish Scores (Make Private)" : "Publish Scores to Candidates"}
            </button>
          )}
          <button 
            type="button" 
            className="admin-btn secondary" 
            onClick={fetchResults}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            <RotateCcw size={14} /> Refresh
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: "10px", fontSize: "13px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="stat-cards-row">
        <div className="stat-card">
          <div className="stat-card-info">
            <small>Total Completed Attempts</small>
            <div className="stat-card-value">{results.length}</div>
            <span className="stat-card-sub">Recorded in database</span>
          </div>
          <div className="stat-card-icon blue"><FileCheck2 size={22} /></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Qualified Candidates</small>
            <div className="stat-card-value">{qualifiedCount}</div>
            <span className="stat-card-sub">{results.length > 0 ? ((qualifiedCount / results.length) * 100).toFixed(1) : 0}% pass rate</span>
          </div>
          <div className="stat-card-icon green"><Award size={22} /></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Average Candidate Score</small>
            <div className="stat-card-value">{avgScore}</div>
            <span className="stat-card-sub">Across all 4 sets A-D</span>
          </div>
          <div className="stat-card-icon amber"><BarChart3 size={22} /></div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-row">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by candidate name, roll no, or department..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Exam Filter Dropdown */}
        <select
          value={selectedExamId || ""}
          onChange={e => setSelectedExamId(e.target.value ? Number(e.target.value) : undefined)}
          style={{ height: "42px", padding: "8px 14px", fontSize: "12.5px", borderRadius: "10px", border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#0f172a", outline: "none" }}
        >
          <option value="">All Examinations</option>
          {exams.map(e => (
            <option key={e.id} value={e.id}>#{e.id} {e.title}</option>
          ))}
        </select>

        <div className="status-filter-pills">
          {["ALL", "QUALIFIED", "NOT_QUALIFIED", "PENDING"].map(st => (
            <button
              key={st}
              type="button"
              className={`filter-pill ${statusFilter === st ? "active" : ""}`}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table */}
      <div className="admin-table-card">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Department</th>
                <th>Examination & Set</th>
                <th>Answered / Unanswered</th>
                <th>Score / Total Marks</th>
                <th>Percentage</th>
                <th>Qualification Status</th>
                <th>Submission Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    Loading real attempt results from PostgreSQL...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                    <BarChart3 size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No examination attempts submitted yet</p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      Candidate exam submissions will appear here with automatic backend scoring and pass status.
                    </small>
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.attemptId}>
                    <td>
                      <b style={{ color: "#0f172a" }}>{r.candidateName}</b>
                      <small style={{ display: "block", color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>{r.registrationNumber}</small>
                    </td>
                    <td>
                      <span className="admin-dept-chip">
                        {r.departmentName}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: "12.5px", fontWeight: 700 }}>{r.examTitle}</div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb" }}>Set {r.setCode}</span>
                    </td>
                    <td>
                      <span style={{ color: "#16a34a", fontWeight: 700 }}>{r.answeredCount}</span> /{" "}
                      <span style={{ color: "#94a3b8" }}>{r.unansweredCount}</span>
                    </td>
                    <td>
                      <b style={{ fontSize: "13.5px", color: "#0f172a" }}>{r.score ?? "-"}</b> / {r.totalMarks}
                    </td>
                    <td>
                      <b>{r.percentage ? `${r.percentage}%` : "-"}</b>
                    </td>
                    <td>
                      <span className={`status-pill ${r.qualificationStatus?.toLowerCase() || "pending"}`}>
                        {r.qualificationStatus || "PENDING"}
                      </span>
                    </td>
                    <td>
                      <small style={{ color: "#64748b" }}>
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : "-"}
                      </small>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
