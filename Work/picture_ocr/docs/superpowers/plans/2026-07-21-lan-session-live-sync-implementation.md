# 局域网采集会话热更新实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重新扫码的前提下，让手机局域网采集页自动获得电脑端最新项目结构，并使会话弹窗可收起但会话继续运行。

**Architecture:** Electron 会话服务和 Web ZIP PowerShell 宿主各自增加“替换完整快照与上传白名单”的受控更新接口。桌面工作台在会话运行时串行提交最新快照，手机页每 2000ms 拉取快照并保留仍有效的选择；工具栏根据服务状态显示“采集中”。

**Tech Stack:** React 18、TypeScript、Vite、Tailwind CSS、Electron IPC、Node HTTP、Windows PowerShell 5.1、Node 内置 assert。

## Global Constraints

- 不新增第三方依赖、不修改 IndexedDB 项目数据模型或导入导出格式。
- 保持随机 token、私有局域网绑定、loopback 控制接口、`X-Evidence-Control`、10MB 限制、MIME 与文件魔数白名单。
- 快照更新必须拒绝不同 `projectId`，且在替换前建立完整新白名单。
- 关闭对话框只能收起 UI；仅“停止会话”、离开工作台、关闭桌面程序或超时终止会话。
- 手机端轮询固定为 2000ms；刷新失败不得清空已加载 UI 或中断上传状态。
- 项目列表不得保留局域网采集按钮或会话保存逻辑；其现有 CSS 响应式收纳策略保持不变。

---

### Task 1: 让 Electron HTTP 会话原子更新快照与白名单

