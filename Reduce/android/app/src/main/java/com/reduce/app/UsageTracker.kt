package com.reduce.app

import android.content.Context
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object UsageTracker {
    private const val PREFS = "reduce_usage"
    private const val KEY_USED_SEC = "used_seconds"
    private const val KEY_DATE = "used_date"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getUsedSeconds(context: Context): Int {
        return prefs(context).getInt(KEY_USED_SEC, 0)
    }

    fun addSeconds(context: Context, seconds: Int) {
        val current = getUsedSeconds(context)
        prefs(context).edit().putInt(KEY_USED_SEC, current + seconds).apply()
    }

    fun resetIfNewDay(context: Context) {
        val today = currentDateKey()
        val stored = prefs(context).getString(KEY_DATE, "") ?: ""
        if (stored != today) {
            prefs(context).edit()
                .putString(KEY_DATE, today)
                .putInt(KEY_USED_SEC, 0)
                .apply()
        }
    }

    private fun currentDateKey(): String {
        val formatter = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        return formatter.format(Date())
    }
}