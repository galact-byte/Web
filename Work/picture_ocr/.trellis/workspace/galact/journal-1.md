# Journal - galact (Part 1)

> AI development session journal
> Started: 2026-07-21

---

## 2026-07-23 — 检查项交互与安全排序

- 手动新增检查项改为默认必填且插入首位；新增经完整 ID 校验的 `REORDER_ITEMS` reducer action。
- 新增独立排序模式：鼠标/触屏仅可从专用手柄开始拖动，拖动中以悬浮副本、实时预览和 FLIP 动画呈现让位，取消会恢复原顺序。
- 排序拖至列表上下边缘会自动滚动，并在离开边缘、抬起、取消、退出、切换资产和卸载时停止。
- 已通过 reducer、Chrome CDP 浏览器回归、构建和现有 Web/PWA/LAN 验证；Electron 临时输出目录打包成功。默认 `desktop-dist` 输出受 Windows `EPERM` 目录锁影响。
- 发布版本更新至 v0.4.4，工作提交 `5c6fb06`，任务归档提交 `324cc6c`。

---

## 2026-07-31 — 多项目升级后续修复与统一提示

- 修复项目列表将多个互不相关的未分组单系统错误合并成一个“未分组/单系统项目”伪分组（`db.ts` `groupProjectSummaries` 改为每个未分组系统各自成行）。
- 导入数据包改为弹窗内不确定进度条 + 结果面板（成功绿卡/失败红条可重试），去除成功/失败 `alert`。
- 新增全局轻提示 `src/components/Toast.tsx`（`ToastProvider` + `useToast`），将全部 11 处错误 `alert` 换为右上角可堆叠、自动消失的 toast；`main.tsx` 用 `ToastProvider` 包裹 `App`。
- 修复 `verify-inspection-item-interactions.mjs` 在 Windows `core.autocrlf=true` 下因 CRLF 与 LF 专用多行正则失配而必败（读源码时归一化 CRLF→LF）。
- 确认 web 导出 `Failed to fetch` 已随 0.4.6 的 `4246f4b` 修复，旧构建才有；客户端与网页版同一构建产物。
- 发布说明改为统一读取 `RELEASE-NOTES.md`（workflow `body_path` + web ZIP 直接拷贝），以后每版只改这一个文件。
- 全验证基线绿（build / evidence-package / lan-server / lan-mobile-picker / pwa-build / inspection-item 两项 / web-lan-server / `git diff --check`）。版本 0.4.6 → 0.4.7，工作提交 `697d787`，tag `picture-ocr-v0.4.7` 移至该提交重跑 CI 覆盖发布。

---

## 2026-09-08 — 列表加载卡死修复与客户端报错采集

- 根因：图片以 Base64 内联在 `ProjectDocument`，`listProjectGroups`/`listProjects` 用 `getAll()` 全量读文档再 `cloneAssets` 深拷贝，仅为取 `assetCount`。~500 图数百 MB Base64 在主线程读一遍+拷一遍 → UI 卡死/渲染进程 OOM。对应「正在加载项目列表…」与「保存中…」两处永久转圈（保存后 await 刷新列表卡同一步）。
- 修复：`db.ts` 升 `DB_VERSION=4`，新增轻量 `projectSummaries` store（无图片字节）。列表只读摘要；所有写/删/迁移函数同事务维护摘要；`onupgradeneeded` 用逐条游标回填存量（峰值仅一条文档，避免 OOM）。
- 兜底：`withTimeout` 包裹 openDB(60s)/各事务(15s)，卡死变明确错误 reject，不再无限转圈。
- 报错采集：新增 `src/utils/errorLog.ts`（环形缓冲 localStorage 最近 50 条 + 诊断报告 + `<a download>` 导出）；`main.tsx` 装全局 `error`/`unhandledrejection` handler；`App` 用 `setErrorNotifier` 把未捕获错误弹 Toast；db 层超时/失败统一 `recordError`（被 catch 的也进诊断包）。存储设置面板加「导出诊断包/清空错误记录」入口（桌面+Web 通用）。vite 注入 `__APP_VERSION__`。
- 验证：`npm run build` 通过；新增 `verify:list-summary-store`(19/19)、`verify:error-report`(19/19)；回归 image-compression / lan-image-sink / evidence-package / storage-estimate 全绿。
- 已知点：DB v4 单向升级，发布后不可回退 v3 代码（数据不丢）。运行时 IndexedDB 行为未在无浏览器环境实测，建议桌面构建冒烟后再发版。

