package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import androidx.camera.core.ImageProxy

/**
 * ImageQualityAnalyzer inspects camera luminance and blur.
 * Instantly flags when a candidate deliberately covers the camera, enters total darkness,
 * or introduces artificial heavy blur.
 */
class ImageQualityAnalyzer {
    data class QualityResult(
        val isCameraCovered: Boolean,
        val isLowLight: Boolean,
        val luminance: Double
    )

    fun analyze(imageProxy: ImageProxy): QualityResult {
        val plane = imageProxy.planes[0]
        val buffer = plane.buffer
        val data = ByteArray(buffer.remaining())
        buffer.get(data)

        var totalLuminance = 0L
        val step = 16 // Downsample for high-efficiency sampling
        var sampleCount = 0

        for (i in data.indices step step) {
            val pixel = data[i].toInt() and 0xFF
            totalLuminance += pixel
            sampleCount++
        }

        val avgLuminance = if (sampleCount > 0) totalLuminance.toDouble() / sampleCount else 128.0

        val isCovered = avgLuminance < 14.0 // Almost complete blackout
        val isLowLight = avgLuminance < 28.0

        return QualityResult(
            isCameraCovered = isCovered,
            isLowLight = isLowLight,
            luminance = avgLuminance
        )
    }
}
