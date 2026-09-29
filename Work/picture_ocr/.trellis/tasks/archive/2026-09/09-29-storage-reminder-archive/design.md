# 技术设计：存储提醒与项目归档

## 1. 总体结构

```
src/utils/storagePersistence.ts   R1 持久存储申请与状态（纯浏览器 API 封装）
src/utils/storageStats.ts         R2 每系统图片占用统计 + localStorage 缓存
src/utils/storageReminder.ts      R3 阈值/稍后提醒状态 + 纯函数 evaluateReminder()
src/utils/archiveFormat.ts        R4/R5 归档文件格式：打包、读回校验、解析（纯逻辑 + JSZip + WebCrypto）
src/utils/archiveTarget.ts        R4 保存目标抽象：Web(File System Access) / 桌面(IPC) 两个实现
src/utils/archive.ts              R4/R5 编排：归档一个系统、恢复一个系统
src/utils/db.ts                   新增 commitProjectArchive / restoreProjectArchive；archive 字段贯穿文档与摘要
electron/archiveFiles.cjs         桌面端：选目录、写文件（fsync）、读回、磁盘剩余
electron/main.cjs, preload.cjs    注册 IPC，暴露 window.evidenceArchive
src/components/StorageReminderBanner.tsx   列表顶部提示条
src/components/StorageSettingsDialog.tsx   持久存储状态、阈值设置、占用明细、归档入口
src/components/ArchiveDialog.tsx           选择系统 → 选目录 → 逐个归档进度 → 结果
src/components/ProjectList*.tsx            「已归档」标记、打开拦截、恢复入口、禁用导入/导出
src/utils/lanGroupSnapshot.ts              排除已归档系统
```

## 2. 数据模型

不升级 `DB_VERSION`（保持 5），不新增 store/索引。理由：给存量 images 建索引会在升级事务里由浏览器遍历全部图片字节（大库可能超过 openDB 的 60s 超时），而且 C 盘将满时升级失败会导致应用打不开、连归档都做不了。

### 2.1 `ArchiveInfo`（`src/types/index.ts`）

```ts
export interface ArchiveInfo {
  archivedAt: number;      // 时间戳
  fileName: string;        // 归档文件名（不含目录）
  locationLabel: string;   // 目录显示名：Web 为目录名，桌面为完整路径
  imageCount: number;
  imageBytes: number;      // 原始字节合计（estimateBase64Bytes 口径）
  fingerprint: string;     // 归档清单 SHA-256，恢复时比对
}
```

- `ProjectDocument.archive?: ArchiveInfo | null`、`ProjectSummary.archive?: ArchiveInfo | null`。
- `normalizeProjectDocument` / `toProjectSummary` / `normalizeSummary` / `summaryFromRaw` 全部透传 `archive`（做字段级校验，非法值视为 null）。**这是最关键的一处**：`saveProject`、`updateProjectGroupAndSystems`、迁移、压缩等写路径都经 normalize，漏掉就会在下次保存时把归档标记抹掉，导致「本地没有字节、又不显示已归档」。
- 已归档文档保留全部分类/资产/检查项/图片引用（`id`/`fileName`/`caption`/`uploadedAt`），只删除 images store 里的字节。

### 2.2 统计缓存（不入库）

`localStorage['evidence-storage-stats-v1']`：`{ [projectId]: { updatedAt, imageCount, imageBytes, computedAt } }`。

- 某系统的缓存有效条件：`updatedAt` 与摘要一致，且 `by_project` 索引 `count()` 与 `imageCount` 一致（压缩、增删图片都会改变其中之一）。
- 失效时重算：对该系统开 `by_project` 值游标逐条累加 `byteSize`，一次只持有一条记录；一个系统一个只读事务。未迁移（仍有内联 data）的系统不读整份文档，标记「待整理」，不计入候选（归档前会先迁移）。
- 首次全量计算在空闲时后台逐系统进行，可中断续跑；之后只重算有变化的系统。久未修改的系统正好一直命中缓存。
- 显示口径标注为「图片约 X」，与浏览器「已用」不要求相等（后者含文档、索引与存储开销）。

