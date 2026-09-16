# 前端质量规范

> 当前项目未配置 ESLint、Prettier 或测试框架。质量基线由严格 TypeScript 构建、Node 内置 `assert` 验证脚本、构建产物检查与关键浏览器手工验证组成。

## 必做验证

修改 `src/` 后至少运行与变更相关的命令；发版前完整基线以 `README.md` 为准：

```bash
npm run verify:evidence-package
npm run verify:lan-server
npm run verify:lan-mobile-picker
node scripts/verify-inspection-item-interactions.mjs
node scripts/verify-inspection-item-pointer-drag.mjs
npm run verify:data-location
npm run verify:storage-estimate
npm run build
npm run verify:web-lan-server
npm run verify:pwa-build
git diff --check
```

- `npm run build` 执行 `tsc -b`、Vite 构建与 Service Worker 生成，因此也是类型检查与生产构建验证。
- `scripts/verify-evidence-package.mjs` 使用 Node `assert` 验证加密格式、往返解密与错误密码拒绝。
- `scripts/verify-lan-server.cjs` 验证 Electron 局域网服务安全边界；`scripts/verify-lan-mobile-picker.mjs` 用源码断言守护移动端图片来源、会话同步、可访问对话框和项目列表响应式契约。
- 移动端采集或项目列表相关改动运行 `npm run verify:lan-mobile-picker`（`scripts/verify-lan-mobile-picker.mjs`）；检查项新增、状态或排序改动运行 `node scripts/verify-inspection-item-interactions.mjs`，涉及 Pointer 拖拽、实时预览或边缘自动滚动时再运行 `node scripts/verify-inspection-item-pointer-drag.mjs`（生产预览 Chrome 回归）；构建或 PWA 改动后运行 `npm run verify:pwa-build`（`scripts/verify-pwa-build.mjs`）；Web LAN 启动器改动后运行 `npm run verify:web-lan-server`（`scripts/verify-web-lan-server.ps1`）。不要把这些脚本当作通用单元测试框架。

## LAN 上传恢复回归

修改上传、确认、手机恢复或图片事务终态时，另遵守 [局域网上传恢复契约](../backend/lan-upload.md)。先构建，再运行 `node scripts/verify-lan-upload-ui.mjs`；使用真实 PowerShell 服务及正式 Electron main/preload，隔离数据库，核对真实图片引用与字节条数。截图与报告位于 `.trellis/.runtime/lan-upload-qa/`。网络预算仅在测试页面/临时脚本缩短，不能改变生产时限来让测试通过。

修改后台/锁屏恢复、采集名称或相机入口时，另运行 `node scripts/verify-lan-upload-ui.mjs --lifecycle` 和 `node scripts/verify-lan-group-snapshot.mjs`。生命周期模式保留正式后台节流设置，用 CDP 冻结/解冻模拟暂停；Headless 解冻后可能仍为 hidden，手机恢复时显式用 focus emulation 模拟可见并断言 visibilityState。不能把页面内部 await 计时器当成测试监督器，冻结/节流场景从外部 CDP 查询条件。无浏览器能力或非安全上下文点击拍照应同步触发 capture input；权限拒绝人工回退、预览取消释放 tracks、相册取消不上传均需验证。原生系统相机与 OS 锁屏仍属真机验证边界。

## 项目列表回归

