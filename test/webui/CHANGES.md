# 修改记录 — CodeAudit WebUI

> **修订记录**
>
> - v1.4: 同模型并发审计、可配置分批大小/并发数、审计进度条、代码分析展示界面
> - v1.3: 修复清除后重新上传卡住、后台线程 PendingRollbackError，新增全选/全不选
> - v1.2: 分批审计、国标集成、Word/Excel 导出、大文件支持
> - v1.1: UI 美化（Obsidian 配色）、独立导出模块、压缩包/批量文件上传、Bug 修复
> - v1.0: 初始版本，实现代码安全审计 WebUI 核心功能

## v1.4 变更

### 新增文件

### `templates/analysis.html` — 代码分析展示界面

- **功能**：类似专业代码审计工具的三面板交互视图
- **布局**：左侧文件树 + 右上漏洞表格 + 右中代码查看器（行号+高亮）+ 右下漏洞详情
- **交互**：点击文件→显示代码，点击漏洞→定位文件和行号并高亮，支持代码搜索
- **入口**：审计完成后报告页右上角「分析视图」按钮

### 修改文件

### `llm.py` — 同模型并发审计

- **并发处理**：使用 `ThreadPoolExecutor` 并发发送分批请求，多批同时审计
- **可配置 chunk_size**：`audit_code()` 新增 `chunk_size` 参数，默认从 100KB 提升到 300KB
- **可配置 max_workers**：`LLMClient.__init__` 新增 `max_workers` 参数，默认 3 路并发
- **有序结果**：使用 `partial_results[idx]` 确保批次顺序与原始代码一致

### `app.py` — 新路由 + 并发配置 + 进度 API 增强

- **新增路由**：`/audit/<id>/analysis` 渲染分析页面，`/api/audit/<id>/analysis` 返回结构化文件+漏洞数据
- **新增 import**：`parse_vulnerabilities` 从 export.py 导入
- **`build_client()`**：从设置读取 `max_workers` 传入 LLMClient
- **`_run_audit()`**：从设置读取 `chunk_size` 传入 `audit_code()`，进度文案更新为"已完成 X/Y 批（N 路并发）"
- **`audit_status` API**：新增 `progress_current` 和 `progress_total` 字段，支持前端进度条
- **`settings_page()`**：传入 `chunk_size` 和 `max_workers` 到模板
- **`save_settings()`**：保存范围新增 `chunk_size` 和 `max_workers`

### `templates/settings.html` — 审计性能配置

- **新增区域**：「审计性能」分隔区，包含分批大小 (KB) 和并发数两个字段
- **推荐提示**：128K 模型建议 300KB，200K 模型可填 500KB；并发 2-5
- **`getFormData()`**：包含新增的 `chunk_size` 和 `max_workers` 字段

### `templates/report.html` — 进度条 + 分析视图入口

- **进度条**：审计中状态新增 CSS 进度条，显示已完成批次/总批次
- **分析按钮**：审计完成后 report-meta 区域新增「分析视图」链接按钮

### `static/css/style.css` — 进度条样式

- **新增**：`.progress-bar-wrap`、`.progress-bar-track`、`.progress-bar-fill`、`.progress-bar-label` 组件

---

## v1.4 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `templates/analysis.html` |
| **修改** | `llm.py` |
| **修改** | `app.py` |
| **修改** | `templates/settings.html` |
| **修改** | `templates/report.html` |
| **修改** | `static/css/style.css` |

---

## v1.4 测试方式

1. 启动应用，进入「设置」→ 确认新增「审计性能」区域，可配置分批大小和并发数
2. 新建审计 → 上传较大的 .zip → 提交后观察进度条是否正常显示（已完成 X/Y 批）
3. 审计完成后，报告页右上角应出现「分析视图」按钮
4. 点击「分析视图」→ 确认左侧文件树正常渲染（可折叠目录）
5. 点击文件 → 确认代码查看器显示内容和行号
6. 点击漏洞表中某行 → 确认自动跳转到对应文件和行号（高亮）+ 详情面板显示完整信息
7. 在代码搜索框输入关键词 → 确认匹配行高亮并自动滚动

---

## v1.3 变更

### 修改文件

### `app.py` — 修复 _run_audit 线程 PendingRollbackError

