# 测评证据采集工具

一个基于 React + Vite + TypeScript 的纯前端工具，用于按等保测评/现场核查要求收集截图证据、整理资产检查项，并导出数据包或 Word 报告。

## 功能特性

- 内置物理环境、网络设备、安全设备、主机设备、系统管理软件、应用系统等分类模板。
- 支持按资产维护检查项，并为每个检查项上传/粘贴截图；手动新增项默认必填并置顶。
- 使用浏览器 IndexedDB 本地保存数据，无需后端服务。
- 支持 ZIP 数据包导出与导入，便于项目迁移或多人汇总。
- 保留 AES-GCM 加密采集包（`.evidence`）历史兼容：仅用于既有离线数据与紧急恢复。
- 支持导出 Word 报告，导出前会提示缺失的必填截图。
- 支持维护检查项模板，便于适配不同项目要求。
- 工作台可进入独立的“调整顺序”模式：仅可从六点手柄拖动检查项，列表会实时让位预览；拖至上下边缘可自动滚动，鼠标与触屏均可用。

## 技术栈

- React 18
- TypeScript
- Vite 6
- Tailwind CSS
- IndexedDB
- JSZip
- docx

## 本地开发

环境要求：Node.js 20.19+ 或 22.12+，推荐 Node.js 22 LTS。

```bash
npm ci
npm run dev
```

