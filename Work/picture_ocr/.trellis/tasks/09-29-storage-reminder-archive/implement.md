# 执行计划：存储提醒与项目归档

按阶段推进，每阶段先写验证脚本（RED）再实现（GREEN）。每阶段结束跑本阶段脚本 + `npm run build`。

## P0 实测前提（不改应用代码）— 已完成，见 research/quota.md

- [x] 真实 Chrome/Edge 打开 `http://127.0.0.1:51730/`：确认 `showDirectoryPicker` 可用、可选 D 盘目录、`createWritable` 写入与重新 `getFile` 读回正常。
- [x] 同一环境记录 `estimate()` 的 usage/quota 与 C 盘实际剩余，确认「quota − usage ≈ 磁盘剩余」是否成立；结论写入 `research/quota.md`，据此定 Web 端磁盘条件口径。
- [x] Electron 43 下 `navigator.storage.persist()/persisted()` 实际返回值、`fs.statfs` 可用性，记录到同一文件。

## P1 归档标记贯穿数据模型 — 已完成（verify-archive-model 双端 82/82）

- [x] RED `scripts/verify-archive-model.mjs`：`ArchiveInfo` 经 `normalizeProjectDocument` / `toProjectSummary` / `normalizeSummary` / `summaryFromRaw` 透传；非法值归一为 null；`saveProject`、`updateProjectGroupAndSystems`、`migrateProjectImages`、`saveProjectWithImages`、摘要补建之后标记仍在（隔离 IDB 实测）。
- [x] `types/index.ts`、`db.ts` 实现透传。
- [x] `addImageToProject` / `removeImageFromProject` 对已归档文档 abort；脚本断言。
- [x] `reconcileProjectImages` 对已归档项目不报 missing。

- 备注：`migrateProjectImages` 未单独断言——commit 拒绝仍有内联图片的系统，已归档文档不会再进入迁移。

## P2 归档文件格式与校验（纯逻辑）— 已完成（verify-archive-format 双端 23/23）

- [x] RED `scripts/verify-archive-format.mjs`：打包 → 解析往返；sha256/fingerprint 稳定；截断 ZIP、替换一张图、删一张图、改 projectId、改 archive.json 各自被拒并给出对应原因；重建的 data URL 与原始完全相同；产物可被现有 `importDataPackage` 导入。
- [x] `src/utils/archiveFormat.ts` 实现（复用 `createDataPackageBlob`、`dataUrlToBlob`、`blobToDataUrl`；禁止 fetch）。

## P3 库内提交/恢复事务 — 已完成（超时只请求 abort，以真实终态结算）

- [x] RED 扩展 `verify-archive-model.mjs`：`commitProjectArchive` 成功后该项目 images 条数为 0、文档与摘要带标记、`updatedAt` 不变；引用集合或字节集合不符时 abort 且数据不变；`restoreProjectArchive` 成功后字节逐条相等、标记清除；fingerprint 不符拒绝；模拟 put 失败整体回滚。
- [x] RED 扩展 `scripts/verify-pending-writes.mjs`：两条新写路径经 `trackWrite`。
- [x] `db.ts` 实现。

## P4 保存目标与编排 — 已完成（archive-flow 双端 53/53、archive-files 9/9、web-lan-server 通过）

- [x] `start-server.ps1` 新增 `GET /api/control/disk-free`（loopback + 标识头），`scripts/verify-web-lan-server.ps1` 补断言。
- [x] `electron/archiveFiles.cjs` + main/preload IPC：`archive:choose-dir`、`archive:write`（partial → sync → rename，文件名净化）、`archive:read`、`archive:disk-free`。
- [x] RED `scripts/verify-archive-files.cjs`：路径穿越文件名被拒、未知 targetId 被拒、写后读回一致、partial 文件不残留、statfs 返回数值。
- [x] `src/utils/archiveTarget.ts`（Web/桌面两实现）、`src/utils/archive.ts`（archiveProject/restoreProject，5.3/5.4 全流程）。
- [x] RED `scripts/verify-archive-flow.mjs`（新增）：Web 目标用 OPFS 真实目录句柄（与 showDirectoryPicker 同接口），故障注入用内存目标；覆盖归档/恢复往返字节逐条相等、updatedAt 不变、重复归档跳过、同名加序号、写失败/读回损坏/缺图/无图/归档期间并发上传均不动本地、内联系统先整理、批量顺序与进度、桌面桥 Uint8Array + targetId、恢复拦截（未归档/别的系统/旧归档/篡改/非 ZIP）。

- 备注：磁盘剩余接口断言已移到「无 LAN 提前返回」之前，无网环境也会执行。package.json 已登记 verify:archive-model/format/files/flow。Web 端磁盘剩余的前端调用放在 P5。

## P5 持久存储、统计、提醒（逻辑）— 已完成（storage-reminder 双端 29/29、storage-stats 双端 15/15）

- [x] RED `scripts/verify-storage-reminder.mjs`：`evaluateReminder` 三类条件各自命中/不命中；snooze 期间 normal 不显示、urgent 仍显示；输入缺失不误报；已归档/无图片系统不入候选。
- [x] RED `scripts/verify-storage-stats.mjs`：缓存命中/失效条件（updatedAt、count 变化）；游标统计与实际 byteSize 合计一致；未迁移系统标记待整理。
- [x] `storagePersistence.ts`、`storageStats.ts`、`storageReminder.ts` 实现；`main.tsx` 启动申请持久存储。
- 备注：db.ts 新增只读 `countProjectImages` / `measureProjectImages`（游标逐条累加）/ `getProjectsNeedingMigration`（读搬迁状态，不读文档）。Web 磁盘剩余接口在开发服务器/旧脚本下返回非 JSON，按未知处理（已断言）。

