# 修改记录 — 定级备案管理系统（安全加固与代码审查修复）

> **修订记录**
>
> - v1.9.2: Word 导入回填（第二阶段） — ① 完善定级报告页和完善专家评审意见表页新增「导入 Word」按钮，用户上传已填写的 .docx 后自动解析并回填到表单各字段（不完整的 Word 只填已识别部分，其余留空手填）；② 完善备案表页同样新增「导入 Word」按钮，可从已填写的备案表 Word 中提取 15 个文本字段（单位名称/信用代码/地址/负责人/系统名称/业务描述/网安部门/联系人等）自动回填；③ 后端新增 `POST /api/systems/{id}/grading-report/import-word`、`POST /api/systems/{id}/expert-review/import-word?variant=city|department`、`POST /api/filing-workspace/systems/{id}/import-word` 三个端点；④ 解析函数使用 XML 级结构（`xml.etree.ElementTree` 解析 `word/document.xml`），备案表解析改进为模糊标签匹配 + 冒号分隔值提取 + 空格归一化姓名定位，覆盖率从 4 字段提升至 15 字段；⑤ 导出→导入 round-trip 测试全部通过。
> - v1.9.1: 完善定级报告与专家评审意见表（第一阶段） — ① 新增 `/systems/{id}/grading-report` 与 `/systems/{id}/expert-review?variant=city|department` 两个独立录入页，仿"完善备案表"的卡片式分节 + 顶部保存/导出按钮；② 新建 `grading_reports`、`expert_review_forms` 两张数据表存储表单内容（JSON）与拓扑图路径；③ 定级报告页段落均可手填，矩阵表根据备案表表三 `business_security_damage_items` / `service_security_damage_items` 自动计算命中单元格并涂灰（业务/服务两张矩阵独立）；④ 支持单张拓扑图上传（jpg/png/webp 等，≤20MB），导出 Word 时插入到"定级对象构成"段落后；⑤ 导出 Word 将用户填写内容替换模板样例段落（跨 run 合并后匹配），保留模板版式；⑥ 专家评审表支持市级/厅级版本切换与独立保存；⑦ 修复专家评审版本选择弹窗飞到页面底部的问题（改用 `.modal-overlay.visible` 居中样式）；⑧ 外层系统行 `完善定级报告` / `完善专家评审意见表` 按钮改为跳转新页面而非直接下载。
> - v1.9.0: 备案对象工作台扩展 — ① 修复表三定级矩阵及所有 radio 无法取消选择的问题（支持再次点击取消）；② 单位卡片系统行将"完善信息 / 导出 Word"改名为"完善备案表 / 完善定级报告"，并新增"完善专家评审意见表"按钮（点击时弹出市级 / 厅级版本选择）；③ 单位卡片新增"合并专家评审表"功能，可勾选多个系统合并导出；④ 后端新增 `/api/systems/{id}/export/grading-report`、`/api/systems/{id}/export/expert-review?variant=city|department`、`/api/organizations/{id}/export/expert-review-merged`；⑤ Word 模板填充改为 XML 级文本替换（直接操作 `word/document.xml`），保留方框/符号等 python-docx 会丢失的元素。
> - v1.8.1: 备案表导出细节修复 — ① 附件名改为无条件按《单位-系统-类型》默认命名（不再依赖数据库 file_name，对应"不再实际上传文件"的业务简化）；② 前端 6 处附件位置（表三定级报告/专家评审/上级审核、表四云平台/大数据平台、表五六项材料）全部去除"选择文件"上传按钮，改为实时预览即将写入的完整文件名（如《山西晋深交易有限公司-山西国资供应链服务系统-系统定级报告》）；③ 修复 T2 R7 主要协议/端口出现两次 `HTTPS` 的重复问题（清理紧随占位 run 的遗留旧数据）；④ 修复 T6 R4 数据总量、R5 月增长、R7/R8 数据流转单位格式被破坏的问题（保留下划线占位、编号和段落结构）；⑤ T4 R31 大数据平台备案证明补上默认后缀 "大数据平台备案证明"。
> - v1.8.0: 备案表导出模板保真化 — 按官方模板（山西晋深实例）完全对齐 Word 导出的外观；选项字段改用 Wingdings 2 的 ☑/□ 符号切换而非文本重写；日期改为"YYYY 年 M 月 D 日"分 run；附件名自动按《单位-系统-XXX》命名；定级对象编号留空（由公安机关填）；文件名改为《单位名-系统名-网络安全等级保护定级备案表.docx》。
> - v1.7.0: 前端重构 · 衡鉴品牌升级 — 按功能型 UI 规范整体翻修 style.css / base.html / auth.html，删除装饰渐变与毛玻璃、按钮全部扁平化、圆角统一 4-10px、阴影降级；品牌由"兰台清晖"迁移为"衡鉴"并替换为天平几何图标。
> - v1.6.0: 代码审查修复 — 修复 2 个 CRITICAL 路径遍历、3 个 HIGH（文件删除越权、审计记录丢失、数据污染）和 1 个 MEDIUM（索引越界）共 6 个恶性 bug。
> - v1.5.5: UI修复（管理紧凑页面顶部空白条）— 移除 BOM 字符并重构 base.html 模板结构，消除模板管理/知识库/用户管理/备份恢复页面顶部异常空白。
> - v1.5.4: 审计修复（备份恢复防护增强）— 为备份解压增加文件数/总大小门禁，新增 2 个回归测试。
> - v1.5.3: 审计修复（路径边界与模板恢复一致性）— 修复下载路径前缀绕过与模板恢复多默认冲突，新增 2 个回归测试。
> - v1.5.2: 深度清理 — 修复 `delete_organization` 权限绕过漏洞（C3 遗漏），彻底清除全部遗留 actor/is_admin 参数（12 处），移除死代码。
> - v1.5.1: 授权加固（第二轮）— 补充 5 个遗漏认证的端点，清理遗留 actor 参数。
> - v1.5.0: 授权加固 — 修复 3 个 HIGH 级别问题：46 个端点添加角色认证、修复 actor 伪造、移除硬编码真实姓名。
> - v1.4.0: 安全加固 — 修复 5 个 CRITICAL 和 8 个 HIGH 级别安全漏洞，清理冗余文件。

---
## v1.8.0 — 备案表导出模板保真化

### 背景与动机

用户核对导出的 `filing_1_20260420103156.docx` 与官方模板（山西晋深交易有限公司实例）发现大量格式差异：

- 文件名用内部 `filing_{id}_{ts}.docx` 而非"单位名-系统名-备案表"
- 选项字段（隶属关系/业务类型/服务范围等）使用 `□/√` 文本替换，丢失了官方模板的 Wingdings 2 ☑/□ 方框样式与数字编号（1/2/3…/9其他）
- 封面备案日期被自动填入，模板要求由备案单位手填
- 日期用 `YYYY-MM-DD` 而模板用 `YYYY 年 M 月 D 日` 分 run
- 附件名称是 `02-定级报告.docx` 而模板要求《单位-系统-系统定级报告》
- 定级对象编号错误地用 `system_code` 截取 5 位生成（应由公安机关填，5 位留空）

### 实现方式

**核心策略：不再重写选项单元格文本，改为精确操作 Wingdings 2 符号与特定 run，保留模板字体（仿宋/方正小标宋简体）与结构。**

新增 XML 级别 helper 函数：

| 函数 | 职责 |
| :--- | :--- |
| `set_cell_check_by_index` | 根据 0-based 索引集合切换 Wingdings 2 `<w:sym char="0030/0052">` 符号 |
| `replace_cell_preserve_symbols` | 替换单元格数据 run 文本，保留 Wingdings 符号 run |
| `set_fangsong_run_values` / `set_first_fangsong_run` | 按序替换仿宋字体 run，保留前后空白 |
| `replace_attachment_name_in_cell` | 定位《...》书名号区间并整体替换 |
| `replace_date_runs_in_cell` | 识别"年/月/日"标签，向前回溯写入数字 run |
| `_resolve_attachment_name` | 将旧 `02-xxx.docx` 样式自动迁移为新《单位-系统-XXX》 |
| `sanitize_filename_component` | 剔除文件名非法字符用于导出命名 |
| `labels_to_indices` | 中文标签映射到选项索引 |

**主函数 `fill_filing_template_document` 完全重写**，按官方模板 sym 顺序建立映射：

- T1 R14 隶属关系：5 项（中央/省/地/县/其他）
- T1 R15 单位类型：5 项（党委/政府/事业/企业/其他）
- T1 R16 行业类别：49 项（1海关 … 99其他）
- T2 R1 定级对象类型：9 项交错（通信/信息系统 + 5技术+9其他 + 数据资源）
- T3 R11 最终级别：4 项中文数字（第二级/第三级/第四级/第五级）
- 其他表 R、T4-T6 各选项字段均按模板顺序建表

### 关键细节修复

- **日期重复 bug**：修复 `_set_date_part_backwards` 向前回溯遇到"年/月/日"边界即停止，避免把同一年份写两次
- **地址仿宋 run 空格保留**：`set_fangsong_run_values` 保留原 run 的 `^\s*` 和 `\s*$`
- **附件名自动迁移**：检测 `\d{1,2}-.+\.docx` 形式的旧名并替换为 `{单位}-{系统}-{类型}`
- **定级对象编号留空**：T2 R0 C4-C8 不再自动生成编号，等待公安机关填写

### 文件

| 操作 | 文件路径 |
| :--- | :--- |
| 修改 | `app/main.py`（新增 ~200 行 helper、重写 `fill_filing_template_document` ~280 行、修改 `export_system_word` 文件名逻辑） |

### 测试方式

1. 启动应用 `python launch.py`，进入定级备案工作台
2. 选择已填入完整数据的系统，点击"导出 Word"
3. 文件名应为 `{单位名}-{系统名}-网络安全等级保护定级备案表.docx`
4. 打开 Word 检查：
   - 封面备案日期留空
   - 选项字段保留 `□1 中央  □2 省  ☑3 地(区、市、州、盟)  □4 县  □9 其他` 格式（不再是 `□中央 □省 √地`）
   - 日期形如 ` 2022 年 9 月 6 日`
   - 附件名为《单位-系统-系统定级报告》等
   - 定级对象编号 5 格留空
5. 已通过自动对比脚本验证 22 个选项字段的 Wingdings 勾选状态与模板一致（T5 R0 差异为测试数据未填）

---
## v1.7.0 — 前端重构 · 衡鉴品牌升级

### 背景与动机

原前端存在 30 余项违反功能型 UI 规范的问题：圆角散落 14/16/22/32px、戏剧性阴影 `0 30px 70px`、装饰性渐变背景与毛玻璃、朱砂/古铜渐变按钮+位移动画、Dashboard 嵌 Hero Section、古雅衬线字体混排等。按 `frontend-design-integrated.md` 与 `ui-ux-pro-max-skill` 双规范重构。

### 设计系统（新）

- **配色**：Frost 浅色工作区 + Graphite 深色侧边栏（`#0f172a` 实填，非渐变）
- **主色**：`#0f766e`（青墨绿），Accent `#d97706`（琥珀，仅关键警示）
- **圆角**：统一 4-10px（按钮/输入 4px、卡片/面板 8px、弹窗 10px）
- **阴影**：`0 1-2px` subtle，模糊半径 ≤ 8px
- **字体**：`PingFang SC / Microsoft YaHei / system-ui` 系统栈；数字 `JetBrains Mono`
- **动效**：功能型上限 140-200ms，仅 opacity/color 变化，**禁用 transform 位移**

### 修改文件

#### `app/static/style.css` — 完全重写（约 1050 行）

- 重建 `:root` 设计 token 体系（surface / border / text / sidebar / primary / motion / radius / shadow）
- `.sidebar` 改为 `#0f172a` 实填（移除 3-stop 深蓝渐变）
- 所有 `button / .btn / .btn-primary / .btn-lite / .btn-danger / .btn-subtle-danger` 扁平化，移除 `linear-gradient` 与 `transform: translateY(-1px)` 与戏剧性 box-shadow
- 删除 `body` 的 radial-gradient 装饰与 `body::before` 网格纹理
- 删除 `.brand-mark` 的朱砂+古铜渐变+3 层阴影，改为 subtle 深色描边
- 删除 `.auth-visual::after` 装饰色斑
- `.page-hero` 简化：移除 eyebrow + `hero-chip` 侧栏
- `input / select / textarea` 圆角 16px → 4px，padding 降级
- `.top-header` 移除 `backdrop-filter: blur()` 与阴影
- 保留测试必需的 CSS 变量名 `--brand-ink`、`--font-brand`、`--accent-cinnabar`（重赋新值，对齐新设计）
- 保留测试必需的选择器：`@view-transition`、`route-content`、`.page-layout-management-tight .*`、`.header-notice-panel`、`inline-check` 等

#### `app/templates/base.html` — 品牌切换与结构简化

- **修改位置**：
  - `<title>`：`兰台清晖` → `衡鉴`
  - `brand-emblem` SVG：册页形图标 → 天平几何图标（currentColor 适配深色 sidebar）
  - `.brand-copy strong`：`兰台清晖` → `衡鉴`
  - `.page-hero`：移除 `page-eyebrow`、移除 `page-hero-side` 的两张 `hero-chip`
  - `asset_version` bump 到 `20260419-hengjian-flat`

#### `app/templates/auth.html` — 登录页整体重写

- 删除 `"物有本末，事有终始。知所先后，则近道矣。"`《大学》装饰引言
- 删除左侧 `.auth-visual::after` 朱砂色斑 + `auth-quote-block` 装饰块
- `.brand-mark` 朱砂渐变 → subtle 深底描边
- `.btn-primary` 从渐变 + 大阴影 → 实色填充 + subtle 描边
- `.field input` 圆角 16px → 4px，focus ring 对齐主色
- 所有字体改为系统字体栈（移除 `STSong / SimSun / Noto Serif CJK SC`）
- `<title>`：`登录 - 兰台清晖` → `登录 · 衡鉴`
- 保留全部登录/改密 JS 逻辑

