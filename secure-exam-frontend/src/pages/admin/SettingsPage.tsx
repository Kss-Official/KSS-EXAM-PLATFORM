import { useState } from "react";
import { 
  Server, 
  ShieldCheck, 
  CheckCircle2, 
  Copy
} from "lucide-react";
import { API_BASE_URL } from "../../services/api";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);
  const [sebKey, setSebKey] = useState("a8f93e2b10c9d4827103a4b9c1d2e3f4a5b6c7d8e9f0123456789abcdef01234");
  const [quitPassword, setQuitPassword] = useState("PlacementAdmin@2026");

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

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 1. API & Backend Configuration */}
      <div className="panel-card">
        <div className="panel-card-header">
          <div className="panel-card-title">
            <Server size={16} color="#365fe5" />
            <span>Spring Boot REST API Configuration</span>
          </div>
          <span className="api-status-pill up">Vite Config</span>
        </div>

        <div className="panel-card-body">
          <div className="form-group" style={{ marginBottom: "14px" }}>
            <label>API Base URL (from VITE_API_BASE_URL)</label>
            <input 
              type="text" 
              value={API_BASE_URL} 
              readOnly 
              style={{ background: "#f8fafc", fontFamily: "monospace" }}
            />
            <small style={{ color: "#64748b" }}>
              Defined in <code>.env</code> / <code>.env.example</code>. Target: Spring Boot 21 at <code>http://localhost:8080/api</code>.
            </small>
          </div>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px" }}>
            <b style={{ fontSize: "12px", color: "#0f172a", display: "block", marginBottom: "6px" }}>
              Backend CORS Configuration Requirements:
            </b>
            <p style={{ fontSize: "12px", color: "#475569", margin: "0 0 10px 0" }}>
              Spring Boot must permit requests from <code>http://localhost:5173</code> with standard methods.
            </p>
            <div className="banner-code-box">
{`@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}`}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Safe Exam Browser (SEB) Configuration */}
      <div className="panel-card">
        <div className="panel-card-header">
          <div className="panel-card-title">
            <ShieldCheck size={16} color="#10b981" />
            <span>Safe Exam Browser (SEB) Security Settings</span>
          </div>
          <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>Active Profile</span>
        </div>

        <div className="panel-card-body">
          <p style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            Configure client lockdown settings for candidates taking the placement assessment through Safe Exam Browser (SEB).
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
                Sent in the <code>X-SafeExamBrowser-RequestHash</code> HTTP header for server-side integrity verification.
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
                Required to unlock candidates' screens if SEB needs to be exited prematurely.
              </small>
            </div>

            <div className="form-group">
              <label>Candidate Start URL</label>
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
              <button 
                type="button" 
                className="secondary" 
                onClick={copyToClipboard}
                style={{ padding: "4px 8px", fontSize: "11px" }}
              >
                {copied ? <CheckCircle2 size={12} color="#10b981" /> : <Copy size={12} />}
                {copied ? "Copied XML" : "Copy Configuration XML"}
              </button>
            </div>
            <pre style={{ margin: 0, fontSize: "11px", color: "#334155", fontFamily: "monospace", overflowX: "auto" }}>
              {sebConfigXml}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
