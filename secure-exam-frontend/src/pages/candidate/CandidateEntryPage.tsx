import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  GraduationCap, 
  Clock3, 
  ChevronRight, 
  LockKeyhole, 
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
  const [candidateId, setCandidateId] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [touched, setTouched] = useState({
    name: false,
    department: false,
    candidateId: false
  });

  const [errors, setErrors] = useState({
    name: "",
    department: "",
    candidateId: ""
  });

  const [existingSession, setExistingSession] = useState<ReturnType<typeof loadCandidateSession>>(null);
  const [showRestartModal, setShowRestartModal] = useState(false);

  useEffect(() => {
    const session = loadCandidateSession();
    if (session && session.profile) {
      setExistingSession(session);
      // Pre-fill fields with existing draft/session details if available
      setName(session.profile.name || "");
      setDepartment(session.profile.department || "");
      setDepartmentId(session.profile.departmentId);
      setCandidateId(session.profile.candidateId || "");
    }
  }, []);

  const validate = () => {
    const errs = {
      name: "",
      department: "",
      candidateId: ""
    };

    const trimmedName = name.trim();
    if (!trimmedName) {
      errs.name = "Full name is required. Please enter your full name.";
    } else if (trimmedName.length < 2) {
      errs.name = "Full name must be at least 2 characters long.";
    }

    if (!department) {
      errs.department = "Please select your assigned department.";
    }

    const trimmedId = candidateId.trim();
    if (!trimmedId) {
      errs.candidateId = "Candidate ID is required. Please enter the ID supplied by your organization.";
    } else if (trimmedId.length < 3) {
      errs.candidateId = "Candidate ID must be at least 3 characters long.";
    }

    setErrors(errs);
    return !errs.name && !errs.department && !errs.candidateId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, department: true, candidateId: true });
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsVerifying(true);
    try {
      const verifyRes = await verifyCandidateEligibility({
        registrationNumber: candidateId.trim().toUpperCase(),
        departmentId: departmentId
      });

      if (!verifyRes.eligible) {
        setServerError(verifyRes.message || "Candidate record is not eligible or examination has not started.");
        setIsVerifying(false);
        return;
      }

      onContinue({
        name: verifyRes.candidateName || name.trim(),
        department: verifyRes.departmentName || (department as Department),
        departmentId: departmentId,
        candidateId: verifyRes.registrationNumber || candidateId.trim().toUpperCase(),
        dbCandidateId: verifyRes.candidateId,
        assignedExamId: verifyRes.assignedExamId,
        examTitle: verifyRes.examTitle,
        slotName: verifyRes.slotName,
        questionSetCode: verifyRes.questionSetCode
      });
    } catch (err: unknown) {
      const error = err as ApiError;
      setServerError(error.message || "Verification failed. Please ensure the candidate is registered in this department.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRestartConfirmed = () => {
    clearCandidateSession();
    setExistingSession(null);
    setName("");
    setDepartment("");
    setCandidateId("");
    setShowRestartModal(false);
  };

  return (
    <main className="welcome">
      {/* 
        Candidate Portal Header:
        Strictly candidate-only. Note that administrative links and "Switch to Admin Dashboard" 
        buttons have been removed from this candidate-facing view.
        (Real administrator access must eventually be secured server-side via Spring Security).
      */}
      <nav className="nav">
        <div className="brand">
          <div className="logo">
            <ShieldCheck size={22} />
          </div>
          <div>
            <b>ExamSecure</b>
            <small>CANDIDATE EXAMINATION PORTAL</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="secure">
            <LockKeyhole size={14} /> Secure Candidate Session
          </span>
        </div>
      </nav>

      <section className="hero">
        <div className="intro">
          <div className="eyebrow">
            <i /> CAMPUS PLACEMENT & RECRUITMENT ASSESSMENT
          </div>
          <h1>
            Show what<br />
            <em>you know.</em>
          </h1>
          <p className="lead">
            Welcome to your technical assessment portal. Enter your assigned candidate information,
            select your department track, and verify hardware compatibility before beginning your examination.
          </p>

          <div className="feature">
            <span><ShieldCheck size={18} /></span>
            <div>
              <b>Secure assessment environment</b>
              <small>Use the exam browser and workstation designated by your evaluation committee.</small>
            </div>
          </div>
          <div className="feature">
            <span><Clock3 size={18} /></span>
            <div>
              <b>60-minute timed evaluation</b>
              <small>Your exam countdown begins once you pass system checks and enter the exam.</small>
            </div>
          </div>
          <div className="feature">
            <span><GraduationCap size={18} /></span>
            <div>
              <b>100 multiple-choice questions</b>
              <small>Answers are auto-saved locally. Select one answer per question.</small>
            </div>
          </div>
        </div>

        <div className="login card">
          <div className="cardicon">
            <GraduationCap size={24} />
          </div>
          <div className="eyebrow">CANDIDATE ACCESS</div>
          <h2>Assessment Entry</h2>
          <p className="muted">Enter the unique credentials provided by your organization.</p>

          {/* Active attempt detection banner */}
          {existingSession && existingSession.profile && !existingSession.isSubmitted && (
            <div className="active-session-banner">
              <div className="active-session-header">
                <AlertCircle size={16} />
                <strong>Active Exam Session In Progress</strong>
              </div>
              <p>
                An ongoing session was detected for <strong>{existingSession.profile?.name || "Candidate"}</strong> (
                {existingSession.profile?.candidateId || "CAND-001"}) in <strong>{existingSession.profile?.department || "General"}</strong>.
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
                A finalized attempt exists for <strong>{existingSession.profile?.name || "Candidate"}</strong> (Receipt: {existingSession.receiptId || "DEMO-RECEIPT"}).
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
                  <RotateCcw size={13} /> Reset Demo Attempt
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
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
                placeholder="Enter your full name (e.g. John Doe)"
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

            {/* Department */}
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

            {/* Candidate ID */}
            <div className="form-group">
              <label htmlFor="candidate-id">
                Unique Candidate ID <span className="req">*</span>
              </label>
              <input
                id="candidate-id"
                type="text"
                value={candidateId}
                onChange={(e) => {
                  setCandidateId(e.target.value);
                  setServerError(null);
                  if (touched.candidateId) {
                    setErrors((prev) => ({
                      ...prev,
                      candidateId: e.target.value.trim() ? "" : "Candidate ID is required."
                    }));
                  }
                }}
                onBlur={() => {
                  setTouched((prev) => ({ ...prev, candidateId: true }));
                  if (!candidateId.trim()) {
                    setErrors((prev) => ({ ...prev, candidateId: "Candidate ID is required." }));
                  }
                }}
                placeholder="e.g. CAND-2026-001"
                aria-required="true"
                aria-invalid={!!errors.candidateId}
                aria-describedby={errors.candidateId ? "id-error" : undefined}
                className={errors.candidateId ? "input-error" : ""}
              />
              {errors.candidateId && (
                <span id="id-error" className="inline-validation-error" role="alert">
                  {errors.candidateId}
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

            <div className="notice">
              <Info size={16} />
              <span>
                Please ensure your Candidate ID matches your institutional allocation document.
                Your profile will be verified against real backend examination eligibility before launch.
              </span>
            </div>

            <button className="primary" type="submit" disabled={isVerifying}>
              {isVerifying ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Verifying Eligibility...
                </>
              ) : (
                <>
                  Continue to System Compatibility Check <ChevronRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="footnote">
            <LockKeyhole size={13} /> SECURE CLIENT WORKFLOW · FRONTEND VALIDATION
          </div>
        </div>
      </section>

      <footer className="welcomefoot">
        © 2026 ExamSecure · Secure Candidate Examination Portal
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
