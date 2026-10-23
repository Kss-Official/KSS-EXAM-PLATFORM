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

  // Selected candidates list: targets qualified candidates first, or filtered candidates
  const selectedCandidates = (() => {
    if (statusFilter !== "ALL") {
      return filtered;
    }
    const qualified = filtered.filter(r => r.qualificationStatus === "QUALIFIED");
    if (qualified.length > 0) return qualified;
    return filtered;
  })();

  const downloadPdfReport = () => {
    if (selectedCandidates.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up was blocked. Please allow pop-ups to open and download the PDF report.");
      return;
    }
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
            <h1 class="title">ExamSecure — Selected Candidates Report</h1>
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
          ExamSecure Assessment System &bull; Official Selected Candidate Merit List
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
          tr:nth-child(even) { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <h2>ExamSecure &mdash; Selected Candidates List</h2>
        <p><strong>Examination:</strong> ${examTitle} | <strong>Date:</strong> ${dateStr} | <strong>Selected Count:</strong> ${selectedCandidates.length}</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Candidate Name</th>
              <th>Roll / Reg No</th>
              <th>Department</th>
              <th>Examination & Set</th>
              <th>Score / Max</th>
              <th>Qualification Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedCandidates.map((c, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><strong>${c.candidateName}</strong></td>
                <td>${c.registrationNumber}</td>
                <td>${c.departmentName}</td>
                <td>${c.examTitle} (Set ${c.setCode})</td>
                <td>${c.score ?? "-"} / ${c.totalMarks}</td>
                <td>${c.qualificationStatus || "QUALIFIED"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + docContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Selected_Candidates_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCsvReport = () => {
    if (selectedCandidates.length === 0) return;
    const headers = ["#", "Candidate Name", "Roll / Registration Number", "Department", "Examination", "Set", "Score", "Total Marks", "Qualification Status", "Submission Time"];
    const rows = selectedCandidates.map((c, idx) => [
      idx + 1,
      `"${(c.candidateName || "").replace(/"/g, '""')}"`,
      `"${(c.registrationNumber || "").replace(/"/g, '""')}"`,
      `"${(c.departmentName || "").replace(/"/g, '""')}"`,
      `"${(c.examTitle || "").replace(/"/g, '""')}"`,
      `"${c.setCode || ""}"`,
      c.score ?? "",
      c.totalMarks ?? "",
      `"${c.qualificationStatus || "QUALIFIED"}"`,
      `"${c.submittedAt ? new Date(c.submittedAt).toLocaleString() : ""}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Selected_Candidates_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Award size={18} color="#017846" />
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
