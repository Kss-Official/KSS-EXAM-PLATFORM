import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
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
  const [hasMic, setHasMic] = useState(false);
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
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const acquireStream = async (retryOnBusy = true): Promise<void> => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Camera unsupported");
        return;
      }

      let stream: MediaStream | null = null;
      let audioTrackActive = false;

      // Tier 1: Try high-quality video + audio
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: true,
        });
        audioTrackActive = stream.getAudioTracks().length > 0;
      } catch (err1: unknown) {
        const error1 = err1 as Error;

        // If hardware is busy (e.g. just unmounted from SystemCheckPage), pause 300ms and retry
        if (
          retryOnBusy &&
          (error1.name === "NotReadableError" || error1.name === "TrackStartError")
        ) {
          console.warn("[LiveProctorFeed] Camera busy, retrying in 300ms...");
          retryTimeout = setTimeout(() => {
            if (!isCancelled) void acquireStream(false);
          }, 300);
          return;
        }

        // Tier 2: Try video only (in case audio permission was denied or mic unavailable)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user",
            },
            audio: false,
          });
        } catch {
          // Tier 3: Bare minimum video constraints fallback
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (err3) {
            console.warn("[LiveProctorFeed] All camera acquisition tiers failed:", err3);
            if (!isCancelled) {
              const error3 = err3 as Error;
              if (error3.name === "NotAllowedError" || error3.name === "PermissionDeniedError") {
                setError("Camera permission denied");
              } else if (error3.name === "NotFoundError") {
                setError("No camera detected");
              } else {
                setError("Camera unavailable");
              }
            }
            return;
          }
        }
      }

      if (isCancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setHasMic(audioTrackActive);
      setIsActive(true);
      setError(null);

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.defaultMuted = true;
        videoRef.current.playsInline = true;
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          if (err.name !== "AbortError") {
            console.warn("[LiveProctorFeed] Video play:", err);
          }
        });
      }
    };

    acquireStream();

    return () => {
      isCancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      stopTracks();
    };
  }, [stopTracks]);

  // Callback ref guarantees immediate stream attachment when DOM node mounts
  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.muted = true;
      node.defaultMuted = true;
      node.playsInline = true;
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
            {hasMic ? (
              <>
                <Mic size={10} />
                <span>MIC ACTIVE</span>
              </>
            ) : (
              <>
                <MicOff size={10} color="#94a3b8" />
                <span style={{ color: "#94a3b8" }}>MIC OFF</span>
              </>
            )}
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
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          ) : badgeLabel.includes("FACE") ? (
            <UserX size={14} style={{ flexShrink: 0 }} />
          ) : (
            <Activity size={14} style={{ flexShrink: 0 }} />
          )}
          <div className="proctor-warning-content">
            <strong>{warningTitle}</strong>
            <span>{warningText}</span>
          </div>
        </div>
      )}
    </div>
  );
}
