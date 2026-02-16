package com.reduce.app

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

class ShortVideoAccessibilityService : AccessibilityService() {
    override fun onServiceConnected() {
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        val pkg = event.packageName?.toString()
        if (!pkg.isNullOrBlank()) {
            setLatestPackage(pkg)
        }
        when (event.eventType) {
            AccessibilityEvent.TYPE_VIEW_SCROLLED -> {
                val cls = event.className?.toString() ?: ""
                val isTextRelated = cls.contains("EditText", ignoreCase = true)
                        || cls.contains("Editor", ignoreCase = true)
                        || cls.contains("Input", ignoreCase = true)
                if (!isTextRelated) {
                    ShortVideoBehaviorSignals.onScroll(pkg)
                }
            }
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
            AccessibilityEvent.TYPE_WINDOWS_CHANGED -> {
                ShortVideoBehaviorSignals.onWindowChanged(pkg)
            }
        }
    }

    override fun onInterrupt() {
        // no-op
    }

    override fun onDestroy() {
        instance = null
        latestPackage = null
        latestPackageAtMs = 0L
        super.onDestroy()
    }

    companion object {
        var instance: ShortVideoAccessibilityService? = null
            private set
        @Volatile
        private var latestPackage: String? = null
        @Volatile
        private var latestPackageAtMs: Long = 0L

        private fun setLatestPackage(value: String) {
            latestPackage = value
            latestPackageAtMs = System.currentTimeMillis()
        }

        fun getLatestPackage(maxAgeMs: Long = 4_000L): String? {
            val age = System.currentTimeMillis() - latestPackageAtMs
            return if (age in 0..maxAgeMs) latestPackage else null
        }
    }
}
