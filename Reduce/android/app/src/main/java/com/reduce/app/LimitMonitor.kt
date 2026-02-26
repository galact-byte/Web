package com.reduce.app

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Handler
import android.os.Looper
import android.widget.Toast

object LimitMonitor {
    private val handler = Handler(Looper.getMainLooper())
    private var running = false
    private var blocking = false
    private var coolDownUntilMs = 0L
    private var suppressPackage: String? = null
    private var suppressUntilMs = 0L

    private val ignoredPackages = setOf(
        "com.android.systemui",
        "com.google.android.permissioncontroller"
    )

    fun start(context: Context) {
        if (running) return
        running = true
        val appContext = context.applicationContext
        handler.post(object : Runnable {
            override fun run() {
                if (!running) return
                tick(appContext)
                handler.postDelayed(this, 1000L)
            }
        })
    }

    fun stop() {
        running = false
        blocking = false
        handler.removeCallbacksAndMessages(null)
        OverlayController.hide()
    }

    private fun tick(context: Context) {
        UsageTracker.resetIfNewDay(context)

        if (!PermissionUtils.hasUsageAccess(context)) return
        if (UsageUtils.isSelfAppForeground(context)) return

        if (SettingsStore.getOnlyPortrait(context)) {
            val orientation = context.resources.configuration.orientation
            if (orientation != Configuration.ORIENTATION_PORTRAIT) return
        }

        val topPackage = UsageUtils.getCurrentTopPackage(context) ?: return
        if (topPackage == context.packageName) return
        if (ignoredPackages.contains(topPackage)) return
        if (UsageUtils.isHomeApp(context, topPackage)) return

        val behaviorMode = SettingsStore.isBehaviorMode(context)
        val targets = SettingsStore.getTargetPackages(context)
        val targetMatched = UsageUtils.matchesTargets(context, topPackage, targets)
        if (behaviorMode) {
            val behaviorMatched = ShortVideoBehaviorSignals.isLikelyShortVideo(topPackage)
            // Behavior mode with target fallback: avoids missing events causing no-limit situations.
            if (!behaviorMatched && !targetMatched) return
        } else {
            if (!targetMatched) return
        }

        val limitSeconds = SettingsStore.getLimitMinutes(context) * 60
        UsageTracker.addSeconds(context, 1)
        val used = UsageTracker.getUsedSeconds(context)

        // 0 minute means no short-video use is allowed today.
        val isOverLimit = if (limitSeconds == 0) used >= 1 else used >= limitSeconds
        if (isOverLimit) {
            val now = System.currentTimeMillis()
            if (now < coolDownUntilMs) return
            if (suppressPackage == topPackage && now < suppressUntilMs) return
            triggerBlock(context, topPackage)
        }
    }

    private fun triggerBlock(context: Context, topPackage: String) {
        if (blocking) return
        blocking = true

        val reason = SettingsStore.getReasonText(context)
        if (!PermissionUtils.canDrawOverlays(context)) {
            Toast.makeText(context, "需要开启悬浮窗权限才能拦截", Toast.LENGTH_SHORT).show()
            blocking = false
            return
        }

        OverlayController.showBlockingOverlay(
            context = context,
            reason = reason,
            seconds = 5
        ) {
            goHome(context, topPackage)
            // Prevent repeated popups caused by delayed foreground package updates.
            coolDownUntilMs = System.currentTimeMillis() + 8_000L
            suppressPackage = topPackage
            suppressUntilMs = System.currentTimeMillis() + 20_000L
            blocking = false
        }
    }

    private fun goHome(context: Context, topPackage: String) {
        val service = ShortVideoAccessibilityService.instance
        if (service != null) {
            service.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME)
        } else {
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        }
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        am.killBackgroundProcesses(topPackage)
    }
}
