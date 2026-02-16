package com.reduce.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.foundation.shape.RoundedCornerShape

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    HomeScreen(
                        onOpenUsageAccess = { openUsageAccessSettings() },
                        onOpenOverlay = { openOverlaySettings() },
                        onOpenAccessibility = { openAccessibilitySettings() },
                        onOpenBatteryOptimization = { openBatteryOptimizationSettings() },
                        onStartService = { startLimitService() },
                        onStopService = { stopLimitService() }
                    )
                }
            }
        }
    }

    private fun openUsageAccessSettings() {
        startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    private fun openOverlaySettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:$packageName")
        )
        startActivity(intent)
    }

    private fun openAccessibilitySettings() {
        startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
    }

    private fun openBatteryOptimizationSettings() {
        try {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
            )
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }

    private fun startLimitService() {
        if (!PermissionUtils.hasUsageAccess(this)) {
            Toast.makeText(this, getString(R.string.toast_need_usage_permission), Toast.LENGTH_SHORT).show()
            return
        }
        if (!PermissionUtils.canDrawOverlays(this)) {
            Toast.makeText(this, getString(R.string.toast_need_overlay_permission), Toast.LENGTH_SHORT).show()
            return
        }
        val intent = Intent(this, LimitForegroundService::class.java)
        ContextCompat.startForegroundService(this, intent)
        Toast.makeText(this, getString(R.string.toast_limit_enabled), Toast.LENGTH_SHORT).show()
    }

    private fun stopLimitService() {
        val intent = Intent(this, LimitForegroundService::class.java)
        stopService(intent)
        Toast.makeText(this, getString(R.string.toast_limit_disabled), Toast.LENGTH_SHORT).show()
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun HomeScreen(
    onOpenUsageAccess: () -> Unit,
    onOpenOverlay: () -> Unit,
    onOpenAccessibility: () -> Unit,
    onOpenBatteryOptimization: () -> Unit,
    onStartService: () -> Unit,
    onStopService: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val reasonPresets = context.resources.getStringArray(R.array.reason_presets).toList()
    val targetPresets = context.resources.getStringArray(R.array.target_app_presets).toList()

    var refreshToken by remember { mutableIntStateOf(0) }
    var limitMinutes by remember { mutableStateOf(SettingsStore.getLimitMinutes(context).toString()) }
    var reasonPreset by remember { mutableStateOf(SettingsStore.getReasonPreset(context)) }
    var reasonCustom by remember { mutableStateOf(SettingsStore.getReasonCustom(context)) }
    var targetPackages by remember { mutableStateOf(SettingsStore.getTargetPackagesText(context)) }
    var onlyPortrait by remember { mutableStateOf(SettingsStore.getOnlyPortrait(context)) }
    var behaviorMode by remember { mutableStateOf(SettingsStore.isBehaviorMode(context)) }
    var reasonMenuExpanded by remember { mutableStateOf(false) }
    var targetMenuExpanded by remember { mutableStateOf(false) }
    var usedSeconds by remember { mutableIntStateOf(UsageTracker.getUsedSeconds(context)) }
    var currentTopPackage by remember { mutableStateOf("-") }
    var selectedTargetPreset by remember { mutableStateOf(targetPresets.first()) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                refreshToken += 1
                usedSeconds = UsageTracker.getUsedSeconds(context)
                currentTopPackage = UsageUtils.getTopPackage(
                    context = context,
                    excludePackage = context.packageName,
                    lookbackMs = 120_000L
                ).orEmpty().ifBlank { "-" }
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val hasUsage = remember(refreshToken) { PermissionUtils.hasUsageAccess(context) }
    val hasOverlay = remember(refreshToken) { PermissionUtils.canDrawOverlays(context) }
    val hasAccessibility = remember(refreshToken) { PermissionUtils.isAccessibilityEnabled(context) }
    val batteryFree = remember(refreshToken) { PermissionUtils.isIgnoringBatteryOptimizations(context) }
    val reasonText = if (reasonPreset == stringResource(R.string.reason_custom)) reasonCustom else reasonPreset

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                brush = Brush.verticalGradient(
                    colors = listOf(Color(0xFFE9F2FF), Color(0xFFF8FBFF), Color(0xFFFFFFFF))
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(PaddingValues(horizontal = 16.dp, vertical = 18.dp)),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF113A6B))
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 18.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = stringResource(R.string.app_title),
                        color = Color.White,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = stringResource(R.string.app_subtitle),
                        color = Color(0xFFE5EEFF),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }

            SectionCard(title = stringResource(R.string.section_status)) {
                StatusLine(stringResource(R.string.permission_usage, if (hasUsage) stringResource(R.string.enabled) else stringResource(R.string.disabled)))
                StatusLine(stringResource(R.string.permission_overlay, if (hasOverlay) stringResource(R.string.enabled) else stringResource(R.string.disabled)))
                StatusLine(stringResource(R.string.permission_accessibility, if (hasAccessibility) stringResource(R.string.enabled) else stringResource(R.string.disabled)))
                StatusLine(stringResource(R.string.permission_battery, if (batteryFree) stringResource(R.string.enabled) else stringResource(R.string.disabled)))
                StatusLine(stringResource(R.string.today_used, usedSeconds))
                StatusLine(stringResource(R.string.current_top_package, currentTopPackage))
            }

            SectionCard(title = stringResource(R.string.section_limit_rule)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(stringResource(R.string.only_portrait))
                    Switch(checked = onlyPortrait, onCheckedChange = { onlyPortrait = it })
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(stringResource(R.string.behavior_mode))
                    Switch(checked = behaviorMode, onCheckedChange = { behaviorMode = it })
                }
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = limitMinutes,
                    onValueChange = { input -> limitMinutes = input.filter { ch -> ch.isDigit() } },
                    label = { Text(stringResource(R.string.limit_minutes)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
            }

            SectionCard(title = stringResource(R.string.section_targets)) {
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = targetPackages,
                    onValueChange = { targetPackages = it },
                    label = { Text(stringResource(R.string.target_packages)) }
                )

                ExposedDropdownMenuBox(
                    expanded = targetMenuExpanded,
                    onExpandedChange = { targetMenuExpanded = !targetMenuExpanded }
                ) {
                    OutlinedTextField(
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        readOnly = true,
                        value = selectedTargetPreset,
                        onValueChange = {},
                        label = { Text(stringResource(R.string.target_preset_add)) },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = targetMenuExpanded)
                        }
                    )
                    DropdownMenu(
                        expanded = targetMenuExpanded,
                        onDismissRequest = { targetMenuExpanded = false }
                    ) {
                        targetPresets.forEach { item ->
                            androidx.compose.material3.DropdownMenuItem(
                                text = { Text(item) },
                                onClick = {
                                    selectedTargetPreset = item
                                    targetMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Button(onClick = {
                        targetPackages = appendTarget(targetPackages, selectedTargetPreset)
                    }) { Text(stringResource(R.string.target_add_selected)) }
                    Button(onClick = {
                        val pkg = UsageUtils.getTopPackage(
                            context = context,
                            excludePackage = context.packageName,
                            lookbackMs = 120_000L
                        ).orEmpty()
                        currentTopPackage = if (pkg.isBlank()) "-" else pkg
                        if (pkg.isNotBlank()) {
                            val label = UsageUtils.getAppLabel(context, pkg)
                            targetPackages = appendTarget(targetPackages, label)
                            Toast.makeText(context, context.getString(R.string.toast_detect_fill_ok), Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, context.getString(R.string.toast_detect_fill_empty), Toast.LENGTH_SHORT).show()
                        }
                    }) { Text(stringResource(R.string.detect_package)) }
                }
            }

            SectionCard(title = stringResource(R.string.section_reason)) {
                ExposedDropdownMenuBox(
                    expanded = reasonMenuExpanded,
                    onExpandedChange = { reasonMenuExpanded = !reasonMenuExpanded }
                ) {
                    OutlinedTextField(
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        readOnly = true,
                        value = reasonPreset,
                        onValueChange = {},
                        label = { Text(stringResource(R.string.reason_title)) },
                        trailingIcon = {
                            ExposedDropdownMenuDefaults.TrailingIcon(expanded = reasonMenuExpanded)
                        }
                    )
                    DropdownMenu(
                        expanded = reasonMenuExpanded,
                        onDismissRequest = { reasonMenuExpanded = false }
                    ) {
                        reasonPresets.forEach { item ->
                            androidx.compose.material3.DropdownMenuItem(
                                text = { Text(item) },
                                onClick = {
                                    reasonPreset = item
                                    reasonMenuExpanded = false
                                }
                            )
                        }
                    }
                }

                if (reasonPreset == stringResource(R.string.reason_custom)) {
                    OutlinedTextField(
                        modifier = Modifier.fillMaxWidth(),
                        value = reasonCustom,
                        onValueChange = { reasonCustom = it },
                        label = { Text(stringResource(R.string.reason_custom_label)) }
                    )
                }
                Text(stringResource(R.string.current_reason, reasonText))
            }

            SectionCard(title = stringResource(R.string.section_actions)) {
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        val minutes = limitMinutes.toIntOrNull() ?: 5
                        val selfName = UsageUtils.getAppLabel(context, context.packageName)
                        val cleanedTarget = targetPackages
                            .split(",", " ", "\n", "\t")
                            .map { it.trim() }
                            .filter {
                                it.isNotEmpty() &&
                                    it != context.packageName &&
                                    !it.equals(selfName, ignoreCase = true)
                            }
                            .joinToString(",")

                        if (targetPackages.isNotBlank() && cleanedTarget.isBlank()) {
                            Toast.makeText(context, context.getString(R.string.toast_target_invalid), Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        if (!behaviorMode && cleanedTarget.isBlank()) {
                            Toast.makeText(context, context.getString(R.string.toast_target_required), Toast.LENGTH_SHORT).show()
                            return@Button
                        }

                        SettingsStore.setLimitMinutes(context, minutes)
                        SettingsStore.setReasonPreset(context, reasonPreset)
                        SettingsStore.setReasonCustom(context, reasonCustom)
                        SettingsStore.setOnlyPortrait(context, onlyPortrait)
                        SettingsStore.setBehaviorMode(context, behaviorMode)
                        SettingsStore.setTargetPackagesText(context, cleanedTarget)
                        targetPackages = cleanedTarget
                        usedSeconds = UsageTracker.getUsedSeconds(context)
                        Toast.makeText(context, context.getString(R.string.toast_save_ok), Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text(stringResource(R.string.save_settings))
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Button(onClick = {
                        UsageTracker.resetIfNewDay(context)
                        usedSeconds = UsageTracker.getUsedSeconds(context)
                    }) { Text(stringResource(R.string.refresh_usage)) }

                    Button(onClick = {
                        context.getSharedPreferences("reduce_usage", android.content.Context.MODE_PRIVATE)
                            .edit().putInt("used_seconds", 0).apply()
                        usedSeconds = 0
                    }) { Text(stringResource(R.string.reset_usage)) }
                }

                Button(modifier = Modifier.fillMaxWidth(), onClick = onOpenUsageAccess) {
                    Text(stringResource(R.string.open_usage_access))
                }
                Button(modifier = Modifier.fillMaxWidth(), onClick = onOpenOverlay) {
                    Text(stringResource(R.string.open_overlay))
                }
                Button(modifier = Modifier.fillMaxWidth(), onClick = onOpenAccessibility) {
                    Text(stringResource(R.string.open_accessibility))
                }
                Button(modifier = Modifier.fillMaxWidth(), onClick = onOpenBatteryOptimization) {
                    Text(stringResource(R.string.open_battery_optimization))
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Button(onClick = onStartService) { Text(stringResource(R.string.enable_limit)) }
                    Button(onClick = onStopService) { Text(stringResource(R.string.disable_limit)) }
                }
            }
        }
    }
}

private fun appendTarget(current: String, value: String): String {
    val set = current
        .split(",", " ", "\n", "\t")
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .toMutableSet()
    set.add(value)
    return set.joinToString(",")
}

@Composable
private fun SectionCard(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFFFF)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF1E3554)
                )
                content()
            }
        )
    }
}

@Composable
private fun StatusLine(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = Color(0xFF2F4667)
    )
}
