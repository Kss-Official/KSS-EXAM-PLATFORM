import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Users,
  Activity,
  UserX,
} from "lucide-react";
import { useFaceDetection } from "../../hooks/useFaceDetection";

export default function LiveProctorFeed() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Intelligent multi-scenario face and room monitoring
  const {
    severity,
    badgeLabel,
    warningTitle,
    warningText,
  } = useFaceDetection(videoRef, {
    enabled: isActive,
    intervalMs: 180,
  });

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const initStream = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError("Media devices unsupported");
          return;
        }

        // Keep both camera and microphone active throughout the examination
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: true,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setIsActive(true);

        if (videoRef.current && videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            if (err.name !== "AbortError") {
              console.warn("[LiveProctorFeed] Video play:", err);
            }
          });
        }
      } catch (err) {
        console.warn("[LiveProctorFeed] Failed to acquire media in exam:", err);
        setError("Monitoring active");
      }
    };

    initStream();

    // Clean up all camera and microphone tracks when the exam ends or component unmounts
    return () => {
      isCancelled = true;
      stopTracks();
    };
  }, [stopTracks]);

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("[LiveProctorFeed] Callback ref video play:", err);
        }
      });
    }
  }, []);

  const borderClass =
    severity === "red"
      ? "warning-second-person"
      : severity === "amber"
      ? "warning-room-activity"
      : "";

  return (
    <div className="proctor-tile" title="Live proctoring feed active">
      <div className={`proctor-video-wrap ${borderClass}`}>
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          className="proctor-video"
        />

        {/* Top Overlay Badge */}
        <div className="proctor-overlay-top">
          {severity === "red" ? (
            <span className="proctor-rec-pill alert">
              <AlertTriangle size={10} /> {badgeLabel}
            </span>
          ) : severity === "amber" ? (
            <span className="proctor-rec-pill alert-amber">
              <Activity size={10} /> {badgeLabel}
            </span>
          ) : (
            <span className="proctor-rec-pill">
              <span className="proctor-rec-dot" />{" "}
              {isActive ? "REC · PROCTORED" : "INIT · PROCTORED"}
            </span>
          )}

          <span className="proctor-shield-icon">
            <ShieldCheck size={12} />
          </span>
        </div>

        {/* Bottom Overlay Status */}
        <div className="proctor-overlay-bottom">
          <span className="proctor-mic-status">
            <Mic size={10} />
            <span>MIC ACTIVE</span>
          </span>

          {severity === "red" ? (
            <span className="proctor-alert-tag">
              <Users size={9} /> 2ND PERSON
            </span>
          ) : severity === "amber" ? (
            <span className="proctor-alert-tag amber">
              <Activity size={9} /> ACTIVITY
            </span>
          ) : (
            <span className="proctor-feed-label">CANDIDATE FEED</span>
          )}
        </div>

        {error && (
          <div className="proctor-error-overlay">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Non-distracting, contextual alert banner */}
      {warningText && (
        <div
          className={`proctor-warning-banner ${
            severity === "red" ? "red" : "amber"
          }`}
          role="alert"
        >
          {severity === "red" ? (
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
          ) : badgeLabel.includes("FACE") ? (
            <UserX size={12} style={{ flexShrink: 0 }} />
          ) : (
            <Activity size={12} style={{ flexShrink: 0 }} />
          )}
          <span>
            <strong>{warningTitle}:</strong> {warningText}
          </span>
        </div>
      )}
    </div>
  );
}
