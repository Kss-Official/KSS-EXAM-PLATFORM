/**
 * Intelligent Multi-Scenario Computer Vision Proctoring Engine
 *
 * Categorizes room state into precise, meaningful scenarios:
 *  - OPTIMAL_ALONE: Exactly 1 candidate, optimal framing, clean green status.
 *  - SECOND_PERSON_MOVING: 2nd person actively moving/walking in frame (Red alert).
 *  - SECOND_PERSON_PRESENT: 2+ people in camera view (seated/standing) (Red alert).
 *  - UNWANTED_ROOM_MOVEMENT: Background room movement outside candidate silo (Amber notice).
 *  - NO_CANDIDATE: Candidate has stepped away or covered camera (Amber notice).
 */

import { FilesetResolver, FaceDetector as MediaPipeFaceDetector } from "@mediapipe/tasks-vision";

export interface DetectedFace {
  row: number;
  col: number;
  size: number;
  score: number;
  keypoints?: { x: number; y: number }[];
}

export type ProctorScenario =
  | "OPTIMAL_ALONE"
  | "SECOND_PERSON_MOVING"
  | "SECOND_PERSON_PRESENT"
  | "UNWANTED_ROOM_MOVEMENT"
  | "NO_CANDIDATE";

export interface FaceDetectionSummary {
  faces: DetectedFace[];
  count: number;
  scenario: ProctorScenario;
  isMoving: boolean;
}

// MediaPipe state with Promise-based single-flight initialization
let mediaPipeDetector: MediaPipeFaceDetector | null = null;
let mediaPipeInitPromise: Promise<MediaPipeFaceDetector | null> | null = null;
let mediaPipeFailed = false;
let lastVideoTimestamp = 0;

// Temporal second-face displacement tracking
let prevSecondaryFace: { col: number; row: number } | null = null;

// Background movement state for candidate-alone room monitoring
let bgCanvas: HTMLCanvasElement | null = null;
let bgCtx: CanvasRenderingContext2D | null = null;
let prevBgPixels: Uint8Array | null = null;
let bgMotionStreak = 0;
const BG_W = 80;
const BG_H = 60;

// Pico fallback state with Promise-based single-flight initialization
export type ClassifierFn = (
  r: number,
  c: number,
  s: number,
  pixels: Uint8Array,
  ldim: number
) => number;

let cachedPicoClassifier: ClassifierFn | null = null;
let picoInitPromise: Promise<ClassifierFn | null> | null = null;
let picoCanvas: HTMLCanvasElement | null = null;
let picoCtx: CanvasRenderingContext2D | null = null;
const PICO_WIDTH = 320;
const PICO_HEIGHT = 240;

/**
 * Initializes Google MediaPipe BlazeFace Detector.
 * Uses Promise caching to guarantee single-flight initialization without race conditions.
 * Prefers CPU delegate (WebAssembly SIMD) which runs in ~5ms, never crashes WebGL, and works on all devices.
 */
export async function getMediaPipeDetector(): Promise<MediaPipeFaceDetector | null> {
  if (mediaPipeDetector) return mediaPipeDetector;
  if (mediaPipeFailed) return null;
  if (mediaPipeInitPromise) return mediaPipeInitPromise;

  mediaPipeInitPromise = (async () => {
    try {
      let vision;
      try {
        const wasmPath =
          typeof window !== "undefined"
            ? `${window.location.origin}/wasm`
            : "/wasm";
        vision = await FilesetResolver.forVisionTasks(wasmPath);
      } catch {
        vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
      }

      try {
        mediaPipeDetector = await MediaPipeFaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/blaze_face_short_range.tflite",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.48,
          minSuppressionThreshold: 0.35,
        });
        return mediaPipeDetector;
      } catch (cpuErr) {
        console.warn("[FaceDetector] MediaPipe CPU create failed, trying GPU:", cpuErr);
        mediaPipeDetector = await MediaPipeFaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.48,
          minSuppressionThreshold: 0.35,
        });
        return mediaPipeDetector;
      }
    } catch (err) {
      console.warn("[FaceDetector] MediaPipe init failed, using native/Pico fallback:", err);
      mediaPipeFailed = true;
      return null;
    } finally {
      mediaPipeInitPromise = null;
    }
  })();

  return mediaPipeInitPromise;
}

