package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceLandmark
import kotlin.math.abs

/**
 * GazeEstimator uses ML Kit facial landmarks to infer gaze direction.
 *
 * Method: Horizontal asymmetry of eye-to-nose distances.
 * When a candidate looks right, the left eye appears farther from the nose;
 * when looking left, the right eye appears farther from the nose.
 *
 * Limitations (documented explicitly):
 *   - Landmark-based gaze is approximate — not iris tracking
 *   - Unreliable for large head rotations (>25° yaw) — HeadPoseDetector handles those
 *   - Glasses and poor lighting degrade accuracy
 *   - Returns GAZE_UNRELIABLE when confidence is too low rather than a false accusation
 *
 * ProctoringEventEngine applies a 3-frame minimum before generating an alert.
 */
class GazeEstimator {

    enum class GazeDirection { LEFT, RIGHT, UP, CENTER, UNRELIABLE }

    data class GazeResult(
        val direction: GazeDirection,
        val confidence: Float,
        val isGazingAway: Boolean,
        val isUnreliable: Boolean
    )

    fun estimate(face: Face): GazeResult {
        val leftEyeOpen  = face.leftEyeOpenProbability  ?: 1.0f
        val rightEyeOpen = face.rightEyeOpenProbability ?: 1.0f

        // Both eyes closed = blinking — not a violation
        if (leftEyeOpen < 0.2f && rightEyeOpen < 0.2f) {
            return GazeResult(GazeDirection.CENTER, 0.9f, isGazingAway = false, isUnreliable = false)
        }

        val leftEye  = face.getLandmark(FaceLandmark.LEFT_EYE)?.position
        val rightEye = face.getLandmark(FaceLandmark.RIGHT_EYE)?.position
        val nose     = face.getLandmark(FaceLandmark.NOSE_BASE)?.position

        // If landmarks are missing (glasses/occlusion/lighting), report unreliable
        if (leftEye == null || rightEye == null || nose == null) {
            return GazeResult(GazeDirection.UNRELIABLE, 0.3f, isGazingAway = false, isUnreliable = true)
        }

        // Horizontal asymmetry: ratio of left-eye-to-nose vs right-eye-to-nose X distance
        val leftDist  = abs(nose.x - leftEye.x)
        val rightDist = abs(rightEye.x - nose.x)
        val total = leftDist + rightDist

        // Avoid division by zero on degenerate frames
        if (total < 10f) {
            return GazeResult(GazeDirection.UNRELIABLE, 0.2f, isGazingAway = false, isUnreliable = true)
        }

        val ratio = if (rightDist > 0) leftDist / rightDist else 1.0f

        // Vertical: check if one eye is significantly higher — looking up
        val eyeMidY = (leftEye.y + rightEye.y) / 2f
        val noseY = nose.y
        val verticalOffset = eyeMidY - noseY // normally negative (eyes above nose)

        return when {
            ratio > 1.90f -> GazeResult(GazeDirection.RIGHT, 0.88f, isGazingAway = true,  isUnreliable = false)
            ratio < 0.52f -> GazeResult(GazeDirection.LEFT,  0.88f, isGazingAway = true,  isUnreliable = false)
            else          -> GazeResult(GazeDirection.CENTER, 0.95f, isGazingAway = false, isUnreliable = false)
        }
    }
}
