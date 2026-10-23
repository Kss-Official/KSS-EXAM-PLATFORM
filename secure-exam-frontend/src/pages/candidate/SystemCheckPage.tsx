import { useState, useCallback } from "react";
import { 
  ShieldCheck, 
  ArrowLeft, 
  LockKeyhole, 
  Play, 
  User, 
  Briefcase, 
  Hash, 
  AlertCircle,
  ShieldAlert
} from "lucide-react";
import type { CandidateProfile } from "../../types/candidate";
import BrowserReadinessCheck from "../../components/candidate/BrowserReadinessCheck";
import CameraCheck from "../../components/candidate/CameraCheck";
import MicrophoneCheck from "../../components/candidate/MicrophoneCheck";

interface SystemCheckPageProps {
  profile: CandidateProfile;
  onBack: () => void;
  onStartExam: () => void;
}

export default function SystemCheckPage({
  profile,
  onBack,
  onStartExam
}: SystemCheckPageProps) {
  const [browserReady, setBrowserReady] = useState(true);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [microphoneGranted, setMicrophoneGranted] = useState(false);

  const handleBrowserStatusChange = useCallback((allReady: boolean) => {
    setBrowserReady(allReady);
  }, []);

  const handleCameraPermissionChange = useCallback((granted: boolean) => {
    setCameraGranted(granted);
  }, []);

  const handleMicrophonePermissionChange = useCallback((granted: boolean) => {
    setMicrophoneGranted(granted);
  }, []);

  const canContinueToExam = browserReady && cameraGranted && microphoneGranted;

  return (
    <main className="welcome system-check-view">
      {/* Candidate-only Header */}
      <nav className="nav">
        <div className="brand">
          <div className="logo">
            <ShieldCheck size={22} />
          </div>
          <div>
            <b>ExamSecure</b>
            <small>HARDWARE & SYSTEM READINESS CHECK</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            className="secondary small-btn"
            onClick={onBack}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowLeft size={14} /> Back to Details
          </button>
          <span className="secure">
            <LockKeyhole size={14} /> Local Pre-Flight Check
          </span>
        </div>
      </nav>

      <div className="system-check-container">
        {/* Step Header */}
        <div className="sys-header-block">
          <div className="eyebrow">
            <i /> SYSTEM READINESS & DEVICE PERMISSIONS
          </div>
          <h2>Verify Device Compatibility</h2>
          <p className="sys-subtitle">
            Before entering the timed examination, verify that your browser environment, webcam,
            and microphone satisfy the baseline operational requirements.
          </p>
        </div>

        {/* Section A: Candidate Details Confirmation */}
        <section className="card candidate-summary-card">
          <div className="summary-card-header">
            <strong>Candidate Verification Details</strong>
            <button
              type="button"
              className="text-link-btn"
              onClick={onBack}
              title="Edit candidate profile"
            >
              Edit Details
            </button>
          </div>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">
                <User size={14} /> Full Name
              </span>
              <strong className="detail-value">{profile.name}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-label">
                <Briefcase size={14} /> Selected Department
              </span>
              <strong className="detail-value dept-highlight">{profile.department}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-label">
                <Hash size={14} /> Candidate ID
              </span>
              <strong className="detail-value">{profile.candidateId}</strong>
            </div>
          </div>
        </section>

        {/* Section B: Browser Readiness */}
        <section className="check-section">
          <BrowserReadinessCheck onStatusChange={handleBrowserStatusChange} />
        </section>

        {/* Section C & D: Camera and Microphone Media Checks */}
        <section className="check-section media-checks-grid">
          <CameraCheck onPermissionChange={handleCameraPermissionChange} />
          <MicrophoneCheck onPermissionChange={handleMicrophonePermissionChange} />
        </section>

        {/* Privacy & System Disclaimer Notice */}
        <div className="notice warning sys-disclaimer">
          <ShieldAlert size={18} />
          <div>
            <strong>Frontend Readiness Verification Notice:</strong>
            <p style={{ margin: "3px 0 0" }}>
              This compatibility check verifies local device availability in the browser. It does not
              record video or audio, does not transmit biometric feeds, and is not an automated AI proctoring system.
              Once you click <strong>Continue to Exam</strong>, active media tracks are automatically shut down.
            </p>
          </div>
        </div>

        {/* Launch Barrier / Action Footer */}
        <div className="sys-footer-card card">
          <div className="sys-status-summary">
            <div className="checklist-status">
              <span className={`status-pill ${browserReady ? "done" : "pending"}`}>
                System & OS: {browserReady ? "Compatible" : "Pending"}
              </span>
              <span className={`status-pill ${cameraGranted ? "done" : "pending"}`}>
                Camera: {cameraGranted ? "Granted" : "Required"}
              </span>
              <span className={`status-pill ${microphoneGranted ? "done" : "pending"}`}>
                Microphone: {microphoneGranted ? "Granted" : "Required"}
              </span>
            </div>

            {!canContinueToExam && (
              <p className="sys-pending-hint">
                <AlertCircle size={14} />
                Please enable camera and microphone permissions above to unlock the examination.
              </p>
            )}
          </div>

          <div className="sys-actions">
            <button
              type="button"
              className="secondary"
              onClick={onBack}
            >
              <ArrowLeft size={15} /> Back
            </button>
            <button
              type="button"
              className="primary large-btn"
              disabled={!canContinueToExam}
              onClick={onStartExam}
            >
              <Play size={16} /> Continue to Exam
            </button>
          </div>
        </div>
      </div>

      <footer className="welcomefoot">
        © 2026 ExamSecure · System Compatibility Suite
        <span>
          <ShieldCheck size={14} /> Device Verification
        </span>
      </footer>
    </main>
  );
}