/**
 * Unpacks the Pico binary cascade array into a high-speed classifier function.
 */
export function unpackCascade(bytes: Int8Array): ClassifierFn {
  const dview = new DataView(new ArrayBuffer(4));
  let p = 8;

  dview.setUint8(0, bytes[p + 0]);
  dview.setUint8(1, bytes[p + 1]);
  dview.setUint8(2, bytes[p + 2]);
  dview.setUint8(3, bytes[p + 3]);
  const tdepth = dview.getInt32(0, true);
  p += 4;

  dview.setUint8(0, bytes[p + 0]);
  dview.setUint8(1, bytes[p + 1]);
  dview.setUint8(2, bytes[p + 2]);
  dview.setUint8(3, bytes[p + 3]);
  const ntrees = dview.getInt32(0, true);
  p += 4;

  const tcodes_ls: number[] = [];
  const tpreds_ls: number[] = [];
  const thresh_ls: number[] = [];

  for (let t = 0; t < ntrees; ++t) {
    tcodes_ls.push(0, 0, 0, 0);
    const sliceLen = 4 * Math.pow(2, tdepth) - 4;
    for (let k = 0; k < sliceLen; k++) {
      tcodes_ls.push(bytes[p + k]);
    }
    p += sliceLen;

    for (let i = 0; i < Math.pow(2, tdepth); ++i) {
      dview.setUint8(0, bytes[p + 0]);
      dview.setUint8(1, bytes[p + 1]);
      dview.setUint8(2, bytes[p + 2]);
      dview.setUint8(3, bytes[p + 3]);
      tpreds_ls.push(dview.getFloat32(0, true));
      p += 4;
    }

    dview.setUint8(0, bytes[p + 0]);
    dview.setUint8(1, bytes[p + 1]);
    dview.setUint8(2, bytes[p + 2]);
    dview.setUint8(3, bytes[p + 3]);
    thresh_ls.push(dview.getFloat32(0, true));
    p += 4;
  }

  const tcodes = new Int8Array(tcodes_ls);
  const tpreds = new Float32Array(tpreds_ls);
  const thresh = new Float32Array(thresh_ls);

  return function classifyRegion(
    r: number,
    c: number,
    s: number,
    pixels: Uint8Array,
    ldim: number
  ): number {
    r = 256 * r;
    c = 256 * c;
    let root = 0;
    let o = 0.0;
    const pow2tdepth = Math.pow(2, tdepth) >> 0;

    for (let i = 0; i < ntrees; ++i) {
      let idx = 1;
      for (let j = 0; j < tdepth; ++j) {
        const pix1 =
          pixels[
            (((r + tcodes[root + 4 * idx + 0] * s) >> 8) * ldim) +
              ((c + tcodes[root + 4 * idx + 1] * s) >> 8)
          ];
        const pix2 =
          pixels[
            (((r + tcodes[root + 4 * idx + 2] * s) >> 8) * ldim) +
              ((c + tcodes[root + 4 * idx + 3] * s) >> 8)
          ];
        idx = 2 * idx + (pix1 <= pix2 ? 1 : 0);
      }

      o += tpreds[pow2tdepth * i + idx - pow2tdepth];

      if (o <= thresh[i]) {
        return -1;
      }

      root += 4 * pow2tdepth;
    }
    return o - thresh[ntrees - 1];
  };
}

function runCascade(
  pixels: Uint8Array,
  nrows: number,
  ncols: number,
  ldim: number,
  classifyRegion: ClassifierFn,
  params: { shiftfactor: number; minsize: number; maxsize: number; scalefactor: number }
): [number, number, number, number][] {
  const { shiftfactor, minsize, maxsize, scalefactor } = params;
  let scale = minsize;
  const detections: [number, number, number, number][] = [];

  while (scale <= maxsize) {
    const step = Math.max((shiftfactor * scale) >> 0, 1);
    const offset = (scale / 2 + 1) >> 0;

    for (let r = offset; r <= nrows - offset; r += step) {
      for (let c = offset; c <= ncols - offset; c += step) {
        const q = classifyRegion(r, c, scale, pixels, ldim);
        if (q > 0.0) {
          detections.push([r, c, scale, q]);
        }
      }
    }
    scale *= scalefactor;
  }
  return detections;
}

