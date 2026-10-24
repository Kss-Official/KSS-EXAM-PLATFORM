import { useState, useEffect, useCallback } from "react";
import { 
  Server, 
  ShieldCheck, 
  CheckCircle2, 
  Copy,
  Download,
  Activity,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Database,
  Lock,
  Globe,
  Sliders,
  AlertCircle
} from "lucide-react";
import { 
  API_BASE_URL, 
  getAuditLogs, 
  type AuditLogDto, 
  type AuditLogResponse 
} from "../../services/api";

type SettingsTab = "system" | "audit" | "seb" | "email";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("system");
  const [copied, setCopied] = useState(false);
  const [sebKey, setSebKey] = useState("a8f93e2b10c9d4827103a4b9c1d2e3f4a5b6c7d8e9f0123456789abcdef01234");
  const [quitPassword, setQuitPassword] = useState("PlacementAdmin@2026");

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogDto[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const sebConfigXml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>originatorVersion</key>
    <string>SEB_Win_3.4.0</string>
    <key>startURL</key>
    <string>http://localhost:5173/candidate</string>
    <key>browserExamKey</key>
    <string>${sebKey}</string>
    <key>allowQuit</key>
    <true/>
    <key>quitURLConfirm</key>
    <true/>
    <key>hashedAdminPassword</key>
    <string>${quitPassword}</string>
    <key>allowPreferencesWindow</key>
    <false/>
    <key>allowVirtualMachine</key>
    <false/>
</dict>
</plist>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sebConfigXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSebFile = () => {
    const blob = new Blob([sebConfigXml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ExamSecure_Placement_Client.seb";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchAuditLogs = useCallback(async (page: number, search: string, action: string) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const resp: AuditLogResponse = await getAuditLogs({
        page,
        pageSize: 15,
        search: search.trim() || undefined,
        action: action.trim() || undefined
      });
      setAuditLogs(resp.items);
      setTotalLogs(resp.total);
      setCurrentPage(resp.page);
      setTotalPages(resp.totalPages);
    } catch (err: any) {
      setAuditError(err?.message || "Failed to load audit logs from backend.");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs(currentPage, searchQuery, actionFilter);
    }
  }, [activeTab, currentPage, actionFilter, fetchAuditLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAuditLogs(1, searchQuery, actionFilter);
  };

  const formatTimestamp = (isoStr?: string) => {
    if (!isoStr) return "-";
    try {
      return new Date(isoStr).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch {
      return isoStr;
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("CREATE")) return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
    if (action.includes("DELETE")) return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
    if (action.includes("PUBLISH")) return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
    if (action.includes("GENERATE")) return { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff" };
    return { bg: "#f1f5f9", color: "#334155", border: "#cbd5e1" };
  };

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Tab Switcher */}
      <div style={{ 
        display: "flex", 
        gap: "8px", 
        background: "#ffffff", 
        padding: "6px", 
        borderRadius: "10px", 
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
      }}>
        <button
          type="button"
          onClick={() => setActiveTab("system")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: activeTab === "system" ? "#017846" : "transparent",
            color: activeTab === "system" ? "#ffffff" : "#64748b",
            transition: "all 0.15s ease"
          }}
        >
          <Server size={16} /> Backend & System
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: activeTab === "audit" ? "#017846" : "transparent",
            color: activeTab === "audit" ? "#ffffff" : "#64748b",
            transition: "all 0.15s ease"
          }}
        >
          <Activity size={16} /> Security Audit Trail
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("seb")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: activeTab === "seb" ? "#017846" : "transparent",
            color: activeTab === "seb" ? "#ffffff" : "#64748b",
            transition: "all 0.15s ease"
          }}
        >
          <ShieldCheck size={16} /> Safe Exam Browser (SEB)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("email")}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            background: activeTab === "email" ? "#017846" : "transparent",
            color: activeTab === "email" ? "#ffffff" : "#64748b",
            transition: "all 0.15s ease"
          }}
        >
          <Mail size={16} /> Email Gateway
        </button>
      </div>

      {/* TAB 1: SYSTEM & BACKEND CONFIGURATION */}
      {activeTab === "system" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="panel-card">
            <div className="panel-card-header">
              <div className="panel-card-title">
                <Server size={18} color="#017846" />
                <span>FastAPI Enterprise Backend Configuration</span>
              </div>
              <span className="api-status-pill up">Active Runtime</span>
            </div>

            <div className="panel-card-body">
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label>API Gateway Endpoint (from VITE_API_BASE_URL)</label>
                <input 
                  type="text" 
                  value={API_BASE_URL} 
                  readOnly 
                  style={{ background: "#f8fafc", fontFamily: "monospace", fontWeight: 600 }}
                />
                <small style={{ color: "#64748b" }}>
                  Serving live endpoints at <code>http://127.0.0.1:8000/api</code> with CORS support for Vite origin.
                </small>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>
                    <Database size={16} color="#017846" />
                    <span>Database Persistence</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 4px 0" }}>
                    <b>Engine:</b> SQLite with Automatic PostgreSQL Failover
                  </p>
                  <p style={{ fontSize: "12px", color: "#475569", margin: 0 }}>
                    <b>File:</b> <code>examsecure.db</code> (Zero-downtime persistence)
                  </p>
                </div>

                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>
                    <Lock size={16} color="#017846" />
                    <span>Security & Rate Limiting</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 4px 0" }}>
                    <b>Algorithm:</b> BCrypt (12 rounds) & HMAC-SHA256
                  </p>
                  <p style={{ fontSize: "12px", color: "#475569", margin: 0 }}>
                    <b>Brute Force Lock:</b> 5 failed attempts $\rightarrow$ 15 min lock
                  </p>
                </div>

                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>
                    <Globe size={16} color="#017846" />
                    <span>CORS Origins</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 4px 0" }}>
                    <b>Origins:</b> <code>http://localhost:5173</code>, <code>http://127.0.0.1:5173</code>
                  </p>
                  <p style={{ fontSize: "12px", color: "#475569", margin: 0 }}>
                    <b>Credentials:</b> Enabled (Cookies + Bearer headers)
                  </p>
                </div>
              </div>

              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px" }}>
                <b style={{ fontSize: "12.5px", color: "#166534", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <CheckCircle2 size={16} color="#16a34a" /> Backend Health & Live Documentation
                </b>
                <p style={{ fontSize: "12px", color: "#14532d", margin: "0 0 8px 0" }}>
                  Interactive OpenAPI and Swagger documentation is available at <code>http://127.0.0.1:8000/docs</code>.
                </p>
                <div style={{ fontSize: "11.5px", fontFamily: "monospace", color: "#15803d" }}>
                  App: ExamSecure Examination Platform v2.0.0 | Python 3.11 + FastAPI + SQLAlchemy ORM
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-title">
              <Activity size={18} color="#017846" />
              <span>Platform Administrative Audit Trail ({totalLogs} Total Events)</span>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => fetchAuditLogs(currentPage, searchQuery, actionFilter)}
              style={{ fontSize: "12px", padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px" }}
            >
              <RefreshCw size={13} className={auditLoading ? "spin" : ""} /> Refresh Logs
            </button>
          </div>

          <div className="panel-card-body" style={{ padding: "16px 20px" }}>
            {/* Filters */}
            <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 240px" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="Search actions, emails, details..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: "32px", fontSize: "12.5px" }}
                />
              </div>

              <select
                value={actionFilter}
                onChange={e => {
                  setActionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ flex: "0 1 200px", fontSize: "12.5px" }}
              >
                <option value="">All Action Types</option>
                <option value="CREATE_EXAM">CREATE_EXAM</option>
                <option value="PUBLISH_EXAM">PUBLISH_EXAM</option>
                <option value="CREATE_DEPARTMENT">CREATE_DEPARTMENT</option>
                <option value="CREATE_CANDIDATE">CREATE_CANDIDATE</option>
                <option value="GENERATE_ACCESS_CODE">GENERATE_ACCESS_CODE</option>
                <option value="BATCH_GENERATE_CODES">BATCH_GENERATE_CODES</option>
                <option value="ASSIGN_EXAM">ASSIGN_EXAM</option>
                <option value="CREATE_QUESTION">CREATE_QUESTION</option>
                <option value="IMPORT_QUESTIONS">IMPORT_QUESTIONS</option>
                <option value="SUBMIT_EXAM">SUBMIT_EXAM</option>
              </select>

              <button type="submit" className="primary" style={{ fontSize: "12px", padding: "0 16px" }}>
                Search
              </button>
            </form>

            {/* Error banner */}
            {auditError && (
              <div style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", marginBottom: "14px" }}>
                <AlertCircle size={15} style={{ display: "inline", marginRight: "6px" }} />
                {auditError}
              </div>
            )}

            {/* Table */}
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>ID</th>
                    <th style={{ width: "170px" }}>Timestamp</th>
                    <th style={{ width: "190px" }}>Action</th>
                    <th style={{ width: "120px" }}>Entity</th>
                    <th>Performed By</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                        Loading audit logs from database...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                        No audit logs matched your search criteria.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const badgeStyle = getActionBadgeColor(log.action);
                      return (
                        <tr key={log.id}>
                          <td style={{ color: "#64748b", fontFamily: "monospace" }}>#{log.id}</td>
                          <td style={{ fontSize: "11.5px", color: "#475569" }}>{formatTimestamp(log.createdAt)}</td>
                          <td>
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "10.5px",
                              fontWeight: 700,
                              fontFamily: "monospace",
                              background: badgeStyle.bg,
                              color: badgeStyle.color,
                              border: `1px solid ${badgeStyle.border}`
                            }}>
                              {log.action}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: "#1e293b", fontSize: "12px" }}>
                            {log.entityType} {log.entityId ? `(#${log.entityId})` : ""}
                          </td>
                          <td style={{ fontSize: "12px", color: "#0f172a" }}>{log.performedBy}</td>
                          <td style={{ fontSize: "12px", color: "#334155" }}>{log.details || "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Showing page <b>{currentPage}</b> of <b>{totalPages}</b> ({totalLogs} recorded events)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={currentPage <= 1 || auditLoading}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ fontSize: "12px", padding: "4px 12px" }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={currentPage >= totalPages || auditLoading}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ fontSize: "12px", padding: "4px 12px" }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SAFE EXAM BROWSER */}
      {activeTab === "seb" && (
        <div className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-title">
              <ShieldCheck size={18} color="#017846" />
              <span>Safe Exam Browser (SEB) Client Lockdown Settings</span>
            </div>
            <span style={{ fontSize: "11px", color: "#017846", fontWeight: 600 }}>Active Profile</span>
          </div>

          <div className="panel-card-body">
            <p style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Generate, configure, and download encrypted configuration profiles for Safe Exam Browser (SEB v3.4.0+).
              Enforces complete kiosk mode lockdown, preventing window-switching and virtual machine exploits.
            </p>

            <div className="form-grid" style={{ marginBottom: "16px" }}>
              <div className="form-group form-full-width">
                <label>Browser Exam Key (BEK) Hash</label>
                <input 
                  type="text" 
                  value={sebKey} 
                  onChange={e => setSebKey(e.target.value)}
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
                <small style={{ color: "#64748b" }}>
                  Verified by the backend using header <code>X-SafeExamBrowser-RequestHash</code>.
                </small>
              </div>

              <div className="form-group">
                <label>SEB Admin Quit Password</label>
                <input 
                  type="password" 
                  value={quitPassword} 
                  onChange={e => setQuitPassword(e.target.value)}
                />
                <small style={{ color: "#64748b" }}>
                  Required by proctors to unlock candidate terminals if exam is exited prematurely.
                </small>
              </div>

              <div className="form-group">
                <label>Candidate Entrance URL</label>
                <input 
                  type="text" 
                  value="http://localhost:5173/candidate" 
                  readOnly
                  style={{ background: "#f8fafc" }}
                />
              </div>
            </div>

            <div style={{ background: "#f1f5f9", borderRadius: "8px", padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <b style={{ fontSize: "12px", color: "#1e293b" }}>SEB Configuration File (.seb) XML Preview</b>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    type="button" 
                    className="secondary" 
                    onClick={copyToClipboard}
                    style={{ padding: "4px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" }}
                  >
                    {copied ? <CheckCircle2 size={12} color="#10b981" /> : <Copy size={12} />}
                    {copied ? "Copied XML" : "Copy XML"}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={downloadSebFile}
                    style={{ padding: "4px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" }}
                  >
                    <Download size={12} /> Download .seb File
                  </button>
                </div>
              </div>
              <pre style={{ margin: 0, fontSize: "11px", color: "#334155", fontFamily: "monospace", overflowX: "auto" }}>
                {sebConfigXml}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EMAIL GATEWAY */}
      {activeTab === "email" && (
        <div className="panel-card">
          <div className="panel-card-header">
            <div className="panel-card-title">
              <Mail size={18} color="#017846" />
              <span>Notification & Email Dispatch Service</span>
            </div>
            <span className="api-status-pill up">Auto-Dispatch</span>
          </div>

          <div className="panel-card-body">
            <p style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              ExamSecure features an asynchronous, rate-throttled batch delivery engine designed for high-volume campus hiring drives.
              Each Unique Access ID email is dispatched with strict delay pacing (1.2s delay per email) to protect against provider rate limits.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", marginBottom: "16px" }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px" }}>
                <b style={{ fontSize: "12.5px", color: "#0f172a", display: "block", marginBottom: "6px" }}>
                  Supported Gateways
                </b>
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#475569", lineHeight: 1.6 }}>
                  <li><b>Resend API:</b> Direct transactional delivery via HTTPS.</li>
                  <li><b>Brevo (Sendinblue):</b> High-volume SMTP & API integration.</li>
                  <li><b>Standard SMTP:</b> TLS encrypted connection (port 587).</li>
                  <li><b>Development Mock:</b> Safe preview logging if keys are unset.</li>
                </ul>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px" }}>
                <b style={{ fontSize: "12.5px", color: "#0f172a", display: "block", marginBottom: "6px" }}>
                  Batch Dispatch Safety Rules
                </b>
                <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#475569", lineHeight: 1.6 }}>
                  <li><b>Unique ID 3-Use Limit:</b> Embedded strictly in candidate records.</li>
                  <li><b>Round Isolation:</b> Separate credentials for MCQ & Coding.</li>
                  <li><b>Anti-Spam Throttling:</b> Minimum 1.2s sleep between sends.</li>
                  <li><b>Real-Time Polling:</b> Job ID tracking with live progress bar.</li>
                </ul>
              </div>
            </div>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "14px" }}>
              <b style={{ fontSize: "12px", color: "#166534", display: "block", marginBottom: "4px" }}>
                Dispatch Configuration Status
              </b>
              <p style={{ fontSize: "12px", color: "#14532d", margin: 0 }}>
                Automatic failover mode active: Email engine seamlessly uses Resend or Brevo if API keys are provided in <code>backend/.env</code>, otherwise falls back gracefully to authenticated SMTP or local mock with zero job loss.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
