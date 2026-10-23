import { useState } from "react";
import { 
  CheckCircle2, 
  ShieldCheck, 
  RotateCcw, 
  LockKeyhole, 
  Calendar, 
  Hash, 
  FileCheck, 
  Clock, 
  User, 
  Briefcase,
  Printer,
  ArrowRight
} from "lucide-react";
import type { SubmissionReceipt } from "../../types/candidate";
import DemoRestartDialog from "../../components/candidate/DemoRestartDialog";

interface SubmissionConfirmationPageProps {
  receipt: SubmissionReceipt;
  onRestartDemo: () => void;
}

export default function SubmissionConfirmationPage({
  receipt,
  onRestartDemo
}: SubmissionConfirmationPageProps) {
  const [showRestartModal, setShowRestartModal] = useState(false);

  const submittedTime = typeof receipt?.submittedAt === "number" ? receipt.submittedAt : Date.now();
  const formattedDate = new Date(submittedTime).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  const getReasonLabel = (reason: SubmissionReceipt["submissionReason"]) => {
    switch (reason) {
      case "manual_submit":
        return "Submitted by Candidate";
      case "timer_expired":
        return "Automatic Submission (Timer Expired)";
      case "candidate_exit":
        return "Finalized on Session Exit";
      default:
        return "Finalized";
    }
  };

  return (
    <main className="result">
      {/* 
        Candidate-Only Submission Confirmation:
        - Shows strictly submission receipt & completion details
        - NO answer keys, NO scoring breakdown, NO correct/incorrect answers
        - NO admin navigation or "Go to Admin Dashboard" button
      */}
      <section className="card resultcard">
        <div className="resulticon">
          <CheckCircle2 size={36} />
        </div>
        <div className="eyebrow">
          {receipt.isDemoReceipt ? "DEMO ASSESSMENT FINALIZED" : "EXAMINATION FINALIZED"}
        </div>
        <h1>Assessment Submitted</h1>
        <p className="muted">
          Your examination attempt has been officially recorded and locked on the ExamSecure server.
        </p>

        {/* Server Receipt Badge */}
        <div className="receipt-banner">
          <div className="receipt-header">
            <FileCheck size={16} />
            <small>{receipt.isDemoReceipt ? "DEMO RECEIPT IDENTIFIER" : "DURABLE SERVER SUBMISSION RECEIPT"}</small>
          </div>
          <strong className="receipt-code">{receipt.receiptId}</strong>
          <span className="receipt-sub">
            {receipt.isDemoReceipt
              ? "* Demo mode attempt receipt."
              : "Cryptographically generated and stored securely in PostgreSQL. Retain this code for administrative verification."}
          </span>
        </div>

        {/* Candidate & Assessment Metadata */}
        <div className="stats">
          <div>
            <small>
              <User size={12} style={{ display: "inline", marginRight: "4px" }} />
              Candidate Name
            </small>
            <b>{receipt.candidateName}</b>
          </div>
          <div>
            <small>
              <Hash size={12} style={{ display: "inline", marginRight: "4px" }} />
              Candidate ID
            </small>
            <b>{receipt.candidateId}</b>
          </div>
          <div>
            <small>
              <Briefcase size={12} style={{ display: "inline", marginRight: "4px" }} />
              Department Track
            </small>
            <b style={{ color: "#365fe5" }}>{receipt.department}</b>
          </div>
          <div>
            <small>
              <Clock size={12} style={{ display: "inline", marginRight: "4px" }} />
              Finalization Mode
            </small>
            <b>{getReasonLabel(receipt.submissionReason)}</b>
          </div>
          <div>
            <small>Questions Answered</small>
            <b>
              {receipt.answeredCount} / {receipt.totalQuestions}
            </b>
          </div>
          <div>
            <small>Questions Unanswered</small>
            <b>
              {receipt.unansweredCount} / {receipt.totalQuestions}
            </b>
          </div>
          <div>
            <small>
              <Calendar size={12} style={{ display: "inline", marginRight: "4px" }} />
              Timestamp
            </small>
            <b>{formattedDate}</b>
          </div>
          <div>
            <small>Submission Status</small>
            <b className="status-success">Finalized & Graded</b>
          </div>
        </div>

        {/* Controlled Results Publication Section */}
        {receipt.isPublished ? (
          <div style={{
            margin: "18px 0",
            padding: "16px",
            background: receipt.qualificationStatus === "QUALIFIED" ? "#f0fdf4" : "#fffbeb",
            border: `1px solid ${receipt.qualificationStatus === "QUALIFIED" ? "#bbf7d0" : "#fde68a"}`,
            borderRadius: "10px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Official Examination Result (Published)
            </div>
            <div style={{
              display: "inline-block",
              margin: "10px 0",
              padding: "6px 16px",
              borderRadius: "20px",
              fontWeight: 800,
              fontSize: "16px",
              background: receipt.qualificationStatus === "QUALIFIED" ? "#22c55e" : "#ef4444",
              color: "#fff"
            }}>
              {receipt.qualificationStatus === "QUALIFIED" ? "QUALIFIED" : "NOT QUALIFIED"}
            </div>
            <div style={{ fontSize: "14px", color: "#334155" }}>
              Score: <b>{receipt.score ?? 0}</b> / {receipt.totalMarks ?? 100} ({typeof receipt.percentage === "number" ? receipt.percentage.toFixed(1) : Number(receipt.percentage || 0).toFixed(1)}%)
            </div>
          </div>
        ) : (
          /* Organization Policy Notice */
          <div className="notice" style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
            <ShieldCheck size={18} style={{ color: "#16a34a", flexShrink: 0 }} />
            <span>
              Your responses have been securely preserved and locked on the server.
              Official scores and qualification status are undergoing administrative review and will be released when authorized.
            </span>
          </div>
        )}

        {/* Next Steps Roadmap (Reduces candidate anxiety) */}
        <div style={{
          margin: "18px 0 20px",
          padding: "14px 16px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          textAlign: "left"
        }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
            Post-Assessment Roadmap
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#334155" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#16a34a", fontWeight: 600 }}>
              <CheckCircle2 size={15} /> 1. Examination Responses Authenticated & Locked
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0284c7" }}>
              <Clock size={15} /> 2. Automated Scoring & Audit Log Integrity Check Completed
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b" }}>
              <ArrowRight size={15} /> 3. Official Qualification Release by Institutional Authority
            </div>
          </div>
        </div>

        {/* Actions - Candidate Only: Print Receipt + Restart */}
        <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
          <button
            type="button"
            className="primary full"
            onClick={() => window.print()}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "11px 16px", fontSize: "13px" }}
          >
            <Printer size={16} /> Print or Save Verification Docket (PDF)
          </button>
          
          <button
            type="button"
            className="secondary full"
            onClick={() => setShowRestartModal(true)}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px", padding: "9px 14px", fontSize: "12px" }}
          >
            <RotateCcw size={14} /> Reset Session / Start Fresh Assessment
          </button>
        </div>

        <div className="footnote no-print" style={{ marginTop: "18px" }}>
          <LockKeyhole size={13} /> SECURE CLIENT-SIDE FINALIZATION · NO ACTIVE ATTEMPT RUNNING
        </div>
      </section>

      {/* Restart Demo Modal */}
      {showRestartModal && (
        <DemoRestartDialog
          onCancel={() => setShowRestartModal(false)}
          onConfirmRestart={() => {
            setShowRestartModal(false);
            onRestartDemo();
          }}
        />
      )}
    </main>
  );
}