#### `tests/test_ui_templates.py` — 断言迁移

- `兰台清晖` → `衡鉴`
- 新增反向断言：`assertNotIn('兰台清晖')`、`assertNotIn('page-eyebrow')`

#### `tests/test_auth_pages.py` — 断言迁移

- `兰台清晖` → `衡鉴`
- 移除装饰文案断言："物有本末" 与 "《大学》"，改为 `assertNotIn` 反向校验

#### `README.md` / `USER_GUIDE.md` — 标题品牌化

- 根标题加 `衡鉴 ·` 前缀

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **完全重写** | `app/static/style.css`、`app/templates/auth.html` |
| **修改** | `app/templates/base.html`、`tests/test_ui_templates.py`、`tests/test_auth_pages.py`、`README.md`、`USER_GUIDE.md` |

### 测试方式

1. `PYTHONUTF8=1 python -m unittest tests.test_ui_templates -v` — 14/14 通过
2. `PYTHONUTF8=1 python -m unittest tests.test_auth_pages -v` — 5/5 通过
3. 全量 `python -m unittest discover -s tests -p "test_*.py"` — 84/85 通过（剩余 1 个 `test_07_auth_and_template_flow` 为**预先存在**的失败，依赖项目根 `01/02/03-*.docx` 官方模板文件，与本次重构无关）
4. 启动 `start.bat`，在浏览器中打开 `http://127.0.0.1:8011`，人工核对：
   - 侧边栏为实填深色（非渐变），品牌图标为天平几何造型
   - 所有按钮扁平无阴影、无位移动画
   - 卡片/面板圆角 ≤ 8px
   - 登录页无《大学》引言、无装饰色斑
   - 图表、表格、弹窗交互正常

---
## v1.6.0 — 代码审查修复（6 个恶性 bug）

### `app/main.py` — 新增安全辅助函数

- **`safe_delete_uploaded_file()`**（约第 1459-1469 行）：
  - 删除文件前校验路径必须在 `UPLOAD_DIR` 或 `EXPORT_DIR` 范围内，路径非法时静默跳过，防止任意文件删除。

### `app/main.py` — CRITICAL: 模板/知识库版本回滚路径遍历（2 处）

- **模板版本回滚**（原第 2347 行）：`restore_template_version` 从快照读取 `file_path` 后直接 `Path()` 检查存在性，未校验路径安全。攻击者篡改快照数据可指向任意文件。
  - **修复**：改用 `ensure_file_exists()` 校验路径在允许目录内。
- **知识库版本回滚**（原第 5413 行）：`rollback_knowledge` 同样问题。
  - **修复**：同上。

### `app/main.py` — HIGH: 文件删除未校验路径（3 处）

- **删除模板**（原第 2446 行）、**删除附件**（原第 3791 行）、**删除知识库文档**（原第 5485 行）：
  - 从数据库读取 `file_path` 后直接 `Path().unlink()`，未校验路径是否在安全目录内。
  - **修复**：统一改用 `safe_delete_uploaded_file()` 函数。

### `app/main.py` — HIGH: 报告编辑双 commit 破坏审计完整性

- **`edit_report`**（原第 3922-3935 行）：先 commit 报告内容修改，再 add ReviewRecord 后第二次 commit。若第二次 commit 失败，报告已保存但审计记录丢失。
  - **修复**：将 ReviewRecord 添加移到 commit 之前，确保报告修改和审计记录在同一事务中提交。

### `app/main.py` — HIGH: Excel 导入 `str(None)` 数据污染（2 处）

- **组织导入**（原第 2806-2820 行）：`str(row[N])` 当单元格为 `None` 时产生字符串 `"None"`（如信用代码变成 `"NONE"`），且未检查列数。
  - **修复**：添加 `len(row) < 10` 列数校验；所有字段改用 `str(row[N] or "")` 防止 None 转字符串。
- **系统导入**（原第 3246-3265 行）：同样问题，最大索引为 6。
  - **修复**：添加 `len(row) < 7` 列数校验；`system_name` 改用 `str(row[0] or "")`。

### `app/main.py` — MEDIUM: 工作流步骤索引越界

- **`extend_workflow_due`**（原第 4509 行）：`steps_json[instance.current_step_index]` 未做边界检查，若步骤配置被删减会抛出 `IndexError` 导致 500 错误。
  - **修复**：添加索引边界判断，越界时回退为 `"未知节点"`。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app/main.py` |

---

## 测试方式

1. 运行 `pytest tests/ -x`，确认 72 passed, 2 skipped，零回归。
2. 启动服务后，验证模板删除、附件删除、知识库删除功能正常。
3. 验证报告编辑后 ReviewRecord 审计记录完整。
4. 上传列数不足的 Excel 文件，确认返回明确的跳过提示而非 500 错误。

---

---
## v1.5.5 — UI修复（管理紧凑页面顶部空白条）

### `app/templates/base.html` — 移除 BOM 并重构模板结构

- **根因**：文件开头存在 UTF-8 BOM 字符（`ef bb bf`），且 Jinja2 变量设置代码块（约 86 行）位于 `<!doctype html>` 和 `<html>` 标签之间。渲染后产生的 BOM + 空白文本被浏览器解析为 `<body>` 内的可见文本节点（高度约 20.8px），导致 `.layout` 整体下移。标准页面因 hero 区域遮挡未暴露此问题，管理紧凑页面（模板管理、知识库、用户管理、备份恢复）无 hero 区域，空白条清晰可见。
- **修复内容**：
  1. 移除文件开头的 UTF-8 BOM（3 字节 `ef bb bf`）。
  2. 将 `<html lang="zh-CN"><head><meta charset="UTF-8" />` 提到 Jinja2 变量设置块之前，使所有模板空白输出落在 `<head>` 内（浏览器不渲染）。
- **修改位置**：文件头部，原第 1-90 行重构为新的 1-94 行。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app/templates/base.html` |

---

## 测试方式

1. 重启 `start.bat` 或等待 uvicorn `--reload` 自动加载。
2. 在浏览器中依次访问 模板管理、知识库、用户管理、备份恢复 页面。
3. 确认页面顶部 header 紧贴视口顶端，无异常空白条。
4. 切换回 数据看板、单位信息、系统信息、报告与审核、流程管控，确认 hero 区域正常显示。

---
## v1.5.4 — 审计修复（备份恢复防护增强）

### `app/main.py` — 备份解压门禁与导出清理鲁棒性

- **备份恢复解压门禁（HIGH）**：
  - 新增 `MAX_BACKUP_ZIP_ENTRIES`（默认 5000）与 `MAX_BACKUP_UNCOMPRESSED`（默认 2x 备份上限）两个阈值。
  - `safe_extract_zip()` 增加文件数量与总解压大小校验，超限直接返回 400，避免恶意压缩包造成资源耗尽。
- **临时导出清理重试**：
  - `_cleanup_export_file()` 从单次删除改为短重试，降低 Windows 环境句柄释放延迟导致的残留风险。
- **知识库批量下载清理挂载**：
  - `/api/knowledge/batch-download` 返回增加后台清理任务，保持与其它导出接口一致。

### `tests/test_api.py` — 新增回归测试（2 项）

- `test_54_safe_extract_zip_should_reject_too_many_entries`
  - 验证压缩包文件数量超限时拒绝解压（400）。
- `test_55_safe_extract_zip_should_reject_oversized_uncompressed_content`
  - 验证压缩包解压后总大小超限时拒绝解压（400）。

### 验证结果

- 运行 `.\.venv\Scripts\python -m unittest tests.test_api.ApiFlowTests.test_54_safe_extract_zip_should_reject_too_many_entries tests.test_api.ApiFlowTests.test_55_safe_extract_zip_should_reject_oversized_uncompressed_content -v`：通过。
- 运行 `.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`：55/55 全通过。

---
## v1.5.3 — 审计修复（路径边界与模板恢复一致性）

### `app/main.py` — 修复高风险路径与默认模板冲突

- **下载路径边界校验修复（HIGH）**：
  - `ensure_file_exists()` 原先使用字符串前缀匹配，`uploads_shadow/*` 可被误判为 `uploads/*` 子路径。
  - 改为 `Path.is_relative_to()` 的真实路径父子关系校验，阻断目录前缀绕过。
- **模板恢复默认唯一性修复（HIGH）**：
  - `restore_template_version()` 恢复到 `is_default=true` 快照时，新增同类型模板去重逻辑。
  - 确保同一 `report_type` 最终仅保留一个默认模板，避免导出/匹配行为不稳定。

### `tests/test_api.py` — 新增回归测试（2 项）

- `test_52_attachment_download_should_block_upload_dir_prefix_bypass`：
  - 复现并验证附件下载路径前缀绕过被拦截（期望 403）。
- `test_53_restore_template_default_should_keep_single_default`：
  - 验证模板恢复后默认模板唯一性（避免出现多默认模板）。

### 验证结果

- 运行 `.\.venv\Scripts\python -m unittest tests.test_api.ApiFlowTests.test_52_attachment_download_should_block_upload_dir_prefix_bypass tests.test_api.ApiFlowTests.test_53_restore_template_default_should_keep_single_default -v`：通过。
- 运行 `.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`：53/53 全通过。

---
## v1.5.1 — 授权加固（第二轮遗漏修复）

### `app/main.py` — 补充 5 个遗漏认证的端点

- **`test_fill_template`**：POST 端点无认证，可泄露组织/系统数据 → 添加 `require_roles({"admin", "evaluator"})`
- **`export_report_word`**：GET 导出无认证，任意用户可下载报告 → 添加 `require_roles({"admin", "evaluator"})`
- **`export_report_pdf_file`**：GET 导出无认证 → 添加 `require_roles({"admin", "evaluator"})`
- **`export_dashboard_excel`**：GET 导出无认证 → 添加 `require_roles({"admin", "evaluator"})`
- **`export_dashboard_pdf`**：GET 导出无认证 → 添加 `require_roles({"admin", "evaluator"})`
- **清理遗留参数**：`import_local_official_templates` 和 `cleanup_organization_recycle_bin` 移除未使用的 `actor: str = Query()` 参数

---

## v1.5.2 — 深度清理（第三四五轮审计）

### `app/main.py` — 权限绕过修复 + 全面参数清理

- **`delete_organization` 权限绕过（CRITICAL）**：仍使用 `is_current_user_admin(legacy_is_admin=is_admin)` 信任客户端 `is_admin` 参数 → 重构为 `require_roles({"admin", "evaluator"})` + `role != "admin"` 检查
- **彻底清除遗留 actor/is_admin 参数**（12 处）：
  - `create_org_collection_link`：移除 `actor` 参数
  - `review_org_submission`：移除 `actor` 参数
  - `delete_organization`：移除 `actor` 和 `is_admin` 参数
  - `cleanup_system_recycle_bin`：移除 `actor` 参数
  - `review_delete_request`：移除 `actor` 参数
  - `reorder_report_section`：移除 `actor` 和 `is_admin` 参数
  - `set_report_signature`：移除 `actor` 和 `is_admin` 参数
  - `submit_report`：移除 `actor` 参数
  - `workflow_extend_due`：移除 `actor` 参数
  - `workflow_advance`：移除 `actor` 参数
- **移除死代码**：`is_current_user_admin()` 函数已无调用方，安全删除

---

## v1.5.0 — 授权加固与 actor 伪造修复

### `app/main.py` — 角色授权 + actor 伪造修复（46 处修改）

- **H1 缺失授权**：为 22 个无认证的写入/导入/导出端点添加 `require_roles()` 角色检查：
  - Admin 专属：`archive_organization/system`、`restore_organization/system`、`delete_attachment`、`restore_report_version`、`import_*/excel`、`import_*/word`
  - Admin+Evaluator：`create_organization/system`、`update_organization/system`、`export_*`、`upload_attachment`、`generate_report`、`edit_report`、`add/delete_report_section`、`copy_system`、`create_*_delete_request`
- **H2 actor 伪造**：所有端点的 `actor` 参数改为从认证会话中派生，不再信任客户端提交的 `?actor=` 查询参数：
  - 15 个端点移除 `actor: str = Query(...)` 参数，改用 `require_roles()` 返回的用户名
  - 10 个已保护端点移除 `actor` 参数，消除 `actor_name or actor` 回退逻辑
  - 5 个端点移除 `is_admin: bool = Query(...)` 参数，改用 `role == "admin"` 判断
  - 全局替换 `legacy_admin=(actor == "admin")` → `legacy_admin=True`（18 处）
  - 全局替换 `actor_name or actor` → `actor_name`（37 处）

### `app/services/reporting.py` — 移除硬编码真实姓名（H10）

- **修改位置**：`OFFICIAL_TEMPLATE_TEXT_REPLACEMENTS` 常量
- **修改内容**：硬编码的公司名/真实姓名移至外部配置文件 `config/template_replacements.json`，运行时动态加载，源码不再包含任何真实个人信息。
- **新增函数**：`_load_template_replacements()` — 从 JSON 配置文件加载脱敏替换规则。

### `tests/test_api.py` — 测试适配

- 归档/导入等 admin-only 端点调用统一添加 `headers=self.admin_headers`
- 移除测试中已废弃的 `?actor=`、`?is_admin=` 查询参数

### `.gitignore` — 新增忽略项

- `config/template_replacements.json`（含真实姓名，不入库）

## 新增文件

### `config/template_replacements.json` — 模板脱敏配置（gitignored）

- **功能**：存储官方模板中需脱敏替换的真实姓名/公司名映射
- **格式**：JSON 键值对，key 为原文，value 为占位符

### `config/template_replacements.example.json` — 脱敏配置示例

