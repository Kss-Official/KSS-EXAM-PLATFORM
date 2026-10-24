import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Volume2,
  Activity,
} from "lucide-react";

interface MicrophoneCheckProps {
  onPermissionChange: (granted: boolean) => void;
}

export default function MicrophoneCheck({ onPermissionChange }: MicrophoneCheckProps) {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unsupported"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [hasDetectedVoice, setHasDetectedVoice] = useState<boolean>(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopMicrophoneStream = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMicrophoneStream();
    };
  }, [stopMicrophoneStream]);

  const requestMicrophone = async () => {
    setErrorMessage(null);
    setHasDetectedVoice(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("Your browser does not support audio input APIs (getUserMedia).");
      onPermissionChange(false);
      return;
    }

    setStatus("requesting");

    try {
      // Audio stream with standard noise suppression and echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      streamRef.current = stream;

      // Initialize Web Audio API Analyser
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      // Crucial browser fix: Resume context if browser created it in 'suspended' state
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyser) return;

        // Use RMS (Root Mean Square) time-domain sound pressure
        analyser.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const norm = (dataArray[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // Perceptually weighted volume level (0 to 100%)
        const normalized = Math.min(100, Math.round(Math.pow(rms, 0.65) * 180));
        setAudioLevel(normalized);

        if (normalized >= 15) {
          setHasDetectedVoice(true);
        }

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();

      setStatus("granted");
      onPermissionChange(true);
    } catch (err: unknown) {
      stopMicrophoneStream();
      setStatus("denied");

      const error = err as Error;
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setErrorMessage(
          "Microphone access was denied. Please allow microphone permissions in browser settings."
        );
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        setErrorMessage(
          "No microphone hardware was detected on your computer. Please connect an audio input device."
        );
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        setErrorMessage(
          "Microphone is currently locked or in use by another application."
        );
      } else {
        setErrorMessage(error.message || "Failed to initialize microphone device.");
      }

      onPermissionChange(false);
    }
  };

  const handleManualStop = () => {
    stopMicrophoneStream();
    setStatus("idle");
    setHasDetectedVoice(false);
    onPermissionChange(false);
  };

  return (
    <div className="check-card card">
      <div className="check-card-header">
        <div className="check-icon-circle blue">
          <Mic size={18} />
        </div>
        <div>
          <h3 className="check-title">Microphone Permission & Sound Level</h3>
          <p className="check-subtitle">Local audio capture hardware check</p>
        </div>
      </div>

      <div className="check-card-content">
        <p className="check-explainer">
          Verify that your microphone is functioning. Click <strong>Enable Microphone</strong>{" "}
          and speak briefly to test the live indicator.
        </p>

        {status === "idle" && (
          <div className="media-placeholder">
            <Mic size={32} />
            <span>Microphone test inactive. Click below to start.</span>
            <button
              type="button"
              className="primary"
              onClick={requestMicrophone}
            >
              <Volume2 size={15} /> Enable Microphone
            </button>
          </div>
        )}

        {status === "requesting" && (
          <div className="media-placeholder">
            <RefreshCw size={28} className="spin-icon" />
            <span>Requesting microphone permission from browser...</span>
          </div>
        )}

        {status === "granted" && (
          <div className="mic-active-container">
            <div className="mic-visualizer-box">
              <div className="mic-visualizer-header">
                <span className="mic-label">
                  <Mic size={16} /> Live Voice Activity
                </span>
                <span
                  className="mic-level-percent"
                  style={{
                    color: audioLevel > 15 ? "#22c55e" : "#94a3b8",
                  }}
                >
                  {audioLevel}%
                </span>
              </div>

              <div className="mic-track">
                <div
                  className="mic-fill"
                  style={{
                    width: `${Math.max(4, audioLevel)}%`,
                    background:
                      audioLevel > 60
                        ? "linear-gradient(90deg, #38bdf8, #22c55e, #eab308)"
                        : "linear-gradient(90deg, #38bdf8, #22c55e)",
                  }}
                />
              </div>

              {/* Dynamic Voice Feedback Pill */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "8px",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  color: hasDetectedVoice ? "#15803d" : "#64748b",
                }}
              >
                {hasDetectedVoice ? (
                  <>
                    <Activity size={13} color="#22c55e" />
                    <span>Voice activity confirmed · Microphone is working clearly</span>
                  </>
                ) : (
                  <>
                    <Mic size={13} color="#94a3b8" />
                    <span>Waiting for speech... Speak a few words into your mic</span>
                  </>
                )}
              </div>
            </div>

            <div className="media-success-bar">
              <span className="success-text">
                <CheckCircle2 size={16} /> Microphone permission granted & active
              </span>
              <button
                type="button"
                className="secondary small-btn"
                onClick={handleManualStop}
              >
                <MicOff size={14} /> Stop Microphone
              </button>
            </div>
          </div>
        )}

        {(status === "denied" || status === "unsupported") && (
          <div className="media-error-box">
            <AlertTriangle size={20} />
            <div className="media-error-text">
              <strong>Microphone check failed</strong>
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              className="secondary small-btn"
              onClick={requestMicrophone}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        <div className="privacy-badge">
          <small>
            <strong>Privacy Guarantee:</strong> Audio data is analyzed purely in local volatile
            memory to render the visual meter. No voice audio is recorded, stored, or streamed to
            any server.
          </small>
        </div>
      </div>
    </div>
  );
}
