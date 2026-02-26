package com.reduce.app

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

object OverlayController {
    private var windowManager: WindowManager? = null
    private var overlayView: FrameLayout? = null
    private var handler: Handler? = null

    fun showBlockingOverlay(
        context: Context,
        reason: String,
        seconds: Int,
        onFinish: () -> Unit
    ) {
        if (overlayView != null) return

        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        windowManager = wm

        val root = FrameLayout(context).apply {
            setBackgroundColor(0xAA000000.toInt())
        }

        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(context, 20), dp(context, 28), dp(context, 20), dp(context, 28))
            background = GradientDrawable().apply {
                setColor(Color.WHITE)
                cornerRadius = dp(context, 22).toFloat()
            }
        }

        val title = TextView(context).apply {
            text = "限制已到达"
            textSize = 22f
            setTextColor(0xFF1A237E.toInt())
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }

        val reasonText = TextView(context).apply {
            text = "原因：$reason"
            textSize = 16f
            setTextColor(0xFF546E7A.toInt())
            setPadding(0, dp(context, 10), 0, dp(context, 4))
            gravity = Gravity.CENTER
        }

        val quotes = context.resources.getStringArray(R.array.blocking_quotes)
        val randomQuote = quotes.random()
        val quoteText = TextView(context).apply {
            text = "\u201C $randomQuote \u201D"
            textSize = 14f
            setTextColor(0xFF90A4AE.toInt())
            typeface = Typeface.create(Typeface.SERIF, Typeface.ITALIC)
            setPadding(dp(context, 14), 0, dp(context, 14), dp(context, 14))
            gravity = Gravity.CENTER
        }

        val countdownText = TextView(context).apply {
            textSize = 14f
            setTextColor(0xFFEF5350.toInt())
            gravity = Gravity.CENTER
        }

        card.addView(title)
        card.addView(reasonText)
        card.addView(quoteText)
        card.addView(countdownText)

        val cardWidthDp = 300
        val cardWidthPx = dp(context, cardWidthDp)
        val cardParams = FrameLayout.LayoutParams(
            cardWidthPx,
            FrameLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
        }
        root.addView(card, cardParams)

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        )

        overlayView = root
        try {
            wm.addView(root, params)
        } catch (e: Exception) {
            overlayView = null
            windowManager = null
            return
        }

        handler = Handler(Looper.getMainLooper())
        var remaining = seconds
        val ticker = object : Runnable {
            override fun run() {
                countdownText.text = "${remaining} 秒后自动返回桌面"
                if (remaining <= 0) {
                    hide()
                    onFinish()
                } else {
                    remaining -= 1
                    handler?.postDelayed(this, 1000L)
                }
            }
        }
        handler?.post(ticker)
    }

    fun hide() {
        handler?.removeCallbacksAndMessages(null)
        handler = null
        overlayView?.let { view ->
            try {
                windowManager?.removeView(view)
            } catch (_: Exception) {
                // View already detached
            }
        }
        overlayView = null
        windowManager = null
    }

    private fun dp(context: Context, dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }
}
