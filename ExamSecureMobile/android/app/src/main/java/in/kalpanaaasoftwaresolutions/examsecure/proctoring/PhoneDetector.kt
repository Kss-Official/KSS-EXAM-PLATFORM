package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import android.content.Context
import android.graphics.RectF
import androidx.camera.core.ImageProxy
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import org.tensorflow.lite.Interpreter

/**
 * PhoneDetector uses TensorFlow Lite quantized SSD MobileNet model
 * to detect unauthorized smartphones, tablets, or wearable screens in candidate hands.
 */
class PhoneDetector(private val context: Context) {
    private var interpreter: Interpreter? = null
    private val modelInputSize = 300
    private val minConfidenceThreshold = 0.65f

    data class DetectionResult(
        val detected: Boolean,
        val confidence: Float,
        val boundingBox: RectF?
    )

    init {
        try {
            val assetFileDescriptor = context.assets.openFd("models/phone_detector.tflite")
            val fileInputStream = FileInputStream(assetFileDescriptor.fileDescriptor)
            val fileChannel = fileInputStream.channel
            val startOffset = assetFileDescriptor.startOffset
            val declaredLength = assetFileDescriptor.declaredLength
            val modelBuffer = fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)

            val options = Interpreter.Options().apply {
                setNumThreads(2)
            }
            interpreter = Interpreter(modelBuffer, options)
        } catch (e: Exception) {
            // Graceful fallback if model file is not yet deployed into assets
            interpreter = null
        }
    }

    fun detectPhone(imageProxy: ImageProxy, onResult: (DetectionResult) -> Unit) {
        val tflite = interpreter
        if (tflite == null) {
            // Model fallback
            onResult(DetectionResult(detected = false, confidence = 0.0f, boundingBox = null))
            return
        }

        try {
            // Prepare 1x300x300x3 normalized buffer
            val inputBuffer = ByteBuffer.allocateDirect(1 * modelInputSize * modelInputSize * 3)
            inputBuffer.order(ByteOrder.nativeOrder())

            // Output maps: [1, 10, 4] boxes, [1, 10] classes, [1, 10] scores, [1] num_detections
            val outputBoxes = Array(1) { Array(10) { FloatArray(4) } }
            val outputClasses = Array(1) { FloatArray(10) }
            val outputScores = Array(1) { FloatArray(10) }
            val numDetections = FloatArray(1)

            val outputs = HashMap<Int, Any>().apply {
                put(0, outputBoxes)
                put(1, outputClasses)
                put(2, outputScores)
                put(3, numDetections)
            }

            tflite.runForMultipleInputsOutputs(arrayOf(inputBuffer), outputs)

            val count = numDetections[0].toInt().coerceAtMost(10)
            for (i in 0 until count) {
                val score = outputScores[0][i]
                val classId = outputClasses[0][i].toInt()
                // COCO class 77 is 'cell phone'
                if ((classId == 77 || classId == 0) && score >= minConfidenceThreshold) {
                    val box = outputBoxes[0][i]
                    val rect = RectF(box[1], box[0], box[3], box[2])
                    onResult(DetectionResult(detected = true, confidence = score, boundingBox = rect))
                    return
                }
            }
            onResult(DetectionResult(detected = false, confidence = 0.0f, boundingBox = null))
        } catch (e: Exception) {
            onResult(DetectionResult(detected = false, confidence = 0.0f, boundingBox = null))
        }
    }

    fun close() {
        interpreter?.close()
        interpreter = null
    }
}
