# 初步排查证据

## 范围与可信度
2026-09-16，基线提交 `fb96034`，只读代码/历史并运行隔离探针；未修改应用代码、真实数据库或正在使用的服务。现场锁屏故障尚未复现。以下区分源码事实、受控验证与待证实假设。

## 1. 连接关闭日志
来源：`start-server.ps1:329`。`phase=header path=unknown timeout=False` 表示请求路径尚未解析、连接关闭且截止计时器未标记超时，不含照片身份。

利用现有 `scripts/lan-test-helpers.mjs` 启动临时 PowerShell 服务，建立 TCP 空连接后正常关闭；同一服务随后执行合成图片上传、拉取 pending、人工模拟成功回执及状态查询，得到：

```json
{"emptyConnectionProducesReportedLog":true,"uploadHttp":202,"confirmHttp":200,"statusHttp":201,"state":"saved"}
```

结论：该日志可独立于上传失败产生，不能直接推出连接处理回归。探针只验证服务协议；确认由探针模拟，没有证明实际图片已进 IndexedDB，更没有复现锁屏。

## 2. 上传生命周期与历史验证盲区
- `src/utils/lanBridge.ts:158` Web 保存依赖电脑浏览器 `/pending` 轮询；完成后重试 `/confirm`。后台计时器/冻结可能影响交付，但尚无现场因果证据。
- `src/utils/lanUpload.ts:72` 按原身份核对后决定是否发 POST；单次发送 45 秒，状态请求 8 秒，等待确认整体 30 秒。`src/utils/asyncDeadline.ts` 已处理恢复时检查绝对截止时间；不能重复宣称当前完全没有恢复感知。
- `LanMobileCollector.tsx:154` 会话刷新用 2 秒 interval；快照轮询与当前图片保存状态核对是不同链路。
- `scripts/verify-lan-upload-ui.mjs:28` 启动 Chrome 时使用 `--disable-background-timer-throttling`；Electron 测试入口 `scripts/project-list-electron.cjs:6` 调用 `setBackgroundThrottling(false)`。生产 `electron/main.cjs` 未配置同样策略。
- 上次任务 `.trellis/tasks/archive/2026-09/09-15-lan-upload-stuck/verification.md` 已注明未做真机热点/系统强杀等场景；既有通过结果不能扩展解释为 OS 锁屏已验证。

用户已补充：电脑和手机锁屏两种情况都有，电脑会自动锁屏。复现范围确定为两端分别暂停及组合恢复，优先电脑自动锁屏；再定位手机请求、电脑交付、IDB 或回执的具体停顿阶段。该补充不能证明系统睡眠或后台节流就是根因，不以延长超时作为已确定的修复。

## 3. 组名缺口（可复现）
- `src/App.tsx:224` 工作台 `registerBinding` 初次配置 `{groupId, groupTitle:''}`；后续沿用缓存标题。
- `src/utils/lanGroupSnapshot.ts:43` 只读取系统文档，没有读取真实组元数据；多系统且传入空标题时回退“未命名项目组”。
- `src/context/AppContext.tsx:191` 已有 `loadProjectGroup` + `updateProjectGroupAndSystems` 保存元数据；修复应利用这条链路，不另建名称存储。

通过 esbuild 打包真实 `lanGroupSnapshot.ts`，仅替换 db 依赖为两个同组系统夹具（项目名都已填写），输出：

```json
{"inputTitle":"","documentProjectName":"已填写的项目名","outputTitle":"未命名项目组","systemCount":2}
{"inputTitle":"未命名项目组","documentProjectName":"已填写的项目名","outputTitle":"未命名项目组","systemCount":2}
```

这是快照层受控复现，不代表已确认用户从哪个入口启动；完整修复还需验证真实组记录与会话改名刷新。

## 4. Chrome 拍照重复选择
`LanMobileCollector.tsx:169` 总是在进入网页相机后才调用 `getUserMedia`；不可用/拒绝时设置 `cameraFallbackAvailable` 并返回来源菜单。`startWebCamera` 不先分辨安全上下文或 API 存在性；现成系统 input 已有 `capture="environment"`。

普通局域网 HTTP 通常不具备网页相机所需的安全上下文，因此先进入网页相机再返回是重点候选。源码足以确认应用存在第二次点击分支，尚未实测用户手机系统选择器。

`git show e632502^:Work/picture_ocr/src/components/LanMobileCollector.tsx` 中已经有相同的 `getUserMedia` → 失败 → “使用系统相机回退”流程：它不是 v0.8.2 首次新增的问题。`lanGroupSnapshot.ts` 最近历史也早于该修复提交。不能将三项都归因于最近上传改动。