- **功能**：提供配置格式参考，不含真实数据，可安全提交

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app/main.py` |
| **修改** | `app/services/reporting.py` |
| **修改** | `tests/test_api.py` |
| **修改** | `.gitignore` |
| **新增** | `config/template_replacements.json` |
| **新增** | `config/template_replacements.example.json` |

## 测试方式

- 运行 `python -m pytest tests/test_api.py -q`，确认 51 个测试全部通过
- 验证 evaluator 角色无法执行归档、导入、恢复等 admin-only 操作（返回 403）
- 验证 `?actor=attacker` 参数不再影响审计日志中的操作者记录

---

## v1.4.0 — 安全加固

### `app/db.py` — 事务安全修复

- **修改位置**：`get_db()` 函数
- **修改内容**：添加 `db.rollback()` 异常处理，防止未提交事务悬挂导致脏数据。

### `app/main.py` — 安全加固（多处修改）

- **C1 默认密码**：移除硬编码密码，改为环境变量/随机生成 + 强制首次修改。
- **C2 Token 泄露**：移除 URL query 参数传递 token，仅保留 Header 和 HttpOnly Cookie。
- **C3 权限伪造**：`is_current_user_admin()` 不再信任客户端 `is_admin` 参数。
- **H3 LIKE 注入**：添加 `escape_like()`，30 处 LIKE 查询已转义通配符。
- **H5 Cookie 安全**：登录接口设置 `HttpOnly` + `SameSite=Lax` Cookie。
- **H6 空文件名**：4 处导入接口添加 `file.filename` 空值检查。
- **H7 路径遍历**：`ensure_file_exists()` 添加路径边界校验。
- **H8 文件清理**：9 个导出接口添加 `BackgroundTask` 自动清理。
- **H9 事务原子性**：11 处双重 `db.commit()` 改为 `flush()` + 单次 `commit()`。
- **M9 Token 强度**：会话令牌改为 `secrets.token_hex(32)`（256位）。
- **新增 .env 支持**：集成 `python-dotenv`。

### `app/templates/knowledge.html` — XSS 修复

- onclick 字符串拼接改为 `data-*` 属性 + 事件委托。

### `tests/test_api.py` — 测试适配

- 适配 HttpOnly Cookie 和 is_admin 安全修复，更新 4 个测试用例。

## 新增文件

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `.env.example` |
| **修改** | `app/db.py`, `app/main.py`, `app/templates/knowledge.html` |
| **修改** | `tests/test_api.py`, `requirements.txt`, `.gitignore` |

## 清理文件

- `.venv_clean/` (111MB), `delivery_release_*.zip` (2.1MB), `__pycache__/`

## 测试方式

- `pytest tests/test_api.py -v`，全部 51 个测试通过。

---

# 修改记录 — 定级备案管理系统（后端模型层优化）

> **修订记录**
>
- v1.3.7: 简化 `start.bat` 自动开页链路（直接调用 `launcher.py`，去除中间 bat 包装层），修复单位删除弹窗后无反应的 Bug（缺少 try/catch + prompt 取消未中止），清理冗余文件。
- v1.3.6: 去除 `start.bat` 对 PowerShell 的依赖，改为 Python 后台探测端口可用后再打开浏览器，修复自动开页弹窗异常（含 `\" \"\` 路径错误与安全软件拦截风险）。
- v1.3.5: `start.bat` 新增自动打开浏览器能力，双击启动后默认自动打开访问地址，并提供开关 `AUTO_OPEN_BROWSER`。
- v1.3.4: 修复高风险流程缺陷（删除流程绕过、布尔字符串误判、知识库目录缺失崩溃），并补充 6 个回归测试覆盖关键场景，同时为模板导出失败补充异常日志。
- v1.3.3: 按《需求.docx》将单位统一社会信用代码校验从“校验位强校验”调整为“格式校验”，修复单位创建/导入链路批量失败问题，恢复核心业务闭环。
> - v1.3.2: 扩展前端 UI 优化至全部模板页——reports、users、backup、workflow、knowledge、templates 六个页面统一使用 search-bar、table-wrapper、status-badge、btn-sm/btn-danger 等组件，补充空状态/错误提示、图标、下载修复（appendChild/removeChild）。
> - v1.3.1: 完善 schemas Response 模型、validators 校验函数增强（系统编号/信用代码校验位/IP/URL）、reporting 服务健壮性提升（数据完整性检查、日志、容错）。
> - v1.3.0: 前端 UI 全面优化——数据看板图表增强（趋势折线图、动画、悬停提示）、下钻表格分页、统计卡片同比增长指示、表格斑马纹与hover高亮、搜索工具栏交互改进、状态徽章、响应式布局完善。
> - v1.2.47: 修复3个后端 Bug：FastAPI 路由顺序冲突（静态路径被参数路径拦截）、密码长度策略不一致、API 安全性缺陷。

---

## 修改文件（v1.3.7）

### `start.bat` — 简化自动开页链路

- **修改位置**：第 230 行 `AUTO_OPEN_BROWSER` 段。
- **修改内容**：原先通过 `open_browser_when_ready.bat` 间接调用 Python 脚本，现改为 `"%VENV_PY%" "%~dp0launcher.py"` 直接调用，去掉中间包装层。

### `launcher.py` — 新建（原 `open_browser_when_ready.py` 重命名）

- **功能**：轮询本地端口，可连接后自动打开浏览器。
- **实现原理**：socket 探测 + `webbrowser.open()`，与原逻辑完全一致。

### `app/templates/organizations.html` — 修复单位删除弹窗后无反应

- **修改位置**：`deleteOrg()` 函数（约 359 行）。
- **修改内容**：
  1. `prompt()` 返回 `null`（用户点取消）时直接 `return`，不再继续发请求。
  2. 为 `fetch` 调用添加 `try/catch`，捕获网络异常或非 JSON 响应导致的静默失败，错误信息通过 `setOrgResult` 显示给用户。

### 删除冗余文件

- `open_browser_when_ready.bat` — 已被 `launcher.py` 直接调用替代
- `open_browser_when_ready.cmd` — 与 `.bat` 内容完全重复
- `open_browser_when_ready.py` — 已重命名为 `launcher.py`

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `start.bat` |
| **新增** | `launcher.py` |
| **修改** | `app/templates/organizations.html` |
| **删除** | `open_browser_when_ready.bat` |
| **删除** | `open_browser_when_ready.cmd` |
| **删除** | `open_browser_when_ready.py` |

## 测试方式

- 双击 `start.bat` 启动服务，确认浏览器自动打开 `http://127.0.0.1:8011`。
- 进入单位信息页面，导入 Word 创建单位后，点击删除按钮，弹窗输入原因后确认，应显示"删除申请已提交"。
- 点击删除后选择"取消"，应无任何后续动作（不发请求）。

---

## 修改文件（v1.3.6）

### `start.bat` — 自动开页改为非 PowerShell 方案

- **修改位置**：环境变量默认值区、`LAUNCH` 段。
- **修改内容**：
  - 新增 `BROWSER_WAIT_SECONDS`（默认 `30` 秒）用于控制等待服务可用的最长时长。
  - 自动开页逻辑改为调用 `open_browser_when_ready.bat`（内部再调用 Python 探测脚本），不再调用 PowerShell。
  - 保留 `AUTO_OPEN_BROWSER` 开关与 `DRY_RUN=1` 的短路行为。
  - 新增 `LAUNCH_ENTERED` 保护，避免 `LAUNCH` 段被重复执行。

### `open_browser_when_ready.bat` — 轻量调度层

- **修改内容**：
  - 仅负责参数透传与环境校验，再调用 `open_browser_when_ready.py`。
  - 无端口轮询逻辑，避免复杂 `cmd` 引号/管道实现引发弹窗。

### `open_browser_when_ready.py` — 端口就绪后再打开浏览器

- **修改内容**：
  - 轮询 `127.0.0.1:APP_PORT` 端口是否可连接，可连接后打开 `http://127.0.0.1:APP_PORT`。
  - 仅做一次打开，不输出干扰日志，失败时静默退出（不影响主服务启动）。

---

## 文件清单总览（v1.3.6）

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `start.bat` |
| **新增** | `open_browser_when_ready.bat` |
| **新增** | `open_browser_when_ready.py` |

---

## 测试方式（v1.3.6）

1. `.\.venv\Scripts\python.exe open_browser_when_ready.py 65534 1`
2. `cmd /d /c "set DRY_RUN=1&& set AUTO_OPEN_BROWSER=1&& call start.bat"`

---

## 修改文件（v1.3.5）

### `start.bat` — 启动后自动打开网页

- **修改位置**：环境变量默认值区、`LAUNCH` 段。
- **修改内容**：
  - 新增 `AUTO_OPEN_BROWSER` 环境变量（默认 `1`）。
  - 在启动 uvicorn 前，延迟 2 秒自动打开 `http://127.0.0.1:%APP_PORT%`。
  - 修复 `cmd start` 多层引号导致的 “The network path was not found.” 弹窗问题，改为稳定的 PowerShell 打开方式。
  - `DRY_RUN=1` 时不启动服务也不打开浏览器。

---

## 文件清单总览（v1.3.5）

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `start.bat` |

---

## 测试方式（v1.3.5）

1. `cmd /c "set DRY_RUN=1&& set AUTO_OPEN_BROWSER=0&& call start.bat"`

---

## 修改文件（v1.3.4）

### `app/main.py` — 删除流程与布尔解析修复

- **修改位置**：`update_report_template`、`update_workflow_rules`、`delete_organization`、`delete_system`、`get_or_create_workflow_step_rules`、`upload_knowledge`、`new_knowledge_version`。
- **修改内容**：
  - 模板更新的 `is_default` 改为显式布尔解析，修复 `"false"` 被误判为 `True` 的问题。
  - 工作流规则 `enabled` 改为显式布尔解析，修复 `"false"` 失效问题。
  - 修复工作流规则历史重复记录导致“禁用后被自动补回启用”的根因：按最新记录去重并清理旧重复项。
  - 组织/系统直接删除改为管理员路径，非管理员需先走删除申请。
  - 知识库上传与新版本上传补充目录自动创建，避免目录缺失时抛 `FileNotFoundError`。
  - 报告模板导出失败时新增异常日志，保留回退导出能力，避免静默吞错。
  - 启动流程迁移为 FastAPI `lifespan`，移除 `@app.on_event("startup")` 弃用路径。
  - 全部页面 `TemplateResponse` 调用改为新签名（`TemplateResponse(request, name, context)`），消除运行时弃用告警。
  - 看板趋势统计将月份聚合从 SQLite 专用 `strftime` 改为 `extract(year/month)`，提升跨数据库兼容性。

### `tests/test_api.py` — 回归测试补充与旧断言同步

- **修改内容**：
  - 新增 `test_46`~`test_51`，覆盖上述修复场景（含工作流重复规则清理回归）。
  - 调整与新删除流程冲突的旧用例（`test_08`、`test_20`）到“管理员删除/删除申请”语义。

---

## 文件清单总览（v1.3.4）

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app/main.py` |
| **修改** | `tests/test_api.py` |

---

## 测试方式（v1.3.4）

1. `.\.venv\Scripts\python -m unittest tests.test_api.ApiFlowTests.test_46_update_workflow_rules_string_false_should_disable_step tests.test_api.ApiFlowTests.test_47_update_template_is_default_string_false_should_not_set_true tests.test_api.ApiFlowTests.test_48_direct_delete_organization_requires_admin_review_path tests.test_api.ApiFlowTests.test_49_direct_delete_system_requires_admin_review_path tests.test_api.ApiFlowTests.test_50_knowledge_upload_should_create_missing_knowledge_dir -v`
2. `.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

---

## 修改文件（v1.3.3）

### `app/main.py` — 单位信用代码校验回归修复

- **修改位置**：`validate_org_payload`、`validate_org_partial`，以及 validators 导入区。
- **修改内容**：
  - 将单位信用代码校验从 `validate_credit_code`（格式+校验位）切换为 `validate_credit_code_format_only`（仅格式）。
  - 保持原错误文案与接口入参不变，仅修正校验策略，避免影响现有调用方。

---

## 文件清单总览（v1.3.3）

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app/main.py` |

---

## 测试方式（v1.3.3）

1. `.\.venv\Scripts\python -m unittest tests.test_api.ApiFlowTests.test_02_validation_and_dashboard tests.test_api.ApiFlowTests.test_17_import_excel_flush_error_does_not_break_whole_transaction -v`
2. `.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

---

## 修改文件（v1.3.1）

### `app/schemas.py` — 新增核心 Response 响应模型

- **修改内容**：
  - 新增 `OrganizationResponse`：包含 id、archived、locked、created_at、updated_at 等完整字段，`model_config = ConfigDict(from_attributes=True)`
  - 新增 `SystemInfoResponse`：包含 system_code 及所有业务字段与审计字段
  - 新增 `ReportResponse`：包含 report_type、version_no、status、content、generated_at 等
  - 新增 `WorkflowConfigResponse`：包含 steps_json、updated_by、updated_at
  - 所有 Response 模型均支持从 SQLAlchemy ORM 对象直接构造（`from_attributes=True`）

### `app/validators.py` — 增强校验函数

- **修改内容**：
  - **信用代码校验位**：新增 `_calc_credit_code_checksum()` 实现 GB/T 32100-2015 算法；`validate_credit_code()` 同时验证格式和校验位；新增 `validate_credit_code_format_only()` 仅做格式校验
  - **系统编号**：新增 `validate_system_code()`，4~64 位字母/数字/连字符/下划线，首尾必须为字母或数字
  - **IP/URL**：新增 `validate_ipv4()`、`validate_url()`、`validate_network_topology_field()`，用于网络拓扑字段验证

### `app/services/reporting.py` — 完善报告生成健壮性

- **修改内容**：
  - 新增 `ReportDataError` 异常类及 `check_report_data_integrity()` 函数，在生成报告前验证关键字段
  - `generate_report_payload()` 调用完整性检查，缺失字段时提前报错
  - `export_report_docx/pdf` 系列函数：新增参数校验、自动创建输出目录、东亚字体 AttributeError 容错、logging 日志输出

---