**Files:**
- Modify: `electron/lanServer.cjs`
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/vite-env.d.ts`
- Test: `scripts/verify-lan-server.cjs`

**Interfaces:**
- Produces `server.updateSnapshot(snapshot): void`，将 `/api/session` 与 `/api/upload` 同步切换至新快照和新白名单。
- Produces IPC `lan:update-session(snapshot): LanSessionStatus`，仅主工作台调用、仅更新当前项目。
- Exposes `window.evidenceLan.updateSession(snapshot)`。

- [ ] **Step 1: 写入 Electron 服务的失败验证**

在 `scripts/verify-lan-server.cjs` 的初始快照后添加第二份同项目快照：保留 `asset-1`，移除 `item-1`，新增 `item-2`，并添加 `asset-2`。在读取初始 `/api/session` 后调用尚不存在的 `server.updateSnapshot(updatedSnapshot)`，断言：

```js
server.updateSnapshot(updatedSnapshot);
const updatedSession = await request(`${baseUrl}/api/session?token=${encodeURIComponent(token)}`);
assert.equal(updatedSession.status, 200);
assert.equal((await updatedSession.json()).assets[1].id, 'asset-2');
assert.equal((await request(`${baseUrl}/api/upload?token=${encodeURIComponent(token)}&assetId=asset-1&itemId=item-1`, {
  method: 'POST', headers: { 'content-type': 'image/png' }, body: png,
})).status, 403);
assert.equal((await request(`${baseUrl}/api/upload?token=${encodeURIComponent(token)}&assetId=asset-1&itemId=item-2`, {
  method: 'POST', headers: { 'content-type': 'image/png' }, body: png,
})).status, 201);
```

- [ ] **Step 2: 运行失败验证**

Run: `npm run verify:lan-server`

Expected: FAIL，错误为 `server.updateSnapshot is not a function`，证明测试命中了缺失行为。

- [ ] **Step 3: 实现可替换的服务状态**

在 `createLanCollectorServer` 中以 `let currentSnapshot = snapshot; let currentAllowedItems = createAllowedItems(snapshot);` 保存会话状态。让 `/api/session` 返回 `currentSnapshot`，让 `/api/upload` 查询 `currentAllowedItems`。在返回对象添加：

```js
updateSnapshot(nextSnapshot) {
  const nextAllowedItems = createAllowedItems(nextSnapshot);
  currentSnapshot = nextSnapshot;
  currentAllowedItems = nextAllowedItems;
},
```

在 `electron/main.cjs` 添加处理器：规范化输入，要求当前会话存在且 `normalizedSnapshot.projectId === lanSession.projectId`，调用 `lanSession.server.updateSnapshot(normalizedSnapshot)` 并返回 `getLanStatus()`；创建会话时将 `projectId` 存入 `lanSession`，图片回调读取该会话项目 ID。

在 `electron/preload.cjs` 和 `src/vite-env.d.ts` 同步暴露 `updateSession`。

- [ ] **Step 4: 运行 Electron 会话验证**

Run: `npm run verify:lan-server`

Expected: PASS，输出包含 `LAN 采集服务验证通过`，并覆盖更新后新白名单允许、旧白名单拒绝。

- [ ] **Step 5: 提交 Electron 服务改动**

```bash
git add electron/lanServer.cjs electron/main.cjs electron/preload.cjs src/vite-env.d.ts scripts/verify-lan-server.cjs
git commit -m "feat: refresh Electron LAN session snapshots"
```

### Task 2: 为 Web ZIP 控制端增加同项目快照更新

**Files:**
- Modify: `start-server.ps1`
- Test: `scripts/verify-web-lan-server.ps1`

**Interfaces:**
- Produces `POST /api/control/update`，请求体为 `{ snapshot }`，仅 loopback 且 `X-Evidence-Control: 1` 可调用。
- Successful response returns the standard `{ running, url, addresses }` status object.

- [ ] **Step 1: 写入 Web ZIP 的失败验证**

在 `scripts/verify-web-lan-server.ps1` 的会话启动断言后，新增同项目快照 `$updatedSnapshot`，其资产为 `asset-2/item-2`。新增断言：

```powershell
$updated = Invoke-JsonRequest -Method POST -Uri "$baseUrl/api/control/update" -Body @{ snapshot = $updatedSnapshot }
Assert-That ($updated.StatusCode -eq 200 -and $updated.Body.running) '同项目快照更新必须保持当前会话运行。'
$updatedSession = Invoke-JsonRequest -Method GET -Uri "$lanBaseUrl/api/session?token=$token"
Assert-That ($updatedSession.Body.assets[0].id -eq 'asset-2') '手机会话必须返回最新快照。'
Assert-That ((Invoke-JsonRequest -Method POST -Uri "$lanBaseUrl/api/upload?token=$token&assetId=asset-1&itemId=item-1").StatusCode -eq 403) '快照更新后旧白名单必须立即失效。'
```

另断言没有控制 header 返回 403、不同 `projectId` 返回 409、停止后更新返回 409。

- [ ] **Step 2: 运行失败验证**

Run: `npm run verify:web-lan-server`

Expected: FAIL，更新请求得到 405，证明控制更新端点尚不存在。

- [ ] **Step 3: 实现锁内原子更新**

在 `Handle-Control` 的 `/api/control/stop` 分支前添加 `/api/control/update` 分支：解析 JSON、调用 `ConvertTo-NormalizedSnapshot`，取得活动会话；在 `SessionLock` 内确认会话仍存在且规范化 `projectId` 与会话项目一致，随后同一临界区替换 `$session.snapshot` 与 `$session.allowed`。不同项目响应 409，已停止会话响应 409，输入错误响应 400；成功用 `Send-Json` 返回现有状态结构。

- [ ] **Step 4: 运行 Web ZIP 验证**

Run: `npm run verify:web-lan-server`

Expected: PASS，输出包含 `Web ZIP 局域网采集验证通过`，并覆盖控制边界、同项目更新、跨项目拒绝、新旧白名单与停止失效。

- [ ] **Step 5: 提交 Web ZIP 会话改动**

```bash
git add start-server.ps1 scripts/verify-web-lan-server.ps1
git commit -m "feat: refresh Web LAN session snapshots"
```

### Task 3: 同步工作台会话、收起弹窗和轮询手机快照

**Files:**
- Modify: `src/utils/lanBridge.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/LanCollectorDialog.tsx`
- Modify: `src/components/LanMobileCollector.tsx`
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/ProjectList.tsx`
- Modify: `scripts/verify-lan-mobile-picker.mjs`

**Interfaces:**
- `LanBridge.updateSession(snapshot): Promise<LanSessionStatus>` 在 Electron 和 Web ZIP 两种交付形态可用。
- `Toolbar` receives `lanSessionRunning: boolean` and renders a labelled “采集中” state.
- `LanMobileCollector` refreshes `/api/session` at 2000ms and reconciles selection by stable IDs.

- [ ] **Step 1: 写入前端失败验证**

在 `scripts/verify-lan-mobile-picker.mjs` 中加入源码断言：

```js
const appSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/App.tsx'), 'utf8');
const toolbarSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/components/Toolbar.tsx'), 'utf8');
const bridgeSource = fs.readFileSync(path.resolve(scriptDirectory, '../src/utils/lanBridge.ts'), 'utf8');
assert.match(bridgeSource, /updateSession:/, '统一局域网桥必须提供快照更新接口。');
assert.match(collectorSource, /setInterval\([^,]+, 2000\)/, '手机采集页必须每 2 秒同步最新项目快照。');
assert.match(collectorSource, /当前选择已调整/, '手机端删除当前选择时必须给出更新说明。');
assert.match(toolbarSource, /采集中/, '活动会话必须在工作台工具栏显示状态标识。');
assert.match(dialogSource, /关闭此窗口不会停止手机采集/, '关闭弹窗必须明确说明会话仍会继续。');
assert.doesNotMatch(projectListSource, /手机局域网采集/, '项目列表不应保留局域网采集入口。');
assert.match(appSource, /updateSession\(lanSnapshot\)/, '工作台会话运行期间必须提交最新快照。');
```

