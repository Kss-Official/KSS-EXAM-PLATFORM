import { useState } from "react";
import {
  ShieldCheck,
  Code2,
  Clock3,
  Terminal,
  Info,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { API_BASE_URL } from "../../services/api";
import DepartmentSelector from "../../components/candidate/DepartmentSelector";
import type { Department } from "../../types/candidate";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";

/**
 * CodingLoginPage – Round 2 Candidate Entry matching Round 1's UI/UX design.
 *
 * Calls POST /api/candidate/verify, stores the returned token in
 * localStorage as "examsecure_candidate_token", then redirects to
 * /candidate/coding?examId=<id>.
 */
export default function CodingLoginPage() {
  const params = new URLSearchParams(window.location.search);
  const examId = params.get("examId") || "2";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState<Department | "">("");
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !department.trim()) {
      setError("Please enter your full name, department, and registered email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/coding/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          department: department.trim(),
          departmentId,
          examId: Number(examId),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.eligible) {
        setError(data.message || data.detail || "Verification failed. Check your credentials.");
        setLoading(false);
        return;
      }
      if (data.token) {
        localStorage.setItem("examsecure_candidate_token", data.token);
      }
      window.location.href = `/candidate/coding?examId=${encodeURIComponent(examId)}`;
    } catch {
      setError("Temporary network hiccup. Please ensure the backend server is running and try again.");
      setLoading(false);
    }
  }

  function fillDemoCredentials() {
    setName("DEMO Coding Candidate");
    setEmail("demo.coder@example.local");
    setDepartment("AI/ML Developer");
    setDepartmentId(undefined);
    setError(null);
  }

  return (
    <main className="welcome">
      <nav className="nav">
        <div className="brand">
          <img
            src={kalpanaaLogo}
            alt="Kalpanaaa Software Solutions"
            className="candidate-portal-logo"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="secure">
            <ShieldCheck size={14} /> Round 2 &middot; Secure Coding Session
          </span>
        </div>
      </nav>

      <section className="hero">
        {/* Left section: Round 2 Coding Introduction */}
        <div className="intro">
          <div className="eyebrow">
            <i /> KALPANAAA SOFTWARE SOLUTIONS &middot; ROUND 2 CODING ASSESSMENT
          </div>
          <h1>
            Show how<br />
            <em style={{ color: "#017846" }}>you build.</em>
          </h1>
          <p className="lead">
            Welcome to Round 2 of your technical assessment. Authenticate with your Round 1 qualified candidate credentials to launch the coding workspace.
          </p>

          <div className="intro-features">
            <div className="feature">
              <span><Code2 size={18} /></span>
              <div>
                <b>Multi-language code editor</b>
                <small>Write, test against sample cases, and submit in Python, Java, C++, or JavaScript.</small>
              </div>
            </div>
            <div className="feature">
              <span><Clock3 size={18} /></span>
              <div>
                <b>Server-enforced timer &amp; auto-save</b>
                <small>Your drafts sync continuously so your progress is safe across refreshes.</small>
              </div>
            </div>
            <div className="feature">
              <span><Terminal size={18} /></span>
              <div>
                <b>Isolated sandbox evaluation</b>
                <small>Solutions are graded against sample and hidden test suites with strict limits.</small>
              </div>
            </div>
          </div>

          <hr className="intro-divider" />
          <div className="intro-footer">
            SKILLS | OPPORTUNITIES | BRIGHTER FUTURES
          </div>
        </div>

        {/* Right section: Candidate Access Card */}
        <div className="login card">
          <div className="eyebrow">ROUND 2 ACCESS</div>
          <h2>
            Coding <span className="entry-brand" style={{ color: "#017846" }}>Entry</span>
          </h2>
          <p className="muted">
            Enter your registered candidate details below to start your coding round.
          </p>

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label htmlFor="coding-candidate-name">
                Full name <span className="req">*</span>
              </label>
              <input
                id="coding-candidate-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your registered full name (e.g. DEMO Coding Candidate)"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="department-select">
                Department <span className="req">*</span>
              </label>
              <DepartmentSelector
                value={department}
                onChange={(dept, id) => {
                  setDepartment(dept);
                  setDepartmentId(id);
                  setError(null);
                }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="coding-candidate-email">
                Email Address <span className="req">*</span>
              </label>
              <input
                id="coding-candidate-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your registered email address (e.g. demo.coder@example.local)"
                required
              />
            </div>

            {error && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #f87171",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  color: "#991b1b",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong>Verification Notice:</strong>
                  <div style={{ marginTop: "2px" }}>{error}</div>
                </div>
              </div>
            )}

            <div className="green-info-panel">
              <Info size={16} />
              <span>
                Only candidates who qualified in Round 1 (or seeded DEMO accounts) can enter Round 2. Your session will open directly into the coding workspace.
              </span>
            </div>

            <button className="btn-primary-entry" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Verifying Eligibility...
                </>
              ) : (
                <>Enter Coding Round &rarr;</>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: "14px",
              padding: "12px",
              borderRadius: "10px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: "12px", color: "#475569", lineHeight: 1.4 }}>
              <strong style={{ color: "#0f172a" }}>Demo Account:</strong>{" "}
              <code>demo.coder@example.local</code> &middot; <code>AI/ML Developer</code>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={fillDemoCredentials}
              style={{ padding: "6px 10px", fontSize: "12px" }}
            >
              <Sparkles size={13} /> Fill Demo Credentials
            </button>
          </div>

          <div className="card-bottom-footnote">
            <ShieldCheck size={12} /> SECURE CODING WORKFLOW | DATABASE VALIDATED
          </div>
        </div>
      </section>

      <footer className="welcomefoot">
        &copy; 2026 Kalpanaaa Software Solutions &middot; Secure Candidate Examination Portal
        <span>
          <ShieldCheck size={14} /> Safe Exam Browser Verified Flow
        </span>
      </footer>
    </main>
  );
}
