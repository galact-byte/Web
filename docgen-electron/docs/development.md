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

`smoke-test.py` 检查随包后端能启动、缺少配置时返回失败，并在临时目录实际执行两种单项目选择及混合双项目生成，检查互斥文档选择、文档数量与 DOCX 文件完整性；测试结束后自动清理临时文件。它不覆盖桌面 UI 交互或 Word 排版效果。

## 回归检查

```powershell
python -m unittest discover -s scripts -p "test_*.py"
npx vue-tsc --noEmit
npx electron-vite build
```

`test_verification_mode.py` 使用真实模板验证单项目选择、批量项目独立选择、缺少新字段的旧配置、非法选项，以及切换后旧文档归档保留。可通过 `DOCGEN_TEST_BACKEND` 指定已打包的 `main3.exe`，用同一套用例检查冻结后的行为。

项目数据新增可选字段 `验证测试方式`，值为 `执行验证测试` 或 `自愿放弃验证测试`；旧数据缺少该字段时默认使用后者。界面复制、保存及历史恢复均保留此选择。生成器按模板名称识别两份互斥文档；自定义模板如需参与此规则，名称须包含 `验证测试授权书` 或 `自愿放弃验证测试声明`。

## GitHub Actions

仓库根目录的 `.github/workflows/docgen-windows.yml` 会在以下场景运行：

- 推送 `docgen-electron/**` 或工作流自身的改动至 `main`。
- 在 Actions 页面手动点击 **Run workflow**。

流程：安装锁定的 npm 依赖及 Python 构建依赖 → PyInstaller 生成 `main3.exe` → electron-builder 生成 Windows x64 NSIS 安装包 → 运行后端冒烟测试 → 上传安装包、SHA-256 校验文件和人工编写的 `RELEASE_NOTES.md`。

构建产物名称为 `DocGenPro-Windows-x64`，保留 30 天。构建工作流只有仓库读取权限；同一分支新构建会取消尚未结束的旧构建。

`.github/workflows/docgen-release.yml` 在上述构建成功后发布 Release，也支持手动输入已成功的构建运行 ID，将现有产物直接发布，无需重打包。它只接受本仓库 `main` 上指定构建工作流的成功产物，发布前验证安装包 SHA-256 和说明版本。

发布标签为 `docgen-v<package.json 版本>`，指向实际构建提交；正文使用该产物内人工编写的 `RELEASE_NOTES.md`。Release 附带安装程序、校验文件和发布说明，不改变仓库其他子项目的 Latest 标记。已存在的同版本 Release 不覆盖；发布新版前需同步更新 `package.json`、`package-lock.json` 和发布说明，并更新 README 的版本下载链接。

发布任务限定使用 `actions: read` 和 `contents: write`，通过 GitHub 内置令牌工作，不需要额外配置 Secret。

## 目录与忽略规则

- `src/main/`：Electron 主进程与 IPC。
- `src/preload/`：渲染进程桥接。
- `src/renderer/`：Vue 界面。
- `main3.py`：Python 文档生成入口。
- `templates/`、`rules/`：随包分发的模板和规则，受版本控制。
- `resources/`、`build/`、`out/`、`dist_setup/`：生成产物，不提交。
- `.env`、本地项目信息、历史记录及文档输出：用户数据，不提交。
