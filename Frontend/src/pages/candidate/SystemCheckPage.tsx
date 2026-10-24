import { useState, useRef, useEffect, useCallback } from "react";
import { 
  FileText,
  User, 
  Building2, 
  CreditCard,
  Laptop,
  RotateCw,
  Monitor,
  Globe,
  Wifi,
  Camera,
  Mic,
  Check,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  LockKeyhole,
  Video,
  Menu
} from "lucide-react";
import type { CandidateProfile } from "../../types/candidate";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";

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
  // System detection states
  const [osName, setOsName] = useState("Windows 11 / 10 (64-bit)");
  const [browserName, setBrowserName] = useState("Google Chrome");
  const [screenRes, setScreenRes] = useState("1920 ├ù 1080 px");
  const [netStatus, setNetStatus] = useState("High Speed Broadband");
  const [isRechecking, setIsRechecking] = useState(false);
  void osName; void browserName; void screenRes; void netStatus;

  // Media permission states
  const [cameraStatus, setCameraStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [microphoneStatus, setMicrophoneStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Instructions agreement checkbox
  const [rulesAgreed, setRulesAgreed] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // System environment detection
  const runDetection = useCallback(() => {
    setIsRechecking(true);
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent;
      // OS
      if (/Windows NT 10.0/i.test(ua)) setOsName("Windows 11 / 10 (64-bit)");
      else if (/Macintosh|Mac OS X/i.test(ua)) setOsName("macOS (Apple Silicon / Intel)");
      else if (/Linux/i.test(ua)) setOsName("Linux (64-bit)");
      else if (/CrOS/i.test(ua)) setOsName("ChromeOS");

      // Browser
      if (/Edg\//i.test(ua)) setBrowserName("Microsoft Edge");
      else if (/Chrome\//i.test(ua)) setBrowserName("Google Chrome");
      else if (/Firefox\//i.test(ua)) setBrowserName("Mozilla Firefox");
      else if (/Safari\//i.test(ua)) setBrowserName("Apple Safari");

      // Resolution
      const w = window.screen.width || window.innerWidth;
      const h = window.screen.height || window.innerHeight;
      setScreenRes(`${w} ├ù ${h} px`);

      // Network
      setNetStatus(navigator.onLine ? "High Speed Broadband" : "Offline");
    }
    setTimeout(() => {
      setIsRechecking(false);
    }, 600);
  }, []);

  useEffect(() => {
    runDetection();
  }, [runDetection]);

  // Clean up streams on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Handle Camera Permission Request
  const handleEnableCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus("denied");
      setCameraError("Browser does not support camera media devices.");
      return;
    }
    setCameraStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false
      });
      cameraStreamRef.current = stream;
      setCameraStatus("granted");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn(e));
      }
    } catch (e: unknown) {
      setCameraStatus("denied");
      const err = e as Error;
      setCameraError(err.message || "Camera access was denied or device not found.");
    }
  };

  // Re-attach video stream when video element renders
  useEffect(() => {
    if (cameraStatus === "granted" && videoRef.current && cameraStreamRef.current) {
      if (videoRef.current.srcObject !== cameraStreamRef.current) {
        videoRef.current.srcObject = cameraStreamRef.current;
        videoRef.current.play().catch(e => console.warn(e));
      }
    }
  }, [cameraStatus]);

  // Handle Microphone Permission Request
  const handleEnableMicrophone = async () => {
    setMicrophoneError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicrophoneStatus("denied");
      setMicrophoneError("Browser does not support microphone media devices.");
      return;
    }
    setMicrophoneStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false
      });
      micStreamRef.current = stream;
      setMicrophoneStatus("granted");

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (e: unknown) {
      setMicrophoneStatus("denied");
      const err = e as Error;
      setMicrophoneError(err.message || "Microphone access was denied or device not found.");
    }
  };

  const isCameraGranted = cameraStatus === "granted";
  const isMicrophoneGranted = microphoneStatus === "granted";
  const canContinueToExam = isCameraGranted && isMicrophoneGranted && rulesAgreed;

  return (
    <main className="welcome system-check-view">
      {/* Top Navbar */}
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
            <LockKeyhole size={14} /> Secure Candidate Session
          </span>
        </div>
      </nav>

      {/* Main Container */}
      <div className="compat-page-wrapper">
        {/* Centered Heading */}
        <div className="compat-header">
          <span className="compat-eyebrow">
            SYSTEM READINESS & DEVICE VERIFICATION
          </span>
          <h1 className="compat-title">
            Verify Device <span className="compat-accent">Compatibility</span>
          </h1>
          <p className="compat-subtitle">
            Before starting the timed assessment, verify that your browser environment, webcam, and
            microphone satisfy the required operational requirements.
          </p>
        </div>

        {/* Card 1: Candidate Verification Details */}
        <section className="compat-card">
          <div className="compat-card-title-row">
            <div className="compat-card-icon-title">
              <span className="compat-icon-badge green">
                <FileText size={16} />
              </span>
              <h3>Candidate Verification Details</h3>
            </div>
          </div>

          <div className="compat-candidate-row">
            <div className="compat-candidate-col">
              <span className="compat-col-icon">
                <User size={15} />
              </span>
              <div>
                <small>Candidate Name</small>
                <strong>{profile.name || "Jyothna Priyadarshini Roul"}</strong>
              </div>
            </div>

            <div className="compat-candidate-col">
              <span className="compat-col-icon">
                <Building2 size={15} />
              </span>
              <div>
                <small>Department</small>
                <strong>{profile.department || "Management"}</strong>
              </div>
            </div>

            <div className="compat-candidate-col">
              <span className="compat-col-icon">
                <CreditCard size={15} />
              </span>
              <div>
                <small>Candidate ID</small>
                <strong>{profile.candidateId || "CAND-012-09"}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Card 2: Browser & System Compatibility */}
        <section className="compat-card">
          <div className="compat-card-title-row space-between">
            <div className="compat-card-icon-title">
              <span className="compat-icon-badge green">
                <Laptop size={16} />
              </span>
              <div>
                <h3>Browser & System Compatibility</h3>
                <p className="compat-card-desc">We'll check your system configuration for a seamless experience.</p>
              </div>
            </div>
            <button 
              type="button" 
              className="compat-recheck-btn" 
              onClick={runDetection}
              disabled={isRechecking}
            >
              <RotateCw size={14} className={isRechecking ? "animate-spin" : ""} />
              Re-check System
            </button>
          </div>

          <div className="compat-section-two-rows">
            {/* Row 1: Operating System & Web Browser aligned with Camera Permission */}
            <div className="compat-aligned-row">
              <div className="compat-left-cards-pair">
                {/* Box 1: Operating System */}
                <div className="compat-system-box">
                  <div>
                    <div className="compat-box-top-icon">
                      <Monitor size={20} color="#017846" />
                    </div>
                    <strong className="compat-box-name">Operating System</strong>
                    <p className="compat-box-desc">Check if your device OS is supported.</p>
                  </div>
                  <div>
                    <span className="compat-status-badge-green">
                      <Check size={12} strokeWidth={3} /> Compatible
                    </span>
                  </div>
                </div>

                {/* Box 2: Web Browser */}
                <div className="compat-system-box">
                  <div>
                    <div className="compat-box-top-icon">
                      <Globe size={20} color="#017846" />
                    </div>
                    <strong className="compat-box-name">Web Browser</strong>
                    <p className="compat-box-desc">Check if your browser version is supported.</p>
                  </div>
                  <div>
                    <span className="compat-status-badge-green">
                      <Check size={12} strokeWidth={3} /> Supported
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Camera Permission Card */}
              <div className="compat-media-card-aligned">
                <div className="compat-perm-header">
                  <div className="compat-perm-title-group">
                    <span className="compat-perm-icon-sq">
                      <Camera size={16} color="#3b82f6" />
                    </span>
                    <div>
                      <strong>Camera Permission</strong>
                      <small>Enable camera to verify your identity.</small>
                    </div>
                  </div>
                  <span className={`compat-req-pill ${isCameraGranted ? "granted" : "required"}`}>
                    {isCameraGranted ? "GRANTED" : "REQUIRED"}
                  </span>
                </div>

                <div className="compat-perm-inner-box">
                  {isCameraGranted ? (
                    <div className="compat-media-live-preview">
                      <video ref={videoRef} autoPlay playsInline muted className="compat-video-feed" />
                      <div className="compat-live-status-tag">
                        <span className="compat-dot-pulse" /> Camera Active
                      </div>
                    </div>
                  ) : (
                    <div className="compat-perm-empty-state">
                      <span className="compat-big-icon-circle">
                        <Camera size={22} color="#64748b" />
                      </span>
                      <strong className="compat-box-title">Camera access is required</strong>
                      <p className="compat-box-sub">Click the button below to allow camera access.</p>
                      
                      {cameraError && (
                        <div className="compat-error-msg">{cameraError}</div>
                      )}

                      <button 
                        type="button" 
                        className="compat-enable-btn"
                        onClick={handleEnableCamera}
                        disabled={cameraStatus === "requesting"}
                      >
                        <Video size={15} /> 
                        {cameraStatus === "requesting" ? "Requesting..." : "Enable Camera"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Screen Resolution & Network aligned with Microphone Permission */}
            <div className="compat-aligned-row">
              <div className="compat-left-cards-pair">
                {/* Box 3: Screen Resolution */}
                <div className="compat-system-box">
                  <div>
                    <div className="compat-box-top-icon">
                      <Menu size={20} color="#017846" />
                    </div>
                    <strong className="compat-box-name">Screen Resolution</strong>
                    <p className="compat-box-desc">Ensure minimum resolution is met.</p>
                  </div>
                  <div>
                    <span className="compat-status-badge-green">
                      <Check size={12} strokeWidth={3} /> Optimal
                    </span>
                  </div>
                </div>

                {/* Box 4: Network & Internet */}
                <div className="compat-system-box">
                  <div>
                    <div className="compat-box-top-icon">
                      <Wifi size={20} color="#017846" />
                    </div>
                    <strong className="compat-box-name">Network & Internet</strong>
                    <p className="compat-box-desc">Check your internet connection stability.</p>
                  </div>
                  <div>
                    <span className="compat-status-badge-green">
                      <Check size={12} strokeWidth={3} /> Stable
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Microphone Permission Card */}
              <div className="compat-media-card-aligned">
                <div className="compat-perm-header">
                  <div className="compat-perm-title-group">
                    <span className="compat-perm-icon-sq">
                      <Mic size={16} color="#3b82f6" />
                    </span>
                    <div>
                      <strong>Microphone Permission</strong>
                      <small>Enable microphone to check audio input.</small>
                    </div>
                  </div>
                  <span className={`compat-req-pill ${isMicrophoneGranted ? "granted" : "required"}`}>
                    {isMicrophoneGranted ? "GRANTED" : "REQUIRED"}
                  </span>
                </div>

                <div className="compat-perm-inner-box">
                  {isMicrophoneGranted ? (
                    <div className="compat-mic-live-preview">
                      <div className="compat-mic-active-badge">
                        <CheckCircle2 size={16} color="#16a34a" /> Microphone Active & Verified
                      </div>
                      <div className="compat-audio-meter-wrap">
                        <small>Live Audio Input Level:</small>
                        <div className="compat-audio-track">
                          <div 
                            className="compat-audio-fill" 
                            style={{ width: `${Math.max(8, audioLevel)}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="compat-perm-empty-state">
                      <span className="compat-big-icon-circle">
                        <Mic size={22} color="#64748b" />
                      </span>
                      <strong className="compat-box-title">Microphone access is required</strong>
                      <p className="compat-box-sub">Click the button below to allow microphone access.</p>
                      
                      {microphoneError && (
                        <div className="compat-error-msg">{microphoneError}</div>
                      )}

                      <button 
                        type="button" 
                        className="compat-enable-btn"
                        onClick={handleEnableMicrophone}
                        disabled={microphoneStatus === "requesting"}
                      >
                        <Mic size={15} /> 
                        {microphoneStatus === "requesting" ? "Requesting..." : "Enable Microphone"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Card 3: Important Instructions for Candidates */}
        <section className="compat-card">
          <div className="compat-card-title-row space-between">
            <div className="compat-card-icon-title">
              <span className="compat-icon-badge green">
                <ShieldCheck size={16} />
              </span>
              <div>
                <h3>Important Instructions for Candidates</h3>
                <p className="compat-card-desc">Please read and follow the guidelines below before proceeding.</p>
              </div>
            </div>
            <div className="compat-banner-badge">
              <ShieldCheck size={13} />
              <span>These rules ensure a fair, secure and smooth examination process.</span>
            </div>
          </div>

          <div className="compat-rules-grid">
            <div className="compat-rule-item">
              <span className="compat-rule-num">1</span>
              <div>
                <strong>Use a desktop or laptop</strong>
                <p>The exam can only be taken on a desktop or laptop. Mobile phones and tablets are not allowed.</p>
              </div>
            </div>

            <div className="compat-rule-item">
              <span className="compat-rule-num">5</span>
              <div>
                <strong>Do not switch tabs or applications</strong>
                <p>Leaving the exam window may lead to automatic termination of your attempt.</p>
              </div>
            </div>

            <div className="compat-rule-item">
              <span className="compat-rule-num">2</span>
              <div>
                <strong>Ensure a stable internet connection</strong>
                <p>A stable and uninterrupted internet connection is required throughout the exam.</p>
              </div>
            </div>

            <div className="compat-rule-item">
              <span className="compat-rule-num">6</span>
              <div>
                <strong>No external help or unfair means</strong>
                <p>Do not use any external devices, resources, or seek help from others.</p>
              </div>
            </div>

            <div className="compat-rule-item">
              <span className="compat-rule-num">3</span>
              <div>
                <strong>Allow camera and microphone access</strong>
                <p>You must enable both camera and microphone permissions when prompted.</p>
              </div>
            </div>

            <div className="compat-rule-item">
              <span className="compat-rule-num">7</span>
              <div>
                <strong>Keep your face visible throughout the exam</strong>
                <p>Your face must be clearly visible to ensure continuous proctoring.</p>
              </div>
            </div>

            <div className="compat-rule-item">
              <span className="compat-rule-num">4</span>
              <div>
                <strong>Stay in a well-lit and quiet environment</strong>
                <p>Ensure proper lighting and a noise-free surrounding during the exam.</p>
              </div>
            </div>

            <div className="compat-rule-item">
              <span className="compat-rule-num">8</span>
              <div>
                <strong>Follow all on-screen instructions</strong>
                <p>Read and follow the instructions shown during the exam carefully.</p>
              </div>
            </div>
          </div>

          {/* Rules agreement checkbox container */}
          <div className="compat-checkbox-container">
            <input 
              type="checkbox" 
              id="rules-agree-check"
              checked={rulesAgreed}
              onChange={(e) => setRulesAgreed(e.target.checked)}
              className="compat-custom-checkbox"
            />
            <label htmlFor="rules-agree-check" className="compat-checkbox-label">
              I have read and understood all the above instructions. I agree to follow the rules and guidelines during the exam.
            </label>
          </div>
        </section>

        {/* Card 4: Proctored Assessment Verification Notice */}
        <div className="compat-warning-callout">
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Proctored Assessment Verification Notice</strong>
            <p>
              This assessment is proctored. Camera and microphone checks are required during the exam. Please ensure both permissions remain enabled throughout the assessment. Disabling them may lead to termination of the exam.
            </p>
          </div>
        </div>

        {/* Card 5: Bottom Action Footer Bar */}
        <div className="compat-footer-bar">
          <div className="compat-footer-status-pills">
            <span className="compat-pill-badge green">
              <Check size={13} strokeWidth={3} /> SYSTEM: 4/4 COMPATIBLE
            </span>

            <span className={`compat-pill-badge ${isCameraGranted ? "green" : "amber"}`}>
              <Camera size={13} /> CAMERA: {isCameraGranted ? "GRANTED" : "REQUIRED"}
            </span>

            <span className={`compat-pill-badge ${isMicrophoneGranted ? "green" : "amber"}`}>
              <Mic size={13} /> MICROPHONE: {isMicrophoneGranted ? "GRANTED" : "REQUIRED"}
            </span>
          </div>

          <div className="compat-footer-actions">
            <button
              type="button"
              className="compat-btn-back"
              onClick={onBack}
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="button"
              className="compat-btn-continue"
              disabled={!canContinueToExam}
              onClick={onStartExam}
              title={!canContinueToExam ? "Please enable camera, microphone, and agree to instructions to proceed" : "Start your examination"}
            >
              Continue to Exam
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