- **修改位置**：`_run_audit()` 函数（约164行）
- **修改内容**：
  - 进入时检查 audit 是否存在，不存在则直接 return
  - `on_progress` 回调中的 `commit` 加 try/except，失败时 rollback
  - `except` 块中先 `rollback` 再重新查询 audit 对象，避免操作已失效的实例
  - 最终 `commit` 也加 try/except 保护

### `templates/audit.html` — 修复清除后重新上传卡住 + 全选/全不选

- **清除 Bug 修复**：`clearBtn` 事件中增加 `fileInput.value = ''`，重置文件选择器状态
- **全选/全不选**：文件列表头部新增「全选」「全不选」按钮，点击后同步更新数据和 checkbox UI

---

## v1.3 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app.py` |
| **修改** | `templates/audit.html` |

---

## v1.3 测试方式

1. 启动应用，进入「新建审计」→「上传文件/压缩包」
2. 上传一个 .zip 文件 → 确认文件列表正常显示
3. 点击「清除」→ 再次上传同一个 .zip → 确认文件列表正常显示（不卡住）
4. 点击「全不选」→ 确认所有 checkbox 取消勾选，摘要显示 0 文件
5. 点击「全选」→ 确认所有 checkbox 恢复勾选
6. 提交一个审计任务，在审计运行中删除该记录，确认后台不报 PendingRollbackError

---

## v1.2 变更

### 新增文件

### `standards/` — 国标审计标准文件

- **功能**：GB/T 39412-2020 通用标准 + Java/C/C++/C# 语言专项标准的结构化文本
- **用途**：根据代码语言自动加载对应标准条款，嵌入 LLM 审计 prompt

### 修改文件

### `llm.py` — 分批审计 + 国标集成

- **分批审计**：代码超过 100KB 自动按文件边界拆分为多个批次，逐批审计后汇总
- **国标加载**：新增 `_load_standard()` 函数，根据语言加载 GB/T 39412-2020 条款分类
- **Prompt 升级**：审计结果要求包含标准条款编号（如"39412-A.1.4 SQL注入"）和漏洞分类
- **进度回调**：`audit_code()` 新增 `on_progress` 参数，支持实时进度反馈
- **超时调整**：单次 API 调用超时从 180s 提高到 300s

### `export.py` — Word/Excel 导出 + 漏洞解析器

- **新增 `parse_vulnerabilities()`**：从 LLM Markdown 输出中提取结构化漏洞列表
- **新增 `export_docx()`**：Word 格式报告，含封面、基本信息表、审计依据、漏洞详情（按严重程度分组）、安全建议
- **新增 `export_xlsx()`**：Excel 漏洞清单，含序号/漏洞名称/分类/风险等级/位置/描述/危害/修复建议，风险等级着色
- **JSON 增强**：导出数据中加入 `vulnerabilities` 结构化字段

### `app.py` — 新增导出路由 + 进度反馈

- **新增路由**：`/api/audit/<id>/export?format=docx` 和 `format=xlsx`
- **进度回调**：`_run_audit()` 传入 `on_progress` 回调，将分批进度写入 `audit.result` 字段
- **状态 API**：`/api/audit/<id>/status` 返回新增 `progress` 字段
- **LONGTEXT 迁移**：`code_content` 和 `result` 字段从 TEXT 升级为 LONGTEXT (4GB)
- **错误处理**：`create_audit` 路由增加 try/except + rollback，返回 JSON 错误而非 HTML
- **上传限制**：新增 `MAX_CONTENT_LENGTH = 16MB`

### `models.py` — LONGTEXT 列类型

- **修改位置**：`code_content` 和 `result` 列
- **修改内容**：`LongText = Text(length=2**32 - 1)`，解决大代码存储溢出问题

### `templates/report.html` — 进度显示 + 新导出按钮

- **分批进度**：审计中状态实时显示"正在审计第 X/Y 批..."
- **导出按钮**：新增 Word (.docx) 和 Excel (.xlsx) 导出卡片，Word 和 Excel 排在最前

### `templates/audit.html` — 错误处理 + 放宽限制

- **Fetch 修复**：非 JSON 响应不再报 "Unexpected token" 错误，改为友好提示
- **文件限制**：单文件上限从 50KB 提高到 500KB，总量警告从 80KB 提高到 2MB
- **警告文案**：更新为"将自动分批审计，批次越多耗时越长"

