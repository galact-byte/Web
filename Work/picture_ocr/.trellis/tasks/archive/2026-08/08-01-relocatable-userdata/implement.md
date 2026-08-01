# 实施计划：桌面可迁移数据目录 + Web A+B

> 顺序执行；每步给出验证方式。构建命令：`npm run build`（`tsc -b && vite build`）。
> 校验脚本沿用 `scripts/verify-*.mjs` 风格（读源码做断言）。CRLF 注意：verify 脚本读源码断言前先 `.replace(/\r\n/g,'\n')`（见项目约束）。

## 里程碑 A — 桌面版迁移数据目录

### A1. main.cjs：启动早期应用指针（R1/R2、C1/C3）
- [ ] 在 `app.whenReady()` 之前加入：`resolveConfigPath()`、`readConfig()`、目标可用性探针（mkdir + 写删 `.__probe__`）、`app.setPath('userData', target)`；记录 `defaultUserData` 与 `startupWarning`。
- [ ] 配置路径 = `path.join(app.getPath('appData'), app.getName(), 'data-location.json')`；容错读，异常当默认。
- 验证：临时手写一个指向 D 盘有效目录的指针 → 启动后 `app.getPath('userData')` 指向目标；指针指向不存在目录 → 回退默认且不崩溃（可用临时 console 日志确认，后续删除日志）。

### A2. main.cjs + preload：5 个 IPC（R3/R4/R5/R5b、C5）
- [ ] `data:get-location` 返回 `{ current, isDefault, defaultDir, startupWarning, backup? }`（backup 含 remainingDays）。
- [ ] `data:choose-location`：`isExpectedRenderer` → `dialog.showOpenDialog(openDirectory,createDirectory)` → 复制 `currentUserData` → `chosen/测评证据采集数据`（跳过 `GPUCache`/`Code Cache`/`logs` 等缓存目录）→ 复制成功才写指针（含 `backup={dir,createdAt,isDefaultRoot}`）→ 返回 `{ changed, dataDir, needRestart }`。
- [ ] `data:reset-location`：复制回 `defaultUserData` → 当前自定义目录记为 backup(isDefaultRoot:false) → 清 dataDir → `needRestart`。
- [ ] `data:delete-backup`：按 `isDefaultRoot` 删除备份（defaultRoot 保留 `data-location.json`）→ 移除 backup 回写 → `{ deleted }`。
- [ ] `data:relaunch`：`app.relaunch(); app.exit(0)`。
- [ ] `preload.cjs` 暴露 `window.evidenceData`（getLocation/chooseLocation/resetLocation/deleteBackup/relaunch）。
- [ ] `src/vite-env.d.ts` 增补 `evidenceData?` 类型。
- 验证：`npm run build` 通过（类型）；`npm run desktop:build` 出包后手动点“更改位置”走通复制+重启（里程碑末尾人工验收）。

### A3. copyDir 工具（C2 不丢数据）
- [ ] 主进程内实现递归复制（Node `fs.cpSync(src,dst,{recursive:true})` 优先，附排除过滤）；复制为主、**从不删除源**；关键项失败即抛错、不写指针。
- 验证：单元式手测——复制含 `IndexedDB` 的目录到新位置，比对文件数量/存在性。

### A4. 备份自动清理（R5b、C2）
- [ ] `BACKUP_RETENTION_MS = 7天`（集中常量）；app ready 后后台执行：`cfg.backup` 超期 → 按 `isDefaultRoot` 删除（defaultRoot 保留 `data-location.json`；否则递归删子目录）→ 移除 backup 回写。删除失败只记日志、不阻塞。
- 验证：手写一个 `createdAt` 已超 7 天的 backup → 启动后备份被清、cfg.backup 消失；未超期则保留。

## 里程碑 B — Web A（用量可视 + 引导）