## 文件清单总览（v1.3.1）

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app/schemas.py` |
| **修改** | `app/validators.py` |
| **修改** | `app/services/reporting.py` |

---

## 测试方式（v1.3.1）

1. `python -m py_compile app/schemas.py app/validators.py app/services/reporting.py`
2. `validate_credit_code("91110000000000001H")` → `True`；篡改校验位 → `False`
3. `validate_system_code("SYS-001")` → `True`；`validate_ipv4("192.168.1.1")` → `True`
4. 调用 `generate_report_payload()` 传入缺字段对象，确认抛出 `ReportDataError`

---

# 修改记录 — 定级备案管理系统（旧版记录）

> **修订记录**（延续）

## 新增文件 (如有)

无

---

## 修改文件

### `app/main.py` — Bug 1: FastAPI 路由顺序冲突修复

- **修改位置**：organizations 路由区域（原行 2596 附近）、systems 路由区域（原行 3044 附近）
- **修改内容**：将以下静态路由函数移动到对应参数路由之前：
  - `/api/organizations/recycle-bin/list`、`/api/organizations/recycle-bin/cleanup`
  - `/api/organizations/export/excel`、`/api/organizations/import/excel`、`/api/organizations/import/word`
  - `/api/systems/recycle-bin/list`、`/api/systems/recycle-bin/cleanup`
  - `/api/systems/export/excel`、`/api/systems/import/excel`、`/api/systems/import/word`
  - 全部移动到 `/{org_id}` 和 `/{system_id}` 参数路由之前，确保 FastAPI 优先匹配静态路径

### `app/main.py` — Bug 2: 密码长度策略统一

- **修改位置**：第 1841 行（`POST /api/auth/users` 创建用户处）
- **修改内容**：
  ```python
  # 修改前
  if not username or len(password) < 6:
      raise HTTPException(status_code=400, detail="用户名不能为空，密码至少6位。")
  # 修改后
  if not username or len(password) < 8:
      raise HTTPException(status_code=400, detail="用户名不能为空，密码至少8位。")
  ```

### `app/main.py` — Bug 3: API 安全性修复

- **修改位置**：第 2001 行（`POST /api/templates/import-local-official` 函数参数）
- **修改内容**：
  ```python
  # 修改前
  actor: str = Query("admin"),
  # 修改后
  actor: str = Query("system"),
  ```

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app/main.py` |

---

## 测试方式

1. 启动后端服务：`uvicorn app.main:app --reload`
2. 访问 `GET /api/organizations/recycle-bin/list`，确认返回回收站列表而非 404/422
3. 访问 `GET /api/organizations/export/excel`，确认返回 Excel 文件而非路由参数错误
4. 访问 `GET /api/systems/recycle-bin/list`，确认返回回收站列表而非 404/422
5. 访问 `GET /api/systems/export/excel`，确认返回 Excel 文件而非路由参数错误
6. 尝试创建用户时设置7位密码，确认返回"密码至少8位"错误
7. 验证 `/api/templates/import-local-official` 的 actor 默认值为 system

---

# 修改记录 — 定级备案管理系统（数据看板前端 UI 增强）

> **修订记录**
>
> - v1.2.46: 对数据看板进行5项前端 UI 优化：统计卡片彩色边框、图表容器视觉增强、下钻表格序号列、空状态友好提示、移动端汉堡菜单按钮。

## 新增文件 (如有)

无

---

## 修改文件

### app/static/style.css — 视觉增强与移动端适配

- **修改位置**：`.card` 区块、`.charts` 区块、`@media (max-width: 1024px)` 媒体查询。
- **修改内容**：
  - 新增 `.card-blue`、`.card-green`、`.card-orange`、`.card-purple` 四个彩色左边框类及对应数字颜色规则；
  - `.charts > div` 添加 `padding:16px`、`border-radius:8px`、`background:var(--bg-main)`、`border:1px solid var(--border-color)` 及 `position:relative`；
  - 新增 `.empty-hint` 样式（默认隐藏，居中灰色"暂无数据"提示）；
  - 新增 `.sidebar-toggle` 默认隐藏的汉堡菜单按钮样式；
  - 媒体查询中启用 `.sidebar-toggle { display: inline-flex; }` 并添加 `.sidebar.sidebar-open` 固定展开状态。

### app/templates/index.html — 看板结构与交互增强

- **修改位置**：`.cards` 区块、`.charts` 区块、下钻表格、`loadDashboard` 函数、`loadDrilldown` 函数。
- **修改内容**：
  - 四张统计卡片分别添加 `card-blue`、`card-green`、`card-orange`、`card-purple` 类名；
  - 每个图表 `canvas` 旁添加 `<span class="empty-hint">暂无数据</span>`；
  - 下钻表格表头由4列扩展为6列：序号、类型、ID、名称、行业/等级、地区/编号；
  - 新增 `showChart()` 辅助函数处理空数据状态（隐藏 canvas / 显示 empty-hint）；
  - `loadDashboard` 改用 `showChart()` 包装三个图表渲染调用；
  - `loadDrilldown` 使用统一计数器 `idx` 为单位行和系统行生成连续序号，列数据分别拆为行业/等级与地区/编号两列。

### app/templates/base.html — 移动端导航增强

- **修改位置**：`top-header` 内 `breadcrumb` 前。
- **修改内容**：插入汉堡菜单按钮，点击后对 `.sidebar` 切换 `sidebar-open` 类，在小屏幕下以固定定位方式展开侧边栏。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/static/style.css |
| **修改** | app/templates/index.html |
| **修改** | app/templates/base.html |
| **修改** | CHANGES.md |

---

## 测试方式

1. 启动服务（`python -m uvicorn app.main:app --reload` 或对应启动脚本），访问 `http://localhost:8000/`。
2. 确认4张统计卡片分别显示蓝/绿/橙/紫色左边框，且数字颜色与边框一致。
3. 在筛选条件下使数据为空，确认图表区域显示"暂无数据"灰色文字，canvas 被隐藏。
4. 点击图表柱子触发下钻，确认明细表格显示6列（含序号列），序号从1连续递增。
5. 缩小浏览器宽度至 1024px 以下，确认顶部出现汉堡菜单按钮，点击可展开/收起侧边栏。

# 修改记录 — 定级备案管理系统（官方新备案表导入可用性修复）

> **修订记录**
>
> - v1.2.45: 针对 `01-新备案表...docx` 增强字段抽取策略（表格列标签组合、字段别名扩展、弱值过滤、备案地区地址推断），确保模板目录中的官方表可直接导入成功。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 官方新备案表兼容增强

- **修改位置**：`parse_docx_key_values`、`ORG_WORD_MAP`、`import_organization_word`、`infer_filing_region_from_address`。
- **修改内容**：
  - 增加表格行去重与“主字段+子标签”组合键识别（如 `单位负责人姓名`、`联系人移动电话`）；
  - 扩展官方新备案表常见字段别名映射；
  - 导入时增加弱值过滤（避免 `办公电话/电子邮件` 这类标签文本误覆盖真实值）；
  - 在缺少备案地区时从地址文本推断地市；
  - 占位办公电话（如 `/`）自动归空，避免格式校验误杀。

### tests/test_api.py — 官方模板导入回归测试

- **修改位置**：新增 `test_37_organization_word_import_supports_official_new_form_docx`。
- **修改内容**：
  - 直接使用 `01-*.docx` 资源文件验证单位 Word 导入成功；
  - 同时校验关键字段（单位名称/信用代码/手机号/邮箱）可被抽取。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.45。
- **修改内容**：记录本次“官方新备案表可直接导入”修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- `.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（新备案表 docx 兼容修复）

> **修订记录**
>
> - v1.2.44: 修复“新备案表”docx 在 `python-docx` 无法识别包关系时导入失败的问题；新增底层 XML 兜底解析与表格键值兼容，避免再次出现“文件无法解析”误报。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — Word导入解析增强

- **修改位置**：`parse_docx_key_values`、`ORG_WORD_MAP`、`import_organization_word`。
- **修改内容**：
  - 增加双通道解析：优先 `python-docx`，失败自动回退到 `word/document.xml` 原始解析；
  - 增强表格键值识别能力（兼容“键在左列、值在右列”）；
  - 保持非法文件明确返回 400，避免 500。

### tests/test_api.py — 回归测试补充

- **修改位置**：新增 `test_36_parse_docx_fallback_supports_missing_package_relationship`。
- **修改内容**：
  - 构造缺少 `_rels/.rels` 的异常 docx 包，验证兜底解析仍可提取字段。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.44。
- **修改内容**：记录本次“新备案表”docx 解析兼容修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- `.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（新增备份恢复 + Word导入稳健性修复）

> **修订记录**
>
> - v1.2.43: 新增管理员“备份与恢复”功能（备份列表/创建/下载/上传恢复）；修复单位 Word 导入遇到异常 docx 返回 500 导致前端无反馈的问题，并增强“新备案表”字段兼容能力。

## 新增文件 (如有)

### app/templates/backup.html — 管理员备份恢复页面

- **功能**：提供一键创建备份、历史备份下载、上传备份恢复（双重确认）。
- **实现原理**：调用新增 `/api/backup/*` 接口完成服务端打包与恢复，恢复前自动生成快照备份。

---

## 修改文件

### app/main.py — 备份恢复 API + Word 解析稳健性

- **修改位置**：目录初始化、工具函数、页面路由、备份 API、Word 解析函数与单位 Word 导入逻辑。
- **修改内容**：
  - 新增 `BACKUP_DIR` 与备份文件大小限制；
  - 新增 SQLite 备份/恢复能力：`/api/backup/list`、`/api/backup/create`、`/api/backup/download/{file_name}`、`/api/backup/restore`；
  - 新增 `/backup` 管理页面路由（管理员权限）；
  - `parse_docx_key_values` 增加异常兜底与表格解析；
  - 单位 Word 导入改为“字段名归一化 + 别名映射”，兼容更多“新备案表”字段写法。

### app/templates/base.html — 导航入口补充

- **修改位置**：侧边栏和面包屑。
- **修改内容**：新增管理员可见“备份恢复”菜单与对应面包屑名称。

### app/templates/organizations.html — Word导入错误提示修复

- **修改位置**：`importOrgWord()`。
- **修改内容**：增加 `try/catch` 与非 JSON 响应兜底，确保后端异常时页面能显示明确错误，而不是“无反应”。

### tests/test_api.py — 回归测试补充

- **修改位置**：新增 `test_33`~`test_35`。
- **修改内容**：
  - 校验管理员可访问 `/backup`；
  - 校验内存数据库下备份创建返回 400（语义明确）；
  - 校验非法 docx 导入单位接口返回 400，不再 500。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.43。
- **修改内容**：记录本次备份恢复功能与 Word 导入稳健性修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | app/templates/backup.html |
| **修改** | app/main.py |
| **修改** | app/templates/base.html |
| **修改** | app/templates/organizations.html |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- `.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（严格锁定依赖语义修复）

> **修订记录**
>
> - v1.2.42: 修复 `STRICT_DEP_LOCK=1` 仍可能回退到 `requirements.txt` 的回归问题，严格模式下锁定安装失败将直接报错退出。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 严格锁定模式优先级修复

- **修改位置**：环境变量互斥检查、`:INSTALL_DEPS` 回退分支。
- **修改内容**：
  - 增加 `STRICT_DEP_LOCK=1` 与 `PREFER_REQUIREMENTS_TXT=1` 的互斥校验；
  - 当锁定依赖安装失败且 `STRICT_DEP_LOCK=1` 时，直接失败，不再回退 `requirements.txt`。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.42。
- **修改内容**：记录严格依赖锁定语义修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | CHANGES.md |

---

## 测试方式

- `cmd /c "set DRY_RUN=1&& set STRICT_DEP_LOCK=1&& set PREFER_REQUIREMENTS_TXT=1&& .\\start.bat"`（预期失败）
- `cmd /c "set DRY_RUN=1&& .\\start.bat"`（预期成功）

# 修改记录 — 定级备案管理系统（启动兼容性增强：可跳过锁定依赖）

> **修订记录**
>
> - v1.2.41: 新增 `PREFER_REQUIREMENTS_TXT=1` 启动开关，允许目标机器直接使用 `requirements.txt` 安装，绕过 `requirements.lock.txt` 中特定平台可能不可用的锁定包版本。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 依赖源选择开关

- **修改位置**：依赖文件选择逻辑。
- **修改内容**：
  - 新增 `PREFER_REQUIREMENTS_TXT` 环境变量（默认 `0`）；
  - 当该变量为 `1` 时，直接使用 `requirements.txt`，跳过锁定文件。

### start_lite.bat — 依赖源选择开关

- **修改位置**：依赖文件选择逻辑。
- **修改内容**：
  - 新增 `PREFER_REQUIREMENTS_TXT` 环境变量（默认 `0`）；
  - 当该变量为 `1` 时，直接使用 `requirements.txt`，跳过锁定文件。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.41。
- **修改内容**：记录启动脚本新增“跳过锁定依赖”能力。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | CHANGES.md |

---

## 测试方式

- `cmd /c "set DRY_RUN=1&& set PREFER_REQUIREMENTS_TXT=1&& .\\start.bat"`
- `cmd /c "set DRY_RUN=1&& set PREFER_REQUIREMENTS_TXT=1&& .\\start_lite.bat"`

# 修改记录 — 定级备案管理系统（启动兼容性修复：pydantic_core 安装失败兜底）

> **修订记录**
>
> - v1.2.40: 启动脚本新增 Python 架构检查（强制 64 位）并在锁定依赖安装失败时自动回退到 `requirements.txt`，降低目标机器出现 `pydantic_core` 无可用版本的安装失败率。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 依赖安装鲁棒性增强

- **修改位置**：Python 环境检测、依赖安装流程。
- **修改内容**：
  - 新增 Python 架构检测并拒绝 32 位解释器；
  - 抽取 `:INSTALL_DEPS` 安装子流程；
  - `requirements.lock.txt` 安装失败时自动回退 `requirements.txt`；
  - 依赖安装失败时增加既有环境可用性检测（`fastapi/pydantic` 导入探测）。

### start_lite.bat — 依赖安装鲁棒性增强

- **修改位置**：Python 环境检测、依赖安装流程。
- **修改内容**：
  - 新增 Python 架构检测并拒绝 32 位解释器；
  - 增加 `:INSTALL_DEPS` 安装子流程；
  - `requirements.lock.txt` 失败时自动回退 `requirements.txt`。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.40。
- **修改内容**：记录启动脚本对目标机器依赖安装兼容性修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | CHANGES.md |

---

## 测试方式

- `cmd /c "set DRY_RUN=1&& start.bat"`
- `cmd /c "set DRY_RUN=1&& start_lite.bat"`

# 修改记录 — 定级备案管理系统（测试产物清理规则补充）

> **修订记录**
>
> - v1.2.39: 新增“测试后清理缓存/临时文件”全局规则；明确清理范围与锁文件处理方式，避免影响运行中的进程与环境。

## 新增文件 (如有)

无

---

## 修改文件

### AGENTS.md — 测试后清理策略

- **修改位置**：新增 `Post-test Cleanup Policy` 章节。
- **修改内容**：
  - 默认清理 `app/tests` 下 `__pycache__` 与常见测试临时文件（`__start_log.txt`、`pytestdebug.log`、`.coverage`）。
  - 明确不清理 `.venv*` 目录内文件。
  - 遇到文件占用时先报告，不强制终止无关进程。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.39。
- **修改内容**：记录本次全局清理规则补充与执行约束。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | AGENTS.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 文档规则变更，无需运行单元测试。

# 修改记录 — 定级备案管理系统（认证模型回归：管理员统一分发账号）

> **修订记录**
>
> - v1.2.38: 认证流程调整为“管理员统一分发账号”模式：关闭自助注册、保留独立登录页、新增系统内管理员用户管理页；首次登录/重置后强制改密在登录页内闭环完成。

## 新增文件 (如有)

### app/templates/users.html — 管理员用户管理页面

- **功能**：管理员统一新增用户、启停用户、重置密码。
- **实现原理**：页面调用既有 `/api/auth/users`、`/api/auth/users/{id}/toggle`、`/api/auth/users/{id}/reset-password` 接口完成账户运维。

---

## 修改文件

### app/main.py — 路由与认证策略调整

- **修改位置**：`/login`、`/register`、`/users` 页面路由；`/api/auth/register`；鉴权白名单与精简模式屏蔽列表。
- **修改内容**：
  - `/register` 页面改为重定向 `/login`；
  - `/api/auth/register` 改为返回 403（未开放自助注册）；
  - 新增 `/users` 页面路由，仅管理员可访问；
  - 保持登录态通过 token + cookie 识别，页面鉴权重定向策略不变。

### app/templates/auth.html — 独立登录页调整

- **修改位置**：登录页布局与脚本。
- **修改内容**：
  - 移除注册入口与注册逻辑；
  - 新增首次登录/重置后强制改密面板（调用 `/api/auth/change-password`）；
  - 登录成功写入 `localStorage` + `auth_token` Cookie，退出时双清理。

### app/templates/base.html — 侧边导航调整

- **修改位置**：侧边菜单与面包屑。
- **修改内容**：
  - 新增管理员可见“用户管理”入口（`/users`）；
  - 保持顶部登录态按钮逻辑（登录/退出切换）。

### tests/test_api.py — 认证行为测试更新

- **修改位置**：更新 `test_31`，新增 `test_32`。
- **修改内容**：
  - `test_31` 改为校验自助注册被拒绝（403）；
  - 新增 `test_32_admin_can_open_users_page` 校验管理员可访问用户管理页。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.38。
- **修改内容**：记录本次认证模型回归与用户管理页补齐。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | app/templates/users.html |
| **修改** | app/main.py |
| **修改** | app/templates/auth.html |
| **修改** | app/templates/base.html |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 全量回归：`.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（界面优化：登录后隐藏“登录与用户”菜单）