- 发布 v0.6.0（minor：含卡死修复 + 诊断包导出新功能）：新写 RELEASE-NOTES.md，commit `6cc4351`，tag `picture-ocr-v0.6.0` 推送触发 CI（run 34212401352）成功；Release 资产含 web ZIP、`.exe` 便携版；正文取自 RELEASE-NOTES.md。

---

## 2026-09-09 — 摘要自检修复「项目列表少项目」与静默丢数据路径

- 现场：用户 v0.6.1 诊断包（09-09）显示 counts 3 组 / 6 系统 / 72 图、usage 381MB，前一天 v0.6.0 诊断包 counts 全 0、usage 381MB —— 两次用量几乎相同，证明数据一直在库里，v0.6.1 只是让库能重新打开。用户反馈「能打开但少一个项目」+「少一张昨天拍的照片」。
- 根因 1（少项目）：v0.6.1 的 `ensureSummariesBackfilled` 用游标遍历 + `typeof raw.id === 'string'` 判断，读不出内容或 id 残缺的记录被 `continue` 静默跳过 → 该项目永久不进 `projectSummaries` → 列表与诊断计数都看不见它；且幂等判断用 `summariesTotal >= projectsTotal` 计数近似，补齐一次后不再核对具体缺哪条。
- 根因 2（少照片，且会持续复发）：`AppContext` 里 `loadProject` 失败会用空白 `createProjectDocument()` 顶替并置 `loadedRef=true`，500ms 后 debounce 自动保存把空文档写回 —— 读超时就等于清空真实项目；自动保存失败只 `console.error`，界面无感，刚拍的照片只在内存里，关窗即丢。整份文档读写共用 15s 事务超时，大文档极易误判失败。
- 修复：
  - 新增 `src/utils/summaryRepair.ts`（纯函数 `planSummaryRepair`：主键集合求差，按字符串比对，输出 missing/orphans）。
  - `db.ts` 的 `ensureSummariesBackfilled` → 导出 `ensureSummariesSynced(force?)`：`getAllKeys()` 求差、缺失记录逐条 `get`、补建摘要的 id 以 **primaryKey 兜底**、单条读失败 `preventDefault()` 不中止事务、读不出的计入 `damagedIds`、反向清理孤立摘要；结果经 `getLastSummaryRepairReport()` 暴露；异常时 `recordError` 进诊断包。新增 `getStoreDiagnostics()`（各 store 真实条数 + legacy 未迁移标记）。整份文档读写改用 `DB_DOC_TIMEOUT_MS`(120s)。
  - `errorLog.ts` 新增 `reportCriticalError`（记录 + 弹 Toast）；诊断包补 `stores` / `summaryRepair` / `projects` 清单。
  - `AppContext`：读取失败保持 `loadedRef=false` 并提示（不再空白顶替覆盖），自动保存与退出 flush 失败改 `reportCriticalError`；`App` 手机上传落库失败 `recordError`。
  - UI：`ProjectList` 首次刷新后按修复报告弹一次提示；`StorageSettingsDialog` 新增「存储自检」区块（条数对比 + 「立即自检并修复」）。
- 验证：新增 `verify:summary-repair`（28/28，含用 tsc 单文件编译纯函数后真实调用；`--typeRoots ./no-such-types --skipLibCheck` 规避 @types 自动引入报错）；旧 `verify:list-summary-store` 同步更新（24/24）；error-report 19/19；build 通过。**真实浏览器端到端**：vite preview 固定 51730 + Playwright，构造「有文档无摘要」「有摘要无文档」两条脏数据 → 刷新后「丢失的系统」被找回并显示、幽灵条目消失，错误日志留下 `db:summaryRepair 补建 1 条，清理孤立摘要 1 条`；测试数据已清除。
- 两端覆盖：`electron/main.cjs:155` 加载同一份 `dist/index.html`（局域网服务也用同一 dist），故桌面客户端与网页版同源生效。
- 后续（未做）：图片字节仍内联在项目文档里，每加一张图都要重写整份文档（写放大 O(n²)），是大库变慢与保存超时的根因，应拆独立 images store 按需加载。

