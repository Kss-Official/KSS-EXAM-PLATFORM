import { useState, useEffect, useRef } from "react";
import {
  detectFacesInVideo,
  getMediaPipeDetector,
  loadPicoDetector,
  type DetectedFace,
  type ProctorScenario,
} from "../utils/faceDetector";

interface UseFaceDetectionOptions {
  enabled?: boolean;
  intervalMs?: number;
}

export interface UseFaceDetectionResult {
  faceCount: number;
  scenario: ProctorScenario;
  severity: "normal" | "amber" | "red";
  hasSecondPerson: boolean;
  hasNoPerson: boolean;
  badgeLabel: string;
  warningTitle: string;
  warningText: string | null;
  faces: DetectedFace[];
  isModelReady: boolean;
}

/**
 * Intelligent Multi-Scenario React Hook for Candidate Proctoring.
 *
 * Categorizes and debounces room states to deliver clear, meaningful warnings:
 *  - 2nd person moving -> Red warning "PERSON IN MOTION"
 *  - 2nd person present -> Red warning "2+ PEOPLE IN VIEW"
 *  - Unwanted room movement -> Amber warning "ROOM ACTIVITY"
 *  - Candidate missing -> Amber warning "FACE NOT DETECTED"
 *  - Alone & still -> Normal green/clean status
 */
export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseFaceDetectionOptions = {}
): UseFaceDetectionResult {
  const { enabled = true, intervalMs = 180 } = options;

  const [faceCount, setFaceCount] = useState<number>(1);
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [scenario, setScenario] = useState<ProctorScenario>("OPTIMAL_ALONE");
  const [severity, setSeverity] = useState<"normal" | "amber" | "red">("normal");
  const [badgeLabel, setBadgeLabel] = useState<string>("REC · PROCTORED");
  const [warningTitle, setWarningTitle] = useState<string>("Optimal Framing");
  const [warningText, setWarningText] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState<boolean>(false);

  // Consecutive counters for robust temporal stability
  const multiMovingStreak = useRef<number>(0);
  const multiPresentStreak = useRef<number>(0);
  const unwantedMotionStreak = useRef<number>(0);
  const noCandidateStreak = useRef<number>(0);
  const optimalStreak = useRef<number>(0);

  // Pre-load MediaPipe BlazeFace and Pico fallback in parallel
  useEffect(() => {
    let mounted = true;
    Promise.all([getMediaPipeDetector(), loadPicoDetector()])
      .then(() => {
        if (mounted) setIsModelReady(true);
      })
      .catch((err) => {
        console.warn("[useFaceDetection] Preload warning:", err);
        if (mounted) setIsModelReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setScenario("OPTIMAL_ALONE");
      setSeverity("normal");
      setBadgeLabel("REC · PROCTORED");
      setWarningTitle("Optimal Framing");
      setWarningText(null);
      return;
    }

    const timer = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended || video.readyState < 2) {
        return;
      }

      try {
        const result = await detectFacesInVideo(video);
        setFaceCount(result.count);
        setFaces(result.faces);

        const currentScenario = result.scenario;

        // --- Scenario 1: 2nd Person Moving ---
        if (currentScenario === "SECOND_PERSON_MOVING") {
          multiMovingStreak.current += 1;
          multiPresentStreak.current = 0;
          unwantedMotionStreak.current = 0;
          noCandidateStreak.current = 0;
          optimalStreak.current = 0;

          // Responsive detection (2 consecutive frames ~360ms)
          if (multiMovingStreak.current >= 2) {
            setScenario("SECOND_PERSON_MOVING");
            setSeverity("red");
            setBadgeLabel("PERSON IN MOTION");
            setWarningTitle("2nd Person Moving in Room");
            setWarningText(
              "Active movement from a 2nd person detected. Only the candidate may be present in the examination area."
            );
          }
        }

        // --- Scenario 2: 2nd Person Present (Standing / Seated) ---
        else if (currentScenario === "SECOND_PERSON_PRESENT") {
          multiPresentStreak.current += 1;
          multiMovingStreak.current = 0;
          unwantedMotionStreak.current = 0;
          noCandidateStreak.current = 0;
          optimalStreak.current = 0;

          // Responsive detection (2 consecutive frames ~360ms)
          if (multiPresentStreak.current >= 2) {
            setScenario("SECOND_PERSON_PRESENT");
            setSeverity("red");
            setBadgeLabel(`${result.count} PEOPLE IN VIEW`);
            setWarningTitle("2nd Person in Camera View");
            setWarningText(
              `Multiple people detected (${result.count} visible). Please ensure you are alone in the room.`
            );
          }
        }

        // --- Scenario 3: Unwanted Movement in Background (1 Person Seated) ---
        else if (currentScenario === "UNWANTED_ROOM_MOVEMENT") {
          unwantedMotionStreak.current += 1;
          multiMovingStreak.current = 0;
          multiPresentStreak.current = 0;
          noCandidateStreak.current = 0;
          optimalStreak.current = 0;

          if (unwantedMotionStreak.current >= 2) {
            setScenario("UNWANTED_ROOM_MOVEMENT");
            setSeverity("amber");
            setBadgeLabel("ROOM ACTIVITY");
            setWarningTitle("Unwanted Background Movement");
            setWarningText(
              "Significant background activity detected behind you. Please maintain a quiet and still environment."
            );
          }
        }

        // --- Scenario 4: No Candidate in Frame ---
        else if (currentScenario === "NO_CANDIDATE") {
          noCandidateStreak.current += 1;
          multiMovingStreak.current = 0;
          multiPresentStreak.current = 0;
          unwantedMotionStreak.current = 0;
          optimalStreak.current = 0;

          // Responsive missing candidate: 3 consecutive frames (~540ms)
          if (noCandidateStreak.current >= 3) {
            setScenario("NO_CANDIDATE");
            setSeverity("amber");
            setBadgeLabel("FACE NOT DETECTED");
            setWarningTitle("Candidate Missing");
            setWarningText(
              "Looking for candidate face. Please remain seated directly facing the camera."
            );
          }
        }

        // --- Scenario 5: Optimal Alone (Candidate Seated Alone, Quiet Room) ---
        else {
          optimalStreak.current += 1;
          multiMovingStreak.current = 0;
          multiPresentStreak.current = 0;
          unwantedMotionStreak.current = 0;
          noCandidateStreak.current = 0;

          // Require 6 consecutive clean frames (~1.1s) before clearing an active warning
          // This prevents warnings from flickering or disappearing on a single frame glitch
          if (optimalStreak.current >= 6) {
            setScenario("OPTIMAL_ALONE");
            setSeverity("normal");
            setBadgeLabel("REC · PROCTORED");
            setWarningTitle("Optimal Framing");
            setWarningText(null);
          }
        }
      } catch (err) {
        console.warn("[useFaceDetection] Processing cycle warning:", err);
      }
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [enabled, intervalMs, videoRef]);

  const hasSecondPerson =
    scenario === "SECOND_PERSON_MOVING" || scenario === "SECOND_PERSON_PRESENT";
  const hasNoPerson = scenario === "NO_CANDIDATE";

  return {
    faceCount,
    scenario,
    severity,
    hasSecondPerson,
    hasNoPerson,
    badgeLabel,
    warningTitle,
    warningText,
    faces,
    isModelReady,
  };
}

if (import.meta.hot) {
  import.meta.hot.invalidate();
}
