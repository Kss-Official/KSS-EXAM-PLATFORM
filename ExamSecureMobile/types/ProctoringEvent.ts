export type ProctoringEventType =
  | "FACE_NOT_FOUND"
  | "MULTIPLE_FACES"
  | "HEAD_POSE_VIOLATION"
  | "GAZE_AWAY"
  | "PHONE_DETECTED"
  | "CAMERA_COVERED"
  | "LOW_LIGHT"
  | "BLURRY_FRAME"
  | "PROCTOR_HEALTHY";

export type ProctoringSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ProctoringEvent {
  type: ProctoringEventType;
  severity: ProctoringSeverity;
  confidence: number;
  timestamp: number;
  message: string;
  details?: {
    faceCount?: number;
    yaw?: number;
    pitch?: number;
    roll?: number;
    gazeDirection?: "LEFT" | "RIGHT" | "UP" | "DOWN" | "CENTER";
    phoneConfidence?: number;
    phoneBoundingBox?: BoundingBox;
    luminance?: number;
    blurScore?: number;
  };
}

export interface ProctoringConfig {
  enablePhoneDetection: boolean;
  enableGazeTracking: boolean;
  enableHeadPose: boolean;
  frameRateFps: number;
  yawThresholdDeg: number;
  pitchDownThresholdDeg: number;
  pitchUpThresholdDeg: number;
  minPhoneConfidence: number;
  maxConsecutiveViolations: number;
}

export const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = {
  enablePhoneDetection: true,
  enableGazeTracking: true,
  enableHeadPose: true,
  frameRateFps: 15,
  yawThresholdDeg: 28.0,
  pitchDownThresholdDeg: -22.0,
  pitchUpThresholdDeg: 25.0,
  minPhoneConfidence: 0.65,
  maxConsecutiveViolations: 3,
};
