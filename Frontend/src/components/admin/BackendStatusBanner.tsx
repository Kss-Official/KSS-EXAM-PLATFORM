import { useState } from "react";
import { 
  Server, 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  ShieldAlert, 
  Key, 
  ChevronDown, 
  ChevronUp
} from "lucide-react";
import { 
  API_BASE_URL, 
  setAdminCredentials, 
  clearAdminCredentials, 
  hasAdminCredentials,
  type AdminDashboardResponse
} from "../../services/api";

interface BackendStatusBannerProps {
  data: AdminDashboardResponse | null;
  loading: boolean;
  error: string | null;
  statusCode?: number;
  onRetry: () => void;
}

export default function BackendStatusBanner({
  data,
  loading,
  error,
  statusCode,
  onRetry
}: BackendStatusBannerProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authSubmitted, setAuthSubmitted] = useState(hasAdminCredentials());

  const handleApplyAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setAdminCredentials(username.trim(), password);
      setAuthSubmitted(true);
      onRetry();
    }
  };

  const handleClearAuth = () => {
    clearAdminCredentials();
    setUsername("");
    setPassword("");
    setAuthSubmitted(false);
    onRetry();
  };

  if (loading) {
    return (
      <div className="backend-banner" style={{ background: "#f8fafc", borderLeft: "4px solid #365fe5" }}>
        <div className="banner-header">
          <div className="banner-title">
            <Server size={18} className="animate-spin" />
            <span>Connecting to ExamSecure FastAPI Backend...</span>
          </div>
          <small style={{ color: "#64748b" }}>{API_BASE_URL}/admin/dashboard</small>
        </div>
        <p className="banner-desc" style={{ margin: 0 }}>
          Verifying backend health and retrieving real-time administrator telemetry.
        </p>
      </div>
    );
  }

  // 1. Success State (200 OK)
  if (data && !error) {
    return (
      <div className="backend-banner success">
        <div className="banner-header">
          <div className="banner-title" style={{ color: "#065f46" }}>
            <CheckCircle size={18} color="#10b981" />
            <span>FastAPI Backend Connected: {data.application} ({data.status})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="api-status-pill up">HTTP 200 OK</span>
            <button 
              className="secondary" 
              onClick={onRetry} 
              title="Refresh backend status"
              style={{ padding: "4px 8px", fontSize: "11px" }}
            >
              <RotateCcw size={12}/> Refresh
            </button>
          </div>
        </div>
        <p className="banner-desc">
          <strong>API Message:</strong> "{data.message}" · Connected to <code>{API_BASE_URL}</code>.
          <br />
          <small style={{ color: "#64748b" }}>
            Live PostgreSQL Telemetry: totalExams={data.totalExams}, activeExams={data.activeExams}, totalCandidates={data.totalCandidates}, totalAttempts={data.totalAttempts}.
          </small>
        </p>
      </div>
    );
  }

  // 2. Authentication Required (HTTP 401 Unauthorized)
  if (statusCode === 401 || (error && error.includes("401"))) {
    return (
      <div className="backend-banner warning">
        <div className="banner-header">
          <div className="banner-title" style={{ color: "#92400e" }}>
            <ShieldAlert size={18} color="#f59e0b" />
            <span>Administrator Authentication Required (HTTP 401 Unauthorized)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="api-status-pill auth">HTTP 401</span>
            <button 
              className="secondary" 
              onClick={onRetry} 
              style={{ padding: "4px 8px", fontSize: "11px" }}
            >
              <RotateCcw size={12}/> Retry
            </button>
          </div>
        </div>

        <p className="banner-desc">
          The FastAPI backend at <code>{API_BASE_URL}/admin/dashboard</code> is online and protected. Please sign in via the Administrator Login portal or verify your session cookie.
        </p>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
          <button 
            type="button" 
            className="secondary" 
            onClick={() => setShowDetails(!showDetails)}
            style={{ fontSize: "11px", padding: "4px 10px" }}
          >
            {showDetails ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            {showDetails ? "Hide Authentication Details" : "View Session Details"}
          </button>

          {authSubmitted && (
            <button 
              type="button" 
              onClick={handleClearAuth}
              style={{ fontSize: "11px", background: "none", border: "none", color: "#b91c1c", cursor: "pointer", textDecoration: "underline" }}
            >
              Clear current session credentials
            </button>
          )}
        </div>

        {showDetails && (
          <div style={{ marginTop: "12px", borderTop: "1px solid #fde68a", paddingTop: "12px" }}>
            <p style={{ fontSize: "12px", color: "#78350f", margin: "0 0 6px 0" }}>
              <strong>Authentication Method:</strong> ExamSecure uses cryptographic HMAC-SHA256 session cookies (<code>JSESSIONID</code>) verified on every request by FastAPI.
            </p>
          </div>
        )}

        <form onSubmit={handleApplyAuth} className="auth-form-inline">
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#78350f", display: "flex", alignItems: "center", gap: "4px" }}>
            <Key size={14}/> Sign In:
          </span>
          <input 
            type="text" 
            placeholder="Email (e.g. d.koushik@kalpanaaasoftwaresolutions.in)" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
          />
          <button type="submit" className="primary" style={{ padding: "6px 12px", fontSize: "12px" }}>
            Authenticate & Retry
          </button>
        </form>
      </div>
    );
  }

  // 3. Backend Offline or CORS Error
  return (
    <div className="backend-banner error">
      <div className="banner-header">
        <div className="banner-title" style={{ color: "#991b1b" }}>
          <XCircle size={18} color="#ef4444" />
          <span>Cannot Connect to FastAPI Backend</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="api-status-pill down">Connection Failed</span>
          <button 
            className="secondary" 
            onClick={onRetry} 
            style={{ padding: "4px 8px", fontSize: "11px" }}
          >
            <RotateCcw size={12}/> Retry
          </button>
        </div>
      </div>
      <p className="banner-desc">
        {error || `Unable to reach ${API_BASE_URL}/admin/dashboard.`}
      </p>
      <div style={{ fontSize: "11.5px", color: "#7f1d1d", background: "#fee2e2", padding: "10px 12px", borderLeft: "3px solid #dc2626", borderRadius: "6px" }}>
        <strong>Checklist to resolve:</strong>
        <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
          <li>Ensure FastAPI backend is running on <code>http://127.0.0.1:8000</code> (run <code>python run.py</code> in <code>backend/</code>).</li>
          <li>Ensure CORS headers allow origin <code>http://localhost:5173</code>.</li>
          <li>Verify <code>VITE_API_BASE_URL</code> in your <code>.env</code> file.</li>
        </ul>
      </div>
    </div>
  );
}
