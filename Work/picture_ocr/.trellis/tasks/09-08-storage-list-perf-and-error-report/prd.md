# 列表加载性能修复与客户端报错采集

## Goal

修复项目列表在数据量增大（多系统、数百张图片）后加载/保存卡死的问题；并新增客户端全局报错采集与诊断导出，让客户反馈问题时能直接提供证据，不再靠猜。

## Background / 根因

- 图片以 **Base64 内联**存储在每个 `ProjectDocument.assets[].items[].images[].data` 中。
- 列表加载走 `listProjectGroups()` / `listProjects()`：用 `getAll()` 把**全部项目完整文档（含所有 Base64 图片）**读入内存，再对每条执行 `normalizeProjectDocument()` → `cloneAssets()`，**把所有 Base64 再深拷贝一份**，最终只为得到 `assetCount` 和 `meta`。
- 一个矿 4+1 系统、~10 台设备、~500 张图，压缩后仍有数百 MB Base64。每次进列表 / 每次保存后刷新列表，主线程都要「读一遍 + 深拷贝一遍」，导致 UI 卡死或渲染进程 OOM 假死。
- 现象对应：主界面「正在加载项目列表…」永久转（启动 `refreshProjects`）；新建弹窗「保存中…」永久转（保存后 `await` 刷新列表卡在同一步）。
- 客户为打包客户端，出问题时开发者无任何日志，只能猜 → 需要报错采集。

## Requirements

### R1 列表加载性能（治本）
- 项目列表加载不得再读取任何图片 Base64 字节。
- 列表数据来源改为轻量摘要（仅 `id/groupId/meta/assetCount/createdAt/updatedAt`），加载耗时与图片体积无关。
- 所有「写项目」路径（新建/保存/组新建/组编辑/删除/旧库迁移/导入/局域网回传）保持摘要与真实文档一致。
- 打开单个项目仍读取完整文档（含图片），行为不变。

### R2 存量数据平滑升级
- 已存在的 v3 数据库首次打开时自动补建摘要，过程不得因一次性载入全部 Base64 而 OOM（逐条游标处理，峰值仅一条文档）。
- 升级失败不得破坏原有 `projects` / `projectGroups` 数据。

### R3 客户端报错采集
- 安装全局错误捕获：`window.error`、`unhandledrejection`。
- 关键存储操作（openDB / 事务）增加超时兜底：卡死超过阈值时以明确错误返回，而非无限转圈。
- 错误持久化到本地（localStorage 环形缓冲，最近 N 条，跨刷新/崩溃保留）。
- 提供「导出诊断包」入口：导出 JSON（含最近错误、userAgent、应用版本、存储用量、项目/资产计数），走普通 `<a download>`（遵循既有约定，不用 showSaveFilePicker）。
- 捕获到错误时以 Toast（tone=error）提示用户，不再静默假死。

## Constraints

- 遵循既有存储层结构与命名；图片仍内联在文档中（本任务不做图片外置存储的大重构）。
- CSP 为 `connect-src 'self'`，诊断导出不得依赖网络。
- 提示统一用 `useToast()`；二次确认用 `useConfirmDialog()`。
- 桌面版 + Web 版同一套前端代码，两端都要生效。

## Acceptance Criteria

- [x] `DB_VERSION` 升级并新增 `projectSummaries` store；`listProjects`/`listProjectGroups` 只读摘要 store，源码中列表路径不再出现 `getAll()` 全量文档 + `cloneAssets`。
- [x] 所有写/删/迁移路径同事务内维护摘要，摘要与文档计数一致（纯函数逻辑 + 源码断言校验）。
- [x] 存量 v3 库首次打开自动补建摘要，采用逐条游标，构建通过。
- [x] 全局 `error` / `unhandledrejection` 捕获生效并写入持久化日志；DB 操作具备超时兜底。
- [x] 存在「导出诊断包」入口，导出 JSON 含错误列表与环境信息，通过 `<a download>` 下载。
- [x] `npm run build` 通过；新增 `verify:list-summary-store`、`verify:error-report` 校验脚本通过；既有 verify 脚本不回归。

## Notes

- 与 `08-28-image-compression` 相关但独立：压缩降低单图体积，本任务解决「列表全量深拷贝」这一与图片体积线性相关的卡死。
- 图片外置独立 store 是更彻底的方向，作为后续任务候选，不在本次范围。
