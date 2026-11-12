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
  ArrowRight
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

export default function LiveMonitoringPage() {
  const [activeTab, setActiveTab] = useState<"examinees" | "alerts">("examinees");
  const [examinees, setExaminees] = useState<LiveExamineeDto[]>([]);
  const [alerts, setAlerts] = useState<ProctorAlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string>("ALL");
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
        getLiveExaminees({
          batch: selectedSlot !== "ALL" ? selectedSlot : undefined,
          search: search.trim() ? search.trim() : undefined
        }),
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
  }, [selectedSlot, search]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reactive polling loop (every 3.5 seconds) for real-time synchronization
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 3500);
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

  // Metrics Calculation
  const activeExamineesCount = useMemo(() => {
    return examinees.filter(e => e.status === "IN_PROGRESS").length;
  }, [examinees]);

  const totalAlertsCount = useMemo(() => alerts.length, [alerts]);
  const newAlertsCount = useMemo(() => alerts.filter(a => a.status === "NEW").length, [alerts]);

  const extraTimeCount = useMemo(() => {
    return examinees.filter(e => e.extraTimeMinutes > 0).length;
  }, [examinees]);

  const stoppedCount = useMemo(() => {
    return examinees.filter(e => e.status === "DISCARDED" || e.status === "STOPPED").length;
  }, [examinees]);

  // Filtered examinees
  const filteredExaminees = useMemo(() => {
    return examinees.filter(cand => {
      const matchSearch = !search.trim() || 
        cand.fullName.toLowerCase().includes(search.toLowerCase()) ||
        cand.registrationNumber.toLowerCase().includes(search.toLowerCase()) ||
        cand.email.toLowerCase().includes(search.toLowerCase()) ||
        (cand.department && cand.department.toLowerCase().includes(search.toLowerCase()));

      const matchSlot = selectedSlot === "ALL" || 
        (cand.batch && cand.batch.toLowerCase().includes(selectedSlot.toLowerCase()));

      return matchSearch && matchSlot;
    });
  }, [examinees, search, selectedSlot]);

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
              color: "#017846" 
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
              border: "1px solid #017846",
              background: "#017846",
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
            <span style={{ padding: "6px", borderRadius: "8px", background: "#ecfdf5", color: "#017846" }}>
              <Radio size={18} />
            </span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>
            {activeExamineesCount}
          </div>
          <span style={{ fontSize: "12px", color: "#017846", fontWeight: 600 }}>
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
              border: activeTab === "examinees" ? "1px solid #017846" : "1px solid #cbd5e1",
              background: activeTab === "examinees" ? "#017846" : "#ffffff",
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
                  <th style={{ padding: "14px 18px" }}>SLOT & SET</th>
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

                        {/* Slot & Set */}
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "#f1f5f9",
                            color: "#334155",
                            fontWeight: 600,
                            fontSize: "11.5px",
                            marginRight: "6px"
                          }}>
                            {cand.batch}
                          </span>
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            background: "#e0e7ff",
                            color: "#3730a3",
                            fontWeight: 700,
                            fontSize: "11.5px"
                          }}>
                            {cand.assignedSet}
                          </span>
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
                              color: "#017846",
                              fontWeight: 700,
                              fontSize: "12px"
                            }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#017846" }} />
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
                              <Clock size={14} color="#017846" />
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
                              disabled={extraTimeLoadingId === cand.candidateId || isStopped}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid #bfdbfe",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: (extraTimeLoadingId === cand.candidateId || isStopped) ? "not-allowed" : "pointer",
                                opacity: isStopped ? 0.4 : 1
                              }}
                              title="Grant +10 minutes additional time to this candidate"
                            >
                              <Clock size={13} />
                              {extraTimeLoadingId === cand.candidateId ? "Adding..." : "+10 Mins"}
                            </button>

                            {/* Stop / Discard Exam Button */}
                            <button
                              type="button"
                              onClick={() => setStopModalTarget(cand)}
                              disabled={isStopped}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                border: "1px solid #fecaca",
                                background: isStopped ? "#f1f5f9" : "#fee2e2",
                                color: isStopped ? "#94a3b8" : "#dc2626",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: isStopped ? "not-allowed" : "pointer"
                              }}
                              title="Stop candidate's live examination"
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
              <ShieldCheck size={36} color="#017846" style={{ margin: "0 auto 12px" }} />
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
                              color: "#017846",
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
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(4px)",
          zIndex: 100000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            maxWidth: "520px",
            width: "100%",
            padding: "32px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            border: "1px solid #fee2e2"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <span style={{ padding: "10px", borderRadius: "10px", background: "#fee2e2", color: "#dc2626" }}>
                <UserX size={24} />
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#991b1b", fontWeight: 800 }}>
                  Stop & Discard Candidate Exam
                </h3>
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                  This action will terminate the candidate's active exam session immediately.
                </span>
              </div>
            </div>

            <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px", fontSize: "13px" }}>
              <div><strong>Candidate:</strong> {stopModalTarget.fullName}</div>
              <div><strong>Roll / Reg No:</strong> {stopModalTarget.registrationNumber}</div>
              <div><strong>Department:</strong> {stopModalTarget.department}</div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                Termination Reason (displayed to candidate):
              </label>
              <textarea
                value={stopReason}
                onChange={(e) => setStopReason(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  outline: "none"
                }}
              />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                {[
                  "Repeated tab switches detected",
                  "Exited Safe Exam Browser lockdown",
                  "Suspicious multiple faces in camera feed",
                  "Admin technical reset requested"
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStopReason(preset)}
                    style={{
                      fontSize: "11px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      padding: "3px 8px",
                      cursor: "pointer",
                      color: "#475569"
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setStopModalTarget(null)}
                disabled={isStopping}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStopExam}
                disabled={isStopping}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: isStopping ? "not-allowed" : "pointer"
                }}
              >
                {isStopping ? "Stopping Exam..." : "Yes, Stop & Terminate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Candidate Alert History Timeline */}
      {historyModalTarget && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(4px)",
          zIndex: 100000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            maxWidth: "600px",
            width: "100%",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a", fontWeight: 800 }}>
                  Cheating Alert Timeline
                </h3>
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                  {historyModalTarget.candidateName} ({historyModalTarget.regNo})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModalTarget(null)}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "18px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {loadingHistory ? (
                <div style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
                  Loading alert history...
                </div>
              ) : candidateHistory.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  <ShieldCheck size={32} color="#017846" style={{ margin: "0 auto 10px" }} />
                  No alerts recorded for this candidate.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {candidateHistory.map((h, idx) => (
                    <div
                      key={h.id || idx}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: h.severity === "CRITICAL" ? "#fff1f2" : "#f8fafc"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                          {h.alertType.replace("_", " ")}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {formatIST(h.createdAt)}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12.5px", color: "#475569" }}>
                        {h.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end"
            }}>
              <button
                type="button"
                onClick={() => setHistoryModalTarget(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
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

