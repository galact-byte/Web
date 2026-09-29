# Backend Database Guidelines

## 现状

仓库没有服务端数据库、ORM 或服务端迁移系统。所有项目数据保存在浏览器本地 IndexedDB（`src/utils/db.ts`），Web 版与桌面版（Electron 渲染进程）共用同一套代码。局域网服务（`start-server.ps1` / `electron/lanServer.cjs`）只转发上传，不持有数据库。

## IndexedDB 结构（`DB_VERSION = 5`）

| store | keyPath | 索引 | 内容 |
| --- | --- | --- | --- |
| `project` | `id` | `updatedAt` | v1 遗留单项目，仅供 `migrateLegacyProjectIfNeeded` 迁移 |
| `projects` | `id` | `updatedAt`、`groupId` | `ProjectDocument`（系统），图片只存引用 |
| `projectGroups` | `id` | `updatedAt` | `ProjectGroup`（项目组元数据） |
| `projectSummaries` | `id` | `updatedAt` | 列表用轻量摘要（`id/groupId/meta/assetCount/createdAt/updatedAt/archive`），无图片字节 |
| `images` | `key` | `by_project(projectId)` | 图片字节，主键 `${projectId}:${imageId}` |

- 数据库名 `evidence-collector-db`。版本一旦发布不可降级回旧代码。
- `onupgradeneeded` 只建表/建索引；遍历数据的回填放在升级完成后（`ensureSummariesSynced`、`migrateInlineImages`），否则一条坏数据会中止 versionchange 并回滚版本。
- 未迁移的老项目仍可能在 `ImageData.data` 内联 Base64，两种形态共存；读图必须经 `resolveImageData` / `hydrateAssets`，不能直读 `image.data`。

## 写路径不变量

- 所有写用户数据的路径经 `trackWrite()`（`src/utils/pendingWrites.ts`），成功/失败都释放计数；新增写路径同步补 `scripts/verify-pending-writes.mjs`。
- 写/删/迁移项目的事务内同步维护 `projectSummaries`。
- 图片增删走 `addImageToProject` / `removeImageFromProject`：单事务覆盖 projects/summaries/images，文档在事务内现读现改，不接受调用方的整份内存快照。
- 超时：普通事务 `withTimeout` 15s，`openDB` 60s，整份文档读写 `DB_DOC_TIMEOUT_MS` 120s。图片写入与归档事务超时时只请求 `abort`，以真实 `oncomplete`/`onabort` 结算，不用包装 Promise 超时推断「没有写入」。

## 归档与恢复事务

### 1. 范围

系统（`ProjectDocument`）可归档到用户选择的目录：本地删除图片字节，保留文档、摘要与组元数据，并以 `archive: ArchiveInfo` 标记。编排在 `src/utils/archive.ts`，库内提交在 `db.ts`。

### 2. 接口

- `commitProjectArchive(projectId, expectedImageIds, info): Promise<void>`
- `restoreProjectArchive(projectId, fingerprint, records: StoredImage[]): Promise<void>`
- 共用 `runArchiveTransaction`：projects/summaries/images 三 store 读写事务，经 `trackWrite`，失败原因写 `recordError`。

### 3. 数据契约

- `ArchiveInfo = { archivedAt, fileName, locationLabel, imageCount, imageBytes, fingerprint }`，`fingerprint` 为 64 位小写 hex（归档清单 SHA-256）。
- 标记存在于文档与摘要两处，所有派生（`normalizeProjectDocument`、`toProjectSummary`、摘要补建）必须经 `normalizeArchiveInfo` 透传；漏一处会在下次保存时抹掉标记，形成「本地无图片又不显示已归档」。
- 归档/恢复都不改 `updatedAt`，「最后修改」保持业务语义。

### 4. 校验与错误

- 提交：文档不存在/无效、已归档、仍有内联图片、文档引用集合或 `by_project` 主键集合与 `expectedImageIds` 不一致（归档期间有上传/删除）→ 整体 abort，本地不动。
- 恢复：未归档、`fingerprint` 不符、记录的 `projectId`/`key` 与目标不符、非 data URL、记录集合 ≠ 文档引用集合 → 拒绝；任一 `put` 失败整体回滚。
- 已归档只读：`saveProject` / `saveProjectWithImages` 在写事务内读摘要，库里已归档时只接受携带同一指纹且不写图片字节的写入；`addImageToProject` / `removeImageFromProject` 对已归档文档 abort。工作台 `buildDocument` 不带 `archive` 字段，这道兜底防止经 URL 打开后的自动保存把标记写成 null。
- `reconcileProjectImages` 对已归档项目不报缺失图片。

### 5. 编排顺序（`archiveProject`）

整理内联图片 → 对账（有缺图拒绝）→ 打包 → 写入目标目录（不覆盖同名，自动加序号）→ **从磁盘重新读回**逐张校验 SHA-256 → `commitProjectArchive`。任何一步失败都不删除本地数据，结果以返回值汇总，不抛出。批量按顺序逐个执行以控制内存峰值。

### 6. 验证

`verify:archive-model`（隔离 IDB 实测透传、事务与只读兜底）、`verify:archive-format`、`verify:archive-files`、`verify:archive-flow`、`verify:pending-writes`；界面双端 `npm run build` 后 `verify:archive-ui`。

### 7. 错误与正确

错误：写完归档文件就删本地字节，或用内存里的 Blob 充当「读回」。正确：目标的 `read` 必须重新从磁盘读取，校验通过后由单事务在比对集合后删除并打标记。

## 反模式

- 不为前端任务引入服务端数据库假设或 ORM。
- 不用 `getAll()` 全量读 `projects`（图片可能仍内联，大库会卡死/OOM）；列表与统计只读摘要，占用统计用 `measureProjectImages` 游标逐条累加。
- 不把无关应用状态放进 IndexedDB；提醒阈值、占用统计缓存等本机偏好放 localStorage（`evidence-storage-reminder-v1`、`evidence-storage-stats-v1`）。
