package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import com.google.mlkit.vision.face.Face
import kotlin.math.abs

/**
 * HeadPoseDetector extracts Euler angles from ML Kit face results.
 *
 * Euler conventions from ML Kit:
 *   Y (Yaw):   positive = face turned right, negative = face turned left
 *   X (Pitch): positive = face tilted up, negative = face tilted down (phone in lap)
 *   Z (Roll):  positive = head tilted right, negative = head tilted left
 *
 * Thresholds are configurable — not hardcoded universal cheating values.
 * A single frame violation does NOT generate an event; ProctoringEventEngine
 * applies temporal smoothing (3+ frames within window).
 */
class HeadPoseDetector(
    private val yawThreshold: Float = 28.0f,
    private val pitchDownThreshold: Float = -22.0f,
    private val pitchUpThreshold: Float = 25.0f,
    private val rollThreshold: Float = 35.0f
) {
    data class PoseResult(
        val isViolating: Boolean,
        val yaw: Float,
        val pitch: Float,
        val roll: Float,
        val direction: String,   // LEFT, RIGHT, UP, DOWN, CENTER, TILT
        val reason: String?
    )

    fun analyze(face: Face): PoseResult {
        val yaw = face.headEulerAngleY   // Y axis — left/right
        val pitch = face.headEulerAngleX // X axis — up/down
        val roll = face.headEulerAngleZ  // Z axis — tilt

        val yawLeft = yaw < -yawThreshold
        val yawRight = yaw > yawThreshold
        val pitchDown = pitch < pitchDownThreshold
        val pitchUp = pitch > pitchUpThreshold
        val tiltViolated = abs(roll) > rollThreshold

        val direction = when {
            yawRight -> "RIGHT"
            yawLeft  -> "LEFT"
            pitchDown -> "DOWN"
            pitchUp   -> "UP"
            tiltViolated -> "TILT"
            else -> "CENTER"
        }

        val reason = when (direction) {
            "RIGHT"  -> "Head turned right away from screen (yaw=${yaw.toInt()}°)"
            "LEFT"   -> "Head turned left away from screen (yaw=${yaw.toInt()}°)"
            "DOWN"   -> "Looking down toward lap (pitch=${pitch.toInt()}°)"
            "UP"     -> "Looking up away from screen (pitch=${pitch.toInt()}°)"
            "TILT"   -> "Head tilted sideways (roll=${roll.toInt()}°)"
            else     -> null
        }

        val isViolating = yawLeft || yawRight || pitchDown || pitchUp || tiltViolated

        return PoseResult(
            isViolating = isViolating,
            yaw = yaw,
            pitch = pitch,
            roll = roll,
            direction = direction,
            reason = reason
        )
    }
}
