# 技术设计：局域网采集升级为项目组级 + 手机端选系统

## 1. 现状与约束回顾

- 会话状态：`lanBridge` 已在 `App` 层（`App.tsx` 的 `lanBridge` state），但**快照与 `onImage` 落库逻辑在 `AppContent`（系统级）**，随系统切换而重挂载/停会话。
- 落库：`AppContext.addImageAndSave` 只能写**当前挂载系统**；但底层 `db.ts` 的 `loadProject(id)`/`saveProject(doc)` 是**按 systemId 独立**的，可写任意系统。
- 协议：`LanImageUpload` 已含 `projectId`；手机上传接口目前只传 `assetId/itemId`，`projectId` 由服务端用会话单一快照补上。
- 双路径：
  - Electron 原生：`preload.cjs`(桥) → `main.cjs`(IPC + 会话/落库中转) → `lanServer.cjs`(HTTP 宿主)。
  - Web ZIP：`start-server.ps1`（同时是 `/api/control/*` 控制端与 `/api/session`、`/api/upload` 采集宿主）。

## 2. 目标架构

会话从「系统级」升为「项目组级」。核心改动四处：**快照结构**、**上传协议**、**桌面落库分流**、**入口位置**。

### 2.1 组快照结构（类型层）

`src/utils/lanBridge.ts`：

```ts
interface LanCollectorSystem {
  projectId: string;
  title: string;               // 系统名
  categories: { id: string; name: string }[];
  assets: { id; name; categoryId; items: LanCollectorItemSnapshot[] }[];
}
interface LanCollectorSnapshot {   // 现在是“组快照”
  groupId: string | null;
  groupTitle: string;             // 项目组名/展示名
  systems: LanCollectorSystem[];  // 组内所有系统
}
```

`LanImageUpload` 保持含 `projectId`（= 目标系统 id），语义不变。

### 2.2 组快照构建与实时更新

新增 `buildGroupSnapshot(groupId, openSystemLiveSnapshot?)`：
- 从 db 读取该组全部系统（`listProjects()` 按 `groupId` 过滤，或逐个 `loadProject`）。
- 每个系统映射出 categories/assets/items(含 imageCount)。
- 若某系统正是**当前打开系统**，用其**内存实时快照覆盖** db 版本，避免 500ms 自动保存去抖导致的滞后。

触发重建时机（在 `App` 层统一维护 `currentSnapshot`，会话运行时调用 `bridge.updateSession`）：
1. 会话启动时。
2. 当前打开系统的 `categories/assets/meta` 变化时。
3. 任意系统有新图片落库后（imageCount 变化）。

### 2.3 桌面落库分流（关键）

把 `onImage` 注册**上移到 `App` 层**（脱离 `AppProvider`，因为项目列表页没有挂载 AppProvider）。分流规则：

- 目标是**当前打开系统** → 走已挂载的 `AppContext.addImageAndSave`（内存 + 持久化，UI 实时刷新）。
  - 通过 `App` 持有的可变 ref `openSystemImageSinkRef` 实现：`AppProvider` 挂载时把 `(payload)=>addImageAndSave(payload)` 连同自身 `projectId` 注册进去，卸载清除。
- 目标是**非打开系统** → 走新增的项目无关写入器 `saveLanImageToProject(projectId, payload)`：
  1. `loadProject(projectId)`，为空则报「系统已不存在」。
  2. 定位 asset/item，缺失报「结构已变更，请重启会话」。
  3. 按 `image.id` 去重；已存在直接视为成功。
  4. append 后 `saveProject(mergedDoc)`。

分流保证：**无双写**、开放系统实时刷新、其他系统静默落库。落库成功/失败结果沿用现有 `confirmImageSaved` 回执链路。

> 注：`saveLanImageToProject` 放 `src/utils/lanImageSink.ts`（或并入 db 层工具），纯函数式，便于脚本 Red 测试。

### 2.4 上传协议：携带目标系统

- 手机上传接口加 `projectId` 查询参数：`/api/upload?token&projectId&assetId&itemId`。
- 服务端校验 `(projectId, assetId, itemId)` 三元组在会话组快照内；`createAllowedItems` 改为 `Map<projectId, Map<assetId, Set<itemId>>>`。
- `onImage` 回调用**上传携带并校验过的 projectId** 打标（原生 `main.cjs` 不再用 `lanSession.projectId`）。
- `/api/session` 返回组快照；手机端据此选系统。

### 2.5 手机端选系统（`LanMobileCollector.tsx`）

- 快照解析改为组结构：新增「系统选择」层（进入分类前）。
- 维护 `activeSystemId`；分类/资产/检查项均取自 `snapshot.systems.find(s=>s.id===activeSystemId)`。
- 上传时带上 `activeSystemId` 作为 `projectId`。
- 轮询 `/api/session` 合并快照时，保持已选系统/分类/资产（存在则不跳变，缺失再回退首项）。
- 组内仅一个系统时，自动选中并可跳过选择层（保持旧体验）。

### 2.6 入口位置（“放外边”）

- **项目组层级入口**：`ProjectList` 增加「启动手机采集」入口（组级）。点击 → `App` 用该组构建组快照并 `startSession` → 复用 `LanCollectorDialog` 显示二维码/链接。
- **系统工作台**：`Toolbar` 保留「采集中」状态与重开入口；若在未开会话时于系统内启动，则按该系统所属 `groupId` 启动整组会话。
- 单一会话由 `App` 持有，两个入口共享同一状态，切换系统/返回列表都不停会话。

## 3. 双路径改造对照

| 关注点 | Electron 原生 | Web ZIP (`start-server.ps1`) |
|---|---|---|
| 快照结构 | `main.cjs::normalizeSnapshot` 支持 `systems[]` | PS 会话对象存组快照 |
| allowed 校验 | `lanServer.cjs::createAllowedItems` 三层 Map | PS 端等价三层校验 |
| 上传取 projectId | `main.cjs` onImage 用上传校验后的 projectId | PS `/api/upload` 读取并校验 `projectId` |
| 落库中转 | IPC `lan:image` → 渲染进程 App 层分流 | `/api/control/pending` → webBridge → App 层分流 |
| `/api/session` | 返回组快照 | 返回组快照 |

> 渲染进程侧（React）落库分流逻辑对两条路径是**同一份代码**（都经 `lanBridge.onImage`），因此只有服务端/协议层需分别改；这是本任务能双路径对齐的关键。

## 4. 兼容与回退

- 组内仅一个系统：组快照 systems 长度为 1，手机端自动选中，与旧单系统体验一致。
- 会话过期/停止/离开程序：沿用现有 token 失效、2 小时过期、`stopSession` 清理。
- 旧快照字段：无外部持久化（快照是运行时传输结构），无需迁移；只需保证发布时前端/服务端同版本。

## 5. 安全边界（不回退）

token 鉴权、图片魔数校验、10MB、私网地址、CSP、并发上传上限、三元组白名单校验全部保留；白名单从二层升为三层（含 projectId）。

## 6. 风险

- **实时刷新竞态**：开放系统同时有手动编辑与手机上传。用 sink ref 走同一 `addImageAndSave` 队列（已串行化 `saveQueueRef`）规避双写。
- **组快照体积**：系统多时快照较大。仅传结构与计数、不含图片 data，可接受；必要时后续做增量。
- **验证脚本**：`scripts/verify-lan-server.cjs`、`verify-lan-mobile-picker.mjs`、`verify-web-lan-server.ps1` 需按新协议更新。
