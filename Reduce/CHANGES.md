# 修改记录 — Reduce Bug 修复与签名配置

> **修订记录**
>
> - v1.2.0: 修复计时不准确、拦截后未关闭应用、行为检测误判打字三个 Bug
> - v1.1.0-2: 仓库整理，添加 README.md / .gitignore，清理临时文件，文档归档到 docs/
> - v1.1.0: 修复多个恶性 Bug，添加 Release 签名配置以解决 vivo 设置限制问题

---

## v1.2.0 — 三项核心 Bug 修复（计时 / 关闭应用 / 误判）

### 🛠️ 修改文件

### `android/app/src/main/java/com/reduce/app/LimitMonitor.kt` — Bug1: 计时不准确 + Bug2: 拦截后未关闭应用

- **Bug1 — 计时不准确**
  - **问题**：拦截触发后的冷却期（8秒）和同包名抑制期（20秒）会 early return 跳过整个 `tick()`，导致最长 20 秒的使用时间不被计入。用户看了 1 分 14 秒视频，app 的 1 分钟计时还没到。
  - **修改位置**：`tick()` 方法，原第 47 行和第 59 行
  - **修复内容**：将 `coolDownUntilMs` 和 `suppressPackage` 的检查从 `tick()` 顶部移到 `isOverLimit` 判断内部、`triggerBlock()` 调用之前。冷却/抑制期间仍然正常计时，只是不触发拦截弹窗。

- **Bug2 — 拦截后未关闭应用**
  - **问题**：`goHome()` 只执行了 `GLOBAL_ACTION_HOME` 回桌面，短视频 app 仍在后台运行，用户可以从最近任务直接返回继续刷。
  - **修改位置**：`goHome()` 方法 + `triggerBlock()` 调用处
  - **修复内容**：`goHome()` 新增 `topPackage` 参数，在执行 HOME 动作后调用 `ActivityManager.killBackgroundProcesses(topPackage)` 杀死后台进程。新增 `android.app.ActivityManager` 导入。

---

### `android/app/src/main/java/com/reduce/app/ShortVideoAccessibilityService.kt` — Bug3: 过滤文本编辑类滚动

- **问题**：所有 `TYPE_VIEW_SCROLLED` 事件无差别记录，包括输入法弹出导致的页面重排、文本框光标移动、候选词滚动等，导致打字也被误判为刷短视频。
- **修改位置**：`onAccessibilityEvent()` 中 `TYPE_VIEW_SCROLLED` 分支
- **修复内容**：检查事件来源控件的 `className`，排除包含 `EditText`、`Editor`、`Input` 的控件产生的滚动事件，只有非文本类滚动才传递给 `ShortVideoBehaviorSignals.onScroll()`。

---

### `android/app/src/main/java/com/reduce/app/ShortVideoBehaviorSignals.kt` — Bug3: 提高行为判定阈值

- **问题**：原阈值过低（12 秒内仅需 3 次滚动），打字等正常操作容易误触发。
- **修改位置**：`isLikelyShortVideo()` 方法
- **修复内容**：滚动次数阈值从 3 次提高到 **5 次**，时间窗口从 12 秒缩短到 **8 秒**。真实短视频翻页约 1-2 次/秒，8 秒内轻松超过 5 次；正常使用几乎不可能 8 秒内产生 5 次非文本滚动。

---

### `android/app/src/main/AndroidManifest.xml` — 新增权限声明

- **修改内容**：添加 `android.permission.KILL_BACKGROUND_PROCESSES` 权限，支持 Bug2 修复中的 `killBackgroundProcesses()` 调用。

---

### 📊 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `android/app/src/main/java/com/reduce/app/LimitMonitor.kt` |
| **修改** | `android/app/src/main/java/com/reduce/app/ShortVideoAccessibilityService.kt` |
| **修改** | `android/app/src/main/java/com/reduce/app/ShortVideoBehaviorSignals.kt` |
| **修改** | `android/app/src/main/AndroidManifest.xml` |

---

### 🧪 测试方式

1. **Bug1 验证**：启动限制 → 刷短视频 → 触发拦截 → 立即回到短视频 app → 观察计时是否继续正常累加（不再有"时间空洞"）
2. **Bug2 验证**：触发拦截回到桌面后 → 打开最近任务列表 → 确认短视频 app 已被关闭
3. **Bug3 验证**：打开任意聊天 app 打字 → 确认不再被误判为刷短视频；然后刷短视频 → 确认仍能正确检测

## 🛠️ 修改文件

### `android/app/src/main/java/com/reduce/app/MainActivity.kt` — 修复识别按钮覆盖目标列表

- **修改位置**：约第 304 行，"识别并填入当前应用名"按钮的 onClick 逻辑
- **Bug 描述**：点击"识别并填入当前应用名"按钮时，会将整个目标应用列表**替换**为检测到的单个应用名，导致之前配置的所有目标应用全部丢失。
- **修复内容**：将 `targetPackages = UsageUtils.getAppLabel(...)` 改为 `targetPackages = appendTarget(targetPackages, label)`，现在是**追加**而非覆盖。

---

### `android/app/src/main/java/com/reduce/app/OverlayController.kt` — 修复崩溃和静默失败

