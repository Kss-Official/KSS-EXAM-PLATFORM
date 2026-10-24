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
  CheckCircle2,
  Code2,
  Mail,
  Send,
  Eye,
  UserCheck
} from "lucide-react";
import { getAllResults, publishResults, getAllExams, type ExamResultDto, type ExamDto } from "../../services/api";
import { 
  selectCandidatesForRound2, 
  getRound2SelectedMap, 
  type Round2Invitation 
} from "../../services/candidateRoundIdService";
import { 
  getCandidateCodingSubmissions, 
  type CandidateCodingSubmission 
} from "../../services/codingExamService";

export default function ResultsPage() {
  const [selectedRound, setSelectedRound] = useState<"ROUND_1" | "ROUND_2">("ROUND_1");
  const [exams, setExams] = useState<ExamDto[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | undefined>(undefined);
  const [results, setResults] = useState<ExamResultDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState<string | null>(null);

  // Round 2 Nomination & Email Modal State
  const [candidateToNominate, setCandidateToNominate] = useState<ExamResultDto | null>(null);
  const [invitationPreview, setInvitationPreview] = useState<Round2Invitation | null>(null);
  const [selectedCodingSubmission, setSelectedCodingSubmission] = useState<CandidateCodingSubmission | null>(null);
  const [codingSubmissions, setCodingSubmissions] = useState<CandidateCodingSubmission[]>([]);
  const [round2Map, setRound2Map] = useState<Record<string, Round2Invitation>>({});

  const fetchExams = async () => {
    try {
      const data = await getAllExams();
      setExams(data);
    } catch (e) {
      console.warn("Could not load exams:", e);
    }
  };

  const fetchCodingSubmissions = () => {
    const list = getCandidateCodingSubmissions();
    if (list.length === 0) {
      const seedSub: CandidateCodingSubmission = {
        id: "SUB-CODE-8021",
        candidateId: "REG008",
        candidateName: "Jingyasa Priyadarsini",
        registrationNumber: "REG008",
        departmentName: "Developer",
        examId: "CODE-101",
        submittedAt: new Date(Date.now() - 3600000).toISOString(),
        questions: [
          {
            questionId: "q-ip-regex-1",
            questionTitle: "IP Address Validation using Regular Expression",
            language: "java",
            sourceCode: `import java.util.regex.Matcher;\nimport java.util.regex.Pattern;\nimport java.util.Scanner;\n\nclass Solution{\n    public static void main(String[] args){\n        Scanner in = new Scanner(System.in);\n        while(in.hasNext()){\n            String IP = in.next();\n            System.out.println(IP.matches(new MyRegex().pattern));\n        }\n    }\n}\n\nclass MyRegex {\n    String pattern = "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\\\.) {3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$";\n}`,
            passedCases: 4,
            totalCases: 4,
            score: 20,
            maxMarks: 20,
            status: "ACCEPTED",
            runtimeMs: 120
          }
        ],
        totalScore: 20,
        maxScore: 20,
        qualificationStatus: "QUALIFIED"
      };
      setCodingSubmissions([seedSub]);
    } else {
      setCodingSubmissions(list);
    }
    setRound2Map(getRound2SelectedMap());
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
    fetchCodingSubmissions();
  }, []);

  useEffect(() => {
    fetchResults();
  }, [selectedExamId]);

  const handleNominateCandidate = (cand: ExamResultDto) => {
    setCandidateToNominate(cand);
    const existing = round2Map[cand.registrationNumber.toUpperCase()];
    const uniqueId = existing?.round2UniqueId || `CODE-${cand.registrationNumber.toUpperCase()}`;
    setInvitationPreview({
      registrationNumber: cand.registrationNumber,
      candidateName: cand.candidateName,
      email: `${cand.registrationNumber.toLowerCase()}@campus.edu`,
      departmentName: cand.departmentName,
      round2UniqueId: uniqueId,
      selectedAt: new Date().toISOString(),
      emailSent: true,
      emailSentAt: new Date().toISOString(),
      assessmentDate: "Scheduled for Today (Live)",
      durationMinutes: 60
    });
  };

  const handleConfirmSendEmail = () => {
    if (!candidateToNominate || !invitationPreview) return;
    selectCandidatesForRound2([
      {
        registrationNumber: candidateToNominate.registrationNumber,
        candidateName: candidateToNominate.candidateName,
        email: invitationPreview.email,
        departmentName: candidateToNominate.departmentName
      }
    ]);
    setRound2Map(getRound2SelectedMap());
    setNotice(`Round 2 Invitation Email sent to ${candidateToNominate.candidateName} (${invitationPreview.round2UniqueId}) successfully! Candidate is now eligible for Round 2.`);
    setCandidateToNominate(null);
    setInvitationPreview(null);
  };

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
            <h1 class="title">ExamSecure ΓÇö Selected Candidates Report</h1>
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
          <button type="button" onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Γ£ò</button>
        </div>
      )}

      {/* Round 1 vs Round 2 Selection Tabs */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #e2e8f0", paddingBottom: "12px" }}>
        <button
          type="button"
          onClick={() => setSelectedRound("ROUND_1")}
          style={{
            padding: "9px 20px",
            borderRadius: "8px",
            border: "none",
            background: selectedRound === "ROUND_1" ? "#017846" : "#f1f5f9",
            color: selectedRound === "ROUND_1" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease"
          }}
        >
          <FileCheck2 size={16} /> Round 1 ΓÇö MCQ Assessment Results
        </button>
        <button
          type="button"
          onClick={() => setSelectedRound("ROUND_2")}
          style={{
            padding: "9px 20px",
            borderRadius: "8px",
            border: "none",
            background: selectedRound === "ROUND_2" ? "#017846" : "#f1f5f9",
            color: selectedRound === "ROUND_2" ? "#ffffff" : "#475569",
            fontWeight: 700,
            fontSize: "13px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease"
          }}
        >
          <Code2 size={16} /> Round 2 ΓÇö Coding Submissions ({codingSubmissions.length})
        </button>
      </div>

      {selectedRound === "ROUND_1" ? (
        <>
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
                <small>Selected for Round 2</small>
                <div className="stat-card-value">{Object.keys(round2Map).length}</div>
                <span className="stat-card-sub">Issued Round 2 Unique ID</span>
              </div>
              <div className="stat-card-icon emerald" style={{ color: "#017846" }}><Mail size={22} /></div>
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
                    <th>Round 2 Selection</th>
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
                    filtered.map(r => {
                      const isR2 = !!round2Map[r.registrationNumber];
                      const r2Info = round2Map[r.registrationNumber];
                      return (
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
                            {isR2 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11.5px", fontWeight: 700, color: "#017846", background: "#eaf6ef", padding: "3px 8px", borderRadius: "6px" }}>
                                  <CheckCircle2 size={12} /> Selected for R2
                                </span>
                                <small style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "10.5px", color: "#475569" }}>
                                  ID: {r2Info.round2UniqueId}
                                </small>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleNominateCandidate(r)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "6px 12px",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  background: "#f0fdf4",
                                  color: "#017846",
                                  border: "1px solid #bbf7d0",
                                  borderRadius: "6px",
                                  cursor: "pointer"
                                }}
                              >
                                <UserCheck size={13} /> Select for Round 2
                              </button>
                            )}
                          </td>
                          <td>
                            <small style={{ color: "#64748b" }}>
                              {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString() : "-"}
                            </small>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Round 2 Coding Submissions Table */
        <div className="admin-table-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                Round 2 ΓÇö Coding Assessment Submissions
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                Review source code, automated test results, execution runtime, and evaluation marks.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchCodingSubmissions}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
            >
              <RotateCcw size={14} /> Refresh Submissions
            </button>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Round 2 ID</th>
                  <th>Department</th>
                  <th>Problem Statement</th>
                  <th>Language</th>
                  <th>Passed / Total Tests</th>
                  <th>Runtime</th>
                  <th>Submitted At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {codingSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                      <Code2 size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No Round 2 coding submissions yet</p>
                      <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                        Candidates taking the Round 2 Coding IDE exam will automatically submit their code solutions here.
                      </small>
                    </td>
                  </tr>
                ) : (
                  codingSubmissions.map((sub, idx) => (
                    <tr key={sub.id || idx}>
                      <td>
                        <b style={{ color: "#0f172a" }}>{sub.candidateName}</b>
                        <small style={{ display: "block", color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>{sub.registrationNumber}</small>
                      </td>
                      <td>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", fontWeight: 700, color: "#017846", background: "#eaf6ef", padding: "3px 8px", borderRadius: "5px" }}>
                          {sub.round2UniqueId}
                        </span>
                      </td>
                      <td>
                        <span className="admin-dept-chip">{sub.departmentName || "Engineering"}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#1e293b" }}>{sub.questionTitle}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155", background: "#f1f5f9", padding: "3px 8px", borderRadius: "4px", textTransform: "uppercase" }}>
                          {sub.language}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: sub.testCasesPassed === sub.totalTestCases ? "#16a34a" : "#ca8a04", fontWeight: 700 }}>
                          {sub.testCasesPassed}
                        </span> / <span style={{ color: "#64748b" }}>{sub.totalTestCases}</span>
                      </td>
                      <td>
                        <small style={{ color: "#64748b" }}>{sub.executionTime || "0.12 s"}</small>
                      </td>
                      <td>
                        <small style={{ color: "#64748b" }}>
                          {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString() : "-"}
                        </small>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setSelectedCodingSubmission(sub)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 12px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            background: "#017846",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer"
                          }}
                        >
                          <Eye size={13} /> View Code
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Round 2 Candidate Nomination & Email Modal */}
      {candidateToNominate && invitationPreview && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "600px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "18px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#eaf6ef", display: "flex", alignItems: "center", justifyContent: "center", color: "#017846" }}>
                  <Mail size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    Select Candidate for Round 2
                  </h3>
                  <small style={{ color: "#64748b" }}>Issue unique Round 2 ID and dispatch invitation email</small>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setCandidateToNominate(null); setInvitationPreview(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#64748b" }}
              >
                Γ£ò
              </button>
            </div>

            <div style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#f8fafc", padding: "14px 18px", borderRadius: "10px", marginBottom: "18px", border: "1px solid #e2e8f0" }}>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Candidate Name</small>
                  <strong style={{ color: "#0f172a", fontSize: "13.5px" }}>{candidateToNominate.candidateName}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Registration No (R1)</small>
                  <strong style={{ fontFamily: "JetBrains Mono, monospace", color: "#475569", fontSize: "13px" }}>{candidateToNominate.registrationNumber}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Generated Round 2 Unique ID</small>
                  <strong style={{ fontFamily: "JetBrains Mono, monospace", color: "#017846", fontSize: "13.5px" }}>{invitationPreview.round2UniqueId}</strong>
                </div>
                <div>
                  <small style={{ color: "#64748b", display: "block" }}>Round 1 Score</small>
                  <strong style={{ color: "#0f172a", fontSize: "13px" }}>{candidateToNominate.score} / {candidateToNominate.totalMarks} (Qualified)</strong>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Round 2 Email Invitation Preview
                </label>
                <div style={{ background: "#0f172a", color: "#f8fafc", padding: "16px", borderRadius: "10px", fontSize: "12px", fontFamily: "JetBrains Mono, monospace", whiteSpace: "pre-line", maxHeight: "180px", overflowY: "auto", border: "1px solid #334155" }}>
                  {`Subject: Invitation to Round 2 ΓÇö Coding Assessment (Kalpanaa Software Solutions)

Dear ${candidateToNominate.candidateName},

Congratulations! Based on your performance in Round 1 (MCQ Assessment), you have been shortlisted for Round 2 ΓÇö Coding Assessment.

Your Round 2 Credentials:
ΓÇó Round 2 Unique ID: ${invitationPreview.round2UniqueId}
ΓÇó Examination: Coding Assessment (60 Mins)
ΓÇó Assessment URL: http://localhost:5173/candidate/entry (Select "Round 2: Coding Assessment")

Important Instructions:
1. Complete device compatibility check (Camera, Microphone, Screen).
2. Write, compile, and submit code in your preferred programming language.
3. Once submitted, your final code will be evaluated by Kalpanaa Software Solutions.`}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => { setCandidateToNominate(null); setInvitationPreview(null); }}
                  style={{ padding: "9px 18px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "13px", fontWeight: 600, color: "#475569", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSendEmail}
                  style={{ padding: "9px 20px", borderRadius: "8px", border: "none", background: "#017846", fontSize: "13px", fontWeight: 700, color: "#ffffff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "7px" }}
                >
                  <Send size={15} /> Confirm & Dispatch Invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Code Viewer Modal for Administrator Inspection */}
      {selectedCodingSubmission && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "24px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "850px",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "18px 24px", background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#ffffff" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Code2 size={18} color="#4ade80" />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
                    {selectedCodingSubmission.questionTitle}
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: 700, background: "#334155", color: "#93c5fd", padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase" }}>
                    {selectedCodingSubmission.language}
                  </span>
                </div>
                <small style={{ color: "#94a3b8" }}>
                  Candidate: {selectedCodingSubmission.candidateName} ({selectedCodingSubmission.round2UniqueId})
                </small>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCodingSubmission(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#94a3b8" }}
              >
                Γ£ò
              </button>
            </div>

            <div style={{ padding: "16px 24px", background: "#0f172a", borderBottom: "1px solid #1e293b", display: "flex", gap: "24px" }}>
              <div>
                <small style={{ color: "#64748b", display: "block" }}>Test Cases Passed</small>
                <strong style={{ color: "#4ade80", fontSize: "13px" }}>
                  {selectedCodingSubmission.testCasesPassed} / {selectedCodingSubmission.totalTestCases} Passed
                </strong>
              </div>
              <div>
                <small style={{ color: "#64748b", display: "block" }}>Execution Time</small>
                <strong style={{ color: "#f8fafc", fontSize: "13px" }}>
                  {selectedCodingSubmission.executionTime || "0.12 s"}
                </strong>
              </div>
              <div>
                <small style={{ color: "#64748b", display: "block" }}>Status</small>
                <strong style={{ color: "#38bdf8", fontSize: "13px" }}>
                  {selectedCodingSubmission.status || "PASSED"}
                </strong>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", background: "#0f172a", padding: "16px 24px" }}>
              <pre style={{
                margin: 0,
                fontFamily: "Consolas, 'Fira Code', JetBrains Mono, monospace",
                fontSize: "13px",
                lineHeight: 1.6,
                color: "#e2e8f0",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
                {selectedCodingSubmission.sourceCode}
              </pre>
            </div>

            <div style={{ padding: "14px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSelectedCodingSubmission(null)}
                style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "13px", fontWeight: 600, color: "#475569", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
