import { useState, useEffect, useMemo } from "react";
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
  Clock,
  ArrowUpDown,
  Filter,
  SlidersHorizontal,
  XCircle,
  HelpCircle,
  AlertCircle,
  Calendar,
  CalendarDays
} from "lucide-react";
import { 
  getAllResults, 
  getAvailableResultDates,
  publishResults, 
  getAllExams, 
  resetCandidateAttempt,
  type ExamResultDto, 
  type ExamDto 
} from "../../services/api";

type SlotFilterType = "ALL" | "Slot 1" | "Slot 2";
type ScoreSortType = "DEFAULT" | "SCORE_DESC" | "SCORE_ASC" | "NAME_ASC";
type ScorePresetType = "ALL" | "TOP_SCORERS" | "QUALIFIED" | "BORDERLINE" | "NOT_QUALIFIED" | "ZERO";

// Date helpers for IST (UTC+5:30)
const getTodayIstString = (): string => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(new Date()); // Outputs YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const getYesterdayIstString = (todayStr: string): string => {
  try {
    const [y, m, d] = todayStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const formatDateShort = (dStr: string): string => {
  if (!dStr || dStr === "ALL") return "";
  try {
    const [y, m, d] = dStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  } catch {
    return dStr;
  }
};

const formatDateLabel = (dStr: string, todayStr: string, yesterdayStr: string): string => {
  if (dStr === "ALL") return "All Dates Combined";
  if (dStr === todayStr) {
    return `Today (${formatDateShort(todayStr)} ${todayStr.slice(0, 4)})`;
  }
  if (dStr === yesterdayStr) {
    return `Yesterday (${formatDateShort(yesterdayStr)} ${yesterdayStr.slice(0, 4)})`;
  }
  try {
    const [y, m, d] = dStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return dStr;
  }
};

const formatDisplayDate = (dStr: string | undefined): string => {
  if (!dStr || dStr === "-") return "-";
  try {
    const [y, m, d] = dStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  } catch {
    return dStr;
  }
};

export default function ResultsPage() {
  const todayIst = useMemo(() => getTodayIstString(), []);
  const yesterdayIst = useMemo(() => getYesterdayIstString(todayIst), [todayIst]);

  const [exams, setExams] = useState<ExamDto[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | undefined>(undefined);
  const [results, setResults] = useState<ExamResultDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Date Filter States
  const [selectedDate, setSelectedDate] = useState<string>(todayIst); // Default to today's date
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [todayAttemptCount, setTodayAttemptCount] = useState<number | undefined>(undefined);
  
  // Slot & Criteria Filter States
  const [slotFilter, setSlotFilter] = useState<SlotFilterType>("Slot 1"); // Default to Slot 1 as requested
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scorePreset, setScorePreset] = useState<ScorePresetType>("ALL");
  const [minScore, setMinScore] = useState<string>("");
  const [maxScore, setMaxScore] = useState<string>("");
  const [scoreSort, setScoreSort] = useState<ScoreSortType>("DEFAULT");
  const [exportMode, setExportMode] = useState<"FILTERED" | "QUALIFIED">("FILTERED");

  const [notice, setNotice] = useState<string | null>(null);
  const [attemptToReset, setAttemptToReset] = useState<ExamResultDto | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const fetchExams = async () => {
    try {
      const data = await getAllExams();
      setExams(data);
    } catch (e) {
      console.warn("Could not load exams:", e);
    }
  };

  const fetchAvailableDates = async () => {
    try {
      const dates = await getAvailableResultDates();
      if (dates && dates.length > 0) {
        setAvailableDates(dates);
      }
    } catch (e) {
      console.warn("Could not load available dates:", e);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const data = await getAllResults(selectedExamId, selectedDate === "ALL" ? undefined : selectedDate);
      setResults(data);
      if (selectedDate === todayIst) {
        setTodayAttemptCount(data.length);
      }
    } catch (e: unknown) {
      const errorObj = e as Error;
      setNotice("Failed to load results: " + errorObj.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
    fetchAvailableDates();
  }, []);

  useEffect(() => {
    fetchResults();
    const interval = setInterval(() => {
      getAllResults(selectedExamId, selectedDate === "ALL" ? undefined : selectedDate)
        .then(data => {
          setResults(data);
          if (selectedDate === todayIst) {
            setTodayAttemptCount(data.length);
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedExamId, selectedDate]);

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

  const handleConfirmReset = async () => {
    if (!attemptToReset) return;
    setIsResetting(true);
    try {
      await resetCandidateAttempt(attemptToReset.attemptId);
      setNotice(`Attempt for ${attemptToReset.candidateName} has been completely reset. The student can now log back in and retake the exam.`);
      setAttemptToReset(null);
      fetchResults();
    } catch (err: unknown) {
      const errObj = err as Error;
      setNotice("Failed to reset attempt: " + errObj.message);
    } finally {
      setIsResetting(false);
    }
  };

  // Helper to reliably extract candidate's exam date
  const getCandidateExamDate = (r: ExamResultDto): string => {
    if (r.examDate) return r.examDate;
    const ts = r.submittedAt || r.startedAt || r.createdAt;
    if (ts) {
      try {
        return new Date(ts).toISOString().slice(0, 10);
      } catch {
        return "-";
      }
    }
    return "-";
  };

  // Helper to reliably classify a candidate's slot
  const getCandidateSlot = (r: ExamResultDto): "Slot 1" | "Slot 2" => {
    if (r.slotNumber === 2) return "Slot 2";
    if (r.slotNumber === 1 && !r.examTitle?.toLowerCase().includes("slot @") && !r.candidateBatch?.includes("2")) return "Slot 1";
    
    if (r.candidateBatch && r.candidateBatch.includes("2")) return "Slot 2";
    if (r.candidateBatch && r.candidateBatch.includes("1")) return "Slot 1";
    
    if (r.examId === 99 || (r.examTitle && (r.examTitle.includes("@") || r.examTitle.toLowerCase().includes("slot 2")))) {
      return "Slot 2";
    }
    return "Slot 1";
  };

  // Slot candidates for active date
  const slot1Candidates = useMemo(() => results.filter(r => getCandidateSlot(r) === "Slot 1"), [results]);
  const slot2Candidates = useMemo(() => results.filter(r => getCandidateSlot(r) === "Slot 2"), [results]);

  const slotCounts = useMemo(() => ({
    total: results.length,
    slot1: slot1Candidates.length,
    slot2: slot2Candidates.length,
  }), [results, slot1Candidates, slot2Candidates]);

  // Compute dynamic pool based on selected slot
  const activeSlotPool = useMemo(() => {
    if (slotFilter === "Slot 1") return slot1Candidates;
    if (slotFilter === "Slot 2") return slot2Candidates;
    return results;
  }, [slotFilter, slot1Candidates, slot2Candidates, results]);

  const qualifiedInSlot = useMemo(() => activeSlotPool.filter(r => r.qualificationStatus === "QUALIFIED").length, [activeSlotPool]);
  const avgScore = useMemo(() => {
    if (activeSlotPool.length === 0) return "0.0";
    const sum = activeSlotPool.reduce((acc, curr) => acc + (curr.score || 0), 0);
    return (sum / activeSlotPool.length).toFixed(1);
  }, [activeSlotPool]);

  const topScore = useMemo(() => {
    if (activeSlotPool.length === 0) return 0;
    return Math.max(0, ...activeSlotPool.map(r => r.score || 0));
  }, [activeSlotPool]);

  // Multi-filter evaluation
  const filtered = useMemo(() => {
    return results.filter(r => {
      // 1. Slot Filter
      if (slotFilter !== "ALL") {
        if (getCandidateSlot(r) !== slotFilter) return false;
      }

      // 2. Search Query (name, roll no, department, email, exam title)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.candidateName?.toLowerCase().includes(q);
        const matchRoll = r.registrationNumber?.toLowerCase().includes(q);
        const matchDept = r.departmentName?.toLowerCase().includes(q);
        const matchEmail = r.candidateEmail?.toLowerCase().includes(q);
        const matchExam = r.examTitle?.toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchDept && !matchEmail && !matchExam) {
          return false;
        }
      }

      // 3. Exam Dropdown
      if (selectedExamId && r.examId !== selectedExamId) {
        return false;
      }

      // 4. Qualification Status
      if (statusFilter !== "ALL" && r.qualificationStatus !== statusFilter) {
        return false;
      }

      // 5. Marks Presets
      const score = r.score ?? 0;
      if (scorePreset === "TOP_SCORERS" && score < 45) return false;
      if (scorePreset === "QUALIFIED" && (r.qualificationStatus !== "QUALIFIED" && score < 36)) return false;
      if (scorePreset === "BORDERLINE" && (score < 30 || score > 35)) return false;
      if (scorePreset === "NOT_QUALIFIED" && score >= 36) return false;
      if (scorePreset === "ZERO" && score > 0) return false;

      // 6. Custom Score Range
      if (minScore !== "" && !isNaN(Number(minScore))) {
        if (score < Number(minScore)) return false;
      }
      if (maxScore !== "" && !isNaN(Number(maxScore))) {
        if (score > Number(maxScore)) return false;
      }

      return true;
    }).sort((a, b) => {
      if (scoreSort === "SCORE_DESC") {
        return (b.score ?? -1) - (a.score ?? -1);
      }
      if (scoreSort === "SCORE_ASC") {
        return (a.score ?? 999) - (b.score ?? 999);
      }
      if (scoreSort === "NAME_ASC") {
        return a.candidateName.localeCompare(b.candidateName);
      }
      return 0; // Default order
    });
  }, [results, slotFilter, searchQuery, selectedExamId, statusFilter, scorePreset, minScore, maxScore, scoreSort]);

  // Candidates for export
  const exportCandidates = useMemo(() => {
    if (exportMode === "QUALIFIED") {
      return filtered.filter(r => r.qualificationStatus === "QUALIFIED");
    }
    return filtered;
  }, [filtered, exportMode]);

  const hasActiveFilters = slotFilter !== "Slot 1" || searchQuery.trim() !== "" || statusFilter !== "ALL" || scorePreset !== "ALL" || minScore !== "" || maxScore !== "" || scoreSort !== "DEFAULT" || selectedExamId !== undefined;

  const resetAllFilters = () => {
    setSlotFilter("Slot 1");
    setSearchQuery("");
    setStatusFilter("ALL");
    setScorePreset("ALL");
    setMinScore("");
    setMaxScore("");
    setScoreSort("DEFAULT");
    setSelectedExamId(undefined);
  };

  const selectedExamObj = exams.find(e => e.id === selectedExamId);

  // Slot title for exports
  const getSlotExportTitle = () => {
    if (slotFilter === "Slot 1") return "Slot 1 (10:00 AM - 11:00 AM)";
    if (slotFilter === "Slot 2") return "Slot 2 (02:00 PM - 03:00 PM)";
    return "All Slots Combined";
  };

  const downloadCsvReport = () => {
    if (exportCandidates.length === 0) return;
    const headers = [
      "Exam Date",
      "Candidate Name", 
      "Registration Number", 
      "Email Address",
      "Department", 
      "Slot", 
      "Exam Title", 
      "Question Set", 
      "Answered Count",
      "Unanswered Count",
      "Score", 
      "Total Marks", 
      "Percentage", 
      "Time Taken", 
      "Qualification Status", 
      "Submission Time",
      "Receipt ID"
    ];
    const rows = exportCandidates.map(c => [
      `"${c.examDate || getCandidateExamDate(c)}"`,
      `"${c.candidateName}"`,
      `"${c.registrationNumber}"`,
      `"${c.candidateEmail || "-"}"`,
      `"${c.departmentName}"`,
      `"${getCandidateSlot(c)}"`,
      `"${c.examTitle}"`,
      `"${c.setCode}"`,
      c.answeredCount,
      c.unansweredCount,
      c.score ?? 0,
      c.totalMarks,
      `${c.percentage ?? 0}%`,
      `"${c.durationSeconds ? `${Math.floor(c.durationSeconds / 60)}m ${c.durationSeconds % 60}s` : "-"}"`,
      `"${c.qualificationStatus || "PENDING"}"`,
      `"${c.submittedAt ? new Date(c.submittedAt).toLocaleString() : (c.attemptStatus || "-")}"`,
      `"${c.receiptId || "-"}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const prefix = slotFilter === "ALL" ? "All_Slots" : slotFilter.replace(" ", "_");
    const modeStr = exportMode === "QUALIFIED" ? "Qualified" : "Candidates";
    link.setAttribute("download", `ExamSecure_${selectedDate}_${prefix}_${modeStr}_Results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPdfReport = () => {
    if (exportCandidates.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const examTitle = selectedExamObj ? selectedExamObj.title : getSlotExportTitle();
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const examDateLabel = formatDateLabel(selectedDate, todayIst, yesterdayIst);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Examination Results & Merit Report - ${examTitle}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 32px; color: #0f172a; margin: 0; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #017846; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; color: #017846; margin: 0 0 6px 0; }
          .subtitle { font-size: 13px; color: #64748b; margin: 0; }
          .badge-box { text-align: right; }
          .badge { background: #eaf6ef; color: #017846; padding: 6px 14px; border-radius: 6px; font-weight: 700; font-size: 13px; border: 1px solid #bbf7d0; display: inline-block; }
          .slot-tag { margin-top: 4px; font-size: 11.5px; font-weight: 600; color: #0284c7; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
          th { background: #f8fafc; color: #334155; text-align: left; padding: 10px 10px; border: 1px solid #cbd5e1; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
          td { padding: 8px 10px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background: #f8fafc; }
          .status-tag { padding: 3px 8px; border-radius: 4px; font-size: 11px; display: inline-block; font-weight: 700; }
          .status-qualified { background: #dcfce7; color: #166534; }
          .status-not_qualified { background: #fee2e2; color: #991b1b; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .slot-pill { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
          .slot-1 { background: #e0f2fe; color: #0369a1; }
          .slot-2 { background: #f3e8ff; color: #6b21a8; }
          .date-pill { background: #f1f5f9; color: #334155; font-size: 10.5px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
          .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print {
            body { padding: 12px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Kalpanaa Software Solutions &mdash; Official Results Report</h1>
            <p class="subtitle">Examination: <strong>${examTitle}</strong> &bull; Exam Date: <strong>${examDateLabel}</strong> &bull; Generated: ${dateStr}</p>
          </div>
          <div class="badge-box">
            <div class="badge">Total Listed: ${exportCandidates.length} Candidates</div>
            <div class="slot-tag">Scope: ${getSlotExportTitle()} &bull; ${examDateLabel}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 32px;">#</th>
              <th>Exam Date</th>
              <th>Candidate Name & Reg No</th>
              <th>Department</th>
              <th>Slot & Set</th>
              <th>Ans / Unans</th>
              <th>Score / Max</th>
              <th>%</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${exportCandidates.map((c, idx) => {
              const slot = getCandidateSlot(c);
              const st = (c.qualificationStatus || "PENDING").toLowerCase();
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><span class="date-pill">${c.examDate || getCandidateExamDate(c)}</span></td>
                  <td>
                    <strong>${c.candidateName}</strong>
                    <div style="font-family: monospace; font-size: 11px; color: #64748b;">${c.registrationNumber}</div>
                  </td>
                  <td>${c.departmentName}</td>
                  <td>
                    <span class="slot-pill ${slot === "Slot 1" ? "slot-1" : "slot-2"}">${slot}</span>
                    <span style="font-size: 11px; font-weight: 600; margin-left: 4px;">Set ${c.setCode}</span>
                  </td>
                  <td>${c.answeredCount} / ${c.unansweredCount}</td>
                  <td><strong>${c.score ?? "-"}</strong> / ${c.totalMarks}</td>
                  <td>${c.percentage !== undefined && c.percentage !== null ? `${c.percentage}%` : "-"}</td>
                  <td><span class="status-tag status-${st}">${c.qualificationStatus || "PENDING"}</span></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        <div class="footer">
          Kalpanaa Assessment Platform &bull; Official Authenticated Examination Ledger &bull; Confidential
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
    if (exportCandidates.length === 0) return;
    const examTitle = selectedExamObj ? selectedExamObj.title : getSlotExportTitle();
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const examDateLabel = formatDateLabel(selectedDate, todayIst, yesterdayIst);

    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Examination Results - ${examTitle}</title>
        <style>
          body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; }
          h2 { color: #017846; margin-bottom: 4px; }
          p { color: #64748b; font-size: 10pt; margin-top: 0; }
          table { border-collapse: collapse; width: 100%; margin-top: 14px; }
          th, td { border: 1px solid #cbd5e1; padding: 7px 9px; font-size: 10pt; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
        </style>
      </head>
      <body>
        <h2>Kalpanaa Software Solutions &mdash; Official Results Report</h2>
        <p>Examination: <b>${examTitle}</b> | Exam Date: <b>${examDateLabel}</b> | Date Generated: ${dateStr} | Total Candidates: <b>${exportCandidates.length}</b></p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Exam Date</th>
              <th>Candidate Name</th>
              <th>Roll / Reg No</th>
              <th>Department</th>
              <th>Slot</th>
              <th>Set</th>
              <th>Score</th>
              <th>Max Marks</th>
              <th>%</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${exportCandidates.map((c, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${c.examDate || getCandidateExamDate(c)}</td>
                <td><b>${c.candidateName}</b></td>
                <td>${c.registrationNumber}</td>
                <td>${c.departmentName}</td>
                <td>${getCandidateSlot(c)}</td>
                <td>Set ${c.setCode}</td>
                <td><b>${c.score ?? 0}</b></td>
                <td>${c.totalMarks}</td>
                <td>${c.percentage !== undefined && c.percentage !== null ? `${c.percentage}%` : "-"}</td>
                <td>${c.qualificationStatus || "PENDING"}</td>
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
    const prefix = slotFilter === "ALL" ? "All_Slots" : slotFilter.replace(" ", "_");
    link.download = `ExamSecure_${selectedDate}_${prefix}_Results.doc`;
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
            <strong style={{ fontSize: "16px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Examination Results & Scoring Analytics
            </strong>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#64748b" }}>
            Objective scoring, slot-wise candidate classification, and verified qualification reporting
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

      {/* UNIFIED EXAMINATION DATE & SLOT CONTROL PANEL */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "16px 20px",
        marginBottom: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
      }}>
        {/* ROW 1: EXAMINATION DATE SELECTION */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#334155", fontWeight: 700, fontSize: "13px" }}>
              <Calendar size={16} color="#017846" />
              <span>Examination Date:</span>
            </div>

            <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "4px", borderRadius: "10px", gap: "4px", flexWrap: "wrap" }}>
              {/* Today Button */}
              <button
                type="button"
                onClick={() => setSelectedDate(todayIst)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: selectedDate === todayIst ? "#017846" : "transparent",
                  color: selectedDate === todayIst ? "#ffffff" : "#475569",
                  boxShadow: selectedDate === todayIst ? "0 2px 6px rgba(1, 120, 70, 0.25)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <span>Today ({formatDateShort(todayIst)})</span>
                {todayAttemptCount !== undefined && (
                  <span style={{
                    background: selectedDate === todayIst ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                    color: selectedDate === todayIst ? "#ffffff" : "#017846",
                    padding: "1px 7px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 800
                  }}>
                    {todayAttemptCount}
                  </span>
                )}
              </button>

              {/* Yesterday Button */}
              <button
                type="button"
                onClick={() => setSelectedDate(yesterdayIst)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: selectedDate === yesterdayIst ? "#017846" : "transparent",
                  color: selectedDate === yesterdayIst ? "#ffffff" : "#475569",
                  boxShadow: selectedDate === yesterdayIst ? "0 2px 6px rgba(1, 120, 70, 0.25)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <span>Yesterday ({formatDateShort(yesterdayIst)})</span>
              </button>

              {/* Other distinct dates from DB */}
              {availableDates.filter(d => d !== todayIst && d !== yesterdayIst).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                    background: selectedDate === d ? "#017846" : "transparent",
                    color: selectedDate === d ? "#ffffff" : "#475569",
                    boxShadow: selectedDate === d ? "0 2px 6px rgba(1, 120, 70, 0.25)" : "none",
                    transition: "all 0.15s ease"
                  }}
                >
                  <span>{formatDateShort(d)}</span>
                </button>
              ))}

              {/* All Dates Combined Button */}
              <button
                type="button"
                onClick={() => setSelectedDate("ALL")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: selectedDate === "ALL" ? "#0f172a" : "transparent",
                  color: selectedDate === "ALL" ? "#ffffff" : "#475569",
                  boxShadow: selectedDate === "ALL" ? "0 2px 6px rgba(15, 23, 42, 0.25)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <span>All Dates Combined</span>
              </button>
            </div>

            {/* Custom Date Input */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600 }}>Custom Date:</span>
              <input
                type="date"
                value={selectedDate === "ALL" ? "" : selectedDate}
                max={todayIst}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                style={{
                  height: "32px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              />
            </div>
          </div>

          {/* Active Date Indicator */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: selectedDate === todayIst ? "#eaf6ef" : "#f1f5f9",
            border: `1px solid ${selectedDate === todayIst ? "#bbf7d0" : "#cbd5e1"}`,
            padding: "5px 12px",
            borderRadius: "8px",
            fontSize: "12px",
            color: selectedDate === todayIst ? "#017846" : "#475569",
            fontWeight: 600
          }}>
            <CalendarDays size={14} color={selectedDate === todayIst ? "#017846" : "#64748b"} />
            <span>Active Date: <strong>{formatDateLabel(selectedDate, todayIst, yesterdayIst)}</strong></span>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #f1f5f9" }} />

        {/* ROW 2: TIME SLOT SELECTION (Slot 1 vs Slot 2 Separation) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#334155", fontWeight: 700, fontSize: "13px" }}>
              <Clock size={16} color="#017846" />
              <span>Examination Slot:</span>
            </div>

            <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "4px", borderRadius: "10px", gap: "4px" }}>
              {/* Slot 1 Tab */}
              <button
                type="button"
                onClick={() => setSlotFilter("Slot 1")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: slotFilter === "Slot 1" ? "#0284c7" : "transparent",
                  color: slotFilter === "Slot 1" ? "#ffffff" : "#475569",
                  boxShadow: slotFilter === "Slot 1" ? "0 2px 6px rgba(2, 132, 199, 0.3)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <span>Slot 1 (10:00 AM)</span>
                <span style={{
                  background: slotFilter === "Slot 1" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                  color: slotFilter === "Slot 1" ? "#ffffff" : "#0369a1",
                  padding: "1px 8px",
                  borderRadius: "10px",
                  fontSize: "11.5px",
                  fontWeight: 800
                }}>
                  {slotCounts.slot1}
                </span>
              </button>

              {/* Slot 2 Tab */}
              <button
                type="button"
                onClick={() => setSlotFilter("Slot 2")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: slotFilter === "Slot 2" ? "#7c3aed" : "transparent",
                  color: slotFilter === "Slot 2" ? "#ffffff" : "#475569",
                  boxShadow: slotFilter === "Slot 2" ? "0 2px 6px rgba(124, 58, 237, 0.3)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <span>Slot 2 (02:00 PM)</span>
                <span style={{
                  background: slotFilter === "Slot 2" ? "rgba(255,255,255,0.25)" : "#f3e8ff",
                  color: slotFilter === "Slot 2" ? "#ffffff" : "#7c3aed",
                  padding: "1px 8px",
                  borderRadius: "10px",
                  fontSize: "11.5px",
                  fontWeight: 800
                }}>
                  {slotCounts.slot2}
                </span>
              </button>

              {/* All Slots Tab */}
              <button
                type="button"
                onClick={() => setSlotFilter("ALL")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 16px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: slotFilter === "ALL" ? "#017846" : "transparent",
                  color: slotFilter === "ALL" ? "#ffffff" : "#475569",
                  boxShadow: slotFilter === "ALL" ? "0 2px 6px rgba(1, 120, 70, 0.3)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <span>All Slots</span>
                <span style={{
                  background: slotFilter === "ALL" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                  color: slotFilter === "ALL" ? "#ffffff" : "#475569",
                  padding: "1px 8px",
                  borderRadius: "10px",
                  fontSize: "11.5px",
                  fontWeight: 800
                }}>
                  {slotCounts.total}
                </span>
              </button>
            </div>
          </div>

          {/* Slot Info Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {slotFilter === "Slot 1" && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                padding: "5px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#0369a1",
                fontWeight: 600
              }}>
                <CheckCircle2 size={14} color="#0284c7" />
                <span>Slot 1 Exam: <strong>Completed (10:00 AM – 11:00 AM)</strong> &bull; {slotCounts.slot1} Attendees</span>
              </div>
            )}
            {slotFilter === "Slot 2" && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#faf5ff",
                border: "1px solid #e9d5ff",
                padding: "5px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#7e22ce",
                fontWeight: 600
              }}>
                <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#a855f7" }} />
                <span>Slot 2 Exam: <strong>Completed (02:00 PM – 03:00 PM)</strong> &bull; {slotCounts.slot2} Attendees</span>
              </div>
            )}
            {slotFilter === "ALL" && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                padding: "5px 12px",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#475569",
                fontWeight: 600
              }}>
                <span>Showing All Candidate Submissions Across All Slots ({slotCounts.total})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Metric Cards (Updated per selected Date & Slot) */}
      <div className="stat-cards-row">
        <div className="stat-card">
          <div className="stat-card-info">
            <small>Total Completed Attempts {slotFilter !== "ALL" && `(${slotFilter})`}</small>
            <div className="stat-card-value">{activeSlotPool.length}</div>
            <span className="stat-card-sub">Recorded in database</span>
          </div>
          <div className="stat-card-icon blue"><FileCheck2 size={22} /></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Qualified Candidates {slotFilter !== "ALL" && `(${slotFilter})`}</small>
            <div className="stat-card-value">{qualifiedInSlot}</div>
            <span className="stat-card-sub">
              {activeSlotPool.length > 0 ? ((qualifiedInSlot / activeSlotPool.length) * 100).toFixed(1) : 0}% pass rate
            </span>
          </div>
          <div className="stat-card-icon green"><Award size={22} /></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Average Candidate Score {slotFilter !== "ALL" && `(${slotFilter})`}</small>
            <div className="stat-card-value">{avgScore}</div>
            <span className="stat-card-sub">Across {slotFilter} attempts</span>
          </div>
          <div className="stat-card-icon amber"><BarChart3 size={22} /></div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Highest Score {slotFilter !== "ALL" && `(${slotFilter})`}</small>
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
            placeholder="Search by candidate name, roll no, department, or email..." 
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

        {/* Status Filter Pills */}
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

      {/* MARKS-BASED FILTER CONTROLS BAR */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "12px 18px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
      }}>
        {/* Left: Quick Score Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#475569", display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <SlidersHorizontal size={14} color="#017846" />
            Marks Filter:
          </span>

          {[
            { id: "ALL", label: "All Marks" },
            { id: "TOP_SCORERS", label: "Top Scorers (≥ 45)" },
            { id: "QUALIFIED", label: "Passing (≥ 36)" },
            { id: "BORDERLINE", label: "Borderline (30 - 35)" },
            { id: "NOT_QUALIFIED", label: "Below Pass (< 36)" },
            { id: "ZERO", label: "Zero (0)" }
          ].map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setScorePreset(p.id as ScorePresetType);
                if (p.id !== "ALL") {
                  setMinScore("");
                  setMaxScore("");
                }
              }}
              style={{
                padding: "5px 11px",
                borderRadius: "6px",
                fontSize: "11.5px",
                fontWeight: 600,
                cursor: "pointer",
                border: scorePreset === p.id ? "1.5px solid #017846" : "1px solid #cbd5e1",
                background: scorePreset === p.id ? "#eaf6ef" : "#f8fafc",
                color: scorePreset === p.id ? "#017846" : "#475569",
                transition: "all 0.12s ease"
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Right: Min / Max Marks & Sorting */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Min & Max inputs */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600 }}>Range:</span>
            <input 
              type="number"
              placeholder="Min"
              value={minScore}
              onChange={e => {
                setMinScore(e.target.value);
                setScorePreset("ALL");
              }}
              style={{
                width: "60px",
                height: "32px",
                padding: "4px 8px",
                fontSize: "12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                textAlign: "center"
              }}
              min={0}
              max={60}
            />
            <span style={{ color: "#94a3b8" }}>–</span>
            <input 
              type="number"
              placeholder="Max"
              value={maxScore}
              onChange={e => {
                setMaxScore(e.target.value);
                setScorePreset("ALL");
              }}
              style={{
                width: "60px",
                height: "32px",
                padding: "4px 8px",
                fontSize: "12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                textAlign: "center"
              }}
              min={0}
              max={60}
            />
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ArrowUpDown size={14} color="#64748b" />
            <select
              value={scoreSort}
              onChange={e => setScoreSort(e.target.value as ScoreSortType)}
              style={{
                height: "32px",
                padding: "4px 10px",
                fontSize: "12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer"
              }}
            >
              <option value="DEFAULT">Sort: Recent Attempts</option>
              <option value="SCORE_DESC">Marks: High → Low</option>
              <option value="SCORE_ASC">Marks: Low → High</option>
              <option value="NAME_ASC">Name: A → Z</option>
            </select>
          </div>

          {/* Clear All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px dashed #cbd5e1",
                background: "#f8fafc",
                color: "#64748b",
                fontSize: "11.5px",
                fontWeight: 600,
                cursor: "pointer"
              }}
              title="Reset all search and marks filters"
            >
              <XCircle size={13} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Download / Export Candidate List Bar */}
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
            width: "34px",
            height: "34px",
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
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Export Candidates ({exportCandidates.length})</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b" }}>
                from <strong>{getSlotExportTitle()}</strong> &bull; {formatDateLabel(selectedDate, todayIst, yesterdayIst)}
              </span>
            </div>
            <div style={{ fontSize: "11.5px", color: "#64748b" }}>
              Displaying {filtered.length} of {activeSlotPool.length} {slotFilter !== "ALL" ? slotFilter : "total"} candidates based on applied filters
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Export Mode Toggle */}
          <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "3px", borderRadius: "8px", gap: "3px" }}>
            <button
              type="button"
              onClick={() => setExportMode("FILTERED")}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "11.5px",
                fontWeight: 600,
                border: "none",
                background: exportMode === "FILTERED" ? "#ffffff" : "transparent",
                color: exportMode === "FILTERED" ? "#0f172a" : "#64748b",
                boxShadow: exportMode === "FILTERED" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer"
              }}
            >
              Export Filtered ({filtered.length})
            </button>
            <button
              type="button"
              onClick={() => setExportMode("QUALIFIED")}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "11.5px",
                fontWeight: 600,
                border: "none",
                background: exportMode === "QUALIFIED" ? "#ffffff" : "transparent",
                color: exportMode === "QUALIFIED" ? "#017846" : "#64748b",
                boxShadow: exportMode === "QUALIFIED" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                cursor: "pointer"
              }}
            >
              Qualified Only ({filtered.filter(r => r.qualificationStatus === "QUALIFIED").length})
            </button>
          </div>

          <button
            type="button"
            onClick={downloadPdfReport}
            disabled={exportCandidates.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 600,
              background: exportCandidates.length === 0 ? "#94a3b8" : "#017846",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              cursor: exportCandidates.length === 0 ? "not-allowed" : "pointer",
              boxShadow: exportCandidates.length === 0 ? "none" : "0 2px 6px rgba(1, 120, 70, 0.25)",
              transition: "all 0.15s ease"
            }}
            title="Download printable / PDF report of candidates"
          >
            <Download size={14} /> Download PDF
          </button>

          <button
            type="button"
            onClick={downloadWordDoc}
            disabled={exportCandidates.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 13px",
              fontSize: "12px",
              fontWeight: 600,
              background: "#ffffff",
              color: exportCandidates.length === 0 ? "#94a3b8" : "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: exportCandidates.length === 0 ? "not-allowed" : "pointer",
              transition: "all 0.15s ease"
            }}
            title="Download Word Document (.doc) of candidates"
          >
            <FileText size={14} /> Download Docs
          </button>

          <button
            type="button"
            onClick={downloadCsvReport}
            disabled={exportCandidates.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 13px",
              fontSize: "12px",
              fontWeight: 600,
              background: "#ffffff",
              color: exportCandidates.length === 0 ? "#94a3b8" : "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: exportCandidates.length === 0 ? "not-allowed" : "pointer",
              transition: "all 0.15s ease"
            }}
            title="Download CSV spreadsheet of candidates"
          >
            <FileSpreadsheet size={14} /> Download CSV
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="admin-table-card">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Candidate & Slot</th>
                <th>Department</th>
                <th>Examination & Set</th>
                <th>Answered / Unanswered</th>
                <th>Score / Total Marks</th>
                <th>Qualification Status</th>
                <th>Date & Submission Time</th>
                <th style={{ textAlign: "center" }}>Actions</th>
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
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                      {results.length === 0 
                        ? `No examination attempts recorded for ${formatDateLabel(selectedDate, todayIst, yesterdayIst)}`
                        : "No examination attempts match your selected criteria"}
                    </p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      {results.length === 0 
                        ? "Select 'Today' to view today's active examinations or switch to 'All Dates Combined'."
                        : hasActiveFilters 
                          ? "Try clearing or adjusting your slot, search, or marks filters." 
                          : "Candidate exam submissions will appear here with automatic backend scoring and pass status."}
                    </small>
                    <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
                      {results.length === 0 && selectedDate !== todayIst && (
                        <button
                          type="button"
                          onClick={() => setSelectedDate(todayIst)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "6px",
                            background: "#017846",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer"
                          }}
                        >
                          View Today's Results ({formatDateShort(todayIst)})
                        </button>
                      )}
                      {results.length === 0 && selectedDate !== "ALL" && (
                        <button
                          type="button"
                          onClick={() => setSelectedDate("ALL")}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "6px",
                            background: "#0f172a",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer"
                          }}
                        >
                          View All Dates Combined
                        </button>
                      )}
                      {results.length > 0 && hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "6px",
                            background: "#017846",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 600,
                            border: "none",
                            cursor: "pointer"
                          }}
                        >
                          Reset All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(r => {
                  const candidateSlot = getCandidateSlot(r);
                  const attemptDate = r.examDate || getCandidateExamDate(r);
                  return (
                    <tr key={r.attemptId}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <b style={{ color: "#0f172a" }}>{r.candidateName}</b>
                          {/* Slot Badge */}
                          <span style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: candidateSlot === "Slot 1" ? "#e0f2fe" : "#f3e8ff",
                            color: candidateSlot === "Slot 1" ? "#0369a1" : "#7c3aed",
                            border: candidateSlot === "Slot 1" ? "1px solid #bae6fd" : "1px solid #e9d5ff",
                            whiteSpace: "nowrap"
                          }}>
                            {candidateSlot}
                          </span>
                        </div>
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
                        {r.percentage !== undefined && r.percentage !== null && (
                          <small style={{ display: "block", color: (r.percentage >= 60) ? "#16a34a" : "#64748b", fontWeight: 600 }}>
                            {r.percentage}%
                          </small>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${r.qualificationStatus?.toLowerCase() || "pending"}`}>
                          {r.qualificationStatus || "PENDING"}
                        </span>
                      </td>
                      <td>
                        {/* Exam Date Badge */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "3px" }}>
                          <span style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: "#f1f5f9",
                            color: "#334155",
                            border: "1px solid #e2e8f0"
                          }}>
                            📅 {formatDisplayDate(attemptDate)}
                          </span>
                        </div>
                        {/* Submission / Live Status */}
                        <small style={{ color: "#0f172a", fontWeight: 600, display: "block" }}>
                          {r.submittedAt ? (
                            `🕒 ${new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                          ) : (
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
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => setAttemptToReset(r)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 12px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            borderRadius: "6px",
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#b91c1c",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            transition: "all 0.15s ease"
                          }}
                          title="Reset candidate's attempt so they can re-enter and retake the exam"
                        >
                          <RotateCcw size={12} /> Reset Attempt
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Attempt Confirmation Modal */}
      {attemptToReset && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(3px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "14px",
            maxWidth: "460px",
            width: "100%",
            padding: "24px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
                <RotateCcw size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>Reset Candidate Attempt?</h3>
            </div>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              Are you sure you want to reset the examination attempt for <b>{attemptToReset.candidateName}</b> ({attemptToReset.registrationNumber})?
            </p>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 14px", marginBottom: "20px", fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
              This will clear their submitted status and recorded answers, unlocking their account so the candidate can immediately log back in and retake the exam.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setAttemptToReset(null)}
                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmReset}
                style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#dc2626", color: "#ffffff", fontSize: "12.5px", fontWeight: 600, cursor: isResetting ? "not-allowed" : "pointer" }}
              >
                {isResetting ? "Resetting..." : "Yes, Reset Attempt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