## P6 界面 — 已完成（archive-ui 双端 11/11，全量回归通过）

- [x] 数据层兜底（设计偏差，补在 P6 前）：工作台 `AppContext.buildDocument` 不带 `archive` 字段，经 `#/project/<id>` 直接打开已归档系统时自动保存会把标记写成 null。`saveProject` / `saveProjectWithImages` 在写事务内读摘要，库里已归档时只接受携带同一指纹、且不写新图片字节的写入（archive-model 双端 50/50，新增 10 项断言，RED 已确认）。
- [x] URL 入口拦截：`AppProvider.onArchivedOpen` → App 回列表并提示；`MobileCollector` 拒绝采集；`MobileProjectList` 与 `lanGroupSnapshot.buildGroupSnapshot` 过滤已归档（verify-lan-group-snapshot 补断言，RED 已确认）。
- [x] `StorageReminderBanner`、`ArchiveDialog`、`StorageSettingsDialog` 三块新增内容（src/components/archive/；对话框打开时快照列表，归档后外层刷新不打断结果页；桌面选到与数据同盘的目录时确认，可「重新选择」）。
- [x] 项目列表：已归档标签、恢复按钮、打开拦截、导入/导出/压缩/手机采集禁用（悬停说明）、组级采集跳过已归档、删除确认注明不删归档文件；`lanGroupSnapshot` 过滤。独立系统归档文件名改用系统自身的项目/单位名（原先是「未命名项目组」）。
- [x] RED/GREEN `scripts/verify-archive-ui.mjs`（先 build，Web 与正式 Electron 各一轮，隔离数据）：构造数据 → 提醒条出现 → 去归档 → 归档到临时目录 → 列表显示已归档、打开被拦截 → 恢复 → 图片可见、Word 导出图片字节与归档前一致。Web 端目录选择用 Playwright 注入测试目录句柄或 mock `showDirectoryPicker`（在脚本中注明哪部分是 mock）。
  - 实际：Web 用 OPFS 目录句柄替身 `showDirectoryPicker`（mock 仅目录选择框本身，写入/读回是真实 FileSystemHandle）；桌面经 `scripts/archive-ui-electron.cjs` 以隔离 userData 启动真实 `electron/main.cjs`，仅把 `dialog.showOpenDialog` 替换为返回临时目录（生产代码无测试后门），IPC 与落盘都是真实的。Word 校验走 `hydrateAssets → createWordReportBlob`，按 rels 定位原图媒体并数正文引用。截图在 .trellis/.runtime/archive-ui-qa/。
- [x] 回归：`verify:pending-writes`、`verify:image-store`、`verify:summary-repair`、`verify:list-summary-store`、`verify:evidence-package`、`verify:lan-image-sink`、`verify-project-list-views.mjs`、`verify-project-list-ui.mjs`、`verify-lan-group-snapshot.mjs`。另跑 `verify-lan-upload-ui.mjs --lifecycle`（双端 24 项）与 `verify-web-lan-server.ps1`，均通过。

## P7 真实数据验收（副本）

数据：用户真实桌面库完整复制到 `D:\tmp\p7-test\desktop-profile`（复制前后 SHA-256 一致），目标系统 121 张 / 41.1 MB。脚本在 `.trellis/.runtime/p7/`（desktop.mjs / web.mjs），输出与截图在 `D:\tmp\p7-test\out`。

- [x] 桌面版（正式 dist + Electron，同盘确认、归档到 D 盘目录、Node 侧从磁盘独立读回比对）：22/22。
- [x] 网页版（隔离 Chrome profile + 正式 dist，种子为桌面端生成的归档文件走正式导入；目录选择框以 OPFS 目录替身）：21/21。
- [x] 改坏一张图的一个字节 / 截断到 60% 的归档文件恢复均被拒，本地保持已归档、无残留。
- [x] 恢复后 121 张字节逐张一致；Word 正文 121 处引用全是原图字节；重启后保持。
- 未覆盖：系统原生目录选择框本身（桌面由启动脚本替换为固定目录，Web 用 OPFS）。
- 验收中发现并修复：新建/导入的系统要等列表页后台图片存储优化跑完才能归档（此前显示「待整理」）。`saveProject` / `saveProjectWithImages` / `createProjectGroupWithSystems` 提交成功后，若文档无内联字节即记为已整理（`markReferenceFormSaved`）；`storage-stats-cases` 先红后绿覆盖。

## P8 收尾

- [x] 更新 spec：`.trellis/spec/frontend/state-management.md`（archive 字段透传规则、已归档只读、提醒/统计/持久存储）、`.trellis/spec/backend/database-guidelines.md`（重写为当前 v5 事实 + 归档事务）、`quality-guidelines.md` 存储设置描述。
  - 收尾复验时发现 `verify-archive-ui.mjs` 在高负载下偶发 `cases is not defined`：首个文档未提交就注入、reload 靠固定 500ms。改为先登记新文档注入、以页面标记 + readyState 确认新文档；并行 CPU 压力下双端连续 3 轮 22/22。
  - 删除未接线的 `invalidateStorageStats`（缓存靠 updatedAt/归档状态/条数自校验）。
- [x] 提交并发布 v0.9.0（用户授权）。

## 回滚点

- P1–P3 只动数据层且功能未接 UI，可整体撤回。
- P6 之前不暴露给用户。
