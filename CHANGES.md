# 修改记录 — Web

## 2026-11-07 — DocGenPro Windows 自动打包

### 背景与目标
- 为 DocGenPro 增加推送至 `main` 和手动触发的 Windows x64 安装包构建，用户安装后不再依赖开发服务器。
- 一并提交工作区已有的界面、设置及历史记录改动；本次未重新设计或改写这些改动。

### 影响与兼容性
- CI 从 `main3.py` 生成随包 Python 后端，分发现有模板和规则；移除指向不存在文件的图标配置，使用 Electron 默认图标。
- 不创建 GitHub Release，不配置自动更新，不修改现有用户数据；安装包未签名。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 新增 | `.github/workflows/docgen-windows.yml` | Windows 构建、包内后端测试及安装包/校验文件上传 |
| 新增 | `docgen-electron/requirements-build.txt` | Python 构建依赖 |
| 新增 | `docgen-electron/RELEASE_NOTES.md` | 面向用户的功能、修复与兼容性说明，随安装包分发 |
| 新增 | `docgen-electron/scripts/smoke-test.py` | 验证包内后端、模板、单/多项目生成和缺失配置失败分支 |
| 新增 | `docgen-electron/docs/development.md` | 维护者开发及构建说明 |
| 修改 | `.gitignore`、`docgen-electron/.gitignore` | 忽略本地 AI 文件、构建缓存、Python 环境和运行数据 |
| 修改 | `docgen-electron/package.json` | 删除无对应资源文件的图标路径 |
| 修改 | `docgen-electron/README.md` | 面向用户的下载安装和使用说明，移出开发细节 |
| 修改/新增 | `docgen-electron/src/`、`docgen-electron/electron.vite.config.ts` | 工作区已有改动，包括新增的设置与历史记录工具 |

### 验证
- `electron-vite build`：主进程、预加载和 Vue 渲染端编译通过。
- 本地临时数据验证 `main3.py`：单项目生成 5 份、多项目生成 10 份 DOCX，ZIP 完整性检查通过，测试数据自动清理。
- 工作流 YAML、Action 固定引用、缓存路径、锁文件和 Python 语法检查通过；忽略规则及 `git diff --check` 检查通过。

### 已知限制与后续
- 远端安装包构建及包内后端冒烟测试由 GitHub Actions 执行，构建结果由维护者查看；本地尚未验证安装程序及桌面 UI 交互。
- Actions 产物保留 30 天，过期后需手动重新构建。

## 未发布 — 根许可与商业授权边界

- 可由维护者授权的原创部分采用 `LicenseRef-Galact-Internal-Use-1.0`：允许合法个人及公司内部自用、免费分发；对外售卖、集成收费产品或提供直接收费的软件服务须书面授权。
- 根 LICENSE、README 和 NOTICE 同步；历史 MIT 正文原样保留，旧版权利不撤回。
- 子项目现有独立许可、第三方依赖及素材条款优先，`docgen-electron/LICENSE` 保持不变；不改变任何子项目代码或数据。
- 尚未发布、未触发远端流水线。
