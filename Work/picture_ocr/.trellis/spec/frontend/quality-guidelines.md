# 前端质量规范

> 当前项目未配置 ESLint、Prettier 或测试框架。质量基线由严格 TypeScript 构建、Node 内置 `assert` 验证脚本、构建产物检查与关键浏览器手工验证组成。

## 必做验证

修改 `src/` 后至少运行与变更相关的命令；发版前完整基线以 `README.md` 为准：

```bash
npm run verify:evidence-package
npm run verify:lan-server
npm run verify:lan-mobile-picker
npm run build
npm run verify:web-lan-server
npm run verify:pwa-build
git diff --check
```

- `npm run build` 执行 `tsc -b`、Vite 构建与 Service Worker 生成，因此也是类型检查与生产构建验证。
- `scripts/verify-evidence-package.mjs` 使用 Node `assert` 验证加密格式、往返解密与错误密码拒绝。
- `scripts/verify-lan-server.cjs` 验证 Electron 局域网服务安全边界；`scripts/verify-lan-mobile-picker.mjs` 用源码断言守护移动端图片来源、会话同步、可访问对话框和项目列表响应式契约。
- 移动端采集或项目列表相关改动运行 `npm run verify:lan-mobile-picker`（`scripts/verify-lan-mobile-picker.mjs`）；构建或 PWA 改动后运行 `npm run verify:pwa-build`（`scripts/verify-pwa-build.mjs`）；Web LAN 启动器改动后运行 `npm run verify:web-lan-server`（`scripts/verify-web-lan-server.ps1`）。不要把这些脚本当作通用单元测试框架。

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
