import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Server,
  UserCheck
} from "lucide-react";
import { useRouter } from "../../router";
import { loginAdmin, getAuthMe, ApiError, type AuthUser } from "../../services/api";

const CONFIGURED_ADMIN_EMAIL = "d.koushik@kalpanaaasoftwaresolutions.in";

interface AdminLoginPageProps {
  onLoginSuccess?: (user: AuthUser) => void;
}

export default function AdminLoginPage({ onLoginSuccess }: AdminLoginPageProps) {
  const { navigate } = useRouter();
  const [email, setEmail] = useState(CONFIGURED_ADMIN_EMAIL);
  const [password, setPassword] = useState(""); // Never prefilled per security policy
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountDisabled, setAccountDisabled] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  // Check if session is already active on load
  useEffect(() => {
    let isCancelled = false;
    const checkActiveSession = async () => {
      try {
        const user = await getAuthMe();
        if (!isCancelled && user && user.role === "SUPER_ADMIN") {
          if (onLoginSuccess) onLoginSuccess(user);
          navigate("/admin/dashboard");
          return;
        }
      } catch {
        // Unauthenticated is expected here
      } finally {
        if (!isCancelled) {
          setCheckingSession(false);
          setBackendStatus("online");
        }
      }
    };
    checkActiveSession();
    return () => { isCancelled = true; };
  }, [navigate, onLoginSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setAccountDisabled(false);
    setSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage("Administrator email is required.");
      return;
    }

    if (!cleanPassword) {
      setErrorMessage("Administrator password is required.");
      return;
    }

    setLoading(true);

    try {
      // Real backend authentication call with HttpOnly cookie session establishment
      const res = await loginAdmin(cleanEmail, cleanPassword);

      if (res.success && res.user) {
        setSuccessMessage("Security clearance verified. Initializing Administrator Console...");
        if (onLoginSuccess) onLoginSuccess(res.user);
        setTimeout(() => {
          navigate("/admin/dashboard");
        }, 600);
      } else {
        setErrorMessage(res.message || "Authentication failed.");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setErrorMessage(err.backendMessage || "Invalid credentials. Please verify your email and password.");
        } else if (err.statusCode === 403) {
          setAccountDisabled(true);
          setErrorMessage("Account Access Denied: This administrator account is disabled or locked.");
        } else if (err.statusCode === 429) {
          setErrorMessage("Rate limit exceeded: Too many failed login attempts. Temporarily locked for 15 minutes.");
        } else if (err.isCorsOrNetworkError || err.statusCode === 502 || err.statusCode === 503 || err.statusCode === 504) {
          setErrorMessage("Cannot reach Spring Boot server at http://localhost:8080. Start the backend with './mvnw.cmd spring-boot:run' in another terminal.");
          setBackendStatus("offline");
        } else {
          setErrorMessage(err.message || "An authentication error occurred.");
        }
      } else {
        const errorObj = err as Error;
        setErrorMessage(errorObj.message || "Authentication failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div 
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090d16",
          color: "#94a3b8",
          fontFamily: "'DM Sans', sans-serif",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <div style={{ width: "32px", height: "32px", border: "3px solid #017846", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: "13px" }}>ExamSecure: Verifying administrator session...</span>
      </div>
    );
  }

  return (
    <div 
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e293b 100%)",
        color: "#f8fafc",
        fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "20px",
        position: "relative",
        boxSizing: "border-box"
      }}
    >
      {/* Decorative background glows */}
      <div 
        style={{
          position: "absolute",
          top: "10%",
          left: "20%",
          width: "350px",
          height: "350px",
          background: "radial-gradient(circle, rgba(54, 95, 229, 0.15) 0%, transparent 70%)",
          filter: "blur(50px)",
          pointerEvents: "none"
        }} 
      />
      <div 
        style={{
          position: "absolute",
          bottom: "10%",
          right: "20%",
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none"
        }} 
      />

      <div 
        style={{
          width: "100%",
          maxWidth: "440px",
          position: "relative",
          zIndex: 10
        }}
      >
        {/* Brand & Platform Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div 
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #017846, #014D32)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 10px 25px rgba(1, 120, 70, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.15)"
            }}
          >
            <ShieldCheck size={30} color="#ffffff" />
          </div>

          <h1 style={{ margin: "0 0 6px 0", fontSize: "23px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.5px" }}>
            ExamSecure Administrator
          </h1>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8" }}>
            Single-Administrator Secure Access ┬╖ Role-Based Control (RBAC)
          </p>
        </div>

        {/* Login Card */}
        <div 
          style={{
            background: "#ffffff",
            borderRadius: "14px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(226, 232, 240, 0.9)",
            padding: "32px 28px",
            color: "#0f172a"
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <UserCheck size={16} color="#017846" />
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Super Administrator Sign In
              </h2>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Restricted to authorized institutional administrator account.
            </span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div 
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                background: accountDisabled ? "#fff7ed" : "#fef2f2",
                border: accountDisabled ? "1px solid #fed7aa" : "1px solid #fecaca",
                borderRadius: "8px",
                padding: "10px 12px",
                marginBottom: "18px",
                fontSize: "12px",
                color: accountDisabled ? "#c2410c" : "#991b1b"
              }}
            >
              <AlertTriangle size={16} color={accountDisabled ? "#ea580c" : "#dc2626"} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>{accountDisabled ? "Account Notice" : "Authentication Failed"}</strong>
                <div style={{ marginTop: "2px" }}>{errorMessage}</div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "8px",
                padding: "10px 12px",
                marginBottom: "18px",
                fontSize: "12px",
                color: "#166534"
              }}
            >
              <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin}>
            {/* Email Field */}
            <div style={{ marginBottom: "16px" }}>
              <label 
                htmlFor="admin-email" 
                style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}
              >
                Administrator Email Address *
              </label>
              <div style={{ position: "relative" }}>
                <Mail 
                  size={16} 
                  color="#94a3b8" 
                  style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} 
                />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. d.koushik@kalpanaaasoftwaresolutions.in"
                  autoComplete="email"
                  style={{
                    width: "100%",
                    padding: "10px 14px 10px 38px",
                    fontSize: "12.5px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    outline: "none",
                    boxSizing: "border-box",
                    background: "#f8fafc"
                  }}
                  required
                />
              </div>
              <small style={{ fontSize: "10.5px", color: "#64748b", marginTop: "4px", display: "block" }}>
                Provisioned Identity: <code>d.koushik@kalpanaaasoftwaresolutions.in</code>
              </small>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label 
                  htmlFor="admin-password" 
                  style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}
                >
                  Password *
                </label>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Spring Security BCrypt</span>
              </div>
              <div style={{ position: "relative" }}>
                <Lock 
                  size={16} 
                  color="#94a3b8" 
                  style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} 
                />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  autoComplete="current-password"
                  style={{
                    width: "100%",
                    padding: "10px 40px 10px 38px",
                    fontSize: "13px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    outline: "none",
                    boxSizing: "border-box",
                    background: "#f8fafc"
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: "2px"
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                fontSize: "13px",
                fontWeight: 700,
                color: "#ffffff",
                background: "linear-gradient(135deg, #017846, #01663C)",
                border: "none",
                borderRadius: "8px",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(1, 120, 70, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.15s ease",
                opacity: loading ? 0.75 : 1
              }}
            >
              {loading ? (
                <span>Verifying Credentials with Spring Security...</span>
              ) : (
                <>
                  <span>Sign In as Super Administrator</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Provisioning Notice */}
          <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#64748b" }}>
              Administrator credentials are provisioned via environment variables on the backend (<code>ADMIN_BOOTSTRAP_PASSWORD</code>). Public registration is disabled.
            </div>
          </div>
        </div>

        {/* Footer Info & Backend Indicator */}
        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "11.5px", color: "#64748b" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "8px", background: "rgba(255, 255, 255, 0.05)", padding: "4px 10px", borderRadius: "12px" }}>
            <Server size={12} color="#94a3b8" />
            <span>Backend Status:</span>
            <span 
              style={{
                fontWeight: 700,
                color: backendStatus === "online" ? "#22c55e" : "#ef4444"
              }}
            >
              {backendStatus === "online" ? "Spring Boot Active (Session Cookie Auth)" : "Backend Offline"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
