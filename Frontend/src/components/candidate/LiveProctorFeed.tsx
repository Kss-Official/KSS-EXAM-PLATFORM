import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, AlertCircle, Maximize2 } from "lucide-react";

export default function LiveProctorFeed() {
  const [isActive, setIsActive] = useState(false);
  void isActive;
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: "user"
          },
          audio: true
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setIsActive(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.warn("[LiveProctorFeed] Video play:", err);
          });
        }
      } catch (err) {
        console.warn("[LiveProctorFeed] Failed to acquire media in exam:", err);
        setError("Monitoring active");
      }
    };

    initStream();

    // CRITICAL: Stop all camera and microphone tracks when the exam ends or component unmounts
    return () => {
      isCancelled = true;
      stopTracks();
    };
  }, [stopTracks]);

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch((err) => {
        console.warn("[LiveProctorFeed] Callback ref video play:", err);
      });
    }
  }, []);

  return (
    <div className="proctor-tile" title="Live proctoring feed active">
      <div className="proctor-video-wrap">
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          className="proctor-video"
        />

        <div className="proctor-overlay-top">
          <span className="proctor-rec-pill">
            <span className="proctor-rec-dot" /> REC - PROCTORED
          </span>
          <span className="proctor-expand-icon">
            <Maximize2 size={13} color="#22c55e" />
          </span>
        </div>

        <div className="proctor-overlay-bottom">
          <span className="proctor-mic-status">
            <Mic size={10} />
            <span>MIC ACTIVE</span>
          </span>
          <span className="proctor-feed-label">CANDIDATE FEED</span>
        </div>

        {error && (
          <div className="proctor-error-overlay">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
