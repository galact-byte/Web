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
