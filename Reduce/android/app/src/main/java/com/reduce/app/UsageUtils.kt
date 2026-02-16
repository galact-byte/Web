package com.reduce.app

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.app.ActivityManager
import android.content.Intent
import android.content.Context
import android.content.pm.PackageManager
import android.app.usage.UsageStats
import java.util.Locale

object UsageUtils {
    fun getTopPackage(
        context: Context,
        excludePackage: String? = null,
        lookbackMs: Long = 10_000L
    ): String? {
        val mgr = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val end = System.currentTimeMillis()
        val begin = end - lookbackMs
        val events = mgr.queryEvents(begin, end)
        val event = UsageEvents.Event()
        var lastForeground: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                if (excludePackage == null || event.packageName != excludePackage) {
                    lastForeground = event.packageName
                }
            }
        }
        return lastForeground
    }

    fun getTopPackageByUsageStats(context: Context, lookbackMs: Long = 60_000L): String? {
        val mgr = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val end = System.currentTimeMillis()
        val begin = end - lookbackMs
        val stats = mgr.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, begin, end)
        if (stats.isNullOrEmpty()) return null
        return stats
            .asSequence()
            .filter { it.lastTimeUsed > 0L }
            .maxByOrNull { it.lastTimeUsed }
            ?.packageName
    }

    fun getCurrentTopPackage(context: Context): String? {
        val fromAccessibility = ShortVideoAccessibilityService.getLatestPackage(maxAgeMs = 4_000L)
        if (!fromAccessibility.isNullOrBlank()) return fromAccessibility

        val fromEvents = getTopPackage(context, lookbackMs = 5_000L)
        if (!fromEvents.isNullOrBlank()) return fromEvents

        val fromStats = getTopPackageByUsageStats(context, lookbackMs = 90_000L)
        if (!fromStats.isNullOrBlank()) return fromStats

        return null
    }

    fun getAppLabel(context: Context, packageName: String): String {
        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            packageName
        }
    }

    fun matchesTargets(context: Context, topPackage: String, targets: Set<String>): Boolean {
        if (targets.isEmpty()) return false
        val appName = getAppLabel(context, topPackage).lowercase(Locale.getDefault())
        val packageName = topPackage.lowercase(Locale.getDefault())
        return targets.any { token ->
            val t = token.trim().lowercase(Locale.getDefault())
            t.isNotEmpty() && (packageName == t || appName.contains(t))
        }
    }

    fun isHomeApp(context: Context, packageName: String): Boolean {
        val intent = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
        }
        val infos = context.packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
        return infos.any { it.activityInfo?.packageName == packageName }
    }

    fun isSelfAppForeground(context: Context): Boolean {
        val mgr = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val myPid = android.os.Process.myPid()
        return mgr.runningAppProcesses?.any { proc ->
            proc.pid == myPid && proc.importance <= ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
        } == true
    }
}
