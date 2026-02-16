# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Reduce 是一个 Android 应用，用于帮助用户控制刷短视频的时间。它不针对特定 App，而是识别"刷短视频"行为（竖屏 + 连续滚动），当用户超过设定的每日时限后，显示遮罩拦截并在 5 秒倒计时后将用户送回桌面。

## Tech Stack

- **语言**: Kotlin 1.9.24
- **UI**: Jetpack Compose + Material 3
- **SDK**: minSdk 24 / targetSdk 34 / compileSdk 34
- **构建**: Gradle 8.2.2, AGP 8.2.2, JDK 17
- **Compose Compiler**: 1.5.14

## Build Commands

所有命令在 `android/` 目录下执行：

```bash
./gradlew clean                # 清理
./gradlew :app:assembleDebug   # 构建 Debug APK
./gradlew :app:installDebug    # 安装到设备
./gradlew :app:lint            # 运行 Lint
```

**输出 APK 路径**: `android/app/build/outputs/apk/debug/app-debug.apk`

**无自动化测试**，所有行为检测逻辑需在物理设备上手动验证（无障碍服务和悬浮窗在模拟器上表现不可靠）。

## Architecture

包路径: `com.reduce.app`，源码位于 `android/app/src/main/java/com/reduce/app/`。

### 核心运行流程

```
MainActivity (入口/设置界面)
    └→ 启动 LimitForegroundService (前台服务，保活)
         └→ LimitMonitor.start() (每秒 tick 循环)
              ├→ UsageTracker: 按日累计短视频使用秒数
              ├→ UsageUtils: 查询当前前台应用包名
              ├→ ShortVideoBehaviorSignals: 行为检测（滚动频率）
              └→ 超时 → OverlayController: 显示拦截遮罩
                        └→ goHome(): 通过 AccessibilityService 执行回桌面
```

### 关键组件职责

| 文件 | 角色 |
|---|---|
| `LimitMonitor.kt` | **核心引擎** — Singleton，每秒 tick 判断是否在刷短视频、是否超时，触发拦截。包含冷却窗口和同包名抑制逻辑防止重复弹窗 |
| `ShortVideoAccessibilityService.kt` | 无障碍服务 — 监听滚动/窗口事件，记录最新前台包名，执行 GLOBAL_ACTION_HOME |
| `ShortVideoBehaviorSignals.kt` | 行为信号判定 — 根据滚动频率等特征判断是否为短视频浏览行为 |
| `OverlayController.kt` | 悬浮窗遮罩 — 显示拦截卡片（限制理由 + 警示名言 + 倒计时） |
| `SettingsStore.kt` | SharedPreferences 持久化 — 管理限制时长、理由、目标应用、行为模式等设置 |
| `UsageTracker.kt` | 使用时长计数器 — 按日记录已使用秒数，跨天自动重置 |
| `UsageUtils.kt` | 系统查询工具 — 获取前台应用（多重兜底：无障碍包名 + UsageEvents + UsageStats）、判断桌面应用 |
| `PermissionUtils.kt` | 权限检查 — 使用情况访问、悬浮窗、无障碍三项权限的状态检测 |
| `LimitForegroundService.kt` | 前台服务 — 保持 LimitMonitor 后台运行 |

### 检测策略（双模式）

1. **行为模式** (`behaviorMode=true`): 通过无障碍事件的滚动频率判定 + 目标应用兜底
2. **目标应用模式** (`behaviorMode=false`): 仅匹配配置的目标应用包名列表

### 拦截策略

遮罩拦截 → 5 秒倒计时 → AccessibilityService.GLOBAL_ACTION_HOME 回桌面。冷却 8 秒 + 同包名抑制 20 秒，防止回桌面延迟导致的重复弹窗。

## Required Permissions

- `PACKAGE_USAGE_STATS` — 查询前台应用和使用时长
- `SYSTEM_ALERT_WINDOW` — 显示全屏拦截遮罩
- `BIND_ACCESSIBILITY_SERVICE` — 监听 UI 事件 + 执行回桌面
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_DATA_SYNC` — 保活监控服务

## Development Notes

- 所有 UI 使用 Jetpack Compose 编写，新增 UI 组件同样使用 Compose + Material 3
- `strings.xml` 等资源文件必须使用 UTF-8 编码，此前出现过编码损坏导致编译失败的问题
- 版本号维护在 `android/app/build.gradle` 的 `versionCode` / `versionName`
- 建议在 vivo 等国产机型上测试电池优化豁免，否则后台服务容易被杀