## 3. R1 持久存储

- `requestPersistence()`：`navigator.storage.persisted()` 为 true 直接返回；否则调用 `persist()`。在 `main.tsx` 启动后调用一次（不阻塞首屏）。
- `getPersistenceState(): 'granted' | 'denied' | 'unsupported'`。
- Chrome/Edge 不弹权限框，是否批准由浏览器根据站点使用情况决定（安装为应用、加书签、访问频繁时更容易批准）。未批准时存储设置显示说明与「再次申请」按钮，不自动反复申请。
- 桌面版：同样调用并显示结果；说明文字写「桌面版数据位于应用数据目录」，具体是否显示「已批准」以实测为准，不做假设。

## 4. R3 提醒

### 4.1 设置与状态（`localStorage['evidence-storage-reminder-v1']`）

```ts
{ usageLimitBytes: 2GB, diskFreeMinBytes: 10GB, diskFreeUrgentBytes: 3GB,
  staleDays: 90, snoozeDays: 7, snoozedUntil: number | null }
```

### 4.2 输入

| 条件 | Web | 桌面 |
|---|---|---|
| 本工具占用 | `estimate().usage` | `estimate().usage` |
| 磁盘剩余 | `start-server.ps1` 新增本机控制接口 `GET /api/control/disk-free`，返回 `%LOCALAPPDATA%` 所在盘真实剩余与盘符（P0 实测：Chrome/Edge 的 quota 恒为 usage+10GiB，不能用来推算，见 research/quota.md）；接口不可用则视为未知 | IPC `archive:disk-free` → `fs.statfs(userData)`（数据目录迁到 D 盘则查 D 盘） |
| 久未修改 | 摘要 `updatedAt` + 统计缓存 | 同左 |

### 4.3 `evaluateReminder(input, settings, now)`（纯函数，可脚本验证）

返回 `{ level: 'none' | 'normal' | 'urgent', reasons: [...], staleCandidates: [{projectId, bytes}], staleBytes }`。

- `urgent`：磁盘剩余 < `diskFreeUrgentBytes`。无视 `snoozedUntil`。
- `normal`：占用 > 上限 / 磁盘剩余 < 下限 / 存在久未修改候选（未归档、`imageCount > 0`、`now - updatedAt > staleDays`）。`now < snoozedUntil` 时不显示。
- 输入缺失（estimate 不支持、statfs 失败）时该条件视为不满足，不误报。

### 4.4 触发

`ProjectList` 挂载后 `requestIdleCallback`（无则 `setTimeout 2s`）执行一次检查；不阻塞列表加载。提示条列出命中原因，按钮：「去归档」（打开 ArchiveDialog 并预选候选）、「稍后提醒」（`snoozedUntil = now + snoozeDays`）。`urgent` 用 error 色，不提供稍后提醒。

## 5. R4 归档

### 5.1 归档文件格式（明文 ZIP）

沿用 `createDataPackageBlob` 的结构（`manifest.json` + `images/`），因此可被现有「导入数据包」直接导入为新系统。额外加一个 `archive.json`：

```json
{ "format": "evidence-archive", "version": 1,
  "projectId": "...", "groupId": "...", "archivedAt": 0, "appVersion": "0.8.x",
  "group": { ...ProjectGroup 元数据, 可空 },
  "images": [ { "id": "...", "path": "images/xx.png", "mimeType": "image/png", "byteSize": 123, "sha256": "..." } ] }
```

- `sha256` 基于图片解码后的原始字节（非 Base64 文本）。
- `fingerprint` = `archive.json` 中 images 数组按 id 排序后的规范化 JSON 的 SHA-256。
- 文件名：`归档_<项目组显示名>_<系统名>_<YYYYMMDD-HHmm>.zip`，非法字符替换，同名追加序号；用 #165 的组显示名规则。
- 现有导入会跳过未知文件、并对图片重新压缩；这只影响「当新系统导入」这条兜底路径，正式恢复走 5.4，不压缩。

### 5.2 保存目标 `ArchiveTarget`

