package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import android.annotation.SuppressLint
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * CameraManager encapsulates CameraX front camera background capture.
 * Uses STRATEGY_KEEP_ONLY_LATEST to drop stale frames — never queues up work.
 * Delivers YUV_420_888 ImageProxy frames to parallel on-device detectors.
 */
class CameraManager(
    private val activity: AppCompatActivity,
    private val eventEngine: ProctoringEventEngine
) {
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val faceDetector = FaceDetector()
    private val phoneDetector = PhoneDetector(activity)
    private val qualityAnalyzer = ImageQualityAnalyzer()

    fun start() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(activity)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .setTargetResolution(android.util.Size(640, 480))
                .build()

            imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                analyzeFrame(imageProxy)
            }

            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(activity, cameraSelector, imageAnalysis)
            } catch (exc: Exception) {
                exc.printStackTrace()
            }
        }, ContextCompat.getMainExecutor(activity))
    }

    @SuppressLint("UnsafeOptInUsageError")
    private fun analyzeFrame(imageProxy: ImageProxy) {
        val mediaImage = imageProxy.image
        if (mediaImage == null) {
            imageProxy.close()
            return
        }

        // 1. Frame Quality & Obstruction Analysis — instant check, no AI needed
        val quality = qualityAnalyzer.analyze(imageProxy)
        if (quality.isCameraCovered) {
            eventEngine.recordCameraCovered(quality.luminance)
            imageProxy.close()
            return
        }

        // 2. ML Kit Face Detection → Head Pose + Gaze (async, non-blocking)
        faceDetector.detectFaces(
            mediaImage,
            imageProxy.imageInfo.rotationDegrees,
            onSuccess = { faces ->
                eventEngine.processFaces(faces)
            },
            onComplete = {
                // 3. TFLite Phone Detection (runs every ~2s via throttle in eventEngine)
                if (eventEngine.shouldRunPhoneDetection()) {
                    phoneDetector.detectPhone(
                        imageProxy,
                        onResult = { phoneResult ->
                            if (phoneResult.detected) {
                                eventEngine.recordPhoneDetected(
                                    phoneResult.confidence,
                                    phoneResult.boundingBox
                                )
                            }
                            imageProxy.close()
                        }
                    )
                } else {
                    imageProxy.close()
                }
            }
        )
    }

    fun stop() {
        try {
            cameraExecutor.shutdown()
            phoneDetector.close()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
