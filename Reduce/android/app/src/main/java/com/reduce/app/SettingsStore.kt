package com.reduce.app

import android.content.Context

object SettingsStore {
    private const val PREFS = "reduce_settings"
    private const val KEY_LIMIT_MIN = "limit_minutes"
    private const val KEY_REASON_PRESET = "reason_preset"
    private const val KEY_REASON_CUSTOM = "reason_custom"
    private const val KEY_ONLY_PORTRAIT = "only_portrait"
    private const val KEY_TARGET_PACKAGES = "target_packages"
    private const val KEY_BEHAVIOR_MODE = "behavior_mode"

    private const val DEFAULT_LIMIT_MIN = 5
    private const val DEFAULT_REASON = "备考学习"
    private const val CUSTOM_REASON = "自定义"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getLimitMinutes(context: Context): Int {
        return prefs(context).getInt(KEY_LIMIT_MIN, DEFAULT_LIMIT_MIN).coerceIn(0, 240)
    }

    fun setLimitMinutes(context: Context, minutes: Int) {
        prefs(context).edit().putInt(KEY_LIMIT_MIN, minutes.coerceIn(0, 240)).apply()
    }

    fun getReasonPreset(context: Context): String {
        return prefs(context).getString(KEY_REASON_PRESET, DEFAULT_REASON) ?: DEFAULT_REASON
    }

    fun setReasonPreset(context: Context, value: String) {
        prefs(context).edit().putString(KEY_REASON_PRESET, value).apply()
    }

    fun getReasonCustom(context: Context): String {
        return prefs(context).getString(KEY_REASON_CUSTOM, "") ?: ""
    }

    fun setReasonCustom(context: Context, value: String) {
        prefs(context).edit().putString(KEY_REASON_CUSTOM, value).apply()
    }

    fun getOnlyPortrait(context: Context): Boolean {
        return prefs(context).getBoolean(KEY_ONLY_PORTRAIT, true)
    }

    fun setOnlyPortrait(context: Context, value: Boolean) {
        prefs(context).edit().putBoolean(KEY_ONLY_PORTRAIT, value).apply()
    }

    fun isBehaviorMode(context: Context): Boolean {
        return prefs(context).getBoolean(KEY_BEHAVIOR_MODE, false)
    }

    fun setBehaviorMode(context: Context, value: Boolean) {
        prefs(context).edit().putBoolean(KEY_BEHAVIOR_MODE, value).apply()
    }

    fun getTargetPackagesText(context: Context): String {
        return prefs(context).getString(KEY_TARGET_PACKAGES, "") ?: ""
    }

    fun setTargetPackagesText(context: Context, value: String) {
        prefs(context).edit().putString(KEY_TARGET_PACKAGES, value).apply()
    }

    fun getTargetPackages(context: Context): Set<String> {
        return getTargetPackagesText(context)
            .split(",", " ", "\n", "\t")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .toSet()
    }

    fun getReasonText(context: Context): String {
        val preset = getReasonPreset(context)
        return if (preset == CUSTOM_REASON) {
            val custom = getReasonCustom(context).trim()
            if (custom.isNotEmpty()) custom else CUSTOM_REASON
        } else {
            preset
        }
    }
}