> **修订记录**
>
> - v1.2.37: 移除侧边栏“登录与用户”入口；顶部入口改为登录态自适应（未登录显示“登录”，已登录显示“退出”）。

## 新增文件 (如有)

无

---

## 修改文件

### app/templates/base.html — 认证入口交互优化

- **修改位置**：侧边导航、顶部用户区、页面脚本。
- **修改内容**：
  - 删除侧边栏“登录与用户”菜单项，避免登录后仍显示不符合认知；
  - 顶部按钮新增 `authEntryBtn`，未登录显示“登录”，已登录显示“退出”；
  - 新增 `logoutFromLayout()`，统一执行退出 API、清理 `localStorage/Cookie` 并跳转登录页。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.37。
- **修改内容**：记录本次认证入口界面优化。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/templates/base.html |
| **修改** | CHANGES.md |

---

## 测试方式

- 快速验证：`.\.venv\Scripts\python -m unittest tests.test_api.ApiFlowTests.test_30_login_page_is_accessible -v`

# 修改记录 — 定级备案管理系统（登录修复：登录后页面跳转鉴权闭环）

> **修订记录**
>
> - v1.2.36: 修复登录成功后仍停留/回跳登录页的问题；保持 API 登录返回结构不变，由前端认证页写入 `auth_token` Cookie，确保页面跳转请求可被服务端识别。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 登录接口兼容修复

- **修改位置**：`get_auth_token_from_request`、`auth_login`。
- **修改内容**：
  - 保留服务端读取 Cookie 的能力；
  - `auth_login` 恢复为返回 JSON 字典（不再服务端强制下发 Cookie），避免影响既有 API 行为与测试基线。

### app/templates/auth.html — 前端登录态落盘

- **修改位置**：`login()`、`logout()`。
- **修改内容**：
  - 登录成功后除 `localStorage` 外，同步写入 `auth_token` Cookie（`Path=/; SameSite=Lax`）；
  - 退出时同步清理 Cookie，避免残留会话。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.36。
- **修改内容**：记录本次登录后跳转问题修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/auth.html |
| **修改** | CHANGES.md |

---

## 测试方式

- 全量回归：`.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（认证改造：独立登录/注册页 + 注册后登录流程）

> **修订记录**
>
> - v1.2.35: 新增独立认证页面（不依赖系统侧边栏布局）；新增公开注册接口 `/api/auth/register`；新增 `/register` 路由，支持“先注册再登录后进入系统功能”。

## 新增文件 (如有)

### app/templates/auth.html — 独立认证页面

- **功能**：提供登录与注册双面板，登录后自动跳转到目标页面。
- **实现原理**：
  - 页面独立于 `base.html`，避免未登录时展示业务导航；
  - 通过 `/api/auth/login`、`/api/auth/register` 完成认证流程；
  - 使用 `next` 参数控制登录成功后的跳转路径。

---

## 修改文件

### app/main.py — 认证路由与鉴权白名单扩展

- **修改位置**：`/login`、新增 `/register` 路由；新增 `/api/auth/register`；鉴权豁免判断函数。
- **修改内容**：
  - `/login` 改为渲染独立认证模板 `auth.html`；
  - 新增 `/register` 页面路由；
  - 新增注册接口：创建默认 `evaluator` 角色账号（用户名唯一、密码长度校验、确认密码一致校验）；
  - 鉴权白名单放行 `/register` 与 `/api/auth/register`；
  - 精简模式下同步屏蔽 `/register` 页面（与既有登录策略一致）。

### tests/test_api.py — 认证流程测试补充

- **修改位置**：更新 `test_30`，新增 `test_31_register_then_login_success`。
- **修改内容**：
  - 验证 `/login` 页面可访问且包含登录/注册文案；
  - 验证注册成功后可使用新账号登录并拿到 token。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.35。
- **修改内容**：记录本次认证页面与注册登录流程改造。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | app/templates/auth.html |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 全量回归：`.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（安全与启动体验修复：页面鉴权拦截、pip 输出降噪）

> **修订记录**
>
> - v1.2.34: 新增非 API 页面级鉴权拦截（未登录访问业务页跳转登录页）；优化启动脚本依赖检查输出，静默已满足依赖并明确区分 System/Venv pip 信息。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 页面级鉴权拦截

- **修改位置**：`security_middleware`、鉴权豁免判断函数。
- **修改内容**：
  - 新增 `_is_web_auth_exempt`；
  - 在 `API_AUTH_REQUIRED=1` 且非精简模式下，未登录访问受保护 HTML 页面时重定向到 `/login?next=...`；
  - 保留 `/login`、`/health`、`/static/*`、`/organizations/collect/*` 等公开访问能力。

### start.bat / start_lite.bat — pip 输出与依赖安装体验优化

- **修改位置**：Python/pip 信息输出与依赖安装命令。
- **修改内容**：
  - 输出改为显式区分 `[INFO] System pip` 与 `[INFO] Venv pip`；
  - 依赖安装增加 `--quiet`，避免刷屏 `Requirement already satisfied`；
  - 仍保留 `-i https://pypi.org/simple --timeout 20 --retries 1` 参数。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.34。
- **修改内容**：记录本次安全与启动体验修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | CHANGES.md |

---

## 测试方式

- 启动脚本自检：`set DRY_RUN=1 && start.bat`
- 精简版自检：`set DRY_RUN=1 && start_lite.bat`
- 全量回归：`.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（界面补充：登录入口显式化）

> **修订记录**
>
> - v1.2.33: 补强登录界面入口可见性，侧边导航新增“登录与用户”入口，顶部始终显示登录按钮（含精简模式），并新增页面可达性回归测试。

## 新增文件 (如有)

无

---

## 修改文件

### app/templates/base.html — 登录入口显式化

- **修改位置**：侧边导航、面包屑标题、顶部用户区域。
- **修改内容**：
  - 新增侧边栏菜单项“登录与用户”（`/login`）；
  - 面包屑增加 `/login` 显示文案；
  - 顶部“登录”按钮不再受 `lite_mode` 限制，统一可见。

### tests/test_api.py — 页面可达性测试补充

- **修改位置**：新增 `test_30_login_page_is_accessible`。
- **修改内容**：校验 `/login` 可访问且页面包含“账号登录”“登录与用户”关键文案。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.33。
- **修改内容**：记录本次登录入口界面补充与测试覆盖。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/templates/base.html |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 全量回归：`.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（启动修复：start.bat/start_lite.bat 可用性恢复）

> **修订记录**
>
> - v1.2.32: 修复启动脚本因批处理代码块中未转义括号导致的提前 `pause` 问题；改为显式使用 `.venv\Scripts\python.exe` 执行依赖安装和服务启动，避免受损 `activate.bat` 影响；补充 `DRY_RUN=1` 自检模式。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 启动流程稳定性修复

- **修改位置**：Python 检查分支、venv 依赖检查与安装、启动命令。
- **修改内容**：
  - 修复 `if (...)` 代码块中 `echo ... (recommended)` 语法陷阱导致的无条件 `pause`；
  - 使用 `%CD%\.venv\Scripts\python.exe` 作为唯一解释器执行 `pip/uvicorn`，不再依赖 `activate.bat`；
  - 增加 `DRY_RUN=1`，可只跑检查与依赖步骤而不拉起服务。

### start_lite.bat — 启动流程稳定性修复

- **修改位置**：Python 检查分支、venv 依赖检查与安装、标签跳转、启动命令。
- **修改内容**：
  - 同步修复未转义括号引发的批处理块解析问题；
  - 修复依赖安装后未跳转启动段的流程缺陷；
  - 使用 venv 解释器执行并支持 `DRY_RUN=1` 自检。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.32。
- **修改内容**：记录本次启动脚本可用性修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | CHANGES.md |

---

## 测试方式

- 启动脚本自检：`set DRY_RUN=1 && start.bat`
- 精简版自检：`set DRY_RUN=1 && start_lite.bat`

# 修改记录 — 定级备案管理系统（回归修复：知识库列表未分页调用向后兼容）

> **修订记录**
>
> - v1.2.31: 修复知识库列表默认分页导致未传分页参数调用方只能获取前 50 条数据的回归；仅在显式传入 `page/page_size` 时启用分页，未传时返回全量结果。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 知识库列表分页兼容修复

- **修改位置**：`list_knowledge`。
- **修改内容**：
  - `page/page_size` 改为可选查询参数；
  - 仅当请求显式传入 `page` 或 `page_size` 时执行 `offset/limit`；
  - 未传分页参数时保持历史行为，返回全部匹配数据；
  - 保留 SQL 置顶优先排序逻辑，避免回退到 Python 内存排序。

### tests/test_api.py — 回归测试补充

- **修改位置**：新增 `test_29_knowledge_list_without_pagination_returns_all_for_compatibility`。
- **修改内容**：
  - 直接构造 55 条知识库数据；
  - 校验未传分页参数时 `total=55` 且 `items` 全量返回，验证向后兼容。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.31。
- **修改内容**：记录本次向后兼容回归修复与测试覆盖。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 全量回归：`.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（稳定性修复：模板/附件下载健壮性、流程规则输入校验、知识库列表分页优化）

> **修订记录**
>
> - v1.2.30: 修复模板与附件文件缺失导致下载/预览 500；修复流程规则时限非法整数导致 500；知识库列表改为 SQL 排序并支持分页，降低大数据量内存与响应开销。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 接口稳健性与查询性能优化

- **修改位置**：`download_template`、`download_attachment`、`preview_attachment`、`update_workflow_rules`、`list_knowledge`、文件校验辅助函数。
- **修改内容**：
  - 新增 `ensure_file_exists` 统一校验下载文件是否存在；
  - 模板下载、附件下载/预览在返回 `FileResponse` 前先检查 `Path.exists()/is_file()`，缺失时返回 404；
  - 流程规则更新对 `time_limit_hours` 增加整数转换异常处理，非法值返回 400；
  - 知识库列表由“全量拉取 + Python 内存排序”改为 SQL 外连接置顶表排序，并新增 `page/page_size` 分页参数。

### tests/test_api.py — 回归测试补充

- **修改位置**：新增 `test_25` 到 `test_28`。
- **修改内容**：
  - `test_25_template_download_returns_404_when_file_missing`：验证模板文件缺失返回 404；
  - `test_26_attachment_file_endpoints_return_404_when_file_missing`：验证附件下载/预览文件缺失返回 404；
  - `test_27_update_workflow_rules_invalid_time_limit_returns_400`：验证规则时限非法整数返回 400；
  - `test_28_knowledge_list_pagination_and_pinned_order`：验证知识库列表分页与置顶优先排序行为。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.30。
- **修改内容**：记录本次接口稳健性与性能优化及测试覆盖。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 全量回归：`.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（稳定性修复：系统恢复一致性、导入校验、知识库下载健壮性、流程提醒性能）

