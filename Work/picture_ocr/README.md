# 测评证据采集工具

一个基于 React + Vite + TypeScript 的纯前端工具，用于按等保测评/现场核查要求收集截图证据、整理资产检查项，并导出数据包或 Word 报告。

## 功能特性

- 内置物理环境、网络设备、安全设备、主机设备、系统管理软件、应用系统等分类模板。
- 支持按资产维护检查项，并为每个检查项上传/粘贴截图。
- 使用浏览器 IndexedDB 本地保存数据，无需后端服务。
- 支持 ZIP 数据包导出与导入，便于项目迁移或多人汇总。
- 支持 AES-GCM 加密采集包（`.evidence`）：可用密码保护手机采集数据，再通过 USB 回传电脑合并导入。
- 支持导出 Word 报告，导出前会提示缺失的必填截图。
- 支持维护检查项模板，便于适配不同项目要求。

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
6. 在 Release 正文和 ZIP 内 `RELEASE-NOTES.txt` 写入本次更新/修复摘要，例如多项目列表、新建项目流程、删除入口和界面视觉优化。

ZIP 解压后，同事只需要双击唯一的启动入口 `启动测评证据采集工具.bat`，浏览器会自动打开本地页面。使用期间不要关闭启动窗口；服务因异常或手动停止而退出时，窗口也会同步关闭，不会留下看似仍在运行的空终端。Release 页面会同时说明本次更新内容，避免只写“下载 ZIP 可使用”这类空泛文案。

### 方式二：手动运行工作流

在 GitHub 仓库页面进入 **Actions → Build Picture OCR Release → Run workflow**，填写 release tag 后运行。

## 手机离线采集试用

手机入口为同一网页的 `#/mobile`，项目列表右上方也提供“打开手机采集入口”。它不依赖后端、账号、局域网服务或原生 App；iOS、Android 和 HarmonyOS / HarmonyOS NEXT 均应使用各自浏览器打开同一静态网页，**不能把鸿蒙当作 Android 浏览器处理**。

### 推荐闭环（电脑 → 手机 → 电脑）

1. 电脑项目列表中，对目标系统点击“导出加密采集包”，设置并妥善保管密码，得到 `.evidence` 文件。
2. 用 USB 将该文件拷到手机；手机浏览器打开网页后进入 `#/mobile`，在“从加密初始化包新建采集项目”中输入密码并选择该文件。
3. 选择分类、资产和检查项，点击“拍照/选图”。采集入口使用标准 `<input type="file" accept="image/*" capture="environment">`，让 iOS、Android、HarmonyOS / HarmonyOS NEXT 浏览器自行调用可用的相机或相册；不依赖 `getUserMedia`。
4. 采集完成后点击“导出加密采集包”，设置密码，并从浏览器下载列表保存 `.evidence` 文件。
5. 用 USB 将 `.evidence` 文件拷回电脑。电脑项目列表的目标系统点击“导入数据包”，选择文件、输入密码，再选择“合并导入”（保留电脑现有元数据；同分类同名资产及其检查项、图片会合并去重）或“覆盖导入”。

手机端的“合并导入采集包”用于向已初始化的手机项目补充同一格式的数据；初始化新项目只接受 `.evidence`，避免不小心以明文 ZIP 在手机端建立采集项目。桌面端仍兼容原有 `.zip` 数据包。

### 加密与离线边界

- `.evidence` 是 JSON 信封格式：随机 salt + PBKDF2（SHA-256，310,000 次迭代）派生 AES-256-GCM 密钥，随机 12 字节 IV 加密内部 ZIP。密码和派生密钥不会写入文件、IndexedDB 或日志。
- 密码为空、两次密码不一致、错误密码、文件损坏或浏览器没有 Web Crypto 时，操作会明确报错，**不会降级导出或导入明文**。请自行以安全方式传递密码；忘记密码无法恢复数据。
- Web Crypto 通常仅在 HTTPS 或 `localhost` 等安全上下文可用。普通 HTTP 静态服务、`file://`、浏览器隐私模式和受限企业浏览器都可能不支持加密或限制 IndexedDB/下载。
- 仅生产构建且通过 **HTTPS 或 localhost** 打开时，手机页会注册 Service Worker：构建的同源静态资源会预缓存，离线时 hash 路由仍回退到应用入口；新版本会跳过等待并清理旧缓存，下一次页面导航即可使用更新。开发环境、Electron / `file://`、普通 HTTP Release 不注册 Service Worker，手机页“现场离线准备”卡会明确显示不可离线准备；这不是故障。
- Service Worker 只缓存构建静态资源，不读取、不预缓存也不处理 `.evidence`、ZIP/Word 下载、上传文件、IndexedDB 或 Web Crypto 数据。首次必须在线完成加载并等待卡片中的“SW 缓存”为“可用”，再断网试用；离线期间请勿清理浏览器站点数据，并保留 USB 备份。

## 可复核验证步骤

项目未引入测试框架；加密包格式校验收敛在 `src/utils/evidencePackage.ts` 的纯函数 `validateEvidenceEnvelope`，PWA 构建产物校验会检查 manifest、图标与 Service Worker 的缓存边界。提交或发版前至少执行：

```bash
npm run verify:evidence-package
npm run build
npm run verify:pwa-build
git diff --check
```

并在支持 Web Crypto 的浏览器手工验证：

1. 新建含至少一张图片的项目，导出 `.evidence`；确认文件不含可直接解压的 ZIP 内容。
2. 对同一项目输入正确密码，分别验证覆盖导入与合并导入；检查图片未重复。
3. 使用错误密码、空密码、篡改后的文件各导入一次，确认有中文错误提示且现有项目不被改写。
4. 通过 HTTPS 部署地址或 localhost 打开手机页，确认“现场离线准备”中的安全上下文、Web Crypto、IndexedDB、SW 缓存均为可用；Android/Chromium 若显示“可安装”可点击安装，iOS 请通过 Safari 分享菜单“添加到主屏幕”。
5. 在上述手机浏览器首次在线打开并等待 SW 缓存就绪后，关闭网络，重新打开 `#/mobile`，确认能进入页面和已保存项目；再恢复网络后确认新版本可更新。
6. 用普通 HTTP、Electron / `file://` 和开发服务器各打开一次，确认没有注册 Service Worker，且现场准备卡清晰说明不可离线准备。
7. 用手机实际拍照后导出 `.evidence`，通过 USB 拷回电脑并合并导入；在 iOS、Android、HarmonyOS / HarmonyOS NEXT 的目标浏览器分别完成试用。

## 数据与隐私说明

- 项目数据默认存储在当前浏览器的 IndexedDB 中。
- 截图内容不会上传到服务器；导入、导出和 Word 生成都在浏览器本地完成。
- 更换浏览器、清理站点数据或使用隐私模式可能导致本地数据不可见，请及时导出 ZIP 或加密采集包备份。

## 版本管理建议

- 功能代码、配置、README 和 GitHub workflow 应提交到仓库。
- `node_modules/`、`dist/`、`*.tsbuildinfo`、本地 AI 配置目录、需求计划文档和 Word 参考模板已在 `.gitignore` 中忽略。
