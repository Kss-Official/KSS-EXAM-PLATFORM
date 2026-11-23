package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import android.graphics.RectF
import com.google.mlkit.vision.face.Face

/**
 * ProctoringEventEngine implements temporal sliding window debouncing.
 * Prevents false alerts from normal blinks/micro-movements,
 * while triggering strikes when violations persist > 1.5s
 * or when secondary phones or multiple faces appear.
 */
class ProctoringEventEngine(private val listener: ProctoringEventListener) {

    interface ProctoringEventListener {
        fun onProctoringEvent(
            type: String,
            severity: String,
            confidence: Float,
            message: String,
            details: Map<String, Any?>
        )
    }

    private val headPoseDetector = HeadPoseDetector()
    private val gazeEstimator = GazeEstimator()

    private var noFaceFrameCount = 0
    private var multiFaceFrameCount = 0
    private var gazeAwayFrameCount = 0
    private var headPoseFrameCount = 0
    private var phoneDetectedCount = 0

    private var lastPhoneScanTimeMs = 0L
    private val phoneScanIntervalMs = 1500L // Run phone scan every 1.5s to preserve battery

    private val frameThreshold = 3 // ~1.5s at analysis frequency

    fun reset() {
        noFaceFrameCount = 0
        multiFaceFrameCount = 0
        gazeAwayFrameCount = 0
        headPoseFrameCount = 0
        phoneDetectedCount = 0
        lastPhoneScanTimeMs = 0L
    }

    fun shouldRunPhoneDetection(): Boolean {
        val now = System.currentTimeMillis()
        if (now - lastPhoneScanTimeMs >= phoneScanIntervalMs) {
            lastPhoneScanTimeMs = now
            return true
        }
        return false
    }

    fun processFaces(faces: List<Face>) {
        when {
            faces.isEmpty() -> {
                noFaceFrameCount++
                if (noFaceFrameCount >= frameThreshold) {
                    listener.onProctoringEvent(
                        type = "FACE_NOT_FOUND",
                        severity = "WARNING",
                        confidence = 0.95f,
                        message = "Candidate face missing from frame",
                        details = mapOf("faceCount" to 0)
                    )
                }
            }

            faces.size > 1 -> {
                multiFaceFrameCount++
                if (multiFaceFrameCount >= 2) {
                    listener.onProctoringEvent(
                        type = "MULTIPLE_FACES",
                        severity = "CRITICAL",
                        confidence = 0.99f,
                        message = "Unauthorized secondary person detected in camera view",
                        details = mapOf("faceCount" to faces.size)
                    )
                }
            }

            else -> {
                noFaceFrameCount = 0
                multiFaceFrameCount = 0
                val primaryFace = faces[0]

                // 1. Head Pose Check (Euler yaw, pitch, roll)
                val pose = headPoseDetector.analyze(primaryFace)
                if (pose.isViolating) {
                    headPoseFrameCount++
                    if (headPoseFrameCount >= frameThreshold) {
                        listener.onProctoringEvent(
                            type = "HEAD_POSE_VIOLATION",
                            severity = "WARNING",
                            confidence = 0.92f,
                            message = pose.reason ?: "Looking away from screen",
                            details = mapOf(
                                "yaw" to pose.yaw,
                                "pitch" to pose.pitch,
                                "roll" to pose.roll,
                                "direction" to pose.direction
                            )
                        )
                    }
                } else {
                    headPoseFrameCount = 0
                }

                // 2. Eye Gaze Off-Screen Check
                val gaze = gazeEstimator.estimate(primaryFace)
                if (gaze.isGazingAway) {
                    gazeAwayFrameCount++
                    if (gazeAwayFrameCount >= frameThreshold) {
                        listener.onProctoringEvent(
                            type = "GAZE_AWAY",
                            severity = "WARNING",
                            confidence = gaze.confidence,
                            message = "Candidate eyes directed away from examination screen (${gaze.direction.name})",
                            details = mapOf("gazeDirection" to gaze.direction.name)
                        )
                    }
                } else {
                    gazeAwayFrameCount = 0
                }
            }
        }
    }

    fun recordPhoneDetected(confidence: Float, box: RectF?) {
        phoneDetectedCount++
        if (phoneDetectedCount >= 2) {
            listener.onProctoringEvent(
                type = "PHONE_DETECTED",
                severity = "CRITICAL",
                confidence = confidence,
                message = "Unauthorized secondary smartphone / digital device detected",
                details = mapOf(
                    "phoneConfidence" to confidence,
                    "top" to (box?.top ?: 0f),
                    "left" to (box?.left ?: 0f),
                    "bottom" to (box?.bottom ?: 0f),
                    "right" to (box?.right ?: 0f)
                )
            )
        }
    }

    fun recordCameraCovered(luminance: Double) {
        listener.onProctoringEvent(
            type = "CAMERA_COVERED",
            severity = "CRITICAL",
            confidence = 0.99f,
            message = "Front camera lens is obstructed or covered",
            details = mapOf("luminance" to luminance)
        )
    }
}
