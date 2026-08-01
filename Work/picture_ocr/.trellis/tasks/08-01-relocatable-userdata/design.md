# 技术设计：桌面可迁移数据目录 + Web 用量可视与导出可选位置

> 本设计分两部分：**一、桌面版（Electron）迁移数据目录**；**二、Web 版 A+B（用量可视 + 导出可选位置）**。两者共用一个环境自适应的“存储设置”入口。

---

# 一、桌面版（Electron）

## 总体思路

“指针 / 数据本体分离”：

- **指针**（几 KB JSON）永远放在稳定位置 `%APPDATA%\<应用名>\data-location.json`（用启动早期 `app.getPath('appData')` + `app.getName()` 计算，不受后续 `setPath` 影响）。
- **数据本体**（IndexedDB、Local Storage，即会随图片增大的部分）放在指针里记录的目录。
- 启动早期读指针 → 校验目标可用 → `app.setPath('userData', 目标)`；否则回退默认并记录告警。

C 盘上永远只剩几 KB 指针，真正占地方的图片在用户选的盘。

## 关键约束与原理

- `app.setPath('userData', ...)` 必须在 `app.whenReady()`（尤其是任何窗口/存储打开）之前调用，且运行期不可再改 —— 所以“更改目录”必须走**重启**。
- portable exe 解压到临时目录，`app.getAppPath()/exe 目录`不稳定；因此不采用“数据跟程序走”。（如未来需要，可用 `process.env.PORTABLE_EXECUTABLE_DIR` 获取真实 exe 目录，本任务不用。）
- 指针文件必须放在“**不会被迁移**”的位置，否则改目录后就找不到指针了。默认 userData（`%APPDATA%\<应用名>`）本身不迁移（迁移的是它下面的数据 store 到新 userData），指针放这里天然稳定。

## 指针配置文件

路径（启动早期计算，命名 `resolveConfigPath()`）：

```
path.join(app.getPath('appData'), app.getName(), 'data-location.json')
```

内容：

```json
{
  "version": 1,
  "dataDir": "D:\\资料\\测评证据采集数据",
  "backup": { "dir": "C:\\Users\\x\\AppData\\Roaming\\<app>", "createdAt": 1730000000000, "isDefaultRoot": true }
}
```

- `dataDir` 为空 / 文件不存在 / 解析失败 → 视为“默认位置”，不 setPath。
- `backup` 记录上一次迁移/恢复后被替换下来、待清理的旧数据位置；`isDefaultRoot` 标记该备份是否就是默认 `%APPDATA%\<应用名>` 根（影响清理策略，见下）。无备份时字段缺省。
- 只在“更改目录 / 恢复默认 / 清理备份”成功后写入或更新。

### 目录命名（DATA_SUBDIR）

用户选的父目录本来就可能含中文，程序必须能处理 Unicode 路径，因此子目录名用中英文无实质差别；为便于用户在资源管理器里一眼识别，**用中文子目录**：

```
DATA_SUBDIR = '测评证据采集数据'
目标落点   = path.join(chosen, '测评证据采集数据')
```

指针记录的 `dataDir` 就是这个落点（含子目录）。

## 启动流程（main.cjs，app ready 之前）

```
1. defaultUserData = app.getPath('userData')            // 记下默认位置备用
2. cfg = readConfig(resolveConfigPath())                // 容错读，失败当默认
3. 若 cfg.dataDir 非空：
     a. target = cfg.dataDir
     b. 校验 target 可用：目录存在或可创建、可写（写删一个探针文件）
     c. 可用 → app.setPath('userData', target)
     d. 不可用 → 不 setPath（保持默认），记录 startupWarning = "自定义数据目录不可用，已临时使用默认位置：<target>"
4. app.whenReady() 后照常 createWindow()
5. 若存在 startupWarning，在窗口就绪后推给渲染层用 toast 告警
```

