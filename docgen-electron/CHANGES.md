# 修改记录 — DocGen Pro

## 2026-11-10 — 验证测试方式选择器与深色毛玻璃视觉重构

### 背景与目标
- 原版 `VerificationMode.vue` 直接使用裸 `<el-radio>` 单选框，在深色模式及自定义背景毛玻璃（`.has-bg-image`）下存在对比度过低、未选中圆点呈纯黑（`#141414`）的问题；而带小圆点的双行深色块也与上方半透明毛玻璃输入框风格割裂。
- 将「验证测试方式」重构为无圆点的**半透明分段切换器（`.mode-segment`）**，与上方 `<el-input>` 保持一致的毛玻璃质感、圆角与高度，移除突兀的单选圆点与高饱和紫色文字，在浅色、深色及自定义背景图模式下自然融合。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `src/renderer/src/components/VerificationMode.vue` | 重构为无圆点的分段切换器（`.mode-segment`），基于全局主题变量适配浅色、深色与背景毛玻璃 |
| 修改 | `src/renderer/src/components/MultiProject.vue` | 多项目表格「验证测试方式」列改用语义化 `<el-tag>` 标签展示 |
| 修改 | `src/renderer/src/assets/styles/main.scss` | 新增 `--seg-*` 分段控件主题变量（浅色/深色/毛玻璃），并补齐全局深色模式下 `.el-radio` 可读对比度 |

### 验证
- `npx vue-tsc --noEmit` 与 `npx electron-vite build`：类型检查与生产构建通过。
- `python -m unittest discover -s scripts -p "test_*.py"`：8 项后端回归测试全部通过。

---

## 2026-11-09 — 验证测试授权与自愿放弃声明互斥选择

### 背景与目标
- 单项目与批量项目可选择执行验证测试（漏扫、渗透）或自愿放弃验证测试，生成器仅输出对应文档。
- 仅选择放弃时显示业务详情；切换选项保留已填内容，沿用现有 Element Plus 控件和主题。

### 影响与兼容性
- 项目数据新增可选字段 `验证测试方式`，可选值为 `执行验证测试`、`自愿放弃验证测试`。旧配置和旧历史缺少字段时默认放弃。
- 批量项目分别保存选择，复制、编辑和历史记录保留选择。
- 三份公共内置文档照常生成，每个项目当前输出目录共四份文档。切换后重复生成，将原互斥文档移入该目录的 `历史文档/<唯一时间目录>/`，保留原文件内容；需要恢复时可从该目录复制回去。
- 互斥规则按模板名称中的 `验证测试授权书`、`自愿放弃验证测试声明` 识别。
- 修复冻结后后端缺少配置时调用 `exit` 导致的附加异常，改用 `sys.exit`。
- 本地构建沿用版本 2.1.0，未推送、发布或修改发布工作流。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 新增 | `src/renderer/src/components/VerificationMode.vue` | 两个表单共用的互斥选择控件 |
| 修改 | `src/renderer/src/components/SingleProject.vue` | 选择、业务详情显隐、清空前变更检测 |
| 修改 | `src/renderer/src/components/MultiProject.vue` | 每项目选择、列表显示、数据保存与恢复 |
| 修改 | `src/renderer/src/utils/history.ts` | 新字段类型 |
| 修改 | `main3.py` | 选项校验、互斥文档过滤、旧文档归档、冻结后退出修复 |
| 新增 | `scripts/test_verification_mode.py` | 真实模板生成、兼容与归档回归测试 |
| 修改 | `scripts/test_encoding.py` | 配置缺失错误不得附带异常堆栈 |
| 修改 | `scripts/smoke-test.py` | 随包后端的两种单项目和混合批量生成检查 |
| 修改 | `README.md`、`docs/development.md` | 用户操作与维护说明 |

### 验证
- `python -m unittest discover -s scripts -p 'test_*.py'`：源码后端 8 项通过。
- 设置 `DOCGEN_TEST_BACKEND` 指向 `dist_setup/win-unpacked/resources/bin/main3.exe` 后运行同一命令：随包后端 8 项通过。
- `python scripts/smoke-test.py`：两种单项目分别输出 4 份、混合双项目输出 8 份有效 DOCX；随包资源与配置缺失检查通过。
- `npx vue-tsc --noEmit`、`npx electron-vite build`：通过。
- Playwright 加载构建后的页面并模拟 Electron API：验证切换、字段保留、生成参数、旧历史默认、新历史恢复、批量保存、复制与混合批量历史；800/1100/1440 像素宽度选项无横向越界，键盘切换通过，检查了浅色与深色截图。
- 本机 PyInstaller 与 electron-builder/NSIS 构建成功；运行包位于 `dist_setup/win-unpacked/DocGenPro.exe`，安装包位于 `dist_setup/DocGenPro Setup 2.1.0.exe`。

### 已知限制与后续
- 页面交互使用模拟的 Electron API；真实打包后端独立验证，未执行安装向导或完整桌面 IPC 自动化，也未逐页验证 Word 视觉排版。
- 本地验证截图及日志位于 `E:/DevData/docgen-validation/`。