### B1. storageEstimate 工具（R6）
- [ ] 新增 `src/utils/storageEstimate.ts`：`getStorageEstimate(): Promise<{ supported, usage, quota, ratio }>`，包 `navigator.storage?.estimate?.()`，异常/缺失 → `supported:false`。
- [ ] `formatBytes(n)` 人类可读（复用或新增）。
- 验证：新增 `scripts/verify-storage-estimate.mjs` 断言导出函数与降级分支存在；`node scripts/verify-storage-estimate.mjs` 通过。

## 里程碑 C — Web B（导出可选保存位置）

> 变更（用户验收后回退）：实际环境下普通消费级 Chrome 导出就会弹保存框，`showSaveFilePicker` 开关与之重叠、对用户无增益且关闭时会“弹框+已开始下载”叠加。故 **方案 B 已移除**：saveBlob/exportPreference/verify-save-blob 删除，导出回退普通 `<a download>`。保留方案 A（用量展示）。

### C1. saveBlob 工具（R8/R9）
- [ ] 新增 `src/utils/saveBlob.ts`：`saveBlob(blob, filename, preferPicker?)` → `'saved'|'downloaded'|'cancelled'`；支持 `showSaveFilePicker` 且偏好开启走 picker（`AbortError`→`cancelled`），否则 `<a download>`。
- [ ] 新增 `src/utils/exportPreference.ts`：读写 `localStorage['evidence.exportAskLocation']`，默认随 picker 支持性。
- 验证：新增 `scripts/verify-save-blob.mjs` 断言三分支（saved/downloaded/cancelled）与能力检测存在；通过。

### C2. 接入现有导出（R8）
- [ ] `src/utils/exportImport.ts`：`downloadBlob` 内部改调 `saveBlob`（保留 `<a download>` 作回退实现）；两处导出（zip、`.evidence`）返回结果供 UI 提示。
- [ ] `src/utils/wordExport.ts`：同样改调 `saveBlob`。
- 验证：`npm run build` 通过；`npm run verify:evidence-package` 仍通过（导出内容/格式不变）。

## 里程碑 D — 共用入口 UI

### D1. StorageSettingsDialog（C4/C6）
- [ ] 新增 `src/components/StorageSettingsDialog.tsx`：`window.evidenceData` 存在→桌面迁移区（当前路径/更改/恢复默认，`useConfirmDialog`+`relaunch`）；否则→Web 区（用量卡片+高占用告警+“导出时询问保存位置”开关）。
- [ ] 在项目列表主界面加“存储设置”入口按钮，打开该对话框。
- [ ] App 挂载后若桌面 `startupWarning` 非空 → `useToast({tone:'error'})` 一次。
- 验证：`npm run build` 通过；Web 预览（`npm run preview`）下打开对话框显示用量与开关、不显示桌面迁移 UI。

## 里程碑 E — 全量回归与验收
- [ ] `npm run build` 通过。
- [ ] 现有校验：`npm run verify:evidence-package`、`verify:lan-server`、`verify:pwa-build` 通过（未被本次改动破坏）。
- [ ] 新增：`verify-storage-estimate`、`verify-save-blob` 通过。
- [ ] 桌面人工验收：`npm run desktop:build` → 更改目录到 D 盘 → 重启后原项目/图片可见、原 `%APPDATA%` 保留（AC1/AC3/AC4/AC6）；指针指错目录回退告警（AC5）。
- [ ] Web 人工验收（Chrome/Edge，HTTPS/localhost）：用量显示（AC8）；导出弹保存框可选目录（AC9）；关偏好或不支持时回退下载正常（AC9）；取消保存框不报错（AC10）。

## 回滚点
- 每个里程碑独立可回滚：删对应新增文件 / 把 `saveBlob` 换回 `downloadBlob` / 删 IPC 与指针即可恢复原行为。

## Review Gates
- 里程碑 A、C 各自完成后先自检构建与相关 verify，再进入下一里程碑。
- 桌面复制/重启涉及数据安全，A2/A3 完成后务必做“复制不删源 + 失败不写指针”的边界验证再继续。
