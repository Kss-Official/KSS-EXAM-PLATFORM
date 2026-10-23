import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, CheckCircle2, AlertTriangle, RefreshCw, Volume2 } from "lucide-react";

interface MicrophoneCheckProps {
  onPermissionChange: (granted: boolean) => void;
}

export default function MicrophoneCheck({ onPermissionChange }: MicrophoneCheckProps) {
  const [status, setStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "unsupported">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

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

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("Your browser does not support audio input APIs (getUserMedia).");
      onPermissionChange(false);
      return;
    }

    setStatus("requesting");

    try {
      // Strictly audio-only stream for volume meter; no recording
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        },
        video: false
      });

      streamRef.current = stream;

      // Initialize Web Audio API Analyser for local visual meter only
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        // Calculate average amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();

      setStatus("granted");
      onPermissionChange(true);
    } catch (err: unknown) {
      stopMicrophoneStream();
      setStatus("denied");

      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setErrorMessage("Microphone access was denied. Please allow microphone permissions in browser settings.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setErrorMessage("No microphone device was detected on your computer.");
      } else {
        setErrorMessage(error.message || "Failed to initialize microphone device.");
      }

      onPermissionChange(false);
    }
  };

  const handleManualStop = () => {
    stopMicrophoneStream();
    setStatus("idle");
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
          Verify that your microphone is functioning.
          Click <strong>Enable Microphone</strong> and speak briefly to test the live indicator.
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
                <span className="mic-level-percent">{audioLevel}%</span>
              </div>
              <div className="mic-track">
                <div
                  className="mic-fill"
                  style={{ width: `${Math.max(4, audioLevel)}%` }}
                />
              </div>
              <small className="mic-hint">Speak a few words to confirm microphone pickup</small>
            </div>

            <div className="media-success-bar">
              <span className="success-text">
                <CheckCircle2 size={16} /> Microphone permission granted
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
            <strong>Privacy Guarantee:</strong> Audio data is analyzed purely in local volatile memory
            to render the visual meter. No voice audio is recorded, stored, or streamed to any server.
            All audio tracks are disconnected when starting the exam.
          </small>
        </div>
      </div>
    </div>
  );
}