校验“可写”用探针：在 target 下写 `.__probe__` 再删；捕获异常即判不可用。目录不存在时先 `fs.mkdirSync(target, { recursive: true })`，失败即不可用。

### 备份自动清理（app ready 之后、后台执行）

```
若 cfg.backup 存在：
  age = now - cfg.backup.createdAt
  若 age >= BACKUP_RETENTION_MS (默认 7 天)：
    - isDefaultRoot=true → 删除 backup.dir 下除 data-location.json 外的所有条目（旧 store）
    - isDefaultRoot=false → 递归删除整个 backup.dir（那是我们建的 测评证据采集数据 子目录）
    - 删除成功后从 cfg 移除 backup 字段并回写
  否则：保留，交给 UI 展示剩余天数
```

- 在窗口就绪后异步执行，不阻塞启动；删除失败仅记日志，不影响使用（下次启动再试）。
- 安全边界：`isDefaultRoot` 时**保留 `data-location.json`**（指针本体）；`false` 时目标必是本工具建的 `测评证据采集数据` 子目录，避免误删用户放在同目录的其它文件。

## 实现细化：复制时机改为“重启后、store 打开前”

> 实现时定案：运行期复制当前 userData 不安全——IndexedDB(leveldb) 的 LOCK/.ldb 在 Windows 上被占用，复制会失败或得到不一致快照。因此：`choose-location` / `reset-location` 在运行期**只写一个 `migration` 标记（{ from, to }）并重启**；真正的目录复制在**下次启动 `init()`、`app.whenReady()` 之前**完成（此时没有 store 被打开，复制干净），复制成功后才写 `dataDir` 与 `backup`。复制失败则保持原位置并置 `startupWarning`，原数据始终完好。
>
> 代码位置：`electron/dataLocation.cjs`（init/getLocationInfo/chooseLocation/resetLocation/deleteBackup/cleanupExpiredBackup）；自动验证：`npm run verify:data-location`（mock electron，29 项断言）。

## 更改目录流程（IPC: data:choose-location）

主进程（注：下方 6、7 步的“复制+写指针”已按上述细化移到重启后的 init，运行期仅写 migration 标记）：

```
1. 校验 isExpectedRenderer(sender)
2. dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
   取消 → 返回 { changed: false }
3. chosen = 选中目录
4. 归一化：若 chosen 已是当前 userData → 返回 { changed:false, reason:'相同目录' }
5. 目标落点 = path.join(chosen, DATA_SUBDIR?)  // 见“目录命名”一节
6. 复制现有数据：copyDir(currentUserData, 目标落点)  —— 复制而非移动
     - 跳过明显的锁定/无关缓存目录（如 'GPUCache'、'Code Cache'、'logs'）以减少体积与锁冲突；
       IndexedDB、Local Storage 等业务数据必须复制。
     - 任一关键项复制失败 → 抛错，不写指针，返回 { changed:false, error }
7. 复制成功 → 写指针 data-location.json（dataDir = 目标落点；backup = { dir: currentUserData, createdAt: now, isDefaultRoot: (currentUserData===defaultUserData) }）
8. 返回 { changed:true, dataDir: 目标落点, needRestart:true }
9. 渲染层确认后调用 data:relaunch → app.relaunch(); app.exit(0)
```

原 userData 迁移后转为 `backup` 记录的**临时备份**，不立即删；到保留期后由“备份自动清理”处理。

## 恢复默认流程（IPC: data:reset-location）

```
1. 校验 sender
2. 二次确认由渲染层用 useConfirmDialog 完成后再调
3. 把当前 userData 数据复制回 defaultUserData（若当前已是默认则直接返回 changed:false）
4. 复制成功 → 把当前（自定义）目录记为 backup（isDefaultRoot:false），dataDir 清空/删除
5. 返回 needRestart:true → 渲染层触发 data:relaunch
```

## 立即删除备份流程（IPC: data:delete-backup）

