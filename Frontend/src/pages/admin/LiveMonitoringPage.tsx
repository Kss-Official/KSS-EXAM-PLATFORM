import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Radio, 
  Clock, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  UserX, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  X, 
  AlertCircle,
  Eye,
  Filter,
  Flame,
  Check,
  ChevronRight,
  Maximize2,
  Calendar,
  Layers,
  ArrowRight,
  Download,
  FileText
} from "lucide-react";
import { 
  getLiveExaminees, 
  giveExtraTime, 
  stopCandidateExam, 
  getProctorAlerts, 
  reviewProctorAlert, 
  getCandidateAlertHistory,
  type LiveExamineeDto, 
  type ProctorAlertDto 
} from "../../services/api";

const getTodayIstString = (): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
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

const getTomorrowIstString = (todayStr: string): string => {
  try {
    const [y, m, d] = todayStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
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

const formatDateYear = (dStr: string): string => {
  if (!dStr || dStr === "ALL") return "";
  try {
    return dStr.slice(0, 4);
  } catch {
    return "";
  }
};

export default function LiveMonitoringPage() {
  const todayIst = useMemo(() => getTodayIstString(), []);
  const yesterdayIst = useMemo(() => getYesterdayIstString(todayIst), [todayIst]);
  const tomorrowIst = useMemo(() => getTomorrowIstString(todayIst), [todayIst]);

  const [activeTab, setActiveTab] = useState<"examinees" | "alerts">("examinees");
  const [examinees, setExaminees] = useState<LiveExamineeDto[]>([]);
  const [alerts, setAlerts] = useState<ProctorAlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState<string>("ALL");
  const [customDatePicker, setCustomDatePicker] = useState<string>("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Modal States
  const [stopModalTarget, setStopModalTarget] = useState<LiveExamineeDto | null>(null);
  const [stopReason, setStopReason] = useState("Proctor security termination: multiple suspicious alerts detected.");
  const [isStopping, setIsStopping] = useState(false);

  const [historyModalTarget, setHistoryModalTarget] = useState<{ candidateId: number; candidateName: string; regNo: string } | null>(null);
  const [candidateHistory, setCandidateHistory] = useState<ProctorAlertDto[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [extraTimeLoadingId, setExtraTimeLoadingId] = useState<number | null>(null);

  // Notification helper
  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch live examinees & alerts
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [examineesData, alertsData] = await Promise.all([
        getLiveExaminees({}),
        getProctorAlerts({ limit: 100 })
      ]);
      setExaminees(examineesData);
      setAlerts(alertsData);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.warn("[LiveMonitoring] Fetch notice:", err);
      if (!isSilent) {
        showNotification("error", err?.message || "Failed to refresh live examinee data.");
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reactive polling loop (every 1.8 seconds) for true real-time synchronization
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 1800);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // Give Extra Time (+10 Minutes)
  const handleGiveExtraTime = async (cand: LiveExamineeDto, extraMinutes: number = 10) => {
    setExtraTimeLoadingId(cand.candidateId);
    try {
      const res = await giveExtraTime(cand.candidateId, cand.attemptId, extraMinutes);
      showNotification("success", `Granted +${extraMinutes} minutes to ${cand.fullName} (${cand.registrationNumber}). Revised deadline applied.`);
      await fetchData(true);
    } catch (err: any) {
      showNotification("error", err?.message || `Failed to add extra time for ${cand.fullName}`);
    } finally {
      setExtraTimeLoadingId(null);
    }
  };

  // Stop / Discard Live Exam
  const handleConfirmStopExam = async () => {
    if (!stopModalTarget) return;
    setIsStopping(true);
    try {
      await stopCandidateExam(stopModalTarget.candidateId, stopModalTarget.attemptId, stopReason);
      showNotification("success", `Exam stopped and terminated for ${stopModalTarget.fullName}. Candidate session has been closed.`);
      setStopModalTarget(null);
      await fetchData(true);
    } catch (err: any) {
      showNotification("error", err?.message || "Failed to terminate candidate exam.");
    } finally {
      setIsStopping(false);
    }
  };

  // Open Alert History Modal
  const handleViewAlertHistory = async (candidateId: number, candidateName: string, regNo: string) => {
    setHistoryModalTarget({ candidateId, candidateName, regNo });
    setLoadingHistory(true);
    try {
      const history = await getCandidateAlertHistory(candidateId);
      setCandidateHistory(history);
    } catch (err) {
      console.warn("Could not load alert history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Review Alert
  const handleReviewAlert = async (alertId: number, status: "REVIEWED" | "DISMISSED" | "ACTION_TAKEN") => {
    try {
      await reviewProctorAlert(alertId, status);
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status } : a));
      if (candidateHistory.length > 0) {
        setCandidateHistory(prev => prev.map(a => a.id === alertId ? { ...a, status } : a));
      }
      showNotification("info", `Alert #${alertId} marked as ${status.toLowerCase()}.`);
    } catch (err: any) {
      showNotification("error", "Could not update alert status.");
    }
  };

  // Date Counts
  const dateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cand of examinees) {
      const d = cand.examDate || todayIst;
      counts[d] = (counts[d] || 0) + 1;
    }
    return counts;
  }, [examinees, todayIst]);

  // Filtered examinees
  const filteredExaminees = useMemo(() => {
    return examinees.filter(cand => {
      const candDate = cand.examDate || todayIst;
      const matchDate = selectedDate === "ALL" || candDate === selectedDate;

      const matchSearch = !search.trim() || 
        cand.fullName.toLowerCase().includes(search.toLowerCase()) ||
        cand.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
        cand.email.toLowerCase().includes(search.toLowerCase()) ||
        (cand.department && cand.department.toLowerCase().includes(search.toLowerCase()));

      const matchSlot = selectedSlot === "ALL" || 
        (cand.batch && cand.batch.toLowerCase().includes(selectedSlot.toLowerCase()));

      return matchDate && matchSearch && matchSlot;
    });
  }, [examinees, search, selectedSlot, selectedDate, todayIst]);

  // Metrics Calculation
  const activeExamineesCount = useMemo(() => {
    return filteredExaminees.filter(e => e.status === "IN_PROGRESS").length;
  }, [filteredExaminees]);

  const totalAlertsCount = useMemo(() => alerts.length, [alerts]);
  const newAlertsCount = useMemo(() => alerts.filter(a => a.status === "NEW").length, [alerts]);

  const extraTimeCount = useMemo(() => {
    return filteredExaminees.filter(e => e.extraTimeMinutes > 0).length;
  }, [filteredExaminees]);

  const stoppedCount = useMemo(() => {
    return filteredExaminees.filter(e => e.status === "DISCARDED" || e.status === "STOPPED").length;
  }, [filteredExaminees]);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter(al => {
      const matchSeverity = selectedSeverity === "ALL" || al.severity === selectedSeverity;
      const matchSearch = !search.trim() ||
        al.candidateName.toLowerCase().includes(search.toLowerCase()) ||
        al.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
        al.alertType.toLowerCase().includes(search.toLowerCase()) ||
        al.message.toLowerCase().includes(search.toLowerCase());
      return matchSeverity && matchSearch;
    });
  }, [alerts, selectedSeverity, search]);

  const formatIST = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const formatTimer = (seconds: number) => {
    if (seconds <= 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Download PDF Report for Cheating Alerts
  const downloadAlertsPdf = () => {
    const alertsToExport = filteredAlerts.length > 0 ? filteredAlerts : alerts;
    if (alertsToExport.length === 0) {
      showNotification("info", "No cheating alerts available to export.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const timeStr = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    const criticalCount = alertsToExport.filter(a => a.severity === "CRITICAL").length;
    const highCount = alertsToExport.filter(a => a.severity === "HIGH").length;
    const mediumCount = alertsToExport.filter(a => a.severity === "MEDIUM" || a.severity === "LOW").length;
    const uniqueCandidates = new Set(alertsToExport.map(a => a.candidateId)).size;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Proctor Security & Cheating Alerts Audit Report - Talentise Global</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 28px; color: #0f172a; margin: 0; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #dc2626; padding-bottom: 14px; margin-bottom: 18px; }
          .title { font-size: 20px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; }
          .subtitle { font-size: 12.5px; color: #64748b; margin: 0; }
          .badge-box { text-align: right; }
          .badge { background: #fee2e2; color: #dc2626; padding: 5px 12px; border-radius: 6px; font-weight: 700; font-size: 12.5px; border: 1px solid #fecaca; display: inline-block; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
          .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
          .stat-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; }
          .stat-value { font-size: 18px; font-weight: 800; color: #0f172a; }
          .stat-crit { color: #dc2626; }
          .stat-high { color: #d97706; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
          td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
          tr:nth-child(even) { background: #f8fafc; }
          .sev-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
          .sev-CRITICAL { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .sev-HIGH { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
          .sev-MEDIUM { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .sev-LOW { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
          .type-pill { background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block; }
          .status-pill { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
          .st-NEW { background: #fee2e2; color: #b91c1c; }
          .st-REVIEWED { background: #dcfce7; color: #166534; }
          .st-DISMISSED { background: #f1f5f9; color: #64748b; }
          .st-ACTION_TAKEN { background: #fae8ff; color: #86198f; }
          .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print {
            body { padding: 12px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Talentise Global &mdash; Proctor Security & Cheating Alerts Audit</h1>
            <p class="subtitle">Official Examination Integrity Ledger &bull; Date: <strong>${selectedDate === "ALL" ? "All Dates Combined" : selectedDate}</strong> &bull; Generated: ${dateStr} at ${timeStr}</p>
          </div>
          <div class="badge-box">
            <div class="badge">Total Incidents: ${alertsToExport.length}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Unique Flagged: ${uniqueCandidates}</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Logged Alerts</div>
            <div class="stat-value">${alertsToExport.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Critical Incidents</div>
            <div class="stat-value stat-crit">${criticalCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">High Severity Alerts</div>
            <div class="stat-value stat-high">${highCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Unique Candidates Flagged</div>
            <div class="stat-value">${uniqueCandidates}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 28px;">#</th>
              <th style="width: 80px;">Time (IST)</th>
              <th>Candidate Details</th>
              <th>Academic Track / Dept</th>
              <th>Violation Type</th>
              <th style="width: 75px;">Severity</th>
              <th>Proctor Incident Message</th>
              <th style="width: 75px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${alertsToExport.map((a, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td style="font-family: monospace; font-size: 11px;">${formatIST(a.createdAt)}</td>
                <td>
                  <strong>${a.candidateName}</strong>
                  <div style="font-family: monospace; font-size: 10.5px; color: #64748b;">${a.registrationNumber}</div>
                </td>
                <td>${a.department || "—"}</td>
                <td>
                  <span class="type-pill">${(a.alertType || "").replace(/_/g, " ")}</span>
                </td>
                <td>
                  <span class="sev-pill sev-${a.severity}">${a.severity}</span>
                </td>
                <td style="line-height: 1.35; color: #1e293b;">
                  ${a.message}
                </td>
                <td>
                  <span class="status-pill st-${a.status}">${a.status}</span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="footer">
          Talentise Global Assessment Platform &bull; Official Authenticated Proctor Security Ledger &bull; Strictly Confidential &bull; Document ID: SEB-SEC-${Date.now().toString(36).toUpperCase()}
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

  // Download PDF Report for Live Examinees
  const downloadExamineesPdf = () => {
    const examineesToExport = filteredExaminees.length > 0 ? filteredExaminees : examinees;
    if (examineesToExport.length === 0) {
      showNotification("info", "No live examinees available to export.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const timeStr = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    const writingCount = examineesToExport.filter(e => e.status === "IN_PROGRESS").length;
    const alertCountTotal = examineesToExport.reduce((acc, e) => acc + (e.alertsCount || 0), 0);
    const extraTimeGrantedCount = examineesToExport.filter(e => e.extraTimeMinutes > 0).length;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Live Examination Monitoring Ledger - Talentise Global</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 28px; color: #0f172a; margin: 0; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563EB; padding-bottom: 14px; margin-bottom: 18px; }
          .title { font-size: 20px; font-weight: 800; color: #2563EB; margin: 0 0 4px 0; }
          .subtitle { font-size: 12.5px; color: #64748b; margin: 0; }
          .badge-box { text-align: right; }
          .badge { background: #eff6ff; color: #2563EB; padding: 5px 12px; border-radius: 6px; font-weight: 700; font-size: 12.5px; border: 1px solid #bfdbfe; display: inline-block; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
          .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
          .stat-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; }
          .stat-value { font-size: 18px; font-weight: 800; color: #0f172a; }
          .stat-alert { color: #dc2626; }
          .stat-active { color: #166534; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
          td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
          tr:nth-child(even) { background: #f8fafc; }
          .st-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; }
          .st-IN_PROGRESS { background: #dcfce7; color: #166534; }
          .st-SUBMITTED { background: #e0f2fe; color: #0369a1; }
          .st-DISCARDED, .st-STOPPED { background: #fee2e2; color: #991b1b; }
          .st-COMPLETED { background: #f1f5f9; color: #475569; }
          .alert-pill { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px; }
          .slot-pill { background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
          .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print {
            body { padding: 12px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Talentise Global &mdash; Live Examination Monitoring Ledger</h1>
            <p class="subtitle">Real-Time Examination Attendee & Proctor Status &bull; Date: <strong>${selectedDate === "ALL" ? "All Dates Combined" : selectedDate}</strong> &bull; Generated: ${dateStr} at ${timeStr}</p>
          </div>
          <div class="badge-box">
            <div class="badge">Total Examinees: ${examineesToExport.length}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Scope: ${selectedSlot !== "ALL" ? selectedSlot : "All Slots Combined"}</div>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Examinees Listed</div>
            <div class="stat-value">${examineesToExport.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Active Writing Sessions</div>
            <div class="stat-value stat-active">${writingCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cheating Alerts Flagged</div>
            <div class="stat-value stat-alert">${alertCountTotal}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Extra Time Granted</div>
            <div class="stat-value">${extraTimeGrantedCount}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 28px;">#</th>
              <th>Candidate Name & Reg No</th>
              <th>Track / Department</th>
              <th>College</th>
              <th>Date & Slot</th>
              <th>Set</th>
              <th style="width: 85px;">Live Status</th>
              <th>Remaining Time</th>
              <th>Answered</th>
              <th style="width: 80px;">Cheating Flags</th>
            </tr>
          </thead>
          <tbody>
            ${examineesToExport.map((e, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <strong>${e.fullName}</strong>
                  <div style="font-family: monospace; font-size: 10.5px; color: #64748b;">${e.registrationNumber}</div>
                </td>
                <td>${e.department || "—"}</td>
                <td>${e.college || "—"}</td>
                <td>
                  <div>${e.examDate || selectedDate}</div>
                  <span class="slot-pill">${e.batch || "Slot 1"}</span>
                </td>
                <td style="font-weight: 700;">Set ${e.assignedSet || "A"}</td>
                <td>
                  <span class="st-pill st-${e.status}">${e.status}</span>
                </td>
                <td style="font-family: monospace; font-weight: 600;">
                  ${formatTimer(e.remainingSeconds)}
                  ${e.extraTimeMinutes > 0 ? `<div style="font-size: 10px; color: #0284c7;">+${e.extraTimeMinutes}m extra</div>` : ""}
                </td>
                <td>${e.questionsAnswered} / ${e.totalQuestions}</td>
                <td>
                  ${e.alertsCount > 0 
                    ? `<span class="alert-pill">${e.alertsCount} Alerts</span>` 
                    : `<span style="color: #16a34a; font-weight: 600; font-size: 11px;">✓ Clear</span>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="footer">
          Talentise Global Assessment Platform &bull; Live Examination Proctoring Record &bull; Strictly Confidential &bull; Document ID: SEB-LIVE-${Date.now().toString(36).toUpperCase()}
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

  // Download PDF Dossier for Individual Candidate Cheating Timeline
  const downloadCandidateTimelinePdf = (candName: string, regNo: string, history: ProctorAlertDto[]) => {
    if (history.length === 0) {
      showNotification("info", "No proctor alert history to export for this candidate.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const timeStr = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    const criticalCount = history.filter(a => a.severity === "CRITICAL").length;
    const highCount = history.filter(a => a.severity === "HIGH").length;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Candidate Proctoring Violation Dossier - ${candName}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 28px; color: #0f172a; margin: 0; background: #ffffff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #dc2626; padding-bottom: 14px; margin-bottom: 18px; }
          .title { font-size: 20px; font-weight: 800; color: #dc2626; margin: 0 0 4px 0; }
          .subtitle { font-size: 12.5px; color: #64748b; margin: 0; }
          .cand-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11.5px; }
          th { background: #f1f5f9; color: #334155; text-align: left; padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
          td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
          tr:nth-child(even) { background: #f8fafc; }
          .sev-pill { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
          .sev-CRITICAL { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .sev-HIGH { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
          .sev-MEDIUM { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .type-pill { background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
          .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          @media print {
            body { padding: 12px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Talentise Global &mdash; Candidate Proctoring Violation Dossier</h1>
            <p class="subtitle">Individual Disciplinary Evidence Timeline &bull; Generated: ${dateStr} at ${timeStr}</p>
          </div>
          <div style="text-align: right;">
            <div style="background: #fee2e2; color: #dc2626; padding: 5px 12px; border-radius: 6px; font-weight: 700; font-size: 12px; border: 1px solid #fecaca; display: inline-block;">
              ${history.length} Total Incidents Logged
            </div>
          </div>
        </div>

        <div class="cand-box">
          <div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${candName}</div>
            <div style="font-family: monospace; font-size: 12px; color: #64748b; margin-top: 2px;">Registration: ${regNo}</div>
          </div>
          <div style="text-align: right; font-size: 12px;">
            <div>Critical Alerts: <strong style="color: #dc2626;">${criticalCount}</strong></div>
            <div>High Alerts: <strong style="color: #d97706;">${highCount}</strong></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 28px;">#</th>
              <th style="width: 80px;">Time (IST)</th>
              <th>Violation Type</th>
              <th style="width: 75px;">Severity</th>
              <th>Incident Message / Evidence Log</th>
              <th style="width: 80px;">Review Status</th>
            </tr>
          </thead>
          <tbody>
            ${history.map((a, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td style="font-family: monospace; font-size: 11px;">${formatIST(a.createdAt)}</td>
                <td><span class="type-pill">${(a.alertType || "").replace(/_/g, " ")}</span></td>
                <td><span class="sev-pill sev-${a.severity}">${a.severity}</span></td>
                <td style="line-height: 1.4; color: #1e293b;">${a.message}</td>
                <td style="font-weight: 600;">${a.status}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="footer">
          Talentise Global Assessment Platform &bull; Candidate Evidence Dossier &bull; Official Disciplinary Record
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

  // Download CSV for Cheating Alerts
  const downloadAlertsCsv = () => {
    const alertsToExport = filteredAlerts.length > 0 ? filteredAlerts : alerts;
    if (alertsToExport.length === 0) return;
    const headers = [
      "Alert ID",
      "Timestamp (IST)",
      "Candidate Name",
      "Registration Number",
      "Department",
      "Alert Type",
      "Severity",
      "Violation Message",
      "Status",
      "Reviewed By"
    ];
    const rows = alertsToExport.map(a => [
      a.id,
      `"${formatIST(a.createdAt)}"`,
      `"${(a.candidateName || "").replace(/"/g, '""')}"`,
      `"${a.registrationNumber || ""}"`,
      `"${(a.department || "").replace(/"/g, '""')}"`,
      `"${(a.alertType || "").replace(/_/g, " ")}"`,
      `"${a.severity || ""}"`,
      `"${(a.message || "").replace(/"/g, '""')}"`,
      `"${a.status || ""}"`,
      `"${(a.reviewedBy || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Cheating_Alerts_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download CSV for Live Examinees
  const downloadExamineesCsv = () => {
    const examineesToExport = filteredExaminees.length > 0 ? filteredExaminees : examinees;
    if (examineesToExport.length === 0) return;
    const headers = [
      "Candidate ID",
      "Candidate Name",
      "Registration Number",
      "Email",
      "College",
      "Department",
      "Slot / Batch",
      "Exam Title",
      "Set",
      "Live Status",
      "Questions Answered",
      "Total Questions",
      "Remaining Time (Mins)",
      "Extra Time (Mins)",
      "Cheating Alerts Count"
    ];
    const rows = examineesToExport.map(e => [
      e.candidateId,
      `"${(e.fullName || "").replace(/"/g, '""')}"`,
      `"${e.registrationNumber || ""}"`,
      `"${e.email || ""}"`,
      `"${(e.college || "").replace(/"/g, '""')}"`,
      `"${(e.department || "").replace(/"/g, '""')}"`,
      `"${(e.batch || "").replace(/"/g, '""')}"`,
      `"${(e.examTitle || "").replace(/"/g, '""')}"`,
      `"${e.assignedSet || ""}"`,
      `"${e.status || ""}"`,
      e.questionsAnswered,
      e.totalQuestions,
      Math.round(e.remainingSeconds / 60),
      e.extraTimeMinutes,
      e.alertsCount
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Live_Examinees_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "24px",
          zIndex: 99999,
          background: notification.type === "success" ? "#065f46" : notification.type === "error" ? "#991b1b" : "#1e40af",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "8px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13.5px",
          fontWeight: 600,
          animation: "slideIn 0.3s ease"
        }}>
          {notification.type === "success" && <CheckCircle2 size={18} />}
          {notification.type === "error" && <AlertTriangle size={18} />}
          {notification.type === "info" && <AlertCircle size={18} />}
          <span>{notification.message}</span>
          <button 
            type="button" 
            onClick={() => setNotification(null)}
            style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", marginLeft: "6px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        background: "#ffffff",
        borderRadius: "14px",
        padding: "24px 28px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        border: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <span style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              justifyContent: "center", 
              width: "36px", 
              height: "36px", 
              borderRadius: "10px", 
              background: "#ecfdf5", 
              color: "#2563EB" 
            }}>
              <Radio size={20} className={autoRefresh ? "animate-pulse" : ""} />
            </span>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Live Exam Monitoring & Proctoring
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            Real-time candidate monitoring, +10 minute time extensions, proctor security alerts, and live exam termination.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Real-time sync badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "6px 12px",
            borderRadius: "20px",
            background: autoRefresh ? "#f0fdf4" : "#f1f5f9",
            border: autoRefresh ? "1px solid #bbf7d0" : "1px solid #cbd5e1",
            color: autoRefresh ? "#166534" : "#64748b",
            fontSize: "12px",
            fontWeight: 700
          }}>
            <span style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: autoRefresh ? "#22c55e" : "#94a3b8"
            }} />
            {autoRefresh ? "Live Sync Active" : "Paused"}
          </div>

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            {autoRefresh ? "Pause Sync" : "Resume Sync"}
          </button>

          <button
            type="button"
            onClick={() => fetchData()}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              border: "1px solid #2563EB",
              background: "#2563EB",
              color: "#ffffff",
              fontSize: "12.5px",
              fontWeight: 700,
              cursor: refreshing ? "not-allowed" : "pointer"
            }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* 4 Overview Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        {/* Metric 1: Live Examinees Writing */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "20px 24px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Active Examinees (Writing)
            </span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "#ecfdf5", color: "#2563EB" }}>
              <Radio size={18} />
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>
            {activeExamineesCount}
          </div>
          <span style={{ fontSize: "12px", color: "#2563EB", fontWeight: 600 }}>
            Live in examination session
          </span>
        </div>

        {/* Metric 2: Cheating Alerts Today */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "20px 24px",
          border: newAlertsCount > 0 ? "1px solid #fecaca" : "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Cheating Alerts Logged
            </span>
            <span style={{ padding: "6px", borderRadius: "8px", background: newAlertsCount > 0 ? "#fee2e2" : "#fef3c7", color: newAlertsCount > 0 ? "#dc2626" : "#b45309" }}>
              <ShieldAlert size={18} />
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "28px", fontWeight: 800, color: newAlertsCount > 0 ? "#dc2626" : "#0f172a" }}>
              {totalAlertsCount}
            </span>
            {newAlertsCount > 0 && (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: "12px" }}>
                {newAlertsCount} unreviewed
              </span>
            )}
          </div>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Tab switch, SEB & proctor flags
          </span>
        </div>

        {/* Metric 3: Extra Time Granted */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "20px 24px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Extra Time Extensions
            </span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "#eff6ff", color: "#2563eb" }}>
              <Clock size={18} />
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>
            {extraTimeCount}
          </div>
          <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
            Candidates granted extra time
          </span>
        </div>

        {/* Metric 4: Stopped / Terminated */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "20px 24px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Sessions Discarded / Stopped
            </span>
            <span style={{ padding: "6px", borderRadius: "8px", background: "#fef2f2", color: "#b91c1c" }}>
              <UserX size={18} />
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>
            {stoppedCount}
          </div>
          <span style={{ fontSize: "12px", color: "#b91c1c", fontWeight: 600 }}>
            Terminated by administrator
          </span>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginRight: "4px" }}>
            <Calendar size={16} color="#2563EB" />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Exam Date:
            </span>
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={() => { setSelectedDate(todayIst); setCustomDatePicker(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: selectedDate === todayIst ? "2px solid #2563EB" : "1px solid #cbd5e1",
              backgroundColor: selectedDate === todayIst ? "#2563EB" : "#f8fafc",
              color: selectedDate === todayIst ? "#ffffff" : "#334155",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>Today ({formatDateShort(todayIst)} {formatDateYear(todayIst)})</span>
            <span style={{
              background: selectedDate === todayIst ? "rgba(255,255,255,0.25)" : "#e2e8f0",
              color: selectedDate === todayIst ? "#fff" : "#475569",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {dateCounts[todayIst] || 0}
            </span>
          </button>

          {/* Yesterday Button */}
          <button
            type="button"
            onClick={() => { setSelectedDate(yesterdayIst); setCustomDatePicker(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: selectedDate === yesterdayIst ? "2px solid #0284c7" : "1px solid #cbd5e1",
              backgroundColor: selectedDate === yesterdayIst ? "#0284c7" : "#f8fafc",
              color: selectedDate === yesterdayIst ? "#ffffff" : "#334155",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>Yesterday ({formatDateShort(yesterdayIst)} {formatDateYear(yesterdayIst)})</span>
            <span style={{
              background: selectedDate === yesterdayIst ? "rgba(255,255,255,0.25)" : "#e0f2fe",
              color: selectedDate === yesterdayIst ? "#fff" : "#0369a1",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {dateCounts[yesterdayIst] || 0}
            </span>
          </button>

          {/* Tomorrow Button */}
          <button
            type="button"
            onClick={() => { setSelectedDate(tomorrowIst); setCustomDatePicker(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: selectedDate === tomorrowIst ? "2px solid #2563EB" : "1px solid #cbd5e1",
              backgroundColor: selectedDate === tomorrowIst ? "#2563EB" : "#f8fafc",
              color: selectedDate === tomorrowIst ? "#ffffff" : "#334155",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>Tomorrow ({formatDateShort(tomorrowIst)} {formatDateYear(tomorrowIst)})</span>
            <span style={{
              background: selectedDate === tomorrowIst ? "rgba(255,255,255,0.25)" : "#e2e8f0",
              color: selectedDate === tomorrowIst ? "#fff" : "#475569",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {dateCounts[tomorrowIst] || 0}
            </span>
          </button>

          {/* All Dates Combined Button */}
          <button
            type="button"
            onClick={() => { setSelectedDate("ALL"); setCustomDatePicker(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: selectedDate === "ALL" ? "2px solid #0f172a" : "1px solid #cbd5e1",
              backgroundColor: selectedDate === "ALL" ? "#0f172a" : "#f8fafc",
              color: selectedDate === "ALL" ? "#ffffff" : "#334155",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>All Dates Combined</span>
            <span style={{
              background: selectedDate === "ALL" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
              color: selectedDate === "ALL" ? "#fff" : "#475569",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {examinees.length}
            </span>
          </button>

          {/* Pick Date */}
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <input
              type="date"
              value={customDatePicker}
              onChange={(e) => {
                const val = e.target.value;
                setCustomDatePicker(val);
                if (val) {
                  setSelectedDate(val);
                }
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: selectedDate !== todayIst && selectedDate !== yesterdayIst && selectedDate !== tomorrowIst && selectedDate !== "ALL"
                  ? "2px solid #2563EB"
                  : "1px solid #cbd5e1",
                backgroundColor: selectedDate !== todayIst && selectedDate !== yesterdayIst && selectedDate !== tomorrowIst && selectedDate !== "ALL"
                  ? "#ecfdf5"
                  : "#ffffff",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer"
              }}
              title="Pick a specific examination date"
            />
          </div>
        </div>

        {/* Right Active Date Badge Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Active Date:</span>
          <span style={{
            fontSize: "12px",
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: "6px",
            background: selectedDate === todayIst ? "#ecfdf5" : (selectedDate === "ALL" ? "#f1f5f9" : "#eff6ff"),
            color: selectedDate === todayIst ? "#2563EB" : (selectedDate === "ALL" ? "#0f172a" : "#1d4ed8"),
            border: selectedDate === todayIst ? "1px solid #a7f3d0" : (selectedDate === "ALL" ? "1px solid #cbd5e1" : "1px solid #bfdbfe"),
            display: "inline-flex",
            alignItems: "center",
            gap: "5px"
          }}>
            <Calendar size={13} />
            {selectedDate === todayIst 
              ? `Today (${formatDateShort(todayIst)} ${formatDateYear(todayIst)})` 
              : selectedDate === yesterdayIst 
              ? `Yesterday (${formatDateShort(yesterdayIst)})` 
              : selectedDate === tomorrowIst 
              ? `Tomorrow (${formatDateShort(tomorrowIst)})` 
              : selectedDate === "ALL" 
              ? "All Dates Combined" 
              : formatDateShort(selectedDate) + " " + formatDateYear(selectedDate)}
          </span>
        </div>
      </div>

      {/* Tabs and Filters Bar */}
      <div style={{
        background: "#ffffff",
        borderRadius: "12px",
        padding: "16px 20px",
        border: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "14px"
      }}>
        {/* Left Tabs */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setActiveTab("examinees")}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: activeTab === "examinees" ? "1px solid #2563EB" : "1px solid #cbd5e1",
              background: activeTab === "examinees" ? "#2563EB" : "#ffffff",
              color: activeTab === "examinees" ? "#ffffff" : "#475569",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Radio size={15} />
            Live Examinees ({filteredExaminees.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: activeTab === "alerts" ? "1px solid #dc2626" : "1px solid #cbd5e1",
              background: activeTab === "alerts" ? "#dc2626" : "#ffffff",
              color: activeTab === "alerts" ? "#ffffff" : "#475569",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <ShieldAlert size={15} />
            Cheating Alerts Feed ({alerts.length})
            {newAlertsCount > 0 && (
              <span style={{
                background: activeTab === "alerts" ? "#ffffff" : "#fee2e2",
                color: activeTab === "alerts" ? "#dc2626" : "#dc2626",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 800
              }}>
                {newAlertsCount}
              </span>
            )}
          </button>
        </div>

        {/* Right Search & Slot Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", minWidth: "240px" }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search candidate name, reg no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 12px 7px 32px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "12.5px",
                outline: "none"
              }}
            />
          </div>

          {activeTab === "examinees" ? (
            <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
              {["ALL", "Slot 1", "Slot 2", "Slot 3"].map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedSlot === slot ? "#ffffff" : "transparent",
                    color: selectedSlot === slot ? "#0f172a" : "#64748b",
                    fontSize: "12px",
                    fontWeight: selectedSlot === slot ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: selectedSlot === slot ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
                  }}
                >
                  {slot}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
              {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map(sev => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSelectedSeverity(sev)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: selectedSeverity === sev ? "#ffffff" : "transparent",
                    color: selectedSeverity === sev ? "#0f172a" : "#64748b",
                    fontSize: "12px",
                    fontWeight: selectedSeverity === sev ? 700 : 500,
                    cursor: "pointer",
                    boxShadow: selectedSeverity === sev ? "0 1px 2px rgba(0,0,0,0.06)" : "none"
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>
          )}

          {/* Primary Quick Download PDF Button */}
          <button
            type="button"
            onClick={activeTab === "alerts" ? downloadAlertsPdf : downloadExamineesPdf}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              background: "#2563EB",
              color: "#ffffff",
              border: "none",
              fontSize: "12.5px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              transition: "background 0.15s ease",
              whiteSpace: "nowrap"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1d4ed8"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#2563EB"; }}
            title={activeTab === "alerts" ? "Download Cheating Alerts PDF Report" : "Download Live Examinees PDF Report"}
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* Proctoring & Cheating Alerts Export Action Bar */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "12px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#334155" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            background: "#eff6ff",
            color: "#2563EB"
          }}>
            <FileText size={15} />
          </span>
          <span>
            <strong>Proctoring Reports & Export:</strong>{" "}
            {selectedDate === "ALL" ? "All Dates Combined" : `Date: ${selectedDate}`}
            {selectedSlot !== "ALL" && ` • ${selectedSlot}`}
            {" • "}
            {alerts.length} Total Alerts Logged ({filteredAlerts.length} filtered)
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {/* Download Cheating Alerts PDF */}
          <button
            type="button"
            onClick={downloadAlertsPdf}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              fontSize: "12.5px",
              fontWeight: 600,
              background: "#dc2626",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(220, 38, 38, 0.2)"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#b91c1c"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#dc2626"; }}
            title="Download printable / PDF report of Cheating Alerts"
          >
            <ShieldAlert size={14} /> Download Cheating Alerts PDF
          </button>

          {/* Download Live Examinees PDF */}
          <button
            type="button"
            onClick={downloadExamineesPdf}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              fontSize: "12.5px",
              fontWeight: 600,
              background: "#2563EB",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(37, 99, 235, 0.2)"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1d4ed8"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#2563EB"; }}
            title="Download printable / PDF report of Live Examinees"
          >
            <Radio size={14} /> Download Examinees PDF
          </button>

          {/* Download CSV */}
          <button
            type="button"
            onClick={activeTab === "alerts" ? downloadAlertsCsv : downloadExamineesCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 13px",
              fontSize: "12.5px",
              fontWeight: 600,
              background: "#ffffff",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
            title={`Download CSV Spreadsheet of ${activeTab === "alerts" ? "Cheating Alerts" : "Examinees"}`}
          >
            <Download size={14} /> Download CSV
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "examinees" ? (
        /* TAB 1: Live Examinees Table */
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          overflow: "hidden"
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontWeight: 700, fontSize: "12px" }}>
                  <th style={{ padding: "14px 18px" }}>CANDIDATE & REG NO.</th>
                  <th style={{ padding: "14px 18px" }}>TRACK / DEPARTMENT</th>
                  <th style={{ padding: "14px 18px" }}>EXAM DATE, SLOT & SET</th>
                  <th style={{ padding: "14px 18px" }}>LIVE STATUS</th>
                  <th style={{ padding: "14px 18px" }}>REMAINING TIME</th>
                  <th style={{ padding: "14px 18px" }}>CHEATING ALERTS</th>
                  <th style={{ padding: "14px 18px", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
                      Loading live candidate sessions...
                    </td>
                  </tr>
                ) : filteredExaminees.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                      No examinees found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredExaminees.map(cand => {
                    const isWriting = cand.status === "IN_PROGRESS";
                    const isStopped = cand.status === "DISCARDED" || cand.status === "STOPPED";
                    const isSubmitted = cand.status === "SUBMITTED";

                    return (
                      <tr 
                        key={cand.candidateId} 
                        style={{ 
                          borderBottom: "1px solid #f1f5f9",
                          background: isStopped ? "#fff1f2" : "#ffffff",
                          transition: "background 0.15s ease"
                        }}
                      >
                        {/* Candidate Name & Reg */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>
                            {cand.fullName}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {cand.registrationNumber} • {cand.email}
                          </div>
                        </td>

                        {/* Track / Department */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 600, color: "#334155" }}>
                            {cand.department || "General"}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                            {cand.college || "-"}
                          </div>
                        </td>

                        {/* Exam Date, Slot & Set */}
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: (cand.examDate || todayIst) === todayIst ? "#ecfdf5" : "#f1f5f9",
                              color: (cand.examDate || todayIst) === todayIst ? "#2563EB" : "#475569",
                              border: (cand.examDate || todayIst) === todayIst ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                              fontWeight: 700,
                              fontSize: "11px"
                            }}>
                              <Calendar size={11} />
                              {cand.examDate ? ((cand.examDate === todayIst) ? `Today (${formatDateShort(cand.examDate)})` : formatDateShort(cand.examDate)) : `Today (${formatDateShort(todayIst)})`}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: "#f1f5f9",
                              color: "#334155",
                              fontWeight: 600,
                              fontSize: "11.5px"
                            }}>
                              {cand.batch}
                            </span>
                            <span style={{
                              display: "inline-block",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: "#e0e7ff",
                              color: "#3730a3",
                              fontWeight: 700,
                              fontSize: "11.5px"
                            }}>
                              {cand.assignedSet}
                            </span>
                          </div>
                        </td>

                        {/* Live Status */}
                        <td style={{ padding: "14px 18px" }}>
                          {isWriting && (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              background: "#ecfdf5",
                              color: "#2563EB",
                              fontWeight: 700,
                              fontSize: "12px"
                            }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563EB" }} />
                              Writing
                            </span>
                          )}
                          {isStopped && (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              background: "#fee2e2",
                              color: "#dc2626",
                              fontWeight: 700,
                              fontSize: "12px"
                            }}>
                              <UserX size={12} />
                              Stopped
                            </span>
                          )}
                          {isSubmitted && (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              background: "#f1f5f9",
                              color: "#475569",
                              fontWeight: 600,
                              fontSize: "12px"
                            }}>
                              <CheckCircle2 size={12} color="#059669" />
                              Submitted
                            </span>
                          )}
                          {!isWriting && !isStopped && !isSubmitted && (
                            <span style={{
                              padding: "4px 10px",
                              borderRadius: "12px",
                              background: "#fef3c7",
                              color: "#b45309",
                              fontWeight: 600,
                              fontSize: "12px"
                            }}>
                              {cand.status}
                            </span>
                          )}
                        </td>

                        {/* Remaining Time & Extra Time */}
                        <td style={{ padding: "14px 18px" }}>
                          {isWriting ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Clock size={14} color="#2563EB" />
                              <strong style={{ fontSize: "14px", color: cand.remainingSeconds < 300 ? "#dc2626" : "#0f172a" }}>
                                {formatTimer(cand.remainingSeconds)}
                              </strong>
                              {cand.extraTimeMinutes > 0 && (
                                <span style={{
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#eff6ff",
                                  color: "#2563eb",
                                  fontSize: "11px",
                                  fontWeight: 800
                                }}>
                                  +{cand.extraTimeMinutes}m
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "12px" }}>-</span>
                          )}
                        </td>

                        {/* Cheating Alerts */}
                        <td style={{ padding: "14px 18px" }}>
                          {cand.alertsCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleViewAlertHistory(cand.candidateId, cand.fullName, cand.registrationNumber)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                borderRadius: "8px",
                                border: "1px solid #fecaca",
                                background: "#fee2e2",
                                color: "#dc2626",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer"
                              }}
                            >
                              <ShieldAlert size={14} />
                              {cand.alertsCount} Alert{cand.alertsCount === 1 ? "" : "s"}
                            </button>
                          ) : (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              color: "#059669",
                              fontWeight: 600
                            }}>
                              <ShieldCheck size={14} /> Clear
                            </span>
                          )}
                        </td>

                        {/* Actions: +10 Mins and Stop Exam */}
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            {/* +10 Mins Button */}
                            <button
                              type="button"
                              onClick={() => handleGiveExtraTime(cand, 10)}
                              disabled={extraTimeLoadingId === cand.candidateId || isStopped || isSubmitted}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: isSubmitted || isStopped ? "1px solid #e2e8f0" : "1px solid #bfdbfe",
                                background: isSubmitted || isStopped ? "#f8fafc" : "#eff6ff",
                                color: isSubmitted || isStopped ? "#94a3b8" : "#1d4ed8",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: (extraTimeLoadingId === cand.candidateId || isStopped || isSubmitted) ? "not-allowed" : "pointer",
                                opacity: isSubmitted || isStopped ? 0.5 : 1
                              }}
                              title={isSubmitted ? "Candidate has already submitted the examination" : isStopped ? "Exam session is terminated" : "Grant +10 minutes additional time to this candidate"}
                            >
                              <Clock size={13} />
                              {extraTimeLoadingId === cand.candidateId ? "Adding..." : "+10 Mins"}
                            </button>

                            {/* Stop / Discard Exam Button */}
                            <button
                              type="button"
                              onClick={() => setStopModalTarget(cand)}
                              disabled={isStopped || isSubmitted}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: isSubmitted || isStopped ? "1px solid #e2e8f0" : "1px solid #fecaca",
                                background: isSubmitted || isStopped ? "#f8fafc" : "#fee2e2",
                                color: isSubmitted || isStopped ? "#94a3b8" : "#dc2626",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: isStopped || isSubmitted ? "not-allowed" : "pointer",
                                opacity: isSubmitted || isStopped ? 0.5 : 1
                              }}
                              title={isSubmitted ? "Candidate has already submitted the examination" : isStopped ? "Exam session is already stopped" : "Stop candidate's live examination"}
                            >
                              <UserX size={13} />
                              Stop Exam
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 2: Real-Time Cheating Alerts Feed */
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          padding: "20px"
        }}>
          {filteredAlerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: "#64748b" }}>
              <ShieldCheck size={36} color="#2563EB" style={{ margin: "0 auto 12px" }} />
              <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#0f172a" }}>No Suspicious Activity Detected</h3>
              <p style={{ margin: 0, fontSize: "13px" }}>All candidate sessions are currently verified and clear of security alerts.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredAlerts.map(al => {
                const isCritical = al.severity === "CRITICAL";
                const isHigh = al.severity === "HIGH";

                return (
                  <div
                    key={al.id}
                    style={{
                      padding: "16px 20px",
                      borderRadius: "10px",
                      border: isCritical ? "1px solid #fca5a5" : isHigh ? "1px solid #fed7aa" : "1px solid #e2e8f0",
                      background: isCritical ? "#fff1f2" : isHigh ? "#fffbeb" : "#f8fafc",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "14px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <span style={{
                        padding: "8px",
                        borderRadius: "8px",
                        background: isCritical ? "#fee2e2" : isHigh ? "#ffedd5" : "#e2e8f0",
                        color: isCritical ? "#dc2626" : isHigh ? "#c2410c" : "#475569"
                      }}>
                        <ShieldAlert size={20} />
                      </span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                          <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                            {al.candidateName}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            ({al.registrationNumber}) • {al.department}
                          </span>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 800,
                            background: isCritical ? "#fee2e2" : isHigh ? "#ffedd5" : "#e0e7ff",
                            color: isCritical ? "#b91c1c" : isHigh ? "#c2410c" : "#3730a3"
                          }}>
                            {al.alertType.replace("_", " ")}
                          </span>
                        </div>
                        <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#334155", fontWeight: 500 }}>
                          {al.message}
                        </p>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          Logged at {formatIST(al.createdAt)} • Status: <strong>{al.status}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {al.status === "NEW" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReviewAlert(al.id, "REVIEWED")}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              border: "1px solid #bbf7d0",
                              background: "#ecfdf5",
                              color: "#2563EB",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: "pointer"
                            }}
                          >
                            Mark Reviewed
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewAlert(al.id, "DISMISSED")}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#64748b",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer"
                            }}
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleViewAlertHistory(al.candidateId, al.candidateName, al.registrationNumber)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#334155",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Candidate Timeline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Stop / Discard Exam Confirmation Modal */}
      {stopModalTarget && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget && !isStopping) setStopModalTarget(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            maxWidth: "560px",
            width: "100%",
            boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "16px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "#fef2f2",
                  border: "1px solid #fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#dc2626",
                  flexShrink: 0
                }}>
                  <UserX size={22} />
                </div>
                <div>
                  <h3 style={{
                    margin: 0,
                    fontSize: "17px",
                    fontWeight: 700,
                    color: "#0f172a",
                    letterSpacing: "-0.01em"
                  }}>
                    Stop & Discard Candidate Exam
                  </h3>
                  <p style={{
                    margin: "3px 0 0 0",
                    fontSize: "13px",
                    color: "#64748b",
                    lineHeight: 1.4
                  }}>
                    Immediately terminates the active session and logs a proctor security event.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStopModalTarget(null)}
                disabled={isStopping}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: isStopping ? "not-allowed" : "pointer",
                  padding: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "22px 24px" }}>
              {/* Candidate Info Summary Grid */}
              <div style={{
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                padding: "14px 16px",
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "16px",
                alignItems: "center",
                marginBottom: "20px"
              }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em", marginBottom: "3px" }}>
                    Candidate Name
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                    {stopModalTarget.fullName}
                  </div>
                </div>

                <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em", marginBottom: "3px" }}>
                    Roll / Reg No
                  </div>
                  <code style={{
                    fontSize: "12px",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    background: "#e2e8f0",
                    color: "#1e293b",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontWeight: 600
                  }}>
                    {stopModalTarget.registrationNumber}
                  </code>
                </div>

                <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: "16px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em", marginBottom: "3px" }}>
                    Department
                  </div>
                  <span style={{
                    display: "inline-block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#2563EB",
                    background: "#ecfdf5",
                    border: "1px solid #d1fae5",
                    padding: "2px 10px",
                    borderRadius: "9999px"
                  }}>
                    {stopModalTarget.department}
                  </span>
                </div>
              </div>

              {/* Termination Reason Input */}
              <div style={{ marginBottom: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                    Termination Reason <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                    Shown directly on candidate screen
                  </span>
                </div>
                <textarea
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  rows={3}
                  placeholder="Enter specific reason for terminating candidate examination..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    color: "#0f172a",
                    lineHeight: 1.5,
                    outline: "none",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    resize: "vertical"
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#dc2626";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(220, 38, 38, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />

                {/* Quick-select Infraction Presets */}
                <div style={{ marginTop: "10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.03em", marginBottom: "6px" }}>
                    Quick Infraction Presets
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      "Repeated tab switches detected",
                      "Exited Safe Exam Browser lockdown",
                      "Suspicious multiple faces in camera feed",
                      "Admin technical reset requested"
                    ].map(preset => {
                      const isSelected = stopReason === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setStopReason(preset)}
                          style={{
                            fontSize: "11.5px",
                            fontWeight: isSelected ? 600 : 500,
                            background: isSelected ? "#fef2f2" : "#f8fafc",
                            border: isSelected ? "1px solid #fca5a5" : "1px solid #e2e8f0",
                            color: isSelected ? "#991b1b" : "#475569",
                            borderRadius: "8px",
                            padding: "5px 10px",
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#f1f5f9";
                              e.currentTarget.style.borderColor = "#cbd5e1";
                              e.currentTarget.style.color = "#0f172a";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = "#f8fafc";
                              e.currentTarget.style.borderColor = "#e2e8f0";
                              e.currentTarget.style.color = "#475569";
                            }
                          }}
                        >
                          {isSelected ? "✓ " : ""}{preset}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Warning Notice Banner */}
              <div style={{
                background: "#fffbeb",
                border: "1px solid #fef3c7",
                borderRadius: "10px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}>
                <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: "12px", color: "#92400e", lineHeight: 1.4 }}>
                  <strong>Irreversible action:</strong> The active exam will be marked void. Re-entry requires an explicit admin unlock.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              background: "#f8fafc",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "12px"
            }}>
              <button
                type="button"
                onClick={() => setStopModalTarget(null)}
                disabled={isStopping}
                style={{
                  padding: "9px 18px",
                  borderRadius: "9px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isStopping ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.color = "#475569"; }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStopExam}
                disabled={isStopping || !stopReason.trim()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "9px 20px",
                  borderRadius: "9px",
                  border: "1px solid #b91c1c",
                  background: isStopping || !stopReason.trim() ? "#fca5a5" : "linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  boxShadow: isStopping || !stopReason.trim() ? "none" : "0 2px 4px rgba(220, 38, 38, 0.25)",
                  cursor: isStopping || !stopReason.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {isStopping ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Terminating Session...</span>
                  </>
                ) : (
                  <>
                    <UserX size={15} />
                    <span>Yes, Stop & Terminate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Candidate Alert History Timeline */}
      {historyModalTarget && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryModalTarget(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            maxWidth: "620px",
            width: "100%",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)",
            overflow: "hidden"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#d97706"
                }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>
                    Cheating Alert Timeline
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                      {historyModalTarget.candidateName}
                    </span>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>•</span>
                    <code style={{
                      fontSize: "11.5px",
                      background: "#f1f5f9",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      color: "#475569"
                    }}>
                      {historyModalTarget.regNo}
                    </code>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => downloadCandidateTimelinePdf(historyModalTarget.candidateName, historyModalTarget.regNo, candidateHistory)}
                  disabled={candidateHistory.length === 0}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "7px",
                    background: candidateHistory.length === 0 ? "#94a3b8" : "#2563EB",
                    color: "#ffffff",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: candidateHistory.length === 0 ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                  }}
                  title="Download candidate proctoring audit dossier as PDF"
                >
                  <Download size={13} /> Download Dossier PDF
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryModalTarget(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "6px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Timeline list */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px", color: "#2563EB" }} />
                  <div style={{ fontSize: "13.5px", fontWeight: 500 }}>Fetching proctor alert history...</div>
                </div>
              ) : candidateHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "#ecfdf5",
                    border: "1px solid #d1fae5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 12px",
                    color: "#2563EB"
                  }}>
                    <ShieldCheck size={26} />
                  </div>
                  <h4 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                    Clean Proctor Record
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                    No security or proctoring alerts have been logged for this candidate.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {candidateHistory.map((h, idx) => {
                    const isCritical = h.severity === "CRITICAL";
                    const isWarning = h.severity === "HIGH" || h.severity === "MEDIUM";
                    return (
                      <div
                        key={h.id || idx}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "10px",
                          border: isCritical ? "1px solid #fecaca" : isWarning ? "1px solid #fed7aa" : "1px solid #e2e8f0",
                          background: isCritical ? "#fff1f2" : isWarning ? "#fffbeb" : "#f8fafc",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: isCritical ? "#fee2e2" : isWarning ? "#fef3c7" : "#e2e8f0",
                            color: isCritical ? "#b91c1c" : isWarning ? "#b45309" : "#475569"
                          }}>
                            {isCritical && "●"} {h.alertType.replace(/_/g, " ")}
                          </span>
                          <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 500 }}>
                            {formatIST(h.createdAt)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "13px", color: "#334155", lineHeight: 1.4 }}>
                          {h.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              background: "#f8fafc",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "flex-end"
            }}>
              <button
                type="button"
                onClick={() => setHistoryModalTarget(null)}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; }}
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