> **修订记录**
>
> - v1.2.29: 修复系统恢复孤儿问题；兼容 Excel datetime 日期导入；统一系统导入等级范围校验；知识库下载缺失文件返回 404；优化提醒接口避免规则查询 N+1，并补充回归测试。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 一致性与健壮性修复

- **修改位置**：`restore_system`、系统 Excel/Word 导入、`download_knowledge`、`workflow_reminders`、流程规则 owner 解析函数。
- **修改内容**：
  - 系统恢复时增加所属单位可用性校验，单位已删除或不存在时禁止恢复；
  - 新增 `parse_proposed_level` 与 `parse_optional_go_live_date`，导入路径统一复用；
  - 系统导入等级统一限制为 1-5；
  - Excel 导入支持 `datetime/date` 单元格以及 `YYYY-MM-DD HH:MM:SS` 文本日期；
  - 知识库下载前检查磁盘文件存在性，缺失时返回 404；
  - 提醒接口在循环外一次性加载规则映射，避免循环内重复查询。

### tests/test_api.py — 回归测试补充

- **修改位置**：新增 `test_20` 到 `test_24`。
- **修改内容**：
  - `test_20_restore_deleted_system_requires_alive_org`：验证删除单位后禁止恢复其系统；
  - `test_21_system_excel_import_accepts_datetime_cell`：验证 Excel `datetime` 上线时间可成功导入；
  - `test_22_system_import_validates_proposed_level_range`：验证 Excel/Word 导入等级越界被拒绝；
  - `test_23_knowledge_download_returns_404_when_file_missing`：验证知识库缺失文件返回 404；
  - `test_24_workflow_reminders_reuse_rule_map`：验证提醒接口规则映射仅加载一次。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.29。
- **修改内容**：记录本次稳定性与性能修复及测试覆盖。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 全量回归：`.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（仓库清理：停止追踪 AGENTS.md）

> **修订记录**
>
> - v1.2.28: 将 `AGENTS.md` 加入忽略规则并从 Git 追踪中移除（仅仓库删除，保留本地文件），避免后续误提交。

## 新增文件 (如有)

无

---

## 修改文件

### .gitignore — 忽略规则补充

- **修改位置**：`IDE / 编辑器` 段落。
- **修改内容**：新增 `AGENTS.md`，防止本地代理配置文件继续被追踪。

### AGENTS.md — 追踪状态变更

- **修改位置**：Git 索引（非文件内容）。
- **修改内容**：执行 `git rm --cached AGENTS.md`，从仓库删除但保留本地文件。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.28。
- **修改内容**：记录本次追踪清理操作。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | .gitignore |
| **修改** | CHANGES.md |
| **取消追踪** | AGENTS.md |

---

## 测试方式

- 执行 `git ls-files -- AGENTS.md`，确认仓库不再追踪该文件；
- 执行 `Test-Path AGENTS.md`，确认本地文件仍保留。

# 修改记录 — 定级备案管理系统（稳定性修复：Excel 导入事务、系统编号并发、模板必填校验）

> **修订记录**
>
> - v1.2.27: 修复 Excel 导入行失败后事务污染导致 500；修复 `generate_system_code` 并发冲突风险；修复模板更新将必填字段置空触发 500 的问题，并补充回归测试。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 导入事务与参数校验增强

- **修改位置**：`generate_system_code`、`import_organizations_excel`、`update_report_template`。
- **修改内容**：
  - 系统编号由 `count()+1` 改为高熵编号 + 存在性检查，避免并发生成重复编号；
  - Excel 导入按行使用 `begin_nested()` savepoint，单行 `flush` 异常不会污染整批事务；
  - 模板更新对 `template_name/status` 空值做 400 校验，并校验 `status` 仅允许 `enabled/disabled`。

### tests/test_api.py — 回归测试补充

- **修改位置**：新增 `test_17`、`test_18`、`test_19`。
- **修改内容**：
  - `test_17_import_excel_flush_error_does_not_break_whole_transaction`：验证单行唯一约束异常不会导致接口 500；
  - `test_18_update_template_empty_required_fields_returns_400`：验证模板必填字段传空返回 400；
  - `test_19_generate_system_code_not_reused_without_insert`：验证系统编号连续生成不会复用。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.27。
- **修改内容**：记录本次稳定性修复与测试覆盖。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_17_import_excel_flush_error_does_not_break_whole_transaction -v`
- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_18_update_template_empty_required_fields_returns_400 -v`
- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_19_generate_system_code_not_reused_without_insert -v`
- 全量回归：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（回归修复：无鉴权管理员维护与系统日期筛选）

> **修订记录**
>
> - v1.2.26: 修复无鉴权模式下冻结报告无法通过 `is_admin=true` 维护的回归；修复系统侧看板日期筛选使用错误字段导致统计偏小的问题。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 管理员判定与系统日期筛选修复

- **修改位置**：`is_current_user_admin`、`update_organization`、`update_system`、`edit_report`、章节编辑接口、`dashboard_summary`。
- **修改内容**：
  - 管理员判定改为：
    - 有登录用户时仅信任令牌角色；
    - 无登录且处于无鉴权/精简模式时，允许回退 `is_admin` 参数（兼容演示流程）；
  - 看板系统侧日期筛选改为 `SystemInfo.created_at`，与系统指标语义一致。

### tests/test_api.py — 回归测试补充

- **修改位置**：新增 `test_16_lite_mode_can_edit_frozen_report_with_is_admin_flag`。
- **修改内容**：验证 `API_AUTH_REQUIRED=0` 场景下，未登录但带 `is_admin=true` 仍可维护冻结报告，防止精简演示流程回归。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.26。
- **修改内容**：记录本次回归修复与字段筛选修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 新增回归：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_16_lite_mode_can_edit_frozen_report_with_is_admin_flag -v`
- 全量回归：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（安全修复：权限绕过与看板统计一致性）

> **修订记录**
>
> - v1.2.25: 修复 `is_admin` 参数信任导致的报告/归档对象编辑绕过；修复知识库批量下载可下载下架文档；修复看板 totals 指标未应用筛选条件导致统计不一致。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 权限与统计修复

- **修改位置**：`update_organization`、`update_system`、报告编辑/章节/签章接口、`/api/knowledge/batch-download`、`dashboard_summary`。
- **修改内容**：
  - 新增 `is_current_user_admin`，管理员判断绑定当前登录用户角色，不再信任 `is_admin` 查询参数；
  - 归档且锁定对象更新时，仅管理员账号可绕过锁定限制；
  - 报告在 `submitted/approved` 状态时，仅管理员可编辑（普通角色即使传 `is_admin=true` 也不可绕过）；
  - 批量下载接口新增下架状态校验，包含 `disabled` 文档直接拒绝；
  - 看板 `archived_system_count`、`pending_review_reports`、`in_progress_projects` 改为基于同一筛选后的系统集合统计。

### tests/test_api.py — 回归测试补充

- **修改位置**：新增 `test_14`、`test_15`。
- **修改内容**：
  - `test_14_is_admin_param_cannot_bypass_lock_and_report_freeze`：验证普通账号无法通过 `?is_admin=true` 绕过报告冻结和归档锁定编辑；
  - `test_15_batch_download_and_dashboard_filter_consistency`：验证批量下载下架文档被拒绝，且看板 totals 指标与城市筛选一致。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.25。
- **修改内容**：记录本次安全与统计一致性修复。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_14_is_admin_param_cannot_bypass_lock_and_report_freeze -v`
- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_15_batch_download_and_dashboard_filter_consistency -v`
- 全量回归：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（收口：忽略测试残留并推送）

> **修订记录**
>
> - v1.2.24: 更新 `.gitignore` 忽略 `tests/runtime/` 测试残留目录，整理当前变更并准备推送到远端仓库。

## 新增文件 (如有)

无

---

## 修改文件

### .gitignore — 测试残留忽略规则补充

- **修改位置**：`Python 缓存` 段落。
- **修改内容**：新增 `tests/runtime/`，避免测试运行产物反复出现在工作区。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.24 记录。
- **修改内容**：记录本次忽略规则收口与推送准备。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | .gitignore |
| **修改** | CHANGES.md |

---

## 测试方式

- 变更为忽略规则与文档更新，无运行时逻辑改动；
- 已在此前步骤完成 `unittest` 全量回归验证（13/13 通过）。

# 修改记录 — 定级备案管理系统（安全加固：强制改密策略与布尔参数解析）

> **修订记录**
>
> - v1.2.23: 后端强制执行“需改密”策略（仅放行改密/登出/查看自身信息），并修复 `require_password_change` 字符串输入被误判为 `True` 的问题，补充对应回归测试。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 强制改密策略与布尔解析

- **修改位置**：`security_middleware`、`require_roles`、`create_user`。
- **修改内容**：
  - 新增 `parse_optional_bool`，显式解析 `true/false`、`1/0`，非法值返回 400；
  - 新增 `_is_password_change_exempt` 并在鉴权链路启用：
    - `must_change_password=true` 时，仅允许访问 `/api/auth/change-password`、`/api/auth/logout`、`/api/auth/me`；
    - 其余受保护接口返回 403，避免“临时密码长期可用”。

### tests/test_api.py — 安全回归与兼容调整

- **修改位置**：新增 `test_12`、`test_13`，调整 `test_10`。
- **修改内容**：
  - `test_12_must_change_password_is_enforced_server_side`：验证“需改密”账号被后端拦截、改密后恢复访问；
  - `test_13_require_password_change_explicit_bool_parse`：验证 `"false"` 被正确解析为 `False`，非法值返回 400；
  - `test_10_permission_boundaries`：显式传入 `require_password_change=False`，保持其原始“权限边界”测试意图。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.23 记录。
- **修改内容**：记录本次安全修复与测试结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_12_must_change_password_is_enforced_server_side -v`
- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_13_require_password_change_explicit_bool_parse -v`
- 全量回归：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（权限修复：改密会话失效与重置按钮参数编码）

> **修订记录**
>
> - v1.2.22: 修复改密后旧 token 仍可使用的问题；修复用户管理页重置密码按钮参数编码不完整导致的脚本异常风险，并补充回归测试。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 改密后会话立即失效

- **修改位置**：`/api/auth/change-password`。
- **修改内容**：改密成功后删除该用户全部 `AuthSession`，确保旧 token 立即失效，避免未授权会话继续使用。

### app/templates/login.html — 重置按钮参数安全编码

- **修改位置**：`loadUsers`、`resetPassword`。
- **修改内容**：
  - 新增 `encodeUserArg`，对用户名进行 URL 编码后再传入事件参数，避免反斜杠/换行等字符破坏内联脚本；
  - `resetPassword` 内部解码用户名后用于提示；
  - 补充 `escapeHtml`，避免用户列表展示字段直接插入 HTML。

### tests/test_api.py — 安全回归测试

- **修改位置**：新增 `test_11_change_password_revokes_old_sessions`。
- **修改内容**：验证用户改密后旧 token 访问 `/api/auth/me` 返回 401，且旧密码不可登录、新密码可登录。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.22 记录。
- **修改内容**：记录本次安全修复及测试结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/login.html |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 单测（新增用例）：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_11_change_password_revokes_old_sessions -v`
- 全量回归：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（目录整理与干净环境验证）

> **修订记录**
>
> - v1.2.21: 清理项目可再生产物（缓存、测试残留、自动生成 Word），补充虚拟环境忽略规则，并在全新虚拟环境完成依赖安装与运行验证。

## 新增文件 (如有)

无

---

## 修改文件

### .gitignore — 虚拟环境忽略补充

- **修改位置**：`Python 虚拟环境` 段落。
- **修改内容**：新增 `.venv_clean/`，避免干净验证环境目录污染工作区变更。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.21 记录。
- **修改内容**：记录本次目录整理与环境验证结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | .gitignore |
| **修改** | CHANGES.md |
| **删除** | tests/runtime/manual.db-journal |
| **删除** | tests/runtime/test_1771997075345.db-journal |
| **删除** | tests/runtime/test_1771997123382.db-journal |

---

## 测试方式

- 依赖一致性检查：`.\.venv_clean\Scripts\python.exe -m pip check`
- 单元/集成测试：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 启动冒烟：`.\.venv_clean\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8011`（启动成功后主动停止）

# 修改记录 — 定级备案管理系统（提权执行规则补充）

> **修订记录**
>
> - v1.2.20: 在仓库贡献规范中补充“pip/删除操作需用户确认后提权”的执行约定，统一后续协作行为。

## 新增文件 (如有)

无

---

## 修改文件

### AGENTS.md — 沙箱提权规则补充

- **修改位置**：新增 `Sandbox Escalation Rules` 章节。
- **修改内容**：
  - 明确 `pip` 与删除操作在用户确认后才请求提权；
  - 规定 pip 前置环境信息输出与安装参数；
  - 规定删除仅限用户批准路径，且默认不删精简版文件。

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.20 记录。
- **修改内容**：记录本次提权规则落地。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | AGENTS.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：文档检查（`AGENTS.md`、`CHANGES.md`）
- 结果：规则描述与现有协作流程一致，无代码行为变更

# 修改记录 — 定级备案管理系统（兼容优先的依赖策略修正）

> **修订记录**
>
> - v1.2.19: 调整启动策略为默认兼容运行（可回退），并保留可选严格模式，避免“锁死”影响协作与部署。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 默认兼容 + 可选严格

- **修改位置**：Python 版本校验与依赖文件选择逻辑。
- **修改内容**：
  - 默认不强制 Python 3.12，仅提示推荐版本；
  - 默认优先 `requirements.lock.txt`，缺失时回退 `requirements.txt`；
  - 新增可选严格开关：
    - `STRICT_PY312=1`：强制 Python 3.12.x
    - `STRICT_DEP_LOCK=1`：强制存在 `requirements.lock.txt`