```
1. 校验 sender（+ 渲染层 useConfirmDialog 二次确认）
2. 读 cfg.backup；无 → 返回 { deleted:false }
3. 按 isDefaultRoot 执行与“备份自动清理”相同的删除逻辑
4. 成功 → 从 cfg 移除 backup 回写 → 返回 { deleted:true }
```

## 查询当前状态（IPC: data:get-location）

返回：

```ts
{
  current: string;        // 当前实际 userData 绝对路径（app.getPath('userData')）
  isDefault: boolean;     // 是否为默认 %APPDATA% 位置
  defaultDir: string;     // 默认位置绝对路径
  startupWarning?: string;// 启动回退告警（若有）
  backup?: { dir: string; createdAt: number; remainingDays: number }; // 待清理备份（若有）
}
```

保留期常量：`BACKUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000`（集中定义，便于调整）。

## IPC 与 preload 契约

`electron/main.cjs` 新增 handler（沿用 `isExpectedRenderer` 校验）：

- `ipcMain.handle('data:get-location', ...)`
- `ipcMain.handle('data:choose-location', ...)`  // 弹框 + 复制 + 写指针
- `ipcMain.handle('data:reset-location', ...)`
- `ipcMain.handle('data:delete-backup', ...)`     // 立即删除待清理备份
- `ipcMain.handle('data:relaunch', ...)`          // app.relaunch + exit

`electron/preload.cjs` 在 `contextBridge` 暴露新命名空间，避免污染 `evidenceLan`：

```js
contextBridge.exposeInMainWorld('evidenceData', {
  getLocation: () => ipcRenderer.invoke('data:get-location'),
  chooseLocation: () => ipcRenderer.invoke('data:choose-location'),
  resetLocation: () => ipcRenderer.invoke('data:reset-location'),
  deleteBackup: () => ipcRenderer.invoke('data:delete-backup'),
  relaunch: () => ipcRenderer.invoke('data:relaunch'),
});
```

`src/vite-env.d.ts` 的 `interface Window` 增补 `evidenceData?` 类型。

## 前端设计（桌面部分）

- 新增统一入口组件（见下“三、共用入口”）；桌面分支渲染数据目录迁移 UI，仅当 `window.evidenceData` 存在时显示。
- 对话框内容：
  - 显示 `current` 绝对路径 + `isDefault` 标记；
  - “更改位置…”按钮 → `chooseLocation()` → 成功后 `useConfirmDialog` 提示“需要重启生效，是否立即重启？”→ `relaunch()`；
  - “恢复默认位置”按钮 → `useConfirmDialog` 二次确认 → `resetLocation()` → `relaunch()`；
  - 若 `backup` 存在：显示“旧数据备份将在 N 天后自动清理” + “立即删除备份”按钮（`useConfirmDialog` 确认 → `deleteBackup()` → 刷新 `getLocation`）；
  - 失败用 `useToast({ tone:'error' })`；成功前的过程提示用 `info`。
- 启动告警：App 挂载后若 `getLocation().startupWarning` 非空，用 `useToast({ tone:'error' })` 显示一次。

## 失败与边界处理

- 目标盘不存在 / 无权限：`choose` 阶段探针失败即报错不切换；`启动` 阶段回退默认 + 告警。
- 可移动盘迁移后拔盘再启动：指针指向的目录不可用 → 回退默认并告警（此时“新盘上的新数据”暂不可见，属预期，接回盘后恢复）。文案需说明“请重新接入该磁盘，或在设置里改回其他位置”。
- 复制中断：因是“复制不删原”，原数据始终完好；未写指针则下次仍用原位置。
- 相同目录 / 已是默认：直接返回不操作。

---

# 二、Web 版（A + B）

## 硬约束

网页 JS 无法搬动浏览器 IndexedDB，因此 Web 不做“迁移数据目录”，而是降低 C 盘压力的两个杠杆：用量可见（引导离线备份）、导出可选位置（直接存到非 C 盘）。能力检测 + 优雅降级，适配不同浏览器。