- **Bug 1 — hide() 崩溃**：`windowManager.removeView(view)` 在 View 已脱离窗口时会抛 `IllegalArgumentException` 导致 App 崩溃。已用 try-catch 包裹。
- **Bug 2 — addView 失败后拦截永久失效**：如果 `wm.addView()` 抛出异常（如悬浮窗权限在弹出瞬间被撤销），`overlayView` 未被重置为 null，后续所有 `showBlockingOverlay` 调用都会在 `if (overlayView != null) return` 处静默返回，**拦截功能永久失效直到重启 App**。已在 catch 中清理状态。
- **Bug 3 — 卡片宽度硬编码像素**：原来卡片宽度硬编码为 `800` 像素。在低 DPI 屏幕上溢出屏幕，在高 DPI 屏幕上过小。改为 `300dp` 密度自适应，并新增 `dp()` 工具方法，所有间距/圆角统一使用 dp 单位。
- **其他**：移除已废弃的 `FLAG_FULLSCREEN`。

---

### `android/app/src/main/java/com/reduce/app/LimitMonitor.kt` — 修复上下文泄漏

- **修改位置**：`start()` 方法
- **Bug 描述**：`start(context)` 将 Service 的 Context 直接捕获进长期存活的 Runnable 闭包。如果 `stop()` 因异常未正常调用，会导致 Service 实例泄漏。
- **修复内容**：改为 `context.applicationContext`，Application 上下文的生命周期与进程一致，不会泄漏。

---

### `android/app/src/main/java/com/reduce/app/LimitForegroundService.kt` — 增强服务重启可靠性

- **修改位置**：新增 `onStartCommand()` 方法
- **修改内容**：显式返回 `START_STICKY`，确保系统因内存不足杀死服务后会自动重启，对 vivo 等激进杀后台的机型尤为重要。

---

### `android/app/src/main/res/xml/accessibility_service.xml` — 补全事件类型声明

- **Bug 描述**：代码中 `ShortVideoAccessibilityService` 处理了 `TYPE_WINDOWS_CHANGED` 事件，但 XML 配置中只声明了 `typeWindowStateChanged|typeViewScrolled`，缺少 `typeWindowsChanged`。部分设备上该事件不会被分发，影响前台包名检测准确性。
- **修复内容**：事件类型中添加 `typeWindowsChanged`。

---

### `android/app/build.gradle` — 添加 Release 签名配置

- **问题**：用户在 vivo 手机上安装 debug APK 时，需要手动"解除设置限制"才能正常使用。这是因为 debug 签名的 APK 被 vivo 系统视为不可信来源。GitHub 上的开源项目（如 Kazumi）发布的是 release 签名 APK，所以不需要。
- **修改内容**：
  - 添加 `signingConfigs.release`，从 `keystore.properties` 文件读取密钥库配置
  - `buildTypes.release` 关联 `signingConfigs.release`
  - 版本号更新至 `versionCode = 11`, `versionName = "1.1.0"`

---

## 🆕 新增文件

### `android/keystore.properties` — 签名密钥库配置

- **功能**：存储 release 签名所需的密钥库路径和密码，被 `build.gradle` 读取。
- **注意**：此文件已加入 `.gitignore`，不会被提交到版本控制。

### `android/keystore.properties.example` — 配置模板

- **功能**：供参考的 keystore.properties 模板文件。

### `android/release-key.jks` — Release 签名密钥库

- **功能**：APK 签名用的 Java Keystore 文件。
- **注意**：已加入 `.gitignore`，**请务必妥善备份此文件**，丢失后无法发布与现有签名一致的更新。

### `android/.gitignore` — Git 忽略规则

- **功能**：忽略 `keystore.properties`、`*.jks`、`*.keystore` 等敏感签名文件。

---

## 📊 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `android/app/src/main/java/com/reduce/app/MainActivity.kt` |
| **修改** | `android/app/src/main/java/com/reduce/app/OverlayController.kt` |
| **修改** | `android/app/src/main/java/com/reduce/app/LimitMonitor.kt` |
| **修改** | `android/app/src/main/java/com/reduce/app/LimitForegroundService.kt` |
| **修改** | `android/app/src/main/res/xml/accessibility_service.xml` |
| **修改** | `android/app/build.gradle` |
| **新增** | `android/keystore.properties` |
| **新增** | `android/keystore.properties.example` |
| **新增** | `android/release-key.jks` |
| **新增** | `android/.gitignore` |

---

## 🧪 测试方式

1. **验证 Release APK 签名**：安装 `android/app/build/outputs/apk/release/app-release.apk` 到 vivo 手机，确认不再出现"解除设置限制"提示。
2. **验证识别按钮**：在目标应用栏已有内容的情况下，点击"识别并填入当前应用名"，确认是追加而非覆盖。
3. **验证拦截功能**：设置 0 分钟限制，开启监控，切换到短视频应用，确认拦截遮罩正常弹出、倒计时正常、5 秒后正常回到桌面。
4. **验证服务恢复**：启用限制后，在系统设置中强制停止 Reduce，观察服务是否自动恢复。

---

## 📦 构建说明

构建 Release APK 需指定 JDK 17：

```bash
cd android
JAVA_HOME="E:/Java/JDK17" ./gradlew :app:assembleRelease
```

输出路径：`android/app/build/outputs/apk/release/app-release.apk`