```ts
interface ArchiveTarget {
  label: string;
  write(fileName: string, blob: Blob): Promise<void>;   // 写完即落盘
  read(fileName: string): Promise<Blob>;                 // 从磁盘重新读，不用内存副本
  exists(fileName: string): Promise<boolean>;
}
```

- **Web**：`window.showDirectoryPicker({ id: 'evidence-archive', mode: 'readwrite' })` → `getFileHandle(name, { create: true })` → `createWritable()` → `write` → `close()`；读回 `getFileHandle(name).getFile()`。不支持该 API 时 `createWebTarget()` 返回 null，界面说明「需使用 Chrome/Edge」。
- **桌面**：`window.evidenceArchive.chooseDirectory()` → 主进程 `dialog.showOpenDialog({ properties: ['openDirectory','createDirectory'] })`，返回一次性 `targetId`（主进程记住真实路径）。`writeFile(targetId, name, bytes)`：`path.basename` 净化文件名、拒绝路径分隔符，先写 `name.partial` → `filehandle.sync()` → rename；`readFile(targetId, name)` 返回字节。渲染进程拿不到任意路径写权限。
- 两端都在选目录后提示：若所选目录位于数据所在盘（Web 无法判断则不提示；桌面比较盘符），警告「选在同一块盘上不能释放空间」，可继续。

### 5.3 归档单个系统（`archiveProject(projectId, target)`）

1. 读文档；若 `archive` 已存在 → 跳过。若仍有内联图片 → `ensureProjectImagesMigrated`，失败则该系统报「图片尚未整理完成，暂不能归档」。
2. `reconcileProjectImages`：`missing.length > 0` → 拒绝（「有 N 张图片本地已缺失」），不归档不删除。
3. `hydrateAssets` 取全部字节；逐张计算 sha256，生成 `archive.json`；`createDataPackageBlob` + `archive.json` → Blob。
4. `target.write` → `target.read` 从磁盘读回 → `verifyArchiveBlob(blob, expected)`：解析 ZIP、`archive.json` 与 expected 一致、每张图片存在且 sha256/byteSize 一致、`manifest.json` 引用的图片 id 集合与本地引用一致。
5. 校验通过 → `commitProjectArchive(projectId, expectedImageIds, archiveInfo)`（见 5.5）。事务失败 → 本地数据不变，报「文件已保存但本地未清理」，文件保留在目标目录。
6. 校验失败 → 不动本地，报具体原因；文件留在目录并在结果里注明「该文件无效，可删除」。

多个系统按顺序逐个执行（控制内存峰值），单个失败不影响其它；结果汇总：成功 N 个、释放约 X、失败列表与原因。

### 5.4 恢复单个系统（`restoreProject(projectId, file: Blob)`）

1. 解析 ZIP 与 `archive.json`；`format/version` 不认识 → 拒绝。
2. `projectId` 不等于目标系统 → 拒绝（「该文件属于 <系统名> 的归档」，名称取自文件内 manifest）。
3. 文件 fingerprint 与本地 `archive.fingerprint` 不一致 → 拒绝（不是这次归档生成的文件）。
4. 逐张读取并校验 sha256；用 `archive.json` 记录的 `mimeType` 重建 `data:<mime>;base64,<...>`（atob/FileReader，禁止 fetch，#43）；**不压缩、不改 id**。
5. `restoreProjectArchive(projectId, fingerprint, records)`（见 5.5）。

恢复入口使用 `<input type="file" accept=".zip">`，两端通用。

### 5.5 db.ts 新增写路径（都经 `trackWrite`，#70）

