package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Preview
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * React Native Bridge Module for ExamSecure Native On-Device AI Proctoring.
 * Coordinates CameraX, ML Kit Face/Gaze Detection, and TensorFlow Lite Phone Detection.
 */
class ProctoringModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ProctoringEventEngine.ProctoringEventListener {

    private var cameraManager: CameraManager? = null
    private var eventEngine: ProctoringEventEngine = ProctoringEventEngine(this)
    private var isRunning: Boolean = false

    companion object {
        @Volatile
        private var activeCameraManager: CameraManager? = null

        @Volatile
        private var previewSurfaceProvider: Preview.SurfaceProvider? = null

        fun setPreviewSurfaceProvider(provider: Preview.SurfaceProvider?) {
            previewSurfaceProvider = provider
            activeCameraManager?.setPreviewSurfaceProvider(provider)
        }
    }

    override fun getName(): String = "ProctoringModule"

    @ReactMethod
    fun startProctoring(configMap: ReadableMap?, promise: Promise) {
        val activity = reactApplicationContext.currentActivity as? AppCompatActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Cannot start proctoring without an active AppCompatActivity.")
            return
        }

        activity.runOnUiThread {
            try {
                if (isRunning) {
                    promise.resolve(true)
                    return@runOnUiThread
                }

                eventEngine.reset()
                val manager = CameraManager(activity, eventEngine)
                manager.setPreviewSurfaceProvider(previewSurfaceProvider)
                activeCameraManager = manager
                cameraManager = manager
                manager.start()
                isRunning = true
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("PROCTOR_START_FAILED", e.localizedMessage, e)
            }
        }
    }

    @ReactMethod
    fun stopProctoring(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        val stopAction = {
            try {
                cameraManager?.stop()
                if (activeCameraManager === cameraManager) {
                    activeCameraManager = null
                }
                cameraManager = null
                isRunning = false
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("PROCTOR_STOP_FAILED", e.localizedMessage, e)
            }
        }

        if (activity != null) {
            activity.runOnUiThread { stopAction() }
        } else {
            stopAction()
        }
    }

    override fun onProctoringEvent(
        type: String,
        severity: String,
        confidence: Float,
        message: String,
        details: Map<String, Any?>
    ) {
        val params: WritableMap = Arguments.createMap().apply {
            putString("type", type)
            putString("severity", severity)
            putDouble("confidence", confidence.toDouble())
            putDouble("timestamp", System.currentTimeMillis().toDouble())
            putString("message", message)

            val detailsMap = Arguments.createMap()
            details.forEach { (key, value) ->
                when (value) {
                    is Int -> detailsMap.putInt(key, value)
                    is Double -> detailsMap.putDouble(key, value)
                    is Float -> detailsMap.putDouble(key, value.toDouble())
                    is String -> detailsMap.putString(key, value)
                    is Boolean -> detailsMap.putBoolean(key, value)
                }
            }
            putMap("details", detailsMap)
        }

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onProctoringEvent", params)
    }
}
