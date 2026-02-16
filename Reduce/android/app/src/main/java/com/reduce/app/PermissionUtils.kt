package com.reduce.app

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.view.accessibility.AccessibilityManager
import android.os.Process
import android.os.PowerManager
import android.provider.Settings
import android.text.TextUtils

object PermissionUtils {
    fun hasUsageAccess(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun canDrawOverlays(context: Context): Boolean {
        return Settings.canDrawOverlays(context)
    }

    fun isAccessibilityEnabled(context: Context): Boolean {
        val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        if (!manager.isEnabled) return false

        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val targetFull = ComponentName(context, ShortVideoAccessibilityService::class.java).flattenToString()
        val targetShort = ComponentName(context, ShortVideoAccessibilityService::class.java).flattenToShortString()
        return enabledServices
            .split(":")
            .any { TextUtils.equals(it, targetFull) || TextUtils.equals(it, targetShort) }
    }

    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isIgnoringBatteryOptimizations(context.packageName)
    }
}
