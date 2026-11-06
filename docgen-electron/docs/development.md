# DocGenPro 开发与构建

所有本地命令均在 `docgen-electron` 目录执行。

## 环境

- Windows x64
- Node.js 22（CI 使用版本）及 npm
- Python 3.12（CI 使用版本）

```powershell
npm ci
python -m pip install -r requirements-build.txt
npm run dev
```

若启动时报 `Electron uninstall`，先执行 `node node_modules/electron/install.js` 补装 Electron 程序本体，再重试。安装过程需要能访问 Electron 下载源。

## 本地打包

```powershell
python -m PyInstaller --clean --noconfirm --onefile --distpath resources/bin --workpath build/python --specpath build/python --name main3 main3.py
npm run build -- --win nsis --x64 --publish never
python scripts/smoke-test.py
```

安装程序在 `dist_setup/`，未安装版本在 `dist_setup/win-unpacked/`。Python 后端、`templates/` 和 `rules/` 随包分发；当前没有自定义图标，使用 Electron 默认图标。构建未配置代码签名或自动更新。

`smoke-test.py` 检查随包后端能启动、缺少配置时返回失败，并在临时目录实际执行单项目及双项目生成，检查文档数量与 DOCX 文件完整性；测试结束后自动清理临时文件。它不覆盖桌面 UI 交互或 Word 排版效果。

## GitHub Actions

仓库根目录的 `.github/workflows/docgen-windows.yml` 会在以下场景运行：

- 推送 `docgen-electron/**` 或工作流自身的改动至 `main`。
- 在 Actions 页面手动点击 **Run workflow**。

流程：安装锁定的 npm 依赖及 Python 构建依赖 → PyInstaller 生成 `main3.exe` → electron-builder 生成 Windows x64 NSIS 安装包 → 运行后端冒烟测试 → 上传安装包、SHA-256 校验文件和人工编写的 `RELEASE_NOTES.md`。

产物名称为 `DocGenPro-Windows-x64`，保留 30 天。工作流只有仓库读取权限，不创建 Release、不推送文件、不需要额外配置 Secret。同一分支新构建会取消尚未结束的旧构建。

## 目录与忽略规则

- `src/main/`：Electron 主进程与 IPC。
- `src/preload/`：渲染进程桥接。
- `src/renderer/`：Vue 界面。
- `main3.py`：Python 文档生成入口。
- `templates/`、`rules/`：随包分发的模板和规则，受版本控制。
- `resources/`、`build/`、`out/`、`dist_setup/`：生成产物，不提交。
- `.env`、本地项目信息、历史记录及文档输出：用户数据，不提交。
