# 技术设计：列表性能修复与报错采集

## 1. 存储层：摘要 store（R1/R2）

### 1.1 数据结构
新增常量与类型（`src/utils/db.ts`）：
```
const PROJECT_SUMMARIES_STORE_NAME = 'projectSummaries';
const DB_VERSION = 4;

interface StoredProjectSummary {
  id: string;
  groupId: string | null;
  meta: ProjectMeta;
  assetCount: number;     // = doc.assets.length（与既有 toProjectSummary 口径一致，指资产数）
  createdAt: number;
  updatedAt: number;
}
```
纯派生函数：
```
function summaryFromDoc(doc: ProjectDocument): StoredProjectSummary
```
`ProjectSummary`（对外类型）由 `StoredProjectSummary` 归一化得到（补默认 meta）。

### 1.2 onupgradeneeded（版本 3 → 4）
- 若无 `projectSummaries`：`createObjectStore(keyPath:'id')` + index `updatedAt`、`groupId`。
- **存量补建**：在同一 upgrade 事务内，对 `projects` store 开游标逐条读取，`summariesStore.put(summaryFromDoc(cursor.value))` 后 `cursor.continue()`。逐条处理，峰值内存仅一条文档，避免 OOM。
- 保留既有 v2→v3 逻辑（legacy `project` store、projects 的 `groupId` index）。
- upgrade 只新增/回填，不删除原有数据，失败可安全重试。

### 1.3 读取路径（只读摘要，不碰图片）
- `listProjects()`：`getAll(projectSummaries)` → normalize → 按 updatedAt 排序。
- `listProjectGroups()`：一个只读事务读 `projectSummaries` + `projectGroups`（都很小）→ 复用现有 `groupProjectSummaries()`。
- 两者仍先 `await migrateLegacyProjectIfNeeded()`（该函数也需维护摘要，见 1.4）。
- 移除列表路径里的 `normalizeProjectDocument` / `cloneAssets` 调用。

### 1.4 写入路径（同事务维护摘要）
全部写库函数已集中在 db.ts，外部（组件/导入/局域网 sink）均经由这些函数，无需改调用点：
| 函数 | 事务 store | 摘要动作 |
|---|---|---|
| `saveProject` | projects + summaries | put doc + put summary |
| `createProjectGroupWithSystems` | groups + projects + summaries | put group + 每个 project put doc+summary |
| `createSystemForGroup` | （复用 saveProject） | 同 saveProject |
| `updateProjectGroupAndSystems` | groups + projects + summaries | put group + 改写子系统 doc 时同步 put summary |
| `deleteProject` | projects + summaries | delete doc + delete summary |
| `deleteProjectGroup` | groups + projects + summaries | delete group + 每个子系统 delete doc+summary |
| `migrateLegacyProjectIfNeeded` | legacy + projects + summaries | 迁入 legacy doc 时同步 put summary |

一致性保证：读路径只依赖摘要 store，所有变更均在与文档写入相同的事务内原子完成，摘要不会漂移。

## 2. DB 操作超时兜底（R3）
`src/utils/db.ts` 增加：
```
const DB_OP_TIMEOUT_MS = 15000;
function withTimeout<T>(op: Promise<T>, label: string): Promise<T>
```
用 `Promise.race` 包裹 `openDB()` 及各事务 Promise。超时则 reject `new Error('IndexedDB 操作超时: ' + label)`，由上层 catch → Toast + 记入错误日志。底层 IDB 请求即便仍挂起也不影响：至少把「无限转圈」变成可见错误。

## 3. 报错采集模块（R3）
新增 `src/utils/errorLog.ts`：
- `installGlobalErrorHandlers(onError?)`：注册 `window.addEventListener('error'|'unhandledrejection')`，去重节流后调用 `recordError`。
- `recordError(entry)`：写入 localStorage 环形缓冲 `evidence-error-log`，保留最近 50 条 `{time, type, message, stack, context}`。
- `getErrorLog()` / `clearErrorLog()`。
- `buildDiagnosticsReport()`：汇总 `{app: version, userAgent, timestamp, storage: navigator.storage.estimate(), counts: 项目/系统/资产, errors: getErrorLog()}`。
- `downloadDiagnostics()`：`buildDiagnosticsReport()` → JSON Blob → 普通 `<a download>`（文件名带时间戳）。遵循 memory：不使用 showSaveFilePicker。

安装点：`src/main.tsx` 在渲染前调用 `installGlobalErrorHandlers`，回调里用已有 Toast 通道提示（通过一个轻量事件或全局回调；ToastProvider 在 App 内，故 main.tsx 侧先落日志，UI 提示由 App 内订阅）。

## 4. 诊断入口 UI（R3）
在「存储设置」面板（既有 Web 存储面板/桌面设置处）追加一个「导出诊断包」按钮 + 「最近错误」计数展示，点击调用 `downloadDiagnostics()`；清空按钮走 `useConfirmDialog()`。桌面版与 Web 版共用该入口。

## 5. 兼容性 / 回滚
- 前向：v4 库在旧版本（期望 v3）打开会触发 `VersionError`（IDB 不允许降级打开高版本库）。这是发布单向升级，符合现状（客户只升不降）。
- 回滚代码到 v3：v4 库仍可被 v3 代码打开？否——IDB 打开低于现有版本会报错。故一旦发布 v4，不可退回 v3 代码。实现前在 implement.md 标注该不可逆点；发布走既有 tag 流程，风险可控（数据本身不丢，仅代码需前进修复）。
- 摘要 store 可随时由 `projects` 全量重建（预留 `rebuildSummaries()` 内部函数，迁移与潜在自愈复用）。

## 6. 测试策略（贴合项目 verify 风格，CRLF 归一化）
- `scripts/verify-list-summary-store.mjs`：源码断言（DB_VERSION=4、常量、列表路径不含 cloneAssets/getAll(projects)、各写路径含 summaries）+ 纯函数逻辑（若可 import：summaryFromDoc、groupProjectSummaries 计数一致）。
- `scripts/verify-error-report.mjs`：断言 errorLog API、main.tsx 安装全局 handler、db.ts 含 withTimeout。
- 回归：`npm run build` + 既有 `verify:*`（尤其 lan-image-sink、evidence-package、storage-estimate 依赖 db/导入路径）。