默认开发地址以 Vite 输出为准，通常是 `http://localhost:5173/`。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`。项目的 Vite 配置使用 `base: './'`，因此构建后的静态文件可以直接部署到任意子路径或本地静态服务器。

如需本地预览构建产物：

```bash
npm run preview
```

## 客户端打包

项目支持两种交付形态：

1. Web 静态版 ZIP：解压后可用 `启动测评证据采集工具.bat` 启动本地静态服务。
2. Windows 桌面客户端：基于 Electron 打包为 exe/安装包。

本地构建 Windows 客户端：

```bash
npm run desktop:pack
```

如果只想快速验证 Electron 目录构建：

```bash
npm run desktop:build
```

## Release 打包

仓库已提供 GitHub Actions 工作流：`.github/workflows/release-picture-ocr.yml`。

### 方式一：推送标签自动发布

```bash
git tag picture-ocr-v0.1.0
git push origin picture-ocr-v0.1.0
```

推送匹配 `picture-ocr-v*` 的标签后，工作流会自动：

1. 安装依赖。
2. 运行 `npm run build`。
3. 将 `dist/`、启动脚本、`README.md` 和版本信息打包为 `picture-ocr-<tag>.zip`。
4. 构建 Windows 桌面客户端 exe/安装包。
5. 创建或更新 GitHub Release，并上传 Web ZIP 和 Windows 客户端附件。
6. 在 Release 正文和 ZIP 内 `RELEASE-NOTES.txt` 写入与该标签实际内容一致的人工更新/修复摘要；不得沿用上一版本的通用文案。

ZIP 解压后，同事只需要双击唯一的启动入口 `启动测评证据采集工具.bat`，浏览器会自动打开本地页面。使用期间不要关闭启动窗口；服务因异常或手动停止而退出时，窗口也会同步关闭，不会留下看似仍在运行的空终端。Release 页面会同时说明本次更新内容，避免只写“下载 ZIP 可使用”这类空泛文案。

### 方式二：手动运行工作流

在 GitHub 仓库页面进入 **Actions → Build Picture OCR Release → Run workflow**，填写 release tag 后运行。

## 手机局域网实时采集（Web ZIP 与 Windows 客户端）

Web 静态版 ZIP 和 Windows Electron 客户端均提供“手机局域网采集”。这是推荐的日常实时流程：手机拍照或选图后，图片会写入**当前打开的系统项目**；手机不能浏览、修改或删除其他项目，也不依赖手机端 IndexedDB。

> Web ZIP 不是“纯静态网页自行接收上传”：双击 `启动测评证据采集工具.bat` 后，PowerShell 会启动本机浏览器控制端；仅在启动手机采集会话时才监听所选私有局域网地址，停止会话后立即释放。请保持该窗口打开。

### 使用步骤

1. **Web ZIP**：解压完整包后双击 `启动测评证据采集工具.bat`；**Windows 客户端**：直接打开 exe。两种方式都会进入项目列表。
2. 在目标系统行点击“手机局域网采集”，或打开系统后点击工作台工具栏同名按钮。让电脑和手机连接同一**可信** Wi-Fi，或让电脑连接手机热点。
3. 在会话对话框中选择手机实际可访问的 Wi-Fi / 热点 IPv4 地址，启动会话后扫描二维码或复制链接到手机浏览器。若 Windows 防火墙询问，只能在**专用网络**允许；不要在公共网络允许。
4. 手机上选择分类、资产、检查项，点击“拍照 / 选择图片”。单张图片最大 10MB，仅接受 PNG、JPEG、GIF、WebP、BMP。手机会先显示“正在写入电脑项目”，仅在电脑浏览器 IndexedDB 确认落盘后才提示同步成功。
5. 采集完成点击“停止会话”或关闭会话对话框。返回项目列表、切换项目或关闭工作台也会停止会话，手机链接随即失效。

### 安全与网络边界

- Electron 使用主进程临时服务；Web ZIP 使用 PowerShell 的 IP 精确 `TcpListener`，避免 `HttpListener` 通配符、管理员 URL ACL 和公网监听。两者均只枚举 RFC1918 私有 IPv4，并仅在会话期间监听用户所选地址；Web ZIP 始终只监听 localhost 工作台。无法绑定选中的 LAN 地址时会明确提示防火墙或企业策略问题，不会静默回退。
- 每个会话使用 32 字节随机 token，并限时两小时；停止会话立即清除 token 和内存上传队列。手机只能用 token 读取本次只读快照，并上传已白名单资产/检查项的图片。
- Web ZIP 的控制 API 只接受 loopback 请求；局域网请求仅能读取构建静态资源及调用带 token 的采集 API。服务不提供项目列表、任意项目数据、目录枚举、目录越界或任意文件访问。静态响应带 CSP 与 `nosniff`。
- 服务校验图片 MIME 类型与文件头、10MB 上限和净化后的文件名。图片只暂存在会话内存队列；浏览器 IndexedDB 确认成功或失败后立即从队列移除。移动端在 `202` 等待状态后，只有轮询到 `201` 才显示成功。
- 这是同一受信任局域网内的 **HTTP** 临时服务。HTTP 不提供传输加密，可能被同网攻击者窥探或篡改；不要在公共 Wi-Fi、陌生热点或不可信网络使用，也不要将链接转发给无关人员。
- 本 LAN 流程不使用 Service Worker、PWA 或 Web Crypto。普通 ZIP 数据包继续用于项目备份/迁移；`.evidence` 仅保留为历史兼容与紧急恢复能力，不是推荐的日常手机采集流程。

## 历史兼容：加密离线采集包（紧急恢复）

`.evidence` 是保留给既有离线项目、无法使用 Windows 客户端局域网采集时的紧急恢复场景的兼容格式，不再提供普通项目的导出入口，也不应作为日常手机采集路径。桌面项目列表的“导入数据包”仍可选择 `.evidence` 并输入密码，按“合并导入”或“覆盖导入”恢复历史数据；普通项目的日常备份、迁移继续使用 ZIP 数据包。

历史手机页仍可通过 `#/mobile` 打开，以处理已持有的 `.evidence` 采集包；它不依赖后端、账号、局域网服务或原生 App。该页仅用于兼容处理，不能替代 Electron 的实时局域网采集。iOS、Android 和 HarmonyOS / HarmonyOS NEXT 均应使用各自浏览器打开同一静态网页，**不能把鸿蒙当作 Android 浏览器处理**。

### 加密与离线边界