- `node scripts/verify-project-list-views.mjs` 通过 esbuild 执行真实 TypeScript 派生逻辑，不复制实现。
- 先 `npm run build`，再 `node scripts/verify-project-list-ui.mjs`。生产构建运行于隔离 Chrome profile 和 Electron 正式 main/preload + 临时 userData；脚本输出报告及 375/768/1440px 截图到 `.trellis/.runtime/project-list-qa/`，不纳入版本控制。不使用用户真实库。
- Web 无桥隐藏采集；有桥使用受控 HTTP control 接口验证真实 Web bridge 的范围、轮询及保存确认。Electron 使用正式 LAN 服务上传到临时数据目录。受控服务与故障注入不等同真实手机/Wi-Fi 验收。
- 自动化键盘 Enter 通过 CDP 发送时带 `text: '\\r'`，保证浏览器收到激活键；不能用 `.click()` 冒充键盘可用证据。读取源码断言先归一化 CRLF。
- 多项目原地展开回归覆盖首次全展开、全收起后成功刷新/工作区重挂载、搜索展开与清除恢复、单组选择交集、收起清选择、保存成功但刷新失败后的重试定位；组级采集在子系统搜索裁剪后仍须包含完整组。
- 三档截图分别保留独立页与项目展开页；键盘测试用 CDP Enter/Space 激活真实项目按钮，确认 aria-expanded、组内显隐及收起焦点恢复。
- 隔离 Electron 常规测试入口对测试窗口调用 `setBackgroundThrottling(false)`，避免终端遮挡测试窗口时页面计时器被节流；`LAN_TEST_BACKGROUND=1` 的生命周期测试必须跳过该设置，生产 main/preload 不改。CDP 命令设超时，连接关闭后立即 reject，失败截图也不能无限等待。可用 `--web-only` / `--desktop-only` 定位环境问题，完整验收仍跑无参数双端版本。
- 模拟外部删除原组时让工作区打开另一系统，避免原系统卸载 flushSave 与夹具删除竞态；本测试验证列表落点，不声称解决跨窗口自动保存覆盖。

## 存储位置与导出保存（缓解 C 盘膨胀）

- 桌面版数据目录可迁移：主进程 `electron/dataLocation.cjs` 管理“指针/数据本体分离”（`%APPDATA%\<应用名>\data-location.json` 只存路径），在 `app.whenReady()` 之前 `init()` 应用指针；目录复制在“下次启动、store 未打开前”进行（运行中只写 migration 标记并重启），避免复制占用中的 IndexedDB。旧数据作“临时备份”保留默认 7 天后自动清理。新增数据目录 IPC 走 `window.evidenceData`（preload 桥接），主进程侧沿用 `isExpectedRenderer` 校验。
- 导出落盘走普通浏览器下载（`<a download>`），保存位置交给浏览器/企业策略决定。（曾试验 `showSaveFilePicker` 导出选目录开关，因与浏览器/强制策略的“下载前询问位置”重叠、对用户无增益而移除。）Web 用量展示用 `src/utils/storageEstimate.ts`。
- “存储设置”入口（`src/components/StorageSettingsDialog.tsx`）环境自适应：有 `window.evidenceData` → 桌面迁移 UI；否则 → Web 用量展示 + 归档引导文案。

## 代码与错误处理

- 遵守 `tsconfig.json` 严格选项；删除未使用的 import、参数和局部变量。项目没有 lint 命令，不能以“未运行 lint”替代 `npm run build`。
- 异步浏览器/存储/导出操作必须处理失败并以中文说明用户可理解的结果。`src/App.tsx` 的 Word 导出和 LAN 同步，以及 `src/context/AppContext.tsx` 的 IndexedDB 加载/保存都是参考。
- 处理图片、导入包和 LAN 请求时同时执行格式、大小、身份或状态校验，不能只信任扩展名或 TypeScript 类型。可参照 `src/components/LanMobileCollector.tsx` 与 `electron/lanServer.cjs`。
- 改动共享常量、协议字符串、hash 路由或 UI 文案前，先全文搜索引用；项目的 `scripts/verify-lan-mobile-picker.mjs` 对若干关键文本和源码形态有显式断言。

## 可访问性和响应式

- 对话框、状态消息、按钮标签和表单错误遵循 `component-guidelines.md`；新增交互必须验证键盘操作、禁用状态和窄屏布局。
- 移动端和 LAN 采集流程应实机或浏览器手工验证：权限拒绝、网络中断、会话结束、图片类型/大小拒绝与成功保存确认。README 同时列出了 Web Crypto、PWA、Electron/Web ZIP 的发布前人工步骤。

## 评审清单

- 类型是否来自既有领域模型，状态是否通过 reducer/Context 更新？
- effect、计时器、订阅和媒体流是否有 cleanup，异步失败是否反馈？
- 输入与外部数据是否在运行时校验，是否保持 IndexedDB 写入顺序？
- 新增对话框和图标按钮是否有语义与 ARIA，布局是否适配小屏？
- 是否运行了相关验证与 `git diff --check`，并且没有提交 `dist/`、临时验证目录或 `tsconfig.tsbuildinfo`？