### start_lite.bat — 与完整版一致的兼容策略

- **修改位置**：Python 版本校验与依赖文件选择逻辑。
- **修改内容**：
  - 同步默认兼容策略与可选严格开关；
  - 保留安装失败即退出保护，避免异常状态继续启动。

### README.md — 启动与部署说明修正

- **修改位置**：快速启动与手动启动章节。
- **修改内容**：
  - 将“强制锁定”描述改为“优先 lock、可回退 requirements”；
  - 新增严格模式环境变量说明（按需启用）。

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.19 记录。
- **修改内容**：说明本次从“强制策略”回调为“兼容优先策略”。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | README.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：待本次变更后复测

# 修改记录 — 定级备案管理系统（依赖锁定策略整合）

> **修订记录**
>
> - v1.2.18: 启动脚本改为强制 `requirements.lock.txt` + Python 3.12，阻断依赖与解释器版本漂移。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 完整版启动依赖策略收敛

- **修改位置**：Python 检测、依赖文件选择逻辑。
- **修改内容**：
  - 不再回退 `requirements.txt`，强制要求 `requirements.lock.txt` 存在。
  - 新增 Python 主次版本校验，仅允许 `3.12.x`。
  - 缺失锁文件或版本不匹配时直接退出，避免“本机可用、他机失败”。

### start_lite.bat — 精简版启动依赖策略收敛

- **修改位置**：Python 检测、依赖文件选择逻辑、安装失败处理。
- **修改内容**：
  - 与完整版一致，强制 `requirements.lock.txt` 与 Python `3.12.x`。
  - 依赖安装失败时立即退出，避免带病启动。
  - 保留精简版入口与行为，不删除任何精简版文件。

### README.md — 部署一致性说明补充

- **修改位置**：快速启动、手动启动命令说明。
- **修改内容**：
  - 明确一键启动按锁定依赖安装且校验 Python 3.12。
  - 手动安装命令改为 `requirements.lock.txt`（含超时/重试参数）。
  - 新增“依赖一致性说明”，要求随代码分发锁文件。

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.18 记录。
- **修改内容**：记录依赖锁定策略整合与验证结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | README.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：`Ran 10 tests in 6.909s, OK`（有 FastAPI `on_event` 弃用告警，不影响结果）

# 修改记录 — 定级备案管理系统（无用产物清理）

> **修订记录**
>
> - v1.2.17: 清理临时环境与缓存目录，清空导出产物目录，保留精简版启动与说明文件。

## 新增文件 (如有)

无

---

## 修改文件

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.17 记录。
- **修改内容**：记录本次无用文件清理范围与结果。

### 文件系统（运行产物）— 目录清理

- **修改位置**：项目根目录及导出目录。
- **修改内容**：
  - 删除：`.venv_fresh/`
  - 删除：`.tmp/`
  - 删除：`.pytest_cache/`
  - 清空：`exports/`（保留目录结构）
  - 保留确认：`start_lite.bat`、`README_LITE.md`

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | CHANGES.md |
| **删除** | .venv_fresh/ |
| **删除** | .tmp/ |
| **删除** | .pytest_cache/ |
| **清空** | exports/ |

---

## 测试方式

- 执行：目录存在性检查（`Test-Path`）
- 结果：`.venv_fresh/.tmp/.pytest_cache` 均为 `False`，`exports` 为 `True` 且文件数 `0`
- 执行：`git status --short`
- 结果：未出现精简版文件删除（`start_lite.bat`、`README_LITE.md` 仍在）

# 修改记录 — 定级备案管理系统（贡献指南补充）

> **修订记录**
>
> - v1.2.16: 新增仓库贡献指南 `AGENTS.md`，统一项目结构、开发命令、测试与提交流程说明。

## 新增文件 (如有)

### AGENTS.md — 贡献者指南

- **功能**：为协作者提供统一的仓库约定与快速上手入口。
- **实现原理**：基于现有目录、脚本与测试命令抽取可执行规范，避免泛化说明。
- **结构/映射**：覆盖项目结构、构建/运行命令、编码规范、测试规范、提交/PR 规范与安全配置提示。

---

## 修改文件

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.16 记录。
- **修改内容**：补充本次 `AGENTS.md` 新增及验证结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | AGENTS.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：PowerShell 词数统计（`AGENTS.md`）
- 结果：`301`（满足 200-400 词要求）
- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：`Ran 10 tests in 8.986s, OK`（存在 FastAPI `on_event` 弃用告警，不影响通过）

# 修改记录 — 定级备案管理系统（测试目录恢复与忽略规则确认）

> **修订记录**
>
> - v1.2.15: 恢复误删的 `tests` 目录文件，并确认 `.gitignore` 已覆盖测试产物忽略规则。

## 新增文件 (如有)

无

---

## 修改文件

### tests/test_api.py — 测试脚本恢复

- **修改位置**：从版本库恢复文件内容。
- **修改内容**：恢复接口集成测试用例文件，继续作为回归保障。

### tests/runtime/*.db-journal — 测试运行产物恢复

- **修改位置**：从版本库恢复已跟踪的 journal 文件。
- **修改内容**：恢复如下已跟踪文件：
  - `tests/runtime/manual.db-journal`
  - `tests/runtime/test_1771997075345.db-journal`
  - `tests/runtime/test_1771997123382.db-journal`

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.15 记录。
- **修改内容**：记录测试目录恢复与忽略规则验证结论。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | tests/test_api.py |
| **修改** | tests/runtime/manual.db-journal |
| **修改** | tests/runtime/test_1771997075345.db-journal |
| **修改** | tests/runtime/test_1771997123382.db-journal |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`E:\vscode\Programs\Work\Program1\.venv_fresh\Scripts\python.exe -m pytest -q`
- 结果：`10 passed, 4 warnings`
- 忽略规则校验：`git check-ignore -v --no-index` 验证 `*.db-journal`、`__pycache__/`、`.pytest_cache/` 均命中 `.gitignore` 规则。

# 修改记录 — 定级备案管理系统（依赖兼容锁定）

> **修订记录**
>
> - v1.2.14: 新增完整依赖锁定清单并调整启动脚本优先安装锁定版本，降低新机器安装漂移导致的不兼容风险。

## 新增文件 (如有)

### requirements.lock.txt — 完整依赖锁定清单

- **功能**：固定主依赖及传递依赖版本，保证不同机器安装结果一致。
- **实现原理**：基于已验证可用环境导出 `pip freeze`，安装时优先读取该文件。
- **结构/映射**：纯 `package==version` 列表，覆盖 FastAPI、Uvicorn、SQLAlchemy 及其传递依赖。

---

## 修改文件

### start.bat — 依赖安装策略加固

- **修改位置**：依赖文件选择、安装命令、环境信息输出。
- **修改内容**：
  - 新增 `DEP_FILE` 逻辑，优先 `requirements.lock.txt`，不存在时回退 `requirements.txt`；
  - 依赖安装改为显式参数：`-i https://pypi.org/simple --timeout 20 --retries 1`；
  - 安装前打印 Python 版本、pip 版本、解释器路径，便于定位环境差异。

### start_lite.bat — 依赖安装策略加固

- **修改位置**：Python 检测、依赖文件选择、安装命令。
- **修改内容**：
  - 新增 Python 可用性检测与版本/路径输出；
  - 新增 `DEP_FILE` 逻辑并优先锁定依赖文件；
  - 安装命令改为显式索引/超时/重试参数。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | requirements.lock.txt |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`E:\vscode\Programs\Work\Program1\.venv_fresh\Scripts\python.exe -m pytest -q`
- 结果：`10 passed, 4 warnings`

# 修改记录 — 定级备案管理系统（启动脚本可用性验证）

> **修订记录**
>
> - v1.2.13: 实机运行 `start.bat`，确认启动链路可用并可正常响应页面请求。

## 新增文件 (如有)

无

---

## 修改文件

### CHANGES.md — 启动脚本验证记录补充

- **修改位置**：文件顶部新增 v1.2.13 记录。
- **修改内容**：
  - 在项目目录实际执行 `start.bat`；
  - 通过 `http://127.0.0.1:8011/login` 连通性检查验证服务已启动；
  - 验证后主动停止进程，避免端口占用。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：在 `E:\vscode\Programs\Work\Program1` 运行 `start.bat`
- 检查：访问 `http://127.0.0.1:8011/login`
- 结果：脚本启动成功，HTTP 可达

# 修改记录 — 定级备案管理系统（全新虚拟环境重装验证）

> **修订记录**
>
> - v1.2.12: 在全新 `.venv_fresh` 环境完成依赖逐包安装与测试执行，确认从零安装可用。

## 新增文件 (如有)

无

---

## 修改文件

### CHANGES.md — 安装验证记录补充

- **修改位置**：文件顶部新增 v1.2.12 记录。
- **修改内容**：
  - 记录全新虚拟环境路径：`E:\vscode\Programs\Work\Program1\.venv_fresh`；
  - 记录依赖安装策略：逐包安装、`-i https://pypi.org/simple --timeout 20 --retries 1`；
  - 记录验证结果：`pip check` 无冲突、`pytest` 全通过。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`E:\vscode\Programs\Work\Program1\.venv_fresh\Scripts\python.exe -m pip check`
- 结果：`No broken requirements found.`
- 执行：`E:\vscode\Programs\Work\Program1\.venv_fresh\Scripts\python.exe -m pytest -q`
- 结果：`10 passed, 4 warnings`

# 修改记录 — 定级备案管理系统（登录页与账号策略调整）

> **修订记录**
>
> - v1.2.11: 移除登录页测试账号暴露与一键填充；新增“用户首次改密、管理员重置密码”能力，支持管理员统一分发账号。

## 新增文件 (如有)

无

---

## 修改文件

### app/templates/login.html — 登录与账号管理交互重构

- **修改位置**：登录面板、管理员用户管理面板、前端脚本。
- **修改内容**：
  - 移除内置测试账号文案与一键填充按钮。
  - 登录输入框改为空白，不再预填账号密码。
  - 新增“当前用户修改密码”面板。
  - 管理员用户管理新增“首次改密”选项与“重置密码”操作按钮。

### app/models.py — 用户字段扩展

- **修改位置**：`UserAccount` 模型。
- **修改内容**：新增 `must_change_password`、`password_updated_at` 字段，用于记录首次改密状态与密码更新时间。

### app/main.py — 账号策略后端实现

- **修改位置**：启动初始化、认证接口、用户管理接口。
- **修改内容**：
  - 启动时自动补齐 `user_accounts` 缺失字段（兼容已有数据库）。
  - 登录返回 `must_change_password` 状态。
  - 新增 `POST /api/auth/change-password`（用户自行改密）。
  - 新增 `POST /api/auth/users/{user_id}/reset-password`（管理员重置密码）。
  - 管理员创建账号支持 `require_password_change`，用于控制首次登录改密标记。

### tests/test_api.py — 账号策略测试补充

- **修改位置**：`test_10_permission_boundaries`。
- **修改内容**：
  - 新增“首次登录需改密”状态验证；
  - 新增用户改密后旧密码失效、新密码可登录验证；
  - 新增管理员重置密码后再次标记“需改密”验证。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/templates/login.html |
| **修改** | app/models.py |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：`10/10 OK`

# 修改记录 — 定级备案管理系统（用户操作手册）

> **修订记录**
>
> - v1.2.10: 新增可直接交给测试人员使用的用户操作手册，补充角色化流程与现场常见问题处理指引。

## 新增文件 (如有)

### USER_GUIDE.md — 用户操作手册

- **功能**：为测试人员、业务人员提供可执行的操作步骤。
- **实现原理**：按角色拆分工作流（测评师/审核人/管理员），并补充标准业务闭环与故障排查。
- **结构/映射**：覆盖“快速开始 -> 角色操作 -> 模板操作 -> 看板知识库 -> 常见问题 -> 检查清单”。

---

## 修改文件

### README.md — 手册入口补充

- **修改位置**：文档开头说明区。
- **修改内容**：新增“用户操作手册”链接，便于测试人员打开即用。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | USER_GUIDE.md |
| **修改** | README.md |

---

## 测试方式

- 启动系统后按 `USER_GUIDE.md` 第 3 节“标准业务闭环”逐步执行。
- 验证不同角色登录后菜单可见范围与操作权限符合手册描述。

# 修改记录 — 定级备案管理系统（鉴权回归修复与权限边界加固）

> **修订记录**
>
> - v1.2.9: 修复启用全局鉴权后的前端请求断点；补强客户采集与报告审核权限边界，消除可用性与越权风险。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 组织采集与报告审核接口权限加固

- **修改位置**：组织采集链接、客户提交审核、报告提交/审核/签章/章节顺序调整接口。
- **修改内容**：
  - 组织采集链接创建/查询/启停、客户提交列表/审核改为登录角色校验。
  - 报告审核接口限制为 `admin/reviewer`，防止普通测评角色直接审核通过。
  - 报告提交、签章、章节顺序调整接口补充登录身份校验并规范写入操作者。

### app/templates/*.html — 启用鉴权后的前端断点修复

- **修改位置**：`organizations.html`、`systems.html`、`workflow.html`、`knowledge.html`、`templates.html`。
- **修改内容**：
  - 修复未携带登录令牌的 API 调用，统一补齐 `authHeaders()`。
  - 模板下载链接增加令牌透传，避免开启鉴权后下载失败。
  - 流程实例展示修正负责人字段显示（`current_owner`）。

### tests/test_api.py — 权限边界回归测试新增

- **修改位置**：新增 `test_10_permission_boundaries`。
- **修改内容**：
  - 验证未登录访问采集链接列表返回 401；
  - 验证 evaluator 角色无法执行报告审核（403）；
  - 验证 evaluator 登录后可访问其允许范围接口。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/organizations.html |
| **修改** | app/templates/systems.html |
| **修改** | app/templates/workflow.html |
| **修改** | app/templates/knowledge.html |
| **修改** | app/templates/templates.html |
| **修改** | tests/test_api.py |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：`10/10 OK`

