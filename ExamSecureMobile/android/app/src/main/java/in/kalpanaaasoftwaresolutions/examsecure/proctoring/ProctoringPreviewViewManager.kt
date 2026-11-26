package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import android.view.View
import androidx.camera.view.PreviewView
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Exposes CameraX PreviewView fed by CameraManager so the exam screen renders
 * a live front-camera preview from the single shared CameraX session.
 */
class ProctoringPreviewViewManager : SimpleViewManager<PreviewView>() {
    override fun getName(): String = "ProctoringCameraView"

    override fun createViewInstance(reactContext: ThemedReactContext): PreviewView {
        val previewView = PreviewView(reactContext).apply {
            // TextureView mode avoids SurfaceView z-order / rounded-corner clipping issues
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }

        previewView.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) {
                ProctoringModule.setPreviewSurfaceProvider(previewView.surfaceProvider)
            }

            override fun onViewDetachedFromWindow(v: View) {
                ProctoringModule.setPreviewSurfaceProvider(null)
            }
        })

        return previewView
    }
}
