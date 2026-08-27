# 执行计划：局域网采集升级为项目组级 + 手机端选系统

测试策略：本仓库无测试框架，用 `scripts/verify-*`（Node `assert` / PowerShell）做可重复验证。按 Red→Green 推进：先扩展/新增 verify 断言到失败，再实现到通过。

验证命令总览：
- 类型/构建：`npm run build`（`tsc -b && vite build && sw`）
- 原生 LAN 服务：`npm run verify:lan-server`
- 手机端选择器：`npm run verify:lan-mobile-picker`
- Web ZIP 服务：`npm run verify:web-lan-server`（PowerShell）

---

## 阶段 0 · 基线（review gate 前置）
- [ ] 运行 `npm run build`、`npm run verify:lan-server`、`npm run verify:lan-mobile-picker`、`npm run verify:web-lan-server`，记录改动前的绿基线。
- [ ] 确认工作区干净（仅本任务相关改动）。
- 回退点：本阶段无代码改动。

## 阶段 1 · 类型与快照结构（前端契约）
- [ ] `src/utils/lanBridge.ts`：`LanCollectorSnapshot` 改为组结构（`groupId/groupTitle/systems[]`），新增 `LanCollectorSystem`；`LanImageUpload.projectId` 保留。
- [ ] 新增 `buildGroupSnapshot(groupId, openSystemLiveSnapshot?)` 与项目无关写入器 `saveLanImageToProject(projectId, payload)`（放 `src/utils/lanImageSink.ts`）。
- [ ] Red：新增 `scripts/verify-lan-image-sink.mjs`，断言：写入不存在系统报错、资产/检查项缺失报错、按 image.id 去重、正常 append 落库（用内存 fake 或对 `db` 纯函数部分抽测）。
- 验证：`node scripts/verify-lan-image-sink.mjs`（先红后绿）、`npm run build`。
- 回退点：类型层可独立回退，不影响运行时。

## 阶段 2 · 桌面落库分流上移到 App 层
- [ ] `src/context/AppContext.tsx`：`AppProvider` 挂载时向 `App` 注册 `openSystemImageSinkRef`（`{projectId, sink:(payload)=>addImageAndSave(payload)}`），卸载清除。
- [ ] `src/App.tsx`：`onImage` 注册移到 `App` 层（脱离 AppContent）；分流：目标==当前打开系统→走 sink；否则→`saveLanImageToProject`；结果统一 `confirmImageSaved`。
- [ ] `App` 层维护 `currentGroupSnapshot`，会话运行时按 2.2 时机 `updateSession`。
- 验证：`npm run build`；手动/脚本核对分流路径。
- 回退点：保留旧 `AppContent` onImage 作为过渡分支便于回滚，稳定后删除。

## 阶段 3 · 手机端选系统
- [ ] `src/components/LanMobileCollector.tsx`：解析组快照，新增系统选择层；`activeSystemId` 驱动分类/资产；上传带 `projectId=activeSystemId`；轮询合并保持选择；单系统自动选中。
- [ ] `src/components/LanCollectorDialog.tsx`：`snapshot` 适配组结构（展示层改动，QR/链接逻辑不变）。
- [ ] Red：扩展 `scripts/verify-lan-mobile-picker.mjs` 断言存在系统选择、上传带 projectId、单系统回退。
- 验证：`npm run verify:lan-mobile-picker`（先红后绿）、`npm run build`。
- 回退点：手机端为纯前端，独立回退。

## 阶段 4 · 原生服务端协议（Electron）
- [ ] `electron/main.cjs`：`normalizeSnapshot` 支持 `systems[]`；`start/update-session` 组级；onImage 用上传校验后的 `projectId` 打标（不再用单一 `lanSession.projectId`）。
- [ ] `electron/lanServer.cjs`：`createAllowedItems` 升为 `Map<projectId,Map<assetId,Set<itemId>>>`；`/api/upload` 读取并校验 `projectId`；`/api/session` 返回组快照。
- [ ] `electron/preload.cjs`：如签名不变则无需改（onImage/confirm 保持）。
- [ ] Red：扩展 `scripts/verify-lan-server.cjs`：多系统快照、跨系统上传校验（属于/不属于会话）、projectId 打标正确。
- 验证：`npm run verify:lan-server`（先红后绿）、`npm run build`。
- 回退点：服务端与前端需同版本；本阶段单独提交，回滚整阶段。

## 阶段 5 · Web ZIP 服务端协议（PowerShell）
- [ ] `start-server.ps1`：会话存组快照；三层白名单校验；`/api/upload` 读取并校验 `projectId`；`/api/session` 返回组快照；`/api/control/*` 语义对齐原生。
- [ ] Red：扩展 `scripts/verify-web-lan-server.ps1` 覆盖多系统、跨系统上传校验、projectId 透传。
- 验证：`npm run verify:web-lan-server`（先红后绿）。
- 回退点：PS 脚本独立文件，可单独回滚。

## 阶段 6 · 入口“放外边”
- [ ] `src/components/ProjectList.tsx`：项目组层级新增「启动手机采集」入口，调用 App 层组级启动 + 复用 `LanCollectorDialog`。
- [ ] `src/components/Toolbar.tsx`：保留「采集中」状态/重开；系统内启动按所属 groupId 起整组会话。
- 验证：`npm run build`；手动走查两入口共享单一会话、切系统不断连。
- 回退点：UI 入口层，可独立回退到「仅工作台入口」。

## 阶段 7 · 全量验收
- [ ] 逐条对照 prd.md 验收标准（含单系统不回退、跨系统落库、开放系统实时刷新、越权拒绝）。
- [ ] 全部 verify 脚本 + `npm run build` 绿。
- [ ] `trellis-check` 质量校验。
- [ ] 更新 spec（如涉及局域网协议约定）、提交。

## 验收结果（实现 + 校验）

已按阶段实现并提交两个里程碑：
- `ec71a44`：阶段 1–5（类型/组快照/落库分流/手机选系统/Electron 协议/Web ZIP 协议）。
- `b79b103`：阶段 6（ProjectList 组级“手机采集”入口）。

改动前后均绿的校验：
- `npm run build`（tsc + vite）✓
- `node scripts/verify-lan-image-sink.mjs`（新增，纯逻辑）✓
- `npm run verify:lan-server`（三层白名单 + 跨系统落库）✓
- `npm run verify:lan-mobile-picker`（选系统 + 带 projectId 上传 + 组级入口）✓
- `npm run verify:web-lan-server`（PowerShell，双系统 + 跨系统校验）✓

待用户真机验收：手机扫码后组内切系统采集不断连、当前打开系统实时刷新、越权拒绝。

已知限制：会话运行时若跳到不同项目组的系统再从工作台开对话框，当前打开系统会作为覆盖项混入快照（跨组导航属少见场景）；重新从项目列表对目标组启动即可干净重定向。

## 关键顺序与门禁
1. 阶段 1→2→3 是前端闭环；4、5 是两条服务端；6 是入口。**4 与 5 必须都完成**才能算「web 和客户端同步」。
2. 每阶段单独提交，便于按阶段回滚。
3. 服务端协议（4/5）与前端协议（1/3）必须同版本发布，避免手机端与宿主协议错配。