- `commitProjectArchive(projectId, expectedImageIds, info)`：单事务 projects + summaries + images。事务内重读文档：必须未归档、`collectImageRefs(doc)` 集合 == `expectedImageIds`、`by_project` 主键集合 == `expectedImageIds`（防止归档期间手机上传/删除造成分叉）；任一不符 abort 并返回「归档期间系统有改动，已取消，请重试」。通过则删除该项目全部图片字节、`doc.archive = info`（不改 `updatedAt`，保留「最后修改」语义）、更新摘要。
- `restoreProjectArchive(projectId, fingerprint, records)`：单事务。重读文档：必须已归档且 fingerprint 一致、引用集合 == records 的 id 集合；逐条 `put` 图片记录后 `doc.archive = null`、更新摘要。写入失败（如磁盘满）整体回滚，本地保持「已归档」状态。
- `addImageToProject` / `removeImageFromProject`：事务内发现 `doc.archive` 非空 → abort，「该系统已归档，请先恢复」。这是防止手机端/并发路径绕过 UI 的最后一道闸。
- `saveProject` / `saveProjectWithImages`：写事务内先读摘要，库里已归档时只接受携带**同一指纹**且**不写新图片字节**的写入，否则 abort（「该系统已归档，请先恢复再修改」）。原设计认为「UI 已阻止打开 + normalize 透传」即可，实施时发现工作台 `AppContext.buildDocument` 构造的文档根本不带 `archive` 字段，而 `#/project/<id>`、`#/mobile/<id>` 可绕过列表直接打开，一次自动保存就会把标记写成 null。改名等携带原标记的写入（列表「编辑」、组信息同步）不受影响。

### 5.6 其它路径的归档感知

| 路径 | 处理 |
|---|---|
| 项目列表打开系统 | 已归档 → 不进入编辑，弹确认「该系统已归档（时间/文件名），是否恢复？」 |
| 列表导入到已有系统、导出数据包、Word 报告 | 已归档系统禁用并说明 |
| 项目组级采集/导出 | 跳过已归档系统并在结果中说明 |
| 手机采集 `lanGroupSnapshot` | 过滤已归档系统；上传到已归档系统由 5.5 的库内闸拒绝（返回失败而非 201） |
| 存储自检 `reconcileProjectImages` | 已归档项目返回 `{ missing: [], orphans, archived: true }`；orphans 仍如实报告 |
| 删除系统/项目组 | 保持现有行为；确认文案对已归档系统补一句「归档文件不会被删除」 |
| 图片压缩/存量瘦身 | 跳过已归档系统 |

## 6. 界面

- **项目列表**：已归档系统行显示灰色「已归档」标签与「恢复」按钮；项目组行若全部系统已归档显示「已归档」，部分归档显示「N 个已归档」。样式沿用现有标签/按钮规格。
- **提醒条**：列表页顶部，非阻塞，沿用现有提示色板。
- **存储设置**：新增三块——持久存储状态；提醒阈值（数字输入 + 恢复默认）；占用明细表（按占用降序，可勾选、按组全选，底部「归档所选」）。
- **ArchiveDialog**：步骤：确认清单与总大小 → 选择目录 → 逐个进度（当前系统、第 k/n 个）→ 结果汇总。进行中关闭按钮禁用；关窗由 pendingWrites 保护（仅 commit/restore 事务期间计数；写文件阶段关窗不会丢本地数据）。
- 完成提示：「已归档 N 个系统，释放约 X。浏览器回收磁盘空间可能有延迟，存储设置里的『已用』不一定立即下降。」

## 7. 兼容与回滚

- 旧版本应用打开含 `archive` 字段的库：字段被忽略，已归档系统会显示为「图片缺失」但数据结构完好；再升回新版恢复即可。发版说明中注明不要降级。
- 未使用归档功能的用户：除持久存储申请与提醒外无行为变化。
- 回滚：功能代码独立，撤回提交即可；已产生的归档文件可用任何版本的「导入数据包」导入为新系统。

## 8. 风险

| 风险 | 缓解 |
|---|---|
| normalize 漏透传导致标记丢失 | 验证脚本逐条断言各写路径后 `archive` 仍在 |
| 归档期间并发写 | commit 事务内比对引用集合与字节主键集合 |
| 目录选在 C 盘 | 桌面比较盘符并警告；Web 在说明中提示 |
| 大系统内存峰值 | 逐系统串行；与现有导出同量级 |
| Chrome quota 口径与假设不符 | P0 已证实不符，改由本机服务查询真实磁盘剩余 |
| showDirectoryPicker 在 127.0.0.1 不可用 | 实现第一步先实测（localhost 属安全上下文，预期可用） |