## 2026-09-09 P0 止血：关窗保护（v0.6.3）

- 根因确认（代码证据）：`AppContext` 保存是 debounce 500ms + 卸载 flush，两者都是"发起后不等待"的异步 IndexedDB 写；全项目无 `beforeunload`。大项目写十几秒，页面销毁即事务中止 → 刚拍的照片静默丢失。
- 实现：`src/utils/pendingWrites.ts` 做写入引用计数（`trackWrite` 包住 db.ts 全部 5 个写路径）；`installUnloadGuard` 在有 pending 时 `preventDefault` beforeunload；Electron `win.on('close')` + `dialog` 三选项拦截（等写完自动关 / 取消 / 仍然退出，留逃生阀）；`App.tsx` 右下角"正在保存，请勿关闭窗口…"指示条。
- 验证：`verify:pending-writes` 29/29；`npm run build` 通过；Playwright 真实浏览器 22MB 图片入库，保存中 beforeunload 被拦截 ✓ / 指示条出现 ✓ / 写完自动放行 ✓ / 刷新后图片仍在 ✓；测试数据已清除。
- 未解决（P1-P3 继续）：写放大根因（每加一张图重写整份文档）仍在，v0.6.3 只保证不因关窗丢数据。

## 2026-09-09 P1-P3：图片字节拆分独立 store（DB v5，v0.7.0）

- 存储模型：新增 `images` store（keyPath `key` = `${projectId}:${imageId}`，索引 `by_project`），`ProjectDocument` 只留引用（`ImageData.data` 改可选，已迁移 undefined / 未迁移仍内联，迁移期两种形态共存）。`onupgradeneeded` 的 v4→v5 只建 store 与索引、绝不遍历数据（吸取 v0.6.0 升级中止全丢的教训）。
- 写入：`addImageToProject` / `removeImageFromProject` 单事务覆盖 projects/summaries/images，从库里现读现改，不接受调用方内存快照 → 手机上传与电脑端并发写不再互相覆盖。所有写路径继续走 `trackWrite`。
- 读取：`resolveImageData` / `resolveImagesForProject`（单事务批量建 Map）+ `hydrateAssets` / `hydrateProjectImages`（导出、报告、压缩前按需补齐，结果只在内存用、不写回库）；界面统一走 `useImageSrc` + `imageCache`（inflight 去重 + LRU 60 张，切项目 `clearImageCache`）。
- 搬迁：`migrateInlineImages(force?)` 逐项目分批，单项目事务内「写字节 → 立刻读回校验 → 全部通过才 `stripInlineImageData` 剥离文档」，失败 abort 保持内联并记 `damagedIds`；进度写 localStorage `evidence-image-migration-v5`，每完成一个项目立即落盘可续跑。列表页后台触发、打开项目前触发单项目搬迁，存储面板展示进度与手动重试。
- 验证：`verify:image-store` 76/76、`verify:pending-writes` 29/29、`verify:list-summary-store` 24/24、`tsc --noEmit` + `npm run build` 通过。
- **大库真实演练（Playwright + 真实 IndexedDB，51730）**：造 8 个项目 × 6 张 × 8MB ≈ 385MB 未迁移库 → 刷新后台自动搬迁全部完成、0 损坏；再追加 2 个内联项目（481MB）验证增量搬迁同样完成。逐条比对 60 张图的长度+头尾字节：**60/60 完全一致**，文档内联残留 0 条，单份项目文档从约 48MB 降到 1.0KB。摘要读取 1ms、单张按需读图 16ms。大库下加一张新照片：从选中到落库 **82ms**，文档只增加一条引用（1135 字节）。
- 发布 v0.7.0；RELEASE-NOTES 新写，含「升级后不建议回退 0.6.x」提示。
