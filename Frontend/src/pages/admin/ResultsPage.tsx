import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Award, 
  Search, 
  FileCheck2,
  RotateCcw,
  Globe,
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle2
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
    const interval = setInterval(() => {
      getAllResults(selectedExamId)
        .then(data => setResults(data))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedExamId]);

  const handleTogglePublish = async (examId: number, currentlyPublished: boolean) => {
    try {
      const updated = await publishResults(examId, !currentlyPublished);
      setExams(prev => prev.map(e => e.id === examId ? { ...e, resultsPublished: updated.resultsPublished } : e));
      setResults(prev => prev.map(r => r.examId === examId ? { ...r, isPublished: updated.resultsPublished } : r));
      setNotice(updated.resultsPublished ? "Results published! Candidates can now view their scores." : "Results unpublished (hidden from candidates).");
    } catch (e: unknown) {
      const errorObj = e as Error;
      setNotice("Failed to update results publication: " + errorObj.message);
    }
  };

  const filtered = results.filter(r => {
    const matchesSearch = 
      r.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.registrationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.departmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.examTitle && r.examTitle.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || r.qualificationStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const selectedCandidates = results.filter(r => r.qualificationStatus === "QUALIFIED");
  const qualifiedCount = selectedCandidates.length;
  const avgScore = results.length > 0 
    ? (results.reduce((acc, curr) => acc + (curr.score || 0), 0) / results.length).toFixed(1)
    : "0.0";
  const topScore = results.length > 0
    ? Math.max(...results.map(r => r.score || 0))
    : 0;

  const selectedExamObj = exams.find(e => e.id === selectedExamId);

  const downloadCsvReport = () => {
    if (selectedCandidates.length === 0) return;
    const headers = ["Candidate Name", "Registration Number", "Department", "Exam Title", "Set", "Score", "Total Marks", "Percentage", "Time Taken", "Qualification Status", "Submitted At"];
    const rows = selectedCandidates.map(c => [
      `"${c.candidateName}"`,
      `"${c.registrationNumber}"`,
      `"${c.departmentName}"`,
      `"${c.examTitle}"`,
      `"${c.setCode}"`,
      c.score ?? 0,
      c.totalMarks,
      `${c.percentage ?? 0}%`,
      `"${c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : "-"}"`,
      `"${c.qualificationStatus || "QUALIFIED"}"`,
      `"${c.submittedAt ? new Date(c.submittedAt).toLocaleString() : "-"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Selected_Candidates_Merit_List_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPdfReport = () => {
    if (selectedCandidates.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const examTitle = selectedExamObj ? selectedExamObj.title : "All Examinations";
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Selected Candidates List - ${examTitle}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 36px; color: #0f172a; margin: 0; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #017846; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 20px; font-weight: 800; color: #017846; margin: 0 0 6px 0; }
          .subtitle { font-size: 13px; color: #64748b; margin: 0; }
          .badge { background: #eaf6ef; color: #017846; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 13px; border: 1px solid #bbf7d0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12.5px; }
          th { background: #f8fafc; color: #334155; text-align: left; padding: 10px 12px; border: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
          td { padding: 9px 12px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .status-tag { background: #dcfce7; color: #166534; font-weight: 700; padding: 3px 8px; border-radius: 4px; font-size: 11px; display: inline-block; }
          .footer { margin-top: 36px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print {
            body { padding: 15px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Kalpanaa Software Solutions &mdash; Selected Candidates Report</h1>
            <p class="subtitle">Examination: <strong>${examTitle}</strong> &bull; Generated on: ${dateStr}</p>
          </div>
          <div class="badge">
            Total Selected: ${selectedCandidates.length}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 36px;">#</th>
              <th>Candidate Name</th>
              <th>Roll / Reg Number</th>
              <th>Department</th>
              <th>Examination & Set</th>
              <th>Score / Max</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedCandidates.map((c, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${c.candidateName}</strong></td>
                <td style="font-family: monospace; font-size: 11.5px;">${c.registrationNumber}</td>
                <td>${c.departmentName}</td>
                <td>${c.examTitle} (Set ${c.setCode})</td>
                <td><strong>${c.score ?? "-"}</strong> / ${c.totalMarks}</td>
                <td><span class="status-tag">${c.qualificationStatus || "QUALIFIED"}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="footer">
          Kalpanaa Assessment System &bull; Official Selected Candidate Merit List
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const downloadWordDoc = () => {
    if (selectedCandidates.length === 0) return;
    const examTitle = selectedExamObj ? selectedExamObj.title : "All Examinations";
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Selected Candidates List</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
          h2 { color: #017846; margin-bottom: 4px; }
          p { color: #64748b; font-size: 10pt; margin-top: 0; }
          table { border-collapse: collapse; width: 100%; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 10px; font-size: 10pt; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
        </style>
      </head>
      <body>
        <h2>Kalpanaa Software Solutions &mdash; Selected Candidates Merit List</h2>
        <p>Examination: <b>${examTitle}</b> | Date: ${dateStr} | Total Qualified: <b>${selectedCandidates.length}</b></p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Candidate Name</th>
              <th>Roll / Reg No</th>
              <th>Department</th>
              <th>Score</th>
              <th>Max Marks</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedCandidates.map((c, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><b>${c.candidateName}</b></td>
                <td>${c.registrationNumber}</td>
                <td>${c.departmentName}</td>
                <td><b>${c.score ?? 0}</b></td>
                <td>${c.totalMarks}</td>
                <td>${c.qualificationStatus || "QUALIFIED"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(["\ufeff", docContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Selected_Candidates_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-page">
      {/* Header bar */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={20} color="#017846" />
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
            <span className="stat-card-sub">Across examination attempts</span>
          </div>
          <div className="stat-card-icon amber"><BarChart3 size={22} /></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Highest Score</small>
            <div className="stat-card-value">{topScore}</div>
            <span className="stat-card-sub">Top scoring candidate</span>
          </div>
          <div className="stat-card-icon emerald" style={{ color: "#017846" }}><Award size={22} /></div>
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

      {/* Download / Export Selected Candidate List Bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        marginBottom: "16px",
        padding: "12px 18px",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "#eaf6ef",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#017846"
          }}>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
              Selected Candidate List ({selectedCandidates.length})
            </div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>
              {statusFilter === "QUALIFIED" 
                ? "Showing verified qualified candidates" 
                : "Export qualified / selected candidate list for official records"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={downloadPdfReport}
            disabled={selectedCandidates.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 16px",
              fontSize: "12.5px",
              fontWeight: 600,
              background: selectedCandidates.length === 0 ? "#94a3b8" : "#017846",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              cursor: selectedCandidates.length === 0 ? "not-allowed" : "pointer",
              boxShadow: selectedCandidates.length === 0 ? "none" : "0 2px 6px rgba(1, 120, 70, 0.25)",
              transition: "all 0.15s ease"
            }}
            title="Download printable / PDF report of selected candidates"
          >
            <Download size={15} /> Download PDF
          </button>

          <button
            type="button"
            onClick={downloadWordDoc}
            disabled={selectedCandidates.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 15px",
              fontSize: "12.5px",
              fontWeight: 600,
              background: "#ffffff",
              color: selectedCandidates.length === 0 ? "#94a3b8" : "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: selectedCandidates.length === 0 ? "not-allowed" : "pointer",
              transition: "all 0.15s ease"
            }}
            title="Download Word Document (.doc) of selected candidates"
          >
            <FileText size={15} /> Download Docs
          </button>

          <button
            type="button"
            onClick={downloadCsvReport}
            disabled={selectedCandidates.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 15px",
              fontSize: "12.5px",
              fontWeight: 600,
              background: "#ffffff",
              color: selectedCandidates.length === 0 ? "#94a3b8" : "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: selectedCandidates.length === 0 ? "not-allowed" : "pointer",
              transition: "all 0.15s ease"
            }}
            title="Download CSV spreadsheet of selected candidates"
          >
            <FileSpreadsheet size={15} /> Download CSV
          </button>
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
                <th>Qualification Status</th>
                <th>Submission Time</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    Loading real attempt results from PostgreSQL...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                    <BarChart3 size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No examination attempts submitted yet</p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      Candidate exam submissions will appear here with automatic backend scoring and pass status.
                    </small>
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  return (
                    <tr key={r.attemptId}>
                      <td>
                        <b style={{ color: "#0f172a" }}>{r.candidateName}</b>
                        {r.candidateEmail && (
                          <small style={{ display: "block", color: "#475569", fontSize: "11.5px" }}>{r.candidateEmail}</small>
                        )}
                        <small style={{ display: "block", color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>{r.registrationNumber}</small>
                      </td>
                      <td>
                        <span className="admin-dept-chip">
                          {r.departmentName}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: "12.5px", fontWeight: 700 }}>{r.examTitle}</div>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#017846" }}>Set {r.setCode}</span>
                      </td>
                      <td>
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>{r.answeredCount}</span> /{" "}
                        <span style={{ color: "#94a3b8" }}>{r.unansweredCount}</span>
                      </td>
                      <td>
                        <b style={{ fontSize: "13.5px", color: "#0f172a" }}>{r.score ?? "-"}</b> / {r.totalMarks}
                      </td>
                      <td>
                        <span className={`status-pill ${r.qualificationStatus?.toLowerCase() || "pending"}`}>
                          {r.qualificationStatus || "PENDING"}
                        </span>
                      </td>
                      <td>
                        <small style={{ color: "#0f172a", fontWeight: 600, display: "block" }}>
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (
                            <span style={{ color: "#d97706", fontWeight: 600 }}>{r.attemptStatus === "IN_PROGRESS" ? "In Progress • Live" : (r.attemptStatus || "Pending")}</span>
                          )}
                        </small>
                        {r.durationSeconds !== undefined && r.durationSeconds !== null && r.durationSeconds > 0 && (
                          <small style={{ color: "#64748b", display: "block", fontSize: "11px", marginTop: "2px" }}>
                            ⏱️ {Math.floor(r.durationSeconds / 60)}m {r.durationSeconds % 60}s
                          </small>
                        )}
                        {r.receiptId && (
                          <span style={{ fontSize: "10px", color: "#017846", fontFamily: "JetBrains Mono, monospace", display: "block", marginTop: "2px" }} title="Submission Receipt ID">
                            {r.receiptId}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