### `launch.py` — 新增依赖

- **新增依赖**：`python-docx` (Word 导出)、`openpyxl` (Excel 导出)
- **自动打开浏览器**：启动时延迟 1.5 秒自动打开默认浏览器

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `standards/GB∕T 39412-2020.txt` |
| **新增** | `standards/GB∕T 34944-2017 Java.txt` |
| **新增** | `standards/GB∕T 34943-2017 C-C++.txt` |
| **新增** | `standards/GB∕T 34946-2017 C#.txt` |
| **修改** | `llm.py` |
| **修改** | `export.py` |
| **修改** | `app.py` |
| **修改** | `models.py` |
| **修改** | `templates/report.html` |
| **修改** | `templates/audit.html` |
| **修改** | `launch.py` |

---

## 测试方式

1. 启动 MySQL，运行 `start.bat` 或 `python launch.py`
2. 浏览器应自动打开 `http://localhost:5000`
3. 新建审计 → 上传一个 .zip 压缩包 → 确认文件列表正常 → 提交审计
4. 审计报告页面：确认分批进度显示（如果代码量大）
5. 审计完成后测试 5 种导出格式：Word / Excel / HTML / Markdown / JSON
6. 验证 Word 报告含封面和漏洞详情，Excel 含漏洞清单和风险等级着色

## 新增文件

### `config.py` — 应用配置

- **功能**：集中管理 MySQL 连接参数和 Flask 配置
- **实现原理**：通过环境变量或默认值构建 SQLAlchemy 连接字符串

### `models.py` — 数据模型

- **功能**：定义 Audit（审计记录）和 Setting（键值配置）两张表
- **结构**：Audit 包含标题、代码内容、语言、模型、结果、状态、风险等级、时间戳

### `llm.py` — LLM API 客户端

- **功能**：统一封装 OpenAI 兼容接口和 Anthropic 原生接口的调用
- **实现原理**：根据 provider 切换请求格式，内置安全审计 prompt 模板

### `app.py` — Flask 主应用

- **功能**：页面路由 + API 路由，审计任务后台线程执行，报告导出（Markdown/HTML）
- **实现原理**：`threading.Thread` 异步执行 LLM 调用，前端轮询状态

### `templates/base.html` — 基础布局

- **功能**：左侧固定侧边栏 + 右侧主内容区的全局布局

### `templates/dashboard.html` — 审计记录列表

- **功能**：表格展示所有审计记录，支持按状态筛选，自动轮询进行中任务

### `templates/audit.html` — 新建审计

- **功能**：代码输入表单，支持粘贴和文件上传，Tab 键缩进

### `templates/settings.html` — 设置页

- **功能**：配置 API 提供商、密钥、地址、模型，支持测试连接

### `templates/report.html` — 审计报告

- **功能**：展示审计结果（Markdown 渲染 + 代码高亮），支持导出

### `static/css/style.css` — 全局样式

- **功能**：Void Space 暗色主题，CSS 变量管理所有 Design Token，三断点响应式

### `static/js/app.js` — 全局脚本

- **功能**：Toast 通知、删除确认、highlight.js 初始化

### `start.bat` — Windows 启动脚本

- **功能**：自动检测 Python、pip 依赖、MySQL 连接，一键启动

### `requirements.txt` — Python 依赖

- **功能**：列出所有 pip 依赖及版本

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `config.py` |
| **新增** | `models.py` |
| **新增** | `llm.py` |
| **新增** | `app.py` |
| **新增** | `templates/base.html` |
| **新增** | `templates/dashboard.html` |
| **新增** | `templates/audit.html` |
| **新增** | `templates/settings.html` |
| **新增** | `templates/report.html` |
| **新增** | `static/css/style.css` |
| **新增** | `static/js/app.js` |
| **新增** | `start.bat` |
| **新增** | `requirements.txt` |

---

## 测试方式

1. 确保 MySQL 服务已启动，`root/root` 可登录（或修改 `config.py` 中的连接参数）
2. 双击 `start.bat` 或执行 `python app.py`
3. 浏览器访问 `http://localhost:5000`
4. 进入「设置」页面，配置 API 密钥，点击「测试连接」确认连通
5. 进入「新建审计」，粘贴一段代码，点击「开始审计」
6. 等待审计完成后查看报告，测试 Markdown/HTML 导出