# 修改记录 — 定级备案管理系统（安全加固）

> **修订记录**
>
> - v1.2.8: 完成 API 文档与接口访问加固，补充登录防暴力破解、密码哈希升级、基础 XSS 防护与安全响应头。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 后端安全能力增强

- **修改位置**：鉴权、登录、全局中间件、输入校验。
- **修改内容**：
  - 增加 API 全局登录校验中间件（`API_AUTH_REQUIRED`，完整版默认开启）。
  - 增加安全响应头（`CSP`、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy` 等）。
  - 增加可选 HTTPS 强制访问开关（`FORCE_HTTPS`）。
  - 登录接口增加失败次数限制与临时锁定，缓解暴力破解。
  - 密码哈希从单次 `sha256` 升级为 `PBKDF2-SHA256+salt`，兼容旧哈希并在成功登录后自动迁移。
  - 新增文本/嵌套 payload 安全校验，拦截含脚本特征输入，降低存储型 XSS 风险。

### app/templates/index.html — 看板鉴权与输出转义

- **修改位置**：看板接口请求、下钻列表渲染、导出链接。
- **修改内容**：
  - 看板请求统一携带登录令牌。
  - 下钻表格动态内容做 HTML 转义。
  - 导出 Excel/PDF 时自动带令牌参数，避免开启全局鉴权后导出失败。

### app/templates/reports.html — 报告页鉴权与输出转义

- **修改位置**：报告列表与操作请求脚本。
- **修改内容**：
  - 生成、审核、章节管理、对比等接口统一携带令牌。
  - 报告列表动态字段转义，降低前端注入风险。
  - Word/PDF 导出链接自动附带令牌参数，兼容全局鉴权。

### start.bat / start_lite.bat — 启动参数安全默认值

- **修改位置**：环境变量初始化区。
- **修改内容**：
  - 完整版默认 `API_AUTH_REQUIRED=1`。
  - 精简交付启动脚本显式设置 `API_AUTH_REQUIRED=0`。

### README.md / README_LITE.md — 安全配置说明补充

- **修改位置**：启动与环境变量说明章节。
- **修改内容**：补充 `API_AUTH_REQUIRED`、`FORCE_HTTPS`、登录防暴力破解参数说明。

### tests/test_api.py — 测试环境参数兼容

- **修改位置**：`setUpClass`。
- **修改内容**：测试启动时显式设置 `API_AUTH_REQUIRED=0`，避免影响现有功能回归测试。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/index.html |
| **修改** | app/templates/reports.html |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | README.md |
| **修改** | README_LITE.md |
| **修改** | tests/test_api.py |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 重点验证：
  - 未登录访问受保护 API 返回 401；
  - 登录失败连续触发后返回 429；
  - 登录成功后旧密码哈希可自动迁移；
  - 看板/报告页在登录态下请求与导出正常。

# 修改记录 — 定级备案管理系统（默认端口调整）

> **修订记录**
>
> - v1.2.7: 默认运行端口由 8000 调整为 8011，避免与既有项目端口冲突；启动脚本支持 `APP_PORT` 自定义覆盖。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 端口可配置化

- **修改位置**：启动参数与环境变量初始化区。
- **修改内容**：新增 `APP_PORT` 默认值 `8011`；新增 `PUBLIC_BASE_URL` 联动；`uvicorn` 与访问提示改为使用 `%APP_PORT%`。

### start_lite.bat — 端口可配置化

- **修改位置**：启动参数区。
- **修改内容**：新增 `APP_PORT` 默认值 `8011`；新增 `PUBLIC_BASE_URL` 联动；启动提示与 `uvicorn` 端口改为 `%APP_PORT%`。

### app/main.py — 服务基础地址默认值调整

- **修改位置**：`PUBLIC_BASE_URL` 常量。
- **修改内容**：默认值由 `http://127.0.0.1:8000` 调整为 `http://127.0.0.1:8011`，与启动脚本默认端口保持一致。

### README.md — 启动与访问地址更新

- **修改位置**：快速启动、手动启动、页面入口章节。
- **修改内容**：所有示例地址与命令端口改为 `8011`，并补充 `APP_PORT` 可覆盖说明。

### README_LITE.md — 手动启动示例更新

- **修改位置**：手动启动命令块。
- **修改内容**：新增 `set APP_PORT=8011`，并将启动命令端口改为 `%APP_PORT%`。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | app/main.py |
| **修改** | README.md |
| **修改** | README_LITE.md |

---

## 测试方式

- 启动：双击 `start.bat`，确认控制台显示 `http://127.0.0.1:8011`。
- 访问：打开 `http://127.0.0.1:8011/` 与 `http://127.0.0.1:8011/login`。
- 可选覆盖：执行 `set APP_PORT=8020` 后再启动，确认服务监听与访问地址切换为 8020。

# 修改记录 — 定级备案管理系统（登录与角色可见性优化）

> **修订记录**
>
> - v1.2.4: 修复非管理员登录后误报失败；增加管理员与普通用户界面可见性区分；补充内置账号一键填充。

## 新增文件 (如有)

无

---

## 修改文件

### app/templates/base.html — 导航与角色可见性控制

- **修改位置**：侧边栏导航与页面底部角色脚本。
- **修改内容**：新增 `data-role-only` 控制（如模板管理仅管理员可见、流程管控仅管理员/审核员可见）；新增 `applyRoleUI()` 并在 `/api/auth/me` 返回后统一刷新角色可见区域。

### app/templates/login.html — 登录流程与管理员面板修复

- **修改位置**：登录脚本与用户管理面板。
- **修改内容**：
  - 非管理员登录后不再自动调用用户列表接口，避免“登录成功后被403覆盖成失败提示”。
  - 用户管理区改为仅管理员可见（`data-role-only="admin"`）。
  - 新增内置账号提示与一键填充按钮（`admin/tester/leader`），降低切换账号时密码填错概率。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/templates/base.html |
| **修改** | app/templates/login.html |

---

## 测试方式

- 启动系统后访问登录页，分别使用以下账号登录验证：
  - `admin/admin123`：应显示用户管理面板，并可加载用户列表；
  - `tester/tester123`、`leader/leader123`：应登录成功，不应出现“读取用户失败”覆盖登录成功提示。
- 观察侧边栏可见性：
  - admin 可见模板管理与流程管控；
  - evaluator/reviewer 根据角色显示受限菜单。

# 修改记录 — 定级备案管理系统（API 文档访问加固）

> **修订记录**
>
> - v1.2.5: API 文档改为管理员令牌访问控制，避免未登录访问导致文档暴露。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 文档路由鉴权改造

- **修改位置**：FastAPI 初始化与文档路由定义。
- **修改内容**：
  - 关闭 FastAPI 默认公开文档路由（`docs_url/redoc_url/openapi_url`）。
  - 新增受保护的 `/docs`、`/redoc`、`/openapi.json` 路由：仅管理员且令牌有效时可访问。
  - 文档页面通过 `token` 参数加载受保护的 OpenAPI 数据，防止未授权读取。

### app/templates/base.html — 文档入口令牌透传

- **修改位置**：侧边栏 API 文档入口与全局脚本。
- **修改内容**：
  - API 文档入口改为脚本打开，自动从 `localStorage` 读取当前登录令牌并拼接到文档地址。
  - 未登录打开文档将返回受控错误，不再直接暴露接口定义。

### README.md — 安全说明补充

- **修改位置**：文档开关说明章节。
- **修改内容**：补充“开启 API 文档后仅管理员+有效令牌可访问”的安全约束说明。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/base.html |
| **修改** | README.md |

---

## 测试方式

- `ENABLE_API_DOCS=1` 启动后：
  - 未登录访问 `/docs` 应返回 401；
  - 普通账号访问 `/docs` 应返回 403；
  - 管理员登录后从页面“API文档”入口打开，Swagger 应可正常展示。

# CHANGES

# 修改记录 — 定级备案管理系统（本地官方模板接入）

> **修订记录**
>
> - v1.2.6: 支持 01/02/03 本地 docx 模板一键导入、脱敏入库并设为默认模板；Word 导出优先按模板字段回填。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 本地模板导入与模板导出接入

- **修改位置**：模板管理接口区、报告导出区。
- **修改内容**：
  - 新增 `/api/templates/import-local-official`：按 `01-*.docx / 02-*.docx / 03-*.docx` 自动导入模板并设置默认。
  - 导入时调用脱敏处理，去除模板中的测试样例值。
  - `export/word` 优先使用报告绑定模板进行字段回填；模板不可用时自动回退到原有通用导出逻辑。

### app/services/reporting.py — 模板脱敏与字段回填能力

- **修改位置**：报告导出服务函数。
- **修改内容**：
  - 新增 `sanitize_template_docx_content()`，对单位名称、系统名称、手机号、邮箱、信用代码、URL 等样例信息做替换脱敏。
  - 新增 `export_report_docx_with_template()`，支持 `{{字段}}` 与 `【字段】` 占位替换及表格按标签回填。

### app/templates/templates.html — 模板页面入口增强

- **修改位置**：模板上传面板脚本区。
- **修改内容**：新增“导入本地官方模板”按钮及前端调用逻辑，导入后自动刷新模板列表并回显结果。

### tests/test_api.py — 回归测试补充

- **修改位置**：`test_07_auth_and_template_flow`。
- **修改内容**：新增临时构造 `01/02/03` docx 并调用本地官方模板导入接口的验证，确保导入能力可用。

### README.md — 模板导入使用说明

- **修改位置**：功能覆盖与操作说明章节。
- **修改内容**：增加“官方模板导入（可选）”步骤和命名规范说明。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/services/reporting.py |
| **修改** | app/templates/templates.html |
| **修改** | tests/test_api.py |
| **修改** | README.md |

---

## 测试方式

- 运行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 重点验证：
  - 本地官方模板导入接口返回成功且导入条目完整；
  - 报告生成/导出主流程无回归。

## [1.2.3]

### 单位录入校验与需求对齐

- 对齐 `需求.docx`（基础信息管理模块 1.1 第5条）：
  - 统一社会信用代码恢复严格格式校验（18位大写字母或数字）。
  - 移动电话恢复严格格式校验（11位中国大陆手机号）。
  - 邮箱恢复严格格式校验（标准邮箱格式）。
- 新增后端必填空值拦截：单位名称、统一社会信用代码、单位负责人、单位地址、移动电话、邮箱、所属行业、单位类型、备案地区为空时禁止提交。
- 保留“单位名称不可为 `/`”规则；其他文本字段可按业务需要使用 `/` 占位（不影响上述三类格式字段校验）。
- 前端录入页与客户采集页同步收紧：
  - 明确必填与格式规则提示；
  - 增加提交前即时校验，减少无效请求。
- 测试更新：
  - 单位名称为 `/` 返回 400；
  - 统一社会信用代码/手机号/邮箱为 `/` 返回 400；
  - 其他文本字段使用 `/` 且三类格式字段合法时可提交。

## [1.2.2]

### 单位信息占位策略细化

- 调整为“按字段分级约束”：
  - `单位名称` 继续强约束，禁止填写 `/` 占位，必须录入真实内容。
  - 其他文本必填项保留 `/` 占位能力，降低录入阻塞。
- `统一社会信用代码` 填写 `/` 时，后端自动生成唯一占位编码，避免唯一约束冲突导致保存失败。
- 单位录入页与客户采集页新增前端即时提示与拦截：单位名称为 `/` 时直接提示，不再发起请求。
- 自动化测试新增覆盖：
  - 单位名称为 `/` 时应返回 400；
  - 多次以 `/` 占位提交其他必填项时可正常保存。

## [1.2.1]

### 单位信息录入容错优化

- 放宽单位信息字段校验：`办公电话` 与 `邮箱` 均支持录入 `/` 作为“暂无”占位值。
- 保持原有合法格式校验不变：电话/邮箱在非 `/` 场景下仍按原规则校验。
- 单位录入页与客户采集页增加输入提示，明确“无可填 /”。
- 新增自动化测试覆盖：创建单位时 `office_phone='/'`、`email='/'` 应可成功入库。
## [1.2.0]

### 后端功能补全

- 新增账号与角色能力（admin/reviewer/evaluator）及会话登录机制。
- 新增模板管理能力：上传、列表、编辑、版本、恢复、默认模板、测试填充。
- 报告生成支持按 `report_type + city + level` 自动匹配模板，支持手动指定模板。
- 报告新增签章信息保存与导出注入。
- 新增报告版本差异对比接口：`GET /api/reports/{report_id}/compare/{target_id}`。
- 新增单位/系统删除申请审批流：申请、查询、管理员审核通过/驳回。
- 删除失败提示增强：返回具体阻塞原因（关联系统/关联报告等）。
- 回收站能力增强：单位/系统回收站列表与过期清理。
- 附件能力增强：批量上传、在线预览、下载。
- 流程提醒增强：支持站内消息、邮件、双通道。
- 知识库检索增强：支持模糊/精确检索（`match_mode=fuzzy|exact`）。

### 报告导出与格式优化

- 报告导出内容自动生成目录段。
- Word 导出增加默认字体、字号、行距控制。
- Word/PDF 导出增加页码展示。
- PDF 继续支持可选密码加密。

### 前端体验优化

- 流程管控页面由 JSON 调试回显改为可读状态提示与错误提示。
- 看板按钮区布局优化为横向显示（小屏自动换行）。
- 登录、模板、单位、系统、报告、流程、知识库、客户采集等页面移除面向用户的 JSON 只读框，统一改为可读反馈文案。

### 权限与显示范围

- 看板在 evaluator 角色下仅展示本人权限范围数据。
- 知识库下载与批量下载要求登录后访问。

### 测试与版本

- 应用版本升级为 `1.2.0`。
- 自动化测试更新并通过：
  - `python -m unittest discover -s tests -p "test_*.py" -v`
  - 结果：`9/9 OK`

## [1.0.0]

- 初版实现单位、系统、报告、流程、看板、知识库等模块。
- 提供基础字段校验、导入导出、历史追溯与回收站机制。
