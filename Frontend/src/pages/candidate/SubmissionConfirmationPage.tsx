import { useEffect } from "react";
import { 
  Check, 
  CheckCircle2, 
  User, 
  Hash, 
  Briefcase, 
  FileCheck, 
  ListChecks, 
  Clock, 
  Calendar, 
  Lock 
} from "lucide-react";
import type { SubmissionReceipt } from "../../types/candidate";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";

interface SubmissionConfirmationPageProps {
  receipt: SubmissionReceipt;
  onRestartDemo?: () => void;
}

export default function SubmissionConfirmationPage({
  receipt,
  onRestartDemo
}: SubmissionConfirmationPageProps) {
  // Lock body & html overflow strictly to zero so no scrollbar ever appears
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // Format submission timestamp matching reference: "23 Oct 2026, 3:45 PM"
  const formatSubmittedDate = (ts: number | string | undefined) => {
    try {
      const d = ts ? new Date(ts) : new Date();
      const day = d.getDate();
      const month = d.toLocaleString("en-US", { month: "short" });
      const year = d.getFullYear();
      const time = d.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      return `${day} ${month} ${year}, ${time}`;
    } catch {
      return "23 Oct 2026, 3:45 PM";
    }
  };

  // Format elapsed time taken
  const formatTimeTaken = () => {
    if (receipt?.timeTakenSeconds && receipt.timeTakenSeconds > 0) {
      const mins = Math.floor(receipt.timeTakenSeconds / 60);
      const secs = receipt.timeTakenSeconds % 60;
      return `${mins} min ${secs} sec`;
    }
    return "52 min 18 sec";
  };

  const getReasonLabel = (reason: SubmissionReceipt["submissionReason"]) => {
    switch (reason) {
      case "manual_submit":
        return "Submitted by candidate";
      case "timer_expired":
        return "Automatic (Timer Expired)";
      case "candidate_exit":
        return "Finalized on candidate exit";
      default:
        return "Submitted by candidate";
    }
  };

  const handleCloseWindow = () => {
    try {
      window.close();
    } catch {
      // browser might block window.close for user-opened tabs
    }
    if (onRestartDemo) {
      onRestartDemo();
    } else {
      window.location.href = "/";
    }
  };

  const candidateName = receipt?.candidateName || "Candidate";
  const candidateEmail = receipt?.candidateEmail;
  const candidateId = receipt?.candidateId || "CAND-001";
  const department = receipt?.department || "Developer";
  const submissionStatus = getReasonLabel(receipt?.submissionReason);
  const questionsAnswered = `${receipt?.answeredCount ?? 0} of ${receipt?.totalQuestions ?? 60}`;
  const timeTaken = formatTimeTaken();
  const submittedAt = formatSubmittedDate(receipt?.submittedAt);

  return (
    <div 
      style={{
        height: "100vh",
        maxHeight: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "#edf2f7",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "clamp(8px, 1.8vh, 20px) 16px",
        boxSizing: "border-box",
        fontFamily: "'Inter', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      <div 
        style={{
          width: "100%",
          maxWidth: "540px",
          display: "flex",
          flexDirection: "column",
          maxHeight: "100%",
          boxSizing: "border-box"
        }}
      >
        {/* Top Header Navbar */}
        <header 
          style={{
            width: "100%",
            marginBottom: "clamp(6px, 1.4vh, 12px)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxSizing: "border-box",
            flexShrink: 0
          }}
        >
          <img 
            src={kalpanaaLogo} 
            alt="Kalpanaa Software Solutions" 
            style={{ height: "clamp(26px, 3.4vh, 32px)", objectFit: "contain" }} 
          />

          <div 
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#eaf6ef",
              border: "1px solid #bbf7d0",
              color: "#017846",
              borderRadius: "999px",
              padding: "4px 12px",
              fontSize: "11.5px",
              fontWeight: 700
            }}
          >
            <CheckCircle2 size={13} color="#017846" />
            <span>Assessment complete</span>
          </div>
        </header>

        {/* Main Centered Assessment Finalized Card (Vertical Portrait Profile) */}
        <main 
          style={{
            width: "100%",
            background: "#ffffff",
            borderRadius: "clamp(18px, 2.5vw, 24px)",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.04), 0 2px 6px -1px rgba(0, 0, 0, 0.02)",
            padding: "clamp(18px, 2.6vh, 26px) clamp(18px, 2.8vw, 26px) clamp(16px, 2.2vh, 22px)",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {/* Top Hero Section */}
          <div style={{ textAlign: "center", marginBottom: "clamp(10px, 1.8vh, 16px)" }}>
            {/* Centered Checkmark Badge */}
            <div 
              style={{
                width: "clamp(46px, 5.6vh, 54px)",
                height: "clamp(46px, 5.6vh, 54px)",
                borderRadius: "50%",
                background: "#eaf6ef",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto clamp(4px, 0.8vh, 8px)"
              }}
            >
              <div 
                style={{
                  width: "clamp(32px, 3.8vh, 36px)",
                  height: "clamp(32px, 3.8vh, 36px)",
                  borderRadius: "50%",
                  border: "2px solid #017846",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Check size={19} color="#017846" strokeWidth={3} />
              </div>
            </div>

            <span 
              style={{
                display: "block",
                fontSize: "10px",
                fontWeight: 800,
                color: "#64748b",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                marginBottom: "clamp(2px, 0.4vh, 4px)"
              }}
            >
              EXAMINATION FINALIZED
            </span>

            <h1 
              style={{
                fontSize: "clamp(21px, 2.8vh, 25px)",
                fontWeight: 800,
                color: "#0f172a",
                margin: "0 0 clamp(2px, 0.4vh, 4px)",
                letterSpacing: "-0.4px"
              }}
            >
              Assessment <span style={{ color: "#017846" }}>Submitted</span>
            </h1>

            <p 
              style={{
                fontSize: "clamp(11.5px, 1.45vh, 12.5px)",
                color: "#64748b",
                maxWidth: "400px",
                margin: "0 auto",
                lineHeight: 1.4
              }}
            >
              Your answers have been securely submitted and your examination attempt has been recorded.
            </p>
          </div>

          {/* 7 Metadata Cards Grid (Vertical 2-Column Layout) */}
          <div 
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "clamp(6px, 1vh, 9px) 10px",
              marginBottom: "clamp(8px, 1.2vh, 12px)"
            }}
          >
            {/* Card 1: Candidate Name */}
            <div 
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "clamp(7px, 1vh, 10px) 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.015)"
              }}
            >
              <div 
                style={{
                  width: "clamp(32px, 3.8vh, 36px)",
                  height: "clamp(32px, 3.8vh, 36px)",
                  borderRadius: "8px",
                  background: "#eaf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#017846",
                  flexShrink: 0
                }}
              >
                <User size={17} />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "10.5px", color: "#64748b", marginBottom: "2px", fontWeight: 500 }}>
                  Candidate Name
                </span>
                <strong style={{ display: "block", fontSize: "clamp(12px, 1.45vh, 13px)", color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {candidateName}
                </strong>
              </div>
            </div>

            {/* Card 2: Candidate ID */}
            <div 
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "clamp(7px, 1vh, 10px) 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.015)"
              }}
            >
              <div 
                style={{
                  width: "clamp(32px, 3.8vh, 36px)",
                  height: "clamp(32px, 3.8vh, 36px)",
                  borderRadius: "8px",
                  background: "#eaf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#017846",
                  flexShrink: 0
                }}
              >
                <Hash size={17} />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "10.5px", color: "#64748b", marginBottom: "2px", fontWeight: 500 }}>
                  {candidateEmail ? "Registered Email" : "Candidate ID"}
                </span>
                <strong style={{ display: "block", fontSize: "clamp(12px, 1.45vh, 13px)", color: "#0f172a", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {candidateEmail || candidateId}
                </strong>
              </div>
            </div>

            {/* Card 3: Department */}
            <div 
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "clamp(7px, 1vh, 10px) 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.015)"
              }}
            >
              <div 
                style={{
                  width: "clamp(32px, 3.8vh, 36px)",
                  height: "clamp(32px, 3.8vh, 36px)",
                  borderRadius: "8px",
                  background: "#eaf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#017846",
                  flexShrink: 0
                }}
              >
                <Briefcase size={17} />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "10.5px", color: "#64748b", marginBottom: "2px", fontWeight: 500 }}>
                  Department
                </span>
                <strong style={{ display: "block", fontSize: "clamp(12px, 1.45vh, 13px)", color: "#0f172a", fontWeight: 700 }}>
                  {department}
                </strong>
              </div>
            </div>

            {/* Card 4: Submission Status */}
            <div 
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "clamp(7px, 1vh, 10px) 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.015)"
              }}
            >
              <div 
                style={{
                  width: "clamp(32px, 3.8vh, 36px)",
                  height: "clamp(32px, 3.8vh, 36px)",
                  borderRadius: "8px",
                  background: "#eaf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#017846",
                  flexShrink: 0
                }}
              >
                <FileCheck size={17} />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "10.5px", color: "#64748b", marginBottom: "2px", fontWeight: 500 }}>
                  Submission Status
                </span>
                <strong style={{ display: "block", fontSize: "clamp(12px, 1.45vh, 13px)", color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {submissionStatus}
                </strong>
              </div>
            </div>

            {/* Card 5: Questions Answered */}
            <div 
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "clamp(7px, 1vh, 10px) 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.015)"
              }}
            >
              <div 
                style={{
                  width: "clamp(32px, 3.8vh, 36px)",
                  height: "clamp(32px, 3.8vh, 36px)",
                  borderRadius: "8px",
                  background: "#eaf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#017846",
                  flexShrink: 0
                }}
              >
                <ListChecks size={17} />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "10.5px", color: "#64748b", marginBottom: "2px", fontWeight: 500 }}>
                  Questions Answered
                </span>
                <strong style={{ display: "block", fontSize: "clamp(12px, 1.45vh, 13px)", color: "#0f172a", fontWeight: 700 }}>
                  {questionsAnswered}
                </strong>
              </div>
            </div>

            {/* Card 6: Time Taken */}
            <div 
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "clamp(7px, 1vh, 10px) 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.015)"
              }}
            >
              <div 
                style={{
                  width: "clamp(32px, 3.8vh, 36px)",
                  height: "clamp(32px, 3.8vh, 36px)",
                  borderRadius: "8px",
                  background: "#eaf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#017846",
                  flexShrink: 0
                }}
              >
                <Clock size={17} />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "10.5px", color: "#64748b", marginBottom: "2px", fontWeight: 500 }}>
                  Time Taken
                </span>
                <strong style={{ display: "block", fontSize: "clamp(12px, 1.45vh, 13px)", color: "#0f172a", fontWeight: 700 }}>
                  {timeTaken}
                </strong>
              </div>
            </div>

            {/* Card 7: Submitted At (Full Width) */}
            <div 
              style={{
                gridColumn: "1 / -1",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "clamp(7px, 1vh, 10px) 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.015)"
              }}
            >
              <div 
                style={{
                  width: "clamp(32px, 3.8vh, 36px)",
                  height: "clamp(32px, 3.8vh, 36px)",
                  borderRadius: "8px",
                  background: "#eaf6ef",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#017846",
                  flexShrink: 0
                }}
              >
                <Calendar size={17} />
              </div>
              <div style={{ overflow: "hidden", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "10.5px", color: "#64748b", marginBottom: "2px", fontWeight: 500 }}>
                  Submitted At
                </span>
                <strong style={{ display: "block", fontSize: "clamp(12px, 1.45vh, 13px)", color: "#0f172a", fontWeight: 700 }}>
                  {submittedAt}
                </strong>
              </div>
            </div>
          </div>

          {/* Notice Banner: Responses Locked */}
          <div 
            style={{
              background: "#eaf6ef",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              padding: "clamp(7px, 1vh, 10px) 12px",
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <div 
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "7px",
                background: "#017846",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <Lock size={14} color="#ffffff" />
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "clamp(12px, 1.5vh, 13px)", color: "#014d32", fontWeight: 700 }}>
                Your responses are now locked.
              </strong>
              <span style={{ fontSize: "clamp(11px, 1.35vh, 12px)", color: "#01663c", display: "block", marginTop: "1px" }}>
                You can no longer edit or change answers for this attempt.
              </span>
            </div>
          </div>

          {/* Bottom Button: Close The Window */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "clamp(10px, 1.6vh, 16px)" }}>
            <button
              type="button"
              onClick={handleCloseWindow}
              style={{
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "clamp(7px, 1.1vh, 9px) 28px",
                fontSize: "clamp(12px, 1.4vh, 13px)",
                fontWeight: 700,
                color: "#1e293b",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f8fafc";
                e.currentTarget.style.borderColor = "#94a3b8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }}
            >
              Close The Window
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}


