import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  GraduationCap, 
  Clock3, 
  Info, 
  AlertCircle,
  PlayCircle,
  RotateCcw,
  Loader2
} from "lucide-react";
import type { CandidateProfile, Department } from "../../types/candidate";
import DepartmentSelector from "../../components/candidate/DepartmentSelector";
import { loadCandidateSession, clearCandidateSession } from "../../services/candidateSessionStorage";
import DemoRestartDialog from "../../components/candidate/DemoRestartDialog";
import { verifyCandidateEligibility, ApiError } from "../../services/api";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";

interface CandidateEntryPageProps {
  onContinue: (profile: CandidateProfile) => void;
  onResumeActiveSession: () => void;
}

export default function CandidateEntryPage({
  onContinue,
  onResumeActiveSession
}: CandidateEntryPageProps) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<Department | "">("");
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [touched, setTouched] = useState({
    name: false,
    department: false,
    email: false
  });

  const [errors, setErrors] = useState({
    name: "",
    department: "",
    email: ""
  });

  const [existingSession, setExistingSession] = useState<ReturnType<typeof loadCandidateSession>>(null);
  const [showRestartModal, setShowRestartModal] = useState(false);

  useEffect(() => {
    const session = loadCandidateSession();
    if (session && session.profile) {
      setExistingSession(session);
      setName(session.profile.name || "");
      const savedDept = session.profile.department || "";
      if (savedDept === "Technical Department" || savedDept === "Non-Technical Department") {
        setDepartment(savedDept);
      } else if (
        savedDept.toLowerCase().includes("hr") ||
        savedDept.toLowerCase().includes("human") ||
        savedDept.toLowerCase().includes("sales") ||
        savedDept.toLowerCase().includes("market")
      ) {
        setDepartment("Non-Technical Department");
      } else if (savedDept) {
        setDepartment("Technical Department");
      }
      setDepartmentId(session.profile.departmentId);
      setEmail(session.profile.email || "");
    }
  }, []);

  const validate = () => {
    const errs = {
      name: "",
      department: "",
      email: ""
    };

    const trimmedName = name.trim();
    if (!trimmedName) {
      errs.name = "Full name is required. Please enter your registered full name.";
    } else if (trimmedName.length < 2) {
      errs.name = "Full name must be at least 2 characters long.";
    }

    if (!department) {
      errs.department = "Please select your assigned department.";
    }

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errs.email = "Email address is required. Please enter your registered email.";
    } else if (!emailRegex.test(trimmedEmail)) {
      errs.email = "Please enter a valid email address (e.g. name@campus.edu).";
    }

    setErrors(errs);
    return !errs.name && !errs.department && !errs.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, department: true, email: true });
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsVerifying(true);
    try {
      const verifyRes = await verifyCandidateEligibility({
        fullName: name.trim(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        department: department,
        departmentName: department,
        departmentId: departmentId
      });

      if (!verifyRes.eligible) {
        setServerError(verifyRes.message || "Candidate credentials could not be verified in our records.");
        setIsVerifying(false);
        return;
      }

      onContinue({
        name: verifyRes.candidateName || name.trim(),
        email: verifyRes.email || email.trim().toLowerCase(),
        department: verifyRes.departmentName || (department as Department),
        departmentId: departmentId,
        candidateId: verifyRes.registrationNumber || "CAND-001",
        dbCandidateId: verifyRes.candidateId,
        assignedExamId: verifyRes.assignedExamId,
        examTitle: verifyRes.examTitle,
        slotName: verifyRes.slotName,
        questionSetCode: verifyRes.questionSetCode
      });
    } catch (err: unknown) {
      const error = err as ApiError;
      setServerError(error.message || "Verification failed. Please ensure your name, department, and email address match your registered records.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRestartConfirmed = () => {
    clearCandidateSession();
    setExistingSession(null);
    setName("");
    setDepartment("");
    setDepartmentId(undefined);
    setEmail("");
    setShowRestartModal(false);
  };

  return (
    <main className="welcome">
      {/* 
        Candidate Portal Header:
        Official Kalpanaa Software Solutions logo and Secure Candidate Session indicator.
      */}
      <nav className="nav">
        <div className="brand">
          <img 
            src={kalpanaaLogo} 
            alt="Kalpanaa Software Solutions" 
            className="candidate-portal-logo" 
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="secure">
            <ShieldCheck size={14} /> Secure Candidate Session
          </span>
        </div>
      </nav>

      <section className="hero">
        {/* Left section: Assessment introduction */}
        <div className="intro">
          <div className="eyebrow">
            <i /> CAMPUS PLACEMENT & RECRUITMENT ASSESSMENT
          </div>
          <h1>
            Show what<br />
            <em style={{ color: "#017846" }}>you know.</em>
          </h1>
          <p className="lead">
            Welcome to your technical assessment portal. Enter your registered full name, department, and email address to authenticate and begin your examination.
          </p>

          <div className="intro-features">
            <div className="feature">
              <span><ShieldCheck size={18} /></span>
              <div>
                <b>Secure assessment environment</b>
                <small>Proctored, secure browser with smart monitoring.</small>
              </div>
            </div>
            <div className="feature">
              <span><Clock3 size={18} /></span>
              <div>
                <b>60-minute timed evaluation</b>
                <small>Your session begins once you complete system checks.</small>
              </div>
            </div>
            <div className="feature">
              <span><GraduationCap size={18} /></span>
              <div>
                <b>Multiple-choice questions</b>
                <small>Auto-save, easy navigation, and real-time progress.</small>
              </div>
            </div>
          </div>

          <hr className="intro-divider" />
          <div className="intro-footer">
            SKILLS | OPPORTUNITIES | BRIGHTER FUTURES
          </div>
        </div>

        {/* Right section: Candidate access card */}
        <div className="login card">
          <div className="eyebrow">CANDIDATE ACCESS</div>
          <h2>
            Assessment <span className="entry-brand" style={{ color: "#017846" }}>Entry</span>
          </h2>
          <p className="muted">
            Enter your registered candidate details below to begin your assessment.
          </p>

          {/* Active attempt detection banner */}
          {existingSession && existingSession.profile && !existingSession.isSubmitted && (
            <div className="active-session-banner">
              <div className="active-session-header">
                <AlertCircle size={16} />
                <strong>Active Exam Session In Progress</strong>
              </div>
              <p>
                An ongoing session was detected for <strong>{existingSession.profile?.name || "Candidate"}</strong> (
                {existingSession.profile?.email || "Registered Candidate"}) in <strong>{existingSession.profile?.department || "General"}</strong>.
              </p>
              <div className="active-session-actions">
                <button
                  type="button"
                  className="primary full"
                  onClick={onResumeActiveSession}
                >
                  <PlayCircle size={16} /> Resume Active Attempt
                </button>
                <button
                  type="button"
                  className="secondary small-btn"
                  onClick={() => setShowRestartModal(true)}
                >
                  <RotateCcw size={13} /> Reset / Start Fresh
                </button>
              </div>
            </div>
          )}

          {/* Completed attempt notification */}
          {existingSession && existingSession.isSubmitted && (
            <div className="submitted-session-banner">
              <div className="active-session-header">
                <ShieldCheck size={16} />
                <strong>Assessment Already Submitted</strong>
              </div>
              <p>
                A finalized attempt exists for <strong>{existingSession.profile?.name || "Candidate"}</strong> (Receipt: {existingSession.receiptId || "RECEIPT"}).
              </p>
              <div className="active-session-actions">
                <button
                  type="button"
                  className="secondary full"
                  onClick={onResumeActiveSession}
                >
                  View Submission Receipt
                </button>
                <button
                  type="button"
                  className="secondary small-btn"
                  onClick={() => setShowRestartModal(true)}
                >
                  <RotateCcw size={13} /> Reset Attempt
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Field 1: Full Name */}
            <div className="form-group">
              <label htmlFor="candidate-name">
                Full name <span className="req">*</span>
              </label>
              <input
                id="candidate-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setServerError(null);
                  if (touched.name) {
                    setErrors((prev) => ({
                      ...prev,
                      name: e.target.value.trim() ? "" : "Full name is required."
                    }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, name: true }));
                  if (!name.trim()) {
                    setErrors((prev) => ({ ...prev, name: "Full name is required." }));
                  }
                }}
                placeholder="Enter your registered full name (e.g. Aarav Sharma)"
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                className={errors.name ? "input-error" : ""}
              />
              {errors.name && (
                <span id="name-error" className="inline-validation-error" role="alert">
                  {errors.name}
                </span>
              )}
            </div>

            {/* Field 2: Department */}
            <div className="form-group">
              <label htmlFor="department-select">
                Department <span className="req">*</span>
              </label>
              <DepartmentSelector
                value={department}
                onChange={(dept, id) => {
                  setDepartment(dept);
                  setDepartmentId(id);
                  setTouched((prev) => ({ ...prev, department: true }));
                  setErrors((prev) => ({ ...prev, department: "" }));
                  setServerError(null);
                }}
                error={touched.department ? errors.department : undefined}
              />
            </div>

            {/* Field 3: Email Address */}
            <div className="form-group">
              <label htmlFor="candidate-email">
                Email Address <span className="req">*</span>
              </label>
              <input
                id="candidate-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setServerError(null);
                  if (touched.email) {
                    setErrors((prev) => ({
                      ...prev,
                      email: e.target.value.trim() ? "" : "Email address is required."
                    }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, email: true }));
                  if (!email.trim()) {
                    setErrors((prev) => ({ ...prev, email: "Email address is required." }));
                  }
                }}
                placeholder="Enter your registered email address (e.g. aarav.sharma@campus.edu)"
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={errors.email ? "input-error" : ""}
              />
              {errors.email && (
                <span id="email-error" className="inline-validation-error" role="alert">
                  {errors.email}
                </span>
              )}
            </div>

            {serverError && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #f87171",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                color: "#991b1b",
                fontSize: "13px",
                marginBottom: "16px"
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong>Verification Failed:</strong>
                  <div style={{ marginTop: "2px" }}>{serverError}</div>
                </div>
              </div>
            )}

            <div className="green-info-panel">
              <Info size={16} />
              <span>
                Please ensure your Full Name, Department, and Email Address match your registered institutional records. Your details will be verified against our database before beginning your assessment.
              </span>
            </div>

            <button className="btn-primary-entry" type="submit" disabled={isVerifying}>
              {isVerifying ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Verifying Eligibility...
                </>
              ) : (
                <>
                  Continue to Role & Application &rarr;
                </>
              )}
            </button>
          </form>

          <div className="card-bottom-footnote">
            <ShieldCheck size={12} /> SECURE CLIENT WORKFLOW | DATABASE VALIDATED
          </div>
        </div>
      </section>

      <footer className="welcomefoot">
        &copy; 2026 Kalpanaa Software Solutions &middot; Secure Candidate Examination Portal
        <span>
          <ShieldCheck size={14} /> Safe Exam Browser Verified Flow
        </span>
      </footer>

      {showRestartModal && (
        <DemoRestartDialog
          onCancel={() => setShowRestartModal(false)}
          onConfirmRestart={handleRestartConfirmed}
        />
      )}
    </main>
  );
}