## A：用量可视 + 引导

- 新增 `src/utils/storageEstimate.ts`：封装 `navigator.storage?.estimate()`，返回 `{ supported, usage, quota, ratio }`；不支持时 `supported=false`。
- 面板展示人类可读的已用 / 配额（复用或新增一个 `formatBytes` 工具）；`ratio >= 0.8`（阈值常量）时显著告警样式 + 引导文案：“建议先导出备份到非 C 盘，再删除不再需要的项目释放空间。”
- 不新造删除/导出流程，只引导用户用现有导出与删除项目功能。

## B：导出可选保存位置

- 新增 `src/utils/saveBlob.ts`，统一保存入口：

```ts
// preferPicker 默认读偏好开关（localStorage）
export async function saveBlob(blob: Blob, filename: string, preferPicker?: boolean): Promise<'saved' | 'downloaded' | 'cancelled'>
```

  - 支持 `window.showSaveFilePicker` 且偏好开启：弹原生保存框（`suggestedName=filename`，根据扩展名给 `types`）→ `createWritable()` 写入 → 返回 `'saved'`；用户取消（`AbortError`）返回 `'cancelled'`，不报错、不回退。
  - 不支持或偏好关闭：走现有 `<a download>` 逻辑 → 返回 `'downloaded'`。
  - `showSaveFilePicker` 需安全上下文（HTTPS/localhost）且仅 Chromium；因此能力检测用 `typeof window.showSaveFilePicker === 'function'`，自然覆盖 http/非 Chromium 回退。
- 改造现有三处下载点改调 `saveBlob`：
  - `src/utils/exportImport.ts` 的 `downloadBlob`（数据包 zip、加密 `.evidence`）；
  - `src/utils/wordExport.ts` 的 `downloadBlob`（Word）。
  - 保留内部 `<a download>` 作为回退实现；对外统一走 `saveBlob`。返回 `'saved'/'downloaded'` 时用 toast 提示结果（“已保存 / 已开始下载”），`'cancelled'` 静默。
- 偏好开关：`src/utils/exportPreference.ts`（或存入现有设置工具）读写 `localStorage['evidence.exportAskLocation']`；默认：`showSaveFilePicker` 可用时为 `true`（询问），否则 `false`。

## 前端设计（Web 部分）

- 共用入口的 Web 分支渲染：
  - 存储用量卡片（来自 `storageEstimate`）+ 高占用告警与引导文案；
  - “导出时询问保存位置”开关（绑 `exportPreference`）；不支持 `showSaveFilePicker` 时开关置灰并注明“当前浏览器不支持选择保存位置，导出将存入浏览器默认下载目录，可在浏览器设置中修改”。

---

# 三、共用入口

- 新增 `src/components/StorageSettingsDialog.tsx`（环境自适应）：`window.evidenceData` 存在 → 渲染桌面迁移区；否则 → 渲染 Web 用量 + 导出偏好区。两者可共存于同一对话框的不同区块。
- 入口位置：项目列表主界面（`ProjectList` / 其容器）放一个“存储设置”齿轮/按钮 —— 全局级设置，不属单个项目，放项目列表页比项目内 `Toolbar` 合适。Web 下该入口仍显示（内容为用量/偏好）；仅桌面迁移 UI 在 Web 不出现。

---

## 影响面 / 兼容性

- 桌面：纯新增 IPC/preload/组件 + 指针文件，不改 `db.ts` schema、不改 LAN 逻辑。
- Web B 会改动导出的“落盘方式”（`downloadBlob` → `saveBlob`），但**导出内容/格式不变**，且保留 `<a download>` 回退；不改导入逻辑。
- 未使用新设置的老用户无感（指针不存在 = 默认位置；偏好默认保持现有下载体验——除非支持 picker 且未关）。
- 回滚：删除新增 IPC/preload/组件/工具 + 指针文件，并把 `saveBlob` 换回 `downloadBlob` 即可。
