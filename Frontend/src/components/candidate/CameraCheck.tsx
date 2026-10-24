import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, CheckCircle2, AlertTriangle, VideoOff, RefreshCw, Eye } from "lucide-react";

interface CameraCheckProps {
  onPermissionChange: (granted: boolean) => void;
}

export default function CameraCheck({ onPermissionChange }: CameraCheckProps) {
  const [status, setStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "unsupported">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup all media tracks when component unmounts
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Hook to connect stream to video element whenever status is granted and element is mounted
  useEffect(() => {
    if (status === "granted" && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch((err) => {
          console.warn("[CameraCheck] Video play warning:", err);
        });
      }
    }
  }, [status]);

  // Callback ref guarantees immediate attachment as soon as the <video> node is mounted into DOM
  const handleVideoRef = useCallback((videoElement: HTMLVideoElement | null) => {
    videoRef.current = videoElement;
    if (videoElement && streamRef.current) {
      videoElement.srcObject = streamRef.current;
      videoElement.play().catch((err) => {
        console.warn("[CameraCheck] Callback ref video play:", err);
      });
    }
  }, []);

  const requestCamera = async () => {
    setErrorMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("unsupported");
      setErrorMessage("Your browser does not support media device APIs (getUserMedia).");
      onPermissionChange(false);
      return;
    }

    setStatus("requesting");

    try {
      // Strictly request video stream locally without recording or persisting
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });

      streamRef.current = stream;

      // Update state to granted, which will mount the <video> element
      setStatus("granted");
      onPermissionChange(true);
    } catch (err: unknown) {
      stopCameraStream();
      setStatus("denied");

      const error = err as Error;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setErrorMessage("Camera access was blocked or denied. Please grant permission in your browser address bar.");
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        setErrorMessage("No video input device found on your system. Please connect a webcam.");
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        setErrorMessage("Camera is currently in use by another application. Please close other software using the camera.");
      } else {
        setErrorMessage(error.message || "Failed to initialize camera device.");
      }

      onPermissionChange(false);
    }
  };

  const handleManualStop = () => {
    stopCameraStream();
    setStatus("idle");
    onPermissionChange(false);
  };

  return (
    <div className="check-card card">
      <div className="check-card-header">
        <div className="check-icon-circle blue">
          <Camera size={18} />
        </div>
        <div>
          <h3 className="check-title">Camera Permission & Visual Check</h3>
          <p className="check-subtitle">Local hardware readiness verification</p>
        </div>
      </div>

      <div className="check-card-content">
        <p className="check-explainer">
          Verify that your webcam is connected and can display a preview in your browser.
          Click <strong>Enable Camera</strong> to initiate the local check.
        </p>

        {status === "idle" && (
          <div className="media-placeholder">
            <Camera size={32} />
            <span>Camera preview inactive. Click below to begin.</span>
            <button
              type="button"
              className="primary"
              onClick={requestCamera}
            >
              <Eye size={15} /> Enable Camera
            </button>
          </div>
        )}

        {status === "requesting" && (
          <div className="media-placeholder">
            <RefreshCw size={28} className="spin-icon" />
            <span>Requesting camera permission from browser...</span>
          </div>
        )}

        {status === "granted" && (
          <div className="camera-preview-container">
            <div className="video-viewport">
              <video
                ref={handleVideoRef}
                autoPlay
                playsInline
                muted
                className="live-video-element"
              />
              <span className="live-indicator">
                <span className="live-dot" /> LIVE PREVIEW
              </span>
            </div>

            <div className="media-success-bar">
              <span className="success-text">
                <CheckCircle2 size={16} /> Camera permission granted & working
              </span>
              <button
                type="button"
                className="secondary small-btn"
                onClick={handleManualStop}
              >
                <VideoOff size={14} /> Stop Preview
              </button>
            </div>
          </div>
        )}

        {(status === "denied" || status === "unsupported") && (
          <div className="media-error-box">
            <AlertTriangle size={20} />
            <div className="media-error-text">
              <strong>Camera check failed</strong>
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              className="secondary small-btn"
              onClick={requestCamera}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        <div className="privacy-badge">
          <small>
            <strong>Privacy Guarantee:</strong> Camera access is used exclusively for this local
            device readiness check. Video is never recorded, captured, or transmitted to any server.
            All streams are terminated when moving to the examination.
          </small>
        </div>
      </div>
    </div>
  );
}