- `.evidence` 是 JSON 信封格式：随机 salt + PBKDF2（SHA-256，310,000 次迭代）派生 AES-256-GCM 密钥，随机 12 字节 IV 加密内部 ZIP。密码和派生密钥不会写入文件、IndexedDB 或日志。
- 密码为空、两次密码不一致、错误密码、文件损坏或浏览器没有 Web Crypto 时，操作会明确报错，**不会降级导出或导入明文**。请自行以安全方式传递密码；忘记密码无法恢复数据。
- Web Crypto 通常仅在 HTTPS 或 `localhost` 等安全上下文可用。普通 HTTP 静态服务、`file://`、浏览器隐私模式和受限企业浏览器都可能不支持加密或限制 IndexedDB/下载。
- 仅生产构建且通过 **HTTPS 或 localhost** 打开时，手机页会注册 Service Worker：构建的同源静态资源会预缓存，离线时 hash 路由仍回退到应用入口；新版本会跳过等待并清理旧缓存，下一次页面导航即可使用更新。开发环境、Electron / `file://`、普通 HTTP Release 不注册 Service Worker，手机页“现场离线准备”卡会明确显示不可离线准备；这不是故障。
- Service Worker 只缓存构建静态资源，不读取、不预缓存也不处理 `.evidence`、ZIP/Word 下载、上传文件、IndexedDB 或 Web Crypto 数据。首次必须在线完成加载并等待卡片中的“SW 缓存”为“可用”，再断网试用；离线期间请勿清理浏览器站点数据，并保留 USB 备份。

## 可复核验证步骤

项目未引入测试框架；局域网服务使用 Node 内置 `assert` 的可运行验证脚本覆盖认证、快照、上传白名单、类型/大小拦截、上传通知与会话关闭失效；加密包格式校验收敛在 `src/utils/evidencePackage.ts` 的纯函数 `validateEvidenceEnvelope`，PWA 构建产物校验会检查 manifest、图标与 Service Worker 的缓存边界。提交或发版前至少执行：

```bash
npm run verify:evidence-package
npm run verify:lan-server
node scripts/verify-inspection-item-interactions.mjs
node scripts/verify-inspection-item-pointer-drag.mjs
npm run build
npm run verify:web-lan-server
npm run verify:pwa-build
git diff --check
```

并在支持 Web Crypto 的浏览器手工验证：

1. 对历史 `.evidence` 输入正确密码，分别验证覆盖导入与合并导入；检查图片未重复。
2. 使用错误密码、空密码、篡改后的文件各导入一次，确认有中文错误提示且现有项目不被改写。
3. 通过 HTTPS 部署地址或 localhost 打开历史手机页，确认“现场离线准备”中的安全上下文、Web Crypto、IndexedDB、SW 缓存均为可用；Android/Chromium 若显示“可安装”可点击安装，iOS 请通过 Safari 分享菜单“添加到主屏幕”。
4. 在上述手机浏览器首次在线打开并等待 SW 缓存就绪后，关闭网络，重新打开 `#/mobile`，确认能进入页面和已保存项目；再恢复网络后确认新版本可更新。
5. 用普通 HTTP、Electron / `file://` 和开发服务器各打开一次，确认没有注册 Service Worker，且现场准备卡清晰说明不可离线准备；这不是故障。
6. 分别通过 Web ZIP 和 Windows 客户端启动一个目标系统会话；验证手机端 token 链接可读取快照、拍照后先等待电脑 IndexedDB 落盘再显示成功，停止会话后链接返回“会话无效或已结束”。
7. 对历史采集包进行 USB 回传后，在项目列表“导入数据包”中完成合并导入；`.evidence` 仅用于历史兼容与紧急恢复。

## 数据与隐私说明

- 项目数据默认存储在当前浏览器的 IndexedDB 中。
- 截图内容不会上传到服务器；导入、导出和 Word 生成都在浏览器本地完成。
- 更换浏览器、清理站点数据或使用隐私模式可能导致本地数据不可见，请及时导出 ZIP 数据包备份；`.evidence` 仅用于历史兼容与紧急恢复。

## 版本管理建议

- 功能代码、配置、README 和 GitHub workflow 应提交到仓库。
- `node_modules/`、`dist/`、`desktop-dist/`、`release-web/`、`*.tsbuildinfo`、本地 AI 配置目录、需求计划文档和 Word 参考模板已在 `.gitignore` 中忽略。