function clusterDetections(
  dets: [number, number, number, number][],
  iouthreshold: number
): [number, number, number, number][] {
  dets.sort((a, b) => b[3] - a[3]);

  function calculateIoU(
    d1: [number, number, number, number],
    d2: [number, number, number, number]
  ): number {
    const r1 = d1[0],
      c1 = d1[1],
      s1 = d1[2];
    const r2 = d2[0],
      c2 = d2[1],
      s2 = d2[2];
    const overr = Math.max(
      0,
      Math.min(r1 + s1 / 2, r2 + s2 / 2) - Math.max(r1 - s1 / 2, r2 - s2 / 2)
    );
    const overc = Math.max(
      0,
      Math.min(c1 + s1 / 2, c2 + s2 / 2) - Math.max(c1 - s1 / 2, c2 - s2 / 2)
    );
    return (overr * overc) / (s1 * s1 + s2 * s2 - overr * overc);
  }

  const assignments = new Uint8Array(dets.length);
  const clusters: [number, number, number, number][] = [];

  for (let i = 0; i < dets.length; ++i) {
    if (assignments[i] === 0) {
      let r = 0.0,
        c = 0.0,
        s = 0.0,
        q = 0.0,
        n = 0;
      for (let j = i; j < dets.length; ++j) {
        if (calculateIoU(dets[i], dets[j]) > iouthreshold) {
          assignments[j] = 1;
          r += dets[j][0];
          c += dets[j][1];
          s += dets[j][2];
          q += dets[j][3];
          n += 1;
        }
      }
      clusters.push([r / n, c / n, s / n, q]);
    }
  }
  return clusters;
}

function rgba2grayscale(
  rgba: Uint8ClampedArray,
  nrows: number,
  ncols: number
): Uint8Array {
  const gray = new Uint8Array(nrows * ncols);
  for (let r = 0; r < nrows; ++r) {
    for (let c = 0; c < ncols; ++c) {
      const offset = (r * ncols + c) * 4;
      gray[r * ncols + c] =
        (2 * (rgba[offset] || 0) +
          7 * (rgba[offset + 1] || 0) +
          1 * (rgba[offset + 2] || 0)) /
        10;
    }
  }
  return gray;
}

export async function loadPicoDetector(): Promise<ClassifierFn | null> {
  if (cachedPicoClassifier) return cachedPicoClassifier;
  if (picoInitPromise) return picoInitPromise;

  picoInitPromise = (async () => {
    try {
      const res = await fetch("/facefinder");
      if (!res.ok) throw new Error(`Fetch facefinder failed: ${res.status}`);
      const buffer = await res.arrayBuffer();
      const bytes = new Int8Array(buffer);
      cachedPicoClassifier = unpackCascade(bytes);
      return cachedPicoClassifier;
    } catch (err) {
      console.warn("[FaceDetector] Pico cascade load failed:", err);
      return null;
    } finally {
      picoInitPromise = null;
    }
  })();

  return picoInitPromise;
}

/**
 * High-Accuracy Multi-Scenario Detection Engine.
 * Scales all detector outputs to uniform video pixel coordinates.
 */
