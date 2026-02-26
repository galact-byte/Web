package com.reduce.app

import java.util.ArrayDeque

object ShortVideoBehaviorSignals {
    private const val MAX_EVENTS = 40
    private val scrollEvents = ArrayDeque<Long>()
    private val windowEvents = ArrayDeque<Pair<Long, String>>()

    @Synchronized
    fun onScroll(packageName: String?) {
        if (packageName.isNullOrBlank()) return
        val now = System.currentTimeMillis()
        scrollEvents.addLast(now)
        while (scrollEvents.size > MAX_EVENTS) scrollEvents.removeFirst()
    }

    @Synchronized
    fun onWindowChanged(packageName: String?) {
        if (packageName.isNullOrBlank()) return
        val now = System.currentTimeMillis()
        windowEvents.addLast(now to packageName)
        while (windowEvents.size > MAX_EVENTS) windowEvents.removeFirst()
    }

    @Synchronized
    fun isLikelyShortVideo(topPackage: String, nowMs: Long = System.currentTimeMillis()): Boolean {
        // Heuristic: frequent vertical scrolls in recent seconds.
        // Require recent scrolls to avoid false positives on launcher/recents screens.
        val recentWindow = windowEvents.lastOrNull { nowMs - it.first <= 20_000L }
        val recentScrollCount = scrollEvents.count { nowMs - it <= 8_000L }
        if (recentScrollCount < 5) return false
        return recentWindow == null || recentWindow.second == topPackage
    }
}