- [ ] **Step 2: 运行失败验证**

Run: `npm run verify:lan-mobile-picker`

Expected: FAIL，首个失败来自缺少 `LanBridge.updateSession` 或手机轮询，证明新交互尚未存在。

- [ ] **Step 3: 实现桌面桥接和会话状态 UI**

扩展 `LanBridge`、Web bridge、生命周期串行包装和 Electron 类型声明，新增 `updateSession`。在 `AppContent` 中维护 `lanSessionRunning` 和同步错误；弹窗启动/停止后通过回调更新状态。会话运行时以完整 `lanSnapshot` 为依赖调用 `lanBridge.updateSession(lanSnapshot)`；初次启动前不调用，失败仅显示可恢复说明。把 `LanCollectorDialog.onClose` 改为只收起，删除 `handleClose` 内调用 `handleStop(true)` 的路径；在会话已启动时显示收起不停止的说明。为 `Toolbar` 添加 44px+ 点击区域的绿色状态点与“采集中”。

- [ ] **Step 4: 实现手机无干扰轮询和选择回退**

在 `LanMobileCollector` 创建 `refreshSnapshot(initialLoad: boolean)`：请求快照后，以函数式状态更新保留仍存在的 `activeCategoryId` 与 `activeAssetId`；若已选项不存在，则选首个有效分类/资产并设定“电脑端项目结构已更新，当前选择已调整”。首次请求失败保留原始错误展示，已加载后请求失败不更新 `message`。使用：

```ts
useEffect(() => {
  void refreshSnapshot(true);
  const timer = window.setInterval(() => void refreshSnapshot(false), 2000);
  return () => window.clearInterval(timer);
}, [refreshSnapshot]);
```

删除 `ProjectList` 的 `LanCollectorDialog`、`lanDocument`、`handleOpenLanCollector`、上传监听和所有“手机局域网采集”按钮；保留其 CSS 响应式网格、详情列与“更多操作”。

- [ ] **Step 5: 运行前端行为验证**

Run: `npm run verify:lan-mobile-picker`

Expected: PASS，输出确认单一图片入口、弹窗不停止会话、工具栏采集状态、手机轮询、项目列表入口移除及自适应收纳约束。

- [ ] **Step 6: 提交前端改动**

```bash
git add src/utils/lanBridge.ts src/App.tsx src/components/LanCollectorDialog.tsx src/components/LanMobileCollector.tsx src/components/Toolbar.tsx src/components/ProjectList.tsx scripts/verify-lan-mobile-picker.mjs
git commit -m "feat: keep LAN collection live during project edits"
```

### Task 4: 完成跨交付形态回归与变更交接

**Files:**
- Modify: `CHANGES.md`
- Verify: `scripts/verify-evidence-package.mjs`, `scripts/verify-pwa-build.mjs`

**Interfaces:**
- Produces an auditable changelog entry with actual commands and device-test limitation.

- [ ] **Step 1: 更新变更记录**

在 `CHANGES.md` 顶部添加日期为 `2026-07-21` 的记录，说明：项目内唯一入口、收起弹窗仍采集、绿色“采集中”标识、Electron/Web ZIP 原子快照白名单更新、手机 2 秒同步、项目列表入口移除与自适应保持；已知限制必须说明未完成真实手机设备上的扫码和热更新烟测。

- [ ] **Step 2: 执行完整自动化回归**

Run:

```bash
npm run verify:lan-mobile-picker
npm run verify:lan-server
npm run verify:web-lan-server
npm run verify:evidence-package
npm run build
npm run verify:pwa-build
git diff --check
```

Expected: 每个命令 exit 0；构建含 TypeScript 与 Vite；差异检查无输出。

- [ ] **Step 3: 检查交付差异**

Run:

```bash
git status --short
git log --oneline -4
```

Expected: 仅本任务文件处于 staged/committed 状态；日志包含三个实现提交与设计文档提交。

- [ ] **Step 4: 提交变更记录**

```bash
git add CHANGES.md docs/superpowers/plans/2026-07-21-lan-session-live-sync-implementation.md
git commit -m "docs: record live LAN collection updates"
```