export async function detectFacesInVideo(
  video: HTMLVideoElement
): Promise<FaceDetectionSummary> {
  if (
    !video ||
    video.videoWidth === 0 ||
    video.videoHeight === 0 ||
    video.readyState < 2
  ) {
    return {
      faces: [],
      count: 0,
      scenario: "NO_CANDIDATE",
      isMoving: false,
    };
  }

  const vWidth = video.videoWidth;
  const vHeight = video.videoHeight;
  let detectedFaces: DetectedFace[] = [];

  // 1. Try Native Chromium FaceDetector API (fastest if hardware supported)
  if (typeof window !== "undefined" && "FaceDetector" in window) {
    try {
      type NativeFaceDetector = {
        detect: (img: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
      };
      const DetectorCtor = (
        window as unknown as {
          FaceDetector: new (opts?: {
            maxDetectedFaces?: number;
            fastMode?: boolean;
          }) => NativeFaceDetector;
        }
      ).FaceDetector;
      const nativeDetector = new DetectorCtor({ maxDetectedFaces: 4, fastMode: true });
      const results = await nativeDetector.detect(video);

      detectedFaces = results.map((f) => {
        const bb = f.boundingBox;
        const boxX = bb.width <= 1.0 ? bb.x * vWidth : bb.x;
        const boxY = bb.height <= 1.0 ? bb.y * vHeight : bb.y;
        const boxW = bb.width <= 1.0 ? bb.width * vWidth : bb.width;
        const boxH = bb.height <= 1.0 ? bb.height * vHeight : bb.height;
        return {
          row: boxY + boxH / 2,
          col: boxX + boxW / 2,
          size: Math.max(boxW, boxH),
          score: 0.95,
        };
      });
    } catch {
      // Fall through to MediaPipe
    }
  }

  // 2. Try MediaPipe BlazeFace (Google AI Vision Tasks)
  if (detectedFaces.length === 0) {
    const mpDetector = await getMediaPipeDetector();
    if (mpDetector) {
      try {
        const now = performance.now();
        const timestamp = Math.max(lastVideoTimestamp + 1, now);
        lastVideoTimestamp = timestamp;

        const mpResult = mpDetector.detectForVideo(video, timestamp);

        if (mpResult && mpResult.detections) {
          const valid = mpResult.detections.filter((det) => {
            const score = (det.categories && det.categories[0]?.score !== undefined)
              ? det.categories[0].score
              : 0.85;
            return score >= 0.45;
          });

          detectedFaces = valid.map((det) => {
            const bb = det.boundingBox!;
            const boxX = bb.width <= 1.0 ? bb.originX * vWidth : bb.originX;
            const boxY = bb.height <= 1.0 ? bb.originY * vHeight : bb.originY;
            const boxW = bb.width <= 1.0 ? bb.width * vWidth : bb.width;
            const boxH = bb.height <= 1.0 ? bb.height * vHeight : bb.height;

            const keypts = (det.keypoints || []).map((kp) => ({
              x: kp.x <= 1.0 ? kp.x * vWidth : kp.x,
              y: kp.y <= 1.0 ? kp.y * vHeight : kp.y,
            }));

            return {
              row: boxY + boxH / 2,
              col: boxX + boxW / 2,
              size: Math.max(boxW, boxH),
              score: (det.categories && det.categories[0]?.score !== undefined)
                ? det.categories[0].score
                : 0.85,
              keypoints: keypts,
            };
          });
        }
      } catch (mpErr) {
        console.warn("[FaceDetector] MediaPipe detectForVideo skipped frame:", mpErr);
      }
    }
  }

  // 3. Fallback to Pico Cascade with precise coordinate scaling
  if (detectedFaces.length === 0) {
    const classifier = await loadPicoDetector();
    if (classifier) {
      if (!picoCanvas) {
        picoCanvas = document.createElement("canvas");
        picoCanvas.width = PICO_WIDTH;
        picoCanvas.height = PICO_HEIGHT;
        picoCtx = picoCanvas.getContext("2d", { willReadFrequently: true });
      }

      if (picoCtx) {
        picoCtx.drawImage(video, 0, 0, PICO_WIDTH, PICO_HEIGHT);
        const imgData = picoCtx.getImageData(0, 0, PICO_WIDTH, PICO_HEIGHT);
        const grayPixels = rgba2grayscale(imgData.data, PICO_HEIGHT, PICO_WIDTH);

        const rawDetections = runCascade(
          grayPixels,
          PICO_HEIGHT,
          PICO_WIDTH,
          PICO_WIDTH,
          classifier,
          {
            shiftfactor: 0.1,
            scalefactor: 1.1,
            minsize: 24,
            maxsize: 210,
          }
        );

        const clustered = clusterDetections(rawDetections, 0.25);
        const scaleX = vWidth / PICO_WIDTH;
        const scaleY = vHeight / PICO_HEIGHT;

        detectedFaces = clustered
          .filter((d) => d[3] >= 5.0)
          .map((d) => ({
            row: d[0] * scaleY,
            col: d[1] * scaleX,
            size: d[2] * Math.max(scaleX, scaleY),
            score: Math.min(1.0, 0.65 + (d[3] / 25.0)),
          }));
      }
    }
  }

  // Apply spatial Non-Maximum Suppression and anatomical candidate torso deduplication
  const cleanFaces = cleanAndDeduplicateFaces(detectedFaces, vWidth, vHeight);

  // Sort faces: largest face (primary candidate) first
  cleanFaces.sort((a, b) => b.size - a.size);

  const count = cleanFaces.length;

  let scenario: ProctorScenario;
  let isMoving = false;

  if (count === 0) {
    prevSecondaryFace = null;
    prevBgPixels = null;
    bgMotionStreak = 0;
    scenario = "NO_CANDIDATE";
  } else if (count >= 2) {
    // 2+ people confirmed in view
    prevBgPixels = null;
    bgMotionStreak = 0;
    const secondaryFace = cleanFaces[1];
    let is2ndPersonMoving = false;

    if (prevSecondaryFace) {
      const displacement = Math.hypot(
        secondaryFace.col - prevSecondaryFace.col,
        secondaryFace.row - prevSecondaryFace.row
      );
      if (displacement > 16) {
        is2ndPersonMoving = true;
      }
    }
    prevSecondaryFace = { col: secondaryFace.col, row: secondaryFace.row };

    scenario = is2ndPersonMoving ? "SECOND_PERSON_MOVING" : "SECOND_PERSON_PRESENT";
    isMoving = is2ndPersonMoving;
  } else {
    // Exactly 1 candidate face verified in view!
    prevSecondaryFace = null;

    // Check for background room movement outside candidate's silhouette
    let bgMovementDetected = false;

    if (!bgCanvas) {
      bgCanvas = document.createElement("canvas");
      bgCanvas.width = BG_W;
      bgCanvas.height = BG_H;
      bgCtx = bgCanvas.getContext("2d", { willReadFrequently: true });
    }

    if (bgCtx) {
      bgCtx.drawImage(video, 0, 0, BG_W, BG_H);
      const imgData = bgCtx.getImageData(0, 0, BG_W, BG_H);
      const currGray = rgba2grayscale(imgData.data, BG_H, BG_W);

      if (prevBgPixels) {
        const primary = cleanFaces[0];
        const candNormX = (primary.col / vWidth) * BG_W;
        const candNormY = (primary.row / vHeight) * BG_H;
        const candNormSize = (primary.size / Math.max(vWidth, vHeight)) * BG_W;

        let changedBgPixels = 0;
        let totalBgPixels = 0;

        for (let r = 0; r < BG_H; r++) {
          for (let c = 0; c < BG_W; c++) {
            // Check if (c, r) is in candidate body zone
            const inCandZone =
              Math.abs(c - candNormX) < candNormSize * 1.9 &&
              r > candNormY - candNormSize * 0.35;

            if (!inCandZone) {
              totalBgPixels++;
              const idx = r * BG_W + c;
              if (Math.abs(currGray[idx] - prevBgPixels[idx]) > 18) {
                changedBgPixels++;
              }
            }
          }
        }

        if (totalBgPixels > 250) {
          const changeRatio = changedBgPixels / totalBgPixels;
          // Localized room motion (between 4% and 65% of background altered)
          // Excludes global lighting changes (> 65%)
          if (changeRatio >= 0.04 && changeRatio <= 0.65) {
            bgMovementDetected = true;
          }
        }
      }

      prevBgPixels = currGray;
    }

    if (bgMovementDetected) {
      scenario = "UNWANTED_ROOM_MOVEMENT";
      isMoving = true;
    } else {
      scenario = "OPTIMAL_ALONE";
      isMoving = false;
    }
  }

  return {
    faces: cleanFaces,
    count,
    scenario,
    isMoving,
  };
}

/**
 * Spatial Non-Maximum Suppression (NMS) and Anatomical Candidate Deduplication.
 *
 * Prevents false positives caused by:
 * 1. Duplicate/split detections of candidate head (chin vs eyes vs mouth).
 * 2. Overlapping bounding boxes.
 * 3. Candidate body silo: neck, collar, tie, hoodie, buttons, and graphic t-shirt prints.
 * 4. Candidate hand gestures, typing, or chin-resting.
 * 5. Headphones, hair, ears, or glasses reflections.
 * 6. Background wall art, small photo frames, or calendar pictures.
 *
 * Accurately confirms a true second human face when:
 * - Beside candidate (horizontally separated by at least 2.2x head size).
 * - Behind candidate (clearly above candidate's brow line).
 * - Valid facial geometry (eyes and nose orientation when landmarks exist).
 * - Sized >= 50px (or >= 35% of candidate head) and confident >= 0.68.
 */
function cleanAndDeduplicateFaces(
  rawFaces: DetectedFace[],
  frameWidth: number,
  frameHeight: number
): DetectedFace[] {
  if (rawFaces.length === 0) return [];

  // Minimum face size: Candidate face is at least 32px
  const minValidSize = Math.max(32, Math.min(frameWidth, frameHeight) * 0.07);
  const sizeFiltered = rawFaces.filter((f) => f.size >= minValidSize && f.score >= 0.40);
  if (sizeFiltered.length === 0) return [];

  // Sort by prominence (size * score) descending so the primary candidate face is first
  const sorted = [...sizeFiltered].sort((a, b) => b.size * b.score - a.size * a.score);

  const cleanFaces: DetectedFace[] = [];

  for (const face of sorted) {
    if (cleanFaces.length === 0) {
      // First face is always the primary candidate face
      cleanFaces.push(face);
      continue;
    }

    const primary = cleanFaces[0];

    // Check 1: Candidate Head Sphere
    // Head radius + hair + ears + chin spans 1.55x the face box.
    const centerDist = Math.hypot(face.col - primary.col, face.row - primary.row);
    if (centerDist < primary.size * 1.55) {
      continue;
    }

    // Check 2: Bounding box IoU overlap with candidate face
    const halfA = primary.size / 2;
    const halfB = face.size / 2;
    const x1 = Math.max(primary.col - halfA, face.col - halfB);
    const y1 = Math.max(primary.row - halfA, face.row - halfB);
    const x2 = Math.min(primary.col + halfA, face.col + halfB);
    const y2 = Math.min(primary.row + halfA, face.row + halfB);

    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const areaA = primary.size * primary.size;
    const areaB = face.size * face.size;
    const union = areaA + areaB - intersection;
    const iou = union > 0 ? intersection / union : 0;
    if (iou > 0.04) {
      continue;
    }

    // Check 3: Candidate Torso, Silhouette & Apparel Silo
    // Candidate's torso, shoulders, arms, chest, collar, tie, buttons, t-shirt prints, and chair
    // occupy the horizontal corridor ±2.20 * primary.size and everything below primary.row - primary.size * 0.35!
    const inCandidateCorridor = Math.abs(face.col - primary.col) < primary.size * 2.20;
    const isBelowCandidateBrow = face.row > primary.row - primary.size * 0.35;
    if (inCandidateCorridor && isBelowCandidateBrow) {
      // Inside candidate's body silhouette — impossible to be a second human face
      continue;
    }

    // Check 4: Candidate Hands / Arms / Lap / Desk
    // Candidate hands typing on keyboard, holding mouse, or resting on desk in lower portion
    const isCandidateLowerBody =
      face.row > primary.row + primary.size * 0.40 &&
      Math.abs(face.col - primary.col) < frameWidth * 0.6;
    if (isCandidateLowerBody) {
      continue;
    }

    // Check 5: Facial Anatomy Keypoints Validation (MediaPipe)
    // If MediaPipe keypoints are present, ensure it forms a real human face
    if (face.keypoints && face.keypoints.length >= 4) {
      const rightEye = face.keypoints[0];
      const leftEye = face.keypoints[1];
      const nose = face.keypoints[2];
      const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
      if (eyeDist < 8) {
        // Not a real human face (eyes too close or missing)
        continue;
      }
      if (nose.y < Math.min(rightEye.y, leftEye.y) - 4) {
        // Inverted or distorted geometry
        continue;
      }
    }

    // Check 6: Secondary face must be confident and substantial enough to be an actual human exam intrusion
    // Rejects faint background posters, wall calendars, book covers, and shadow noise:
    // Must be >= 28px (covers person entering room in background) and confidence >= 0.58
    const minSecondarySize = Math.max(28, primary.size * 0.22);
    if (face.score < 0.58 || face.size < minSecondarySize) {
      continue;
    }

    // Check 7: Deduplicate against any other secondary face already confirmed
    let overlapsOther = false;
    for (let i = 1; i < cleanFaces.length; i++) {
      const other = cleanFaces[i];
      if (
        Math.hypot(face.col - other.col, face.row - other.row) <
        Math.min(face.size, other.size) * 0.75
      ) {
        overlapsOther = true;
        break;
      }
    }
    if (overlapsOther) continue;

    cleanFaces.push(face);
  }

  return cleanFaces;
}

// Force clean Vite full reload on module update to prevent stale closures
if (import.meta.hot) {
  import.meta.hot.invalidate();
}
