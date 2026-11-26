package `in`.kalpanaaasoftwaresolutions.examsecure.proctoring

import android.content.Context
import android.view.View
import android.widget.FrameLayout
import androidx.camera.view.PreviewView
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

/**
 * Wraps CameraX PreviewView in a FrameLayout that forces measure/layout passes
 * on internal TextureView children when React Native's Yoga/Fabric layout runs.
 * Without this, PreviewView's internal TextureView stays 0x0 and renders black.
 */
class ProctoringPreviewContainer(context: Context) : FrameLayout(context) {
    val previewView: PreviewView = PreviewView(context).apply {
        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        scaleType = PreviewView.ScaleType.FILL_CENTER
    }

    private var measureAndLayoutScheduled = false

    private val measureAndLayoutRunnable = Runnable {
        measureAndLayoutScheduled = false
        if (width > 0 && height > 0) {
            measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
            )
            layout(left, top, right, bottom)
        }
    }

    init {
        addView(
            previewView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        )
    }

    override fun requestLayout() {
        super.requestLayout()
        if (!measureAndLayoutScheduled && width > 0 && height > 0) {
            measureAndLayoutScheduled = true
            post(measureAndLayoutRunnable)
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        measureChild(previewView, widthMeasureSpec, heightMeasureSpec)
        setMeasuredDimension(
            resolveSize(previewView.measuredWidth, widthMeasureSpec),
            resolveSize(previewView.measuredHeight, heightMeasureSpec)
        )
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        val w = right - left
        val h = bottom - top
        if (w > 0 && h > 0) {
            previewView.measure(
                MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY)
            )
            previewView.layout(0, 0, w, h)
        }
    }
}

/**
 * Exposes CameraX PreviewView fed by CameraManager so the exam screen renders
 * a live front-camera preview from the single shared CameraX session.
 */
class ProctoringPreviewViewManager : SimpleViewManager<ProctoringPreviewContainer>() {
    override fun getName(): String = "ProctoringCameraView"

    override fun createViewInstance(reactContext: ThemedReactContext): ProctoringPreviewContainer {
        val container = ProctoringPreviewContainer(reactContext)

        container.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) {
                ProctoringModule.setPreviewSurfaceProvider(container.previewView.surfaceProvider)
                container.requestLayout()
            }

            override fun onViewDetachedFromWindow(v: View) {
                ProctoringModule.setPreviewSurfaceProvider(null)
            }
        })

        return container
    }
}
