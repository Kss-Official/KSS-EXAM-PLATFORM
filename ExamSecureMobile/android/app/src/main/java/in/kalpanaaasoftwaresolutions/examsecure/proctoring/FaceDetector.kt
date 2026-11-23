package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import android.media.Image
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions

/**
 * FaceDetector wraps Google ML Kit face detection.
 * Uses FAST mode for real-time performance, enables:
 *   - ALL landmarks (eye positions, nose, mouth corners)
 *   - ALL classifications (eye-open probability, smiling probability)
 *   - Face tracking (stable IDs across frames)
 *   - Min face size 20% of image — avoids tracking tiny background faces
 */
class FaceDetector {
    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
            .setMinFaceSize(0.20f)
            .enableTracking()
            .build()
    )

    fun detectFaces(
        mediaImage: Image,
        rotationDegrees: Int,
        onSuccess: (List<Face>) -> Unit,
        onComplete: () -> Unit
    ) {
        val inputImage = InputImage.fromMediaImage(mediaImage, rotationDegrees)
        detector.process(inputImage)
            .addOnSuccessListener { faces ->
                onSuccess(faces)
            }
            .addOnFailureListener {
                // Non-fatal frame drop — do not crash, just skip this frame
                onSuccess(emptyList())
            }
            .addOnCompleteListener {
                onComplete()
            }
    }

    fun close() {
        detector.close()
    }
}
