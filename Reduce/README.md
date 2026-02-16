# Reduce

> 控制分心，优先完成今天真正重要的事。

Reduce 是一款 Android 应用，帮助你控制刷短视频的时间。它不简单粗暴地禁用某个 App，而是**识别"刷短视频"的行为**（竖屏 + 连续滑动），当你超过自己设定的每日时限后，弹出提醒并将你送回桌面。

## 功能

- **行为识别**：通过屏幕方向和滚动频率判断是否在刷短视频，横屏看普通视频不受影响
- **灵活限制**：支持 0~240 分钟的每日时限，0 分钟 = 当天完全禁刷
- **限制理由**：预设"备考学习""专注工作"等理由，也可自定义；超时后弹窗展示理由和警示名言
- **温和拦截**：遮罩提示 5 秒倒计时后自动回到桌面，不强制杀进程
- **预设目标**：内置抖音、快手、小红书、B站、微博、YouTube、TikTok 等主流应用

## 安装

从 [Releases](../../releases) 页面下载最新的 `app-release.apk` 安装即可。

首次使用需要授予以下权限（App 内有引导按钮）：

| 权限 | 用途 |
|---|---|
| 使用情况访问 | 查询当前前台应用 |
| 悬浮窗 | 显示拦截遮罩 |
| 无障碍服务 | 检测滑动行为 + 执行返回桌面 |
| 电池优化豁免（建议） | 防止后台服务被系统杀死 |

## 构建

**环境要求**：JDK 17、Android SDK 34

双击 `build-release.bat` 一键构建，或手动执行：

```bash
cd android
JAVA_HOME="你的JDK17路径" ./gradlew :app:assembleRelease
```

输出路径：`android/app/build/outputs/apk/release/app-release.apk`

> 首次构建需要先配置签名，参考 `android/keystore.properties.example` 创建 `android/keystore.properties`。

## 技术栈

- Kotlin 1.9 + Jetpack Compose + Material 3
- AccessibilityService + UsageStatsManager + System Alert Window
- minSdk 24 / targetSdk 34

## 项目结构

```
android/app/src/main/java/com/reduce/app/
├── MainActivity.kt                    # 入口，设置界面
├── LimitMonitor.kt                    # 核心引擎，每秒检测是否超时
├── ShortVideoAccessibilityService.kt  # 无障碍服务，监听滑动事件
├── ShortVideoBehaviorSignals.kt       # 行为信号判定
├── OverlayController.kt              # 拦截遮罩 UI
├── SettingsStore.kt                   # 用户设置持久化
├── UsageTracker.kt                    # 每日使用时长计数
├── UsageUtils.kt                      # 前台应用查询工具
├── PermissionUtils.kt                 # 权限状态检测
└── LimitForegroundService.kt          # 前台服务，保活监控
```

## License

MIT
