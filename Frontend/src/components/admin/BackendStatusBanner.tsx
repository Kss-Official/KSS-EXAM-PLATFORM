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
import type { AdminDashboardResponse } from "../../types";
import { 
  API_BASE_URL, 
  setAdminCredentials, 
  clearAdminCredentials, 
  hasAdminCredentials 
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
      <div className="backend-banner" style={{ background: "#f8fafc", borderLeft: "4px solid #017846" }}>
        <div className="banner-header">
          <div className="banner-title">
            <Server size={18} className="animate-spin" />
            <span>Connecting to Spring Boot Backend API...</span>
          </div>
          <small style={{ color: "#64748b" }}>{API_BASE_URL}/admin/dashboard</small>
        </div>
        <p className="banner-desc" style={{ margin: 0 }}>
          Verifying backend health and retrieving admin statistics from Spring Boot.
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
            <span>Backend Connected: {data.application} ({data.status})</span>
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
          <strong>API Message:</strong> "{data.message}" ┬╖ Connected to <code>{API_BASE_URL}</code>.
          <br />
          <small style={{ color: "#64748b" }}>
            Note: Current values (totalExams: {data.totalExams}, totalCandidates: {data.totalCandidates}, activeExams: {data.activeExams}) are demonstration endpoints from the initial backend seed.
          </small>
        </p>
      </div>
    );
  }

  // 2. Spring Security 401 Unauthorized State
  if (statusCode === 401 || (error && error.includes("401"))) {
    return (
      <div className="backend-banner warning">
        <div className="banner-header">
          <div className="banner-title" style={{ color: "#92400e" }}>
            <ShieldAlert size={18} color="#f59e0b" />
            <span>Spring Security Authentication Required (HTTP 401 Unauthorized)</span>
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
          The Spring Boot backend at <code>{API_BASE_URL}/admin/dashboard</code> is online and responsive, but <strong>Spring Security</strong> is intercepting the request with <code>WWW-Authenticate: Basic realm="Realm"</code>.
        </p>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
          <button 
            type="button" 
            className="secondary" 
            onClick={() => setShowDetails(!showDetails)}
            style={{ fontSize: "11px", padding: "4px 10px" }}
          >
            {showDetails ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            {showDetails ? "Hide Backend Configuration Instructions" : "View Required Spring Security Backend Configuration"}
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
              <strong>Required Backend Change:</strong> Ensure your Spring Boot <code>SecurityConfig</code> permits admin dashboard access or enables appropriate CORS and authentication:
            </p>
            <div className="banner-code-box">
{`// Example Spring Boot SecurityConfig.java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
        .cors(Customizer.withDefaults())
        .csrf(csrf -> csrf.disable()) // for stateless REST APIs
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/admin/**").permitAll() // or .hasRole("ADMIN") with HTTP Basic/JWT
            .anyRequest().authenticated()
        )
        .httpBasic(Customizer.withDefaults());
    return http.build();
}`}
            </div>
            <p style={{ fontSize: "11px", color: "#92400e", margin: "6px 0 0 0" }}>
              Also ensure CORS is configured on the backend with <code>@CrossOrigin(origins = "http://localhost:5173")</code> or a <code>WebMvcConfigurer</code> bean.
            </p>
          </div>
        )}

        <form onSubmit={handleApplyAuth} className="auth-form-inline">
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#78350f", display: "flex", alignItems: "center", gap: "4px" }}>
            <Key size={14}/> Test with Spring Boot credentials:
          </span>
          <input 
            type="text" 
            placeholder="Username (e.g. user / admin)" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Password (from backend console)" 
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
          <span>Cannot Connect to Spring Boot Backend</span>
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
          <li>Ensure Spring Boot backend is running on <code>http://localhost:8080</code>.</li>
          <li>Ensure CORS headers allow origin <code>http://localhost:5173</code> (e.g., <code>Access-Control-Allow-Origin: http://localhost:5173</code>).</li>
          <li>Verify <code>VITE_API_BASE_URL</code> in your <code>.env</code> file.</li>
        </ul>
      </div>
    </div>
  );
}
