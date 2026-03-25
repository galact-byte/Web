# 修改记录 — 项目完结单管理平台

> **修订记录**
>
> - v6.1: 优化 — 多系统合并分发 + 分发状态显示
> - v6.0: 新功能 — 系统进度汇报（按系统汇报阶段进度，一键同步，汇报历史）
> - v5.5: 对齐模板 — 备案情况选项修正、新增优先级和资料归档字段、移除审批时间
> - v5.4: 优化 — 工作量统计改用项目完结时间归属季度 + 项目列表加搜索 + 移除审批时间
> - v5.3: 优化 — 分发逻辑完善（编号去后缀、精细化判断可分发状态、默认显示列调整、编辑取消返回上一页）
> - v5.2: Bug修复 — 分发补全实施负责人和系统信息、去重编辑按钮、隐藏已完结分发
> - v5.1: 新功能 — 进度数据按经理过滤 + 快速分发到员工
> - v5.0: 新功能 — 项目进度模块（7 种项目类型数据爬取、查看、导出）
> - v4.1: Bug修复 — Word模板导出路径错误
> - v4.0: 流程优化 — 移除审批完成时间、创建项目自动分发、批量Word模板导出
> - v3.0: UI 重构 — 去除"AI 味"，对齐前端设计规范（Void Space 暗色主题）
> - v2.0: 代码审查修复 — 15 项安全/质量/性能问题修复
> - v1.9: 后端 API 修复 — 路由顺序修正、新增趋势API、导入大小限制、错误处理加固

## v6.1 — 多系统合并分发 + 分发状态显示

解决同一项目编号（去后缀后相同）的多条爬取记录无法分发的问题，改为追加系统到已有项目。进度表格新增分发状态标记。

### 修改文件

#### `backend/app/routers/progress.py` — 分发逻辑重构 + 分发状态

- **distribute_record**：项目编号已存在时，不再拒绝，改为追加系统到已有项目 + 补充分配未分配的员工；仅当该系统编号已在项目中时才报错
- **get_records**：批量查询 systems 表，为每条记录计算 `distributed` 布尔标记
- 提取 `_parse_project_code()` 公共函数

#### `backend/app/schemas/progress.py` — 新增 distributed 字段

- **修改内容**：`ProgressRecordResponse` 新增 `distributed: bool = False`

#### `frontend/src/views/ProjectProgress.vue` — 分发状态 UI

- **操作列**：已分发记录显示绿色"已分发" badge，未分发且可分发的显示"分发"按钮
- **分发后**：自动刷新当前页数据，分发状态立即更新

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/routers/progress.py` |
| **修改** | `backend/app/schemas/progress.py` |
| **修改** | `frontend/src/views/ProjectProgress.vue` |

### 测试方式

1. 分发一条记录（如 QZXGC-202602007-01），确认创建项目成功，操作列变为"已分发"
2. 分发同项目编号的第二条记录（如 QZXGC-202602007-02），确认系统追加到已有项目
3. 再次分发 -01，确认提示"该系统已分发"
4. 进入项目详情，确认两个系统都正确显示

---

## v6.0 — 系统进度汇报功能

员工可按项目下的每个系统汇报当前进度阶段（未开始→测评准备→方案编制→现场测评→报告编制→完结归档），附带文字备注，每周提交一次。汇报仅对项目创建者可见。多系统项目支持一键同步进度。

### 新增文件

#### `backend/app/routers/system_progress.py` — 进度汇报 API

- **功能**：4 个端点 — 提交汇报（POST）、进度总览（GET）、汇报历史（GET /history）、一键同步（POST /sync）
- **权限**：汇报/同步仅被分配员工可操作，查看权限限项目创建者和被分配员工
- **周号机制**：同周内重复提交为覆盖更新，不重复创建记录

#### `frontend/src/components/ProgressStepper.vue` — 进度步骤条组件

- **功能**：可复用的 6 阶段步骤条，支持只读/可编辑模式
- **实现**：接收 `modelValue` 和 `editable` props，已完成阶段显示勾号

### 修改文件

#### `backend/app/models/models.py` — 新增进度模型

- **新增**：`SystemProgressPhase` 枚举（6 个阶段）、`PHASE_LABELS` 中文映射、`SystemProgressReport` 汇报记录模型
- **修改**：`System` 模型新增 `current_phase` 字段和 `progress_reports` 关系

#### `backend/app/models/__init__.py` — 导出新模型

- **修改内容**：新增 `SystemProgressPhase, SystemProgressReport, PHASE_LABELS` 导出

#### `backend/app/schemas/schemas.py` — 新增进度 Schema

- **新增**：`ProgressReportCreate, ProgressReportBatchCreate, ProgressReportResponse, SystemProgressResponse, SyncProgressRequest`
- **修改**：`SystemResponse` 新增 `current_phase` 可选字段

#### `backend/app/routers/__init__.py` — 注册新路由

- **修改内容**：新增 `system_progress_router` 导入

#### `backend/app/main.py` — 路由注册 + 数据库迁移

- **修改内容**：注册 `system_progress_router`；`_migrate_db()` 新增 `systems.current_phase` 列自动迁移

#### `frontend/src/api/index.js` — 新增进度 API

- **修改内容**：`projectsApi` 新增 `getProgressOverview, getProgressHistory, submitProgress, syncProgress` 方法

#### `frontend/src/views/ProjectDetail.vue` — 集成进度汇报 UI

- **修改内容**：
  - 系统信息与人员分配之间新增"系统进度"区域
  - 员工视角：步骤条可编辑 + 备注输入 + 提交本周汇报 + 一键同步弹窗
  - 创建者视角：只读步骤条 + 最近汇报信息 + 汇报历史弹窗

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `backend/app/routers/system_progress.py` |
| **新增** | `frontend/src/components/ProgressStepper.vue` |
| **修改** | `backend/app/models/models.py` |
| **修改** | `backend/app/models/__init__.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/routers/__init__.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |

### 测试方式

1. 启动后端，确认 `system_progress_reports` 表和 `systems.current_phase` 列自动创建
2. 用员工账号登录，进入已分配项目详情，对各系统选择阶段并填写备注，提交汇报
3. 测试同周重复提交为覆盖更新（不新增记录）
4. 测试多系统项目的"一键同步进度"功能
5. 用项目创建者账号登录，确认能看到进度总览和汇报历史
6. 用非创建者的管理员账号确认看不到其他人项目的进度

---

## v5.5 — 对齐完结单模板字段

根据 Word 完结单模板的注释，修正字段选项值并新增缺失字段。

### 修改文件

#### `backend/app/models/models.py` — 新增字段 + 修正默认值

- **Project**：新增 `priority`（优先级：/、高、中、低），`filing_status` 默认值改为 `/`
- **System**：新增 `archive_status`（资料归档：/、是、否）

#### `backend/app/main.py` — 数据库迁移

- 自动为 `projects` 表添加 `priority` 列
- 自动为 `systems` 表添加 `archive_status` 列

#### `backend/app/schemas/schemas.py` — Schema 同步

- `ProjectBase`：`filing_status` 默认改 `/`，新增 `priority`，移除 `approval_date`
- `SystemBase`：新增 `archive_status`

#### `backend/app/routers/projects.py` — 路由同步

- 创建/更新/响应均包含 `priority` 字段，移除 `approval_date` 引用

#### `backend/app/routers/progress.py` — 分发默认值修正

- 分发时 `filing_status` 默认为 `/`（不再从爬取数据的备案状态映射）

#### `frontend/src/views/ProjectForm.vue` — 表单字段更新

- **备案情况**：选项改为 /、已填报、已审核、已完成
- **新增优先级**：/、高、中、低
- **系统信息**：新增"资料归档"列（/、是、否），网格改为 5 列

#### `frontend/src/views/ProjectDetail.vue` — 详情页更新

- 基本信息新增"优先级"显示，"定级备案"改为"备案情况"
- 系统表格新增"资料归档"列

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/models/models.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `backend/app/routers/progress.py` |
| **修改** | `frontend/src/views/ProjectForm.vue` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |

### 测试方式

1. 新建项目确认"备案情况"选项为 /、已填报、已审核、已完成
2. 新建项目确认有"优先级"下拉框（/、高、中、低）
3. 添加系统时确认有"资料归档"下拉框（/、是、否）
4. 项目详情页确认显示优先级和资料归档信息

---

## v5.4 — 工作量统计修复 + 项目搜索 + 移除审批时间

### 修改文件

#### `backend/app/models/models.py` — 新增 completed_at 字段

- **修改内容**：Project 模型新增 `completed_at` 字段（DateTime），记录项目标记完成的时间

#### `backend/app/routers/projects.py` — 工作量统计改用完结时间

- **状态变更**：标记完成时设置 `completed_at`，重新开启时清除
- **工作量统计**：`get_workload_stats()` 改用 `completed_at` 归属季度（原 `approval_date` 已废弃）

#### `frontend/src/views/Projects.vue` — 项目列表加搜索框

- **修改内容**：新增搜索输入框，支持按项目编号、项目名称、客户单位模糊搜索

#### `frontend/src/views/ProjectDetail.vue` — 移除审批时间显示

- **修改内容**：详情页移除"审批时间"字段，与表单保持一致

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/models/models.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `frontend/src/views/Projects.vue` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |

### 测试方式

1. 将一个项目标记为已完成，检查工作量统计页面该季度能查到数据
2. 重新开启该项目，确认工作量统计不再包含它
3. 项目列表页输入关键字搜索，确认按编号/名称/客户过滤正常
4. 项目详情页确认不再显示"审批时间"

---

## v5.3 — 分发逻辑完善 + UI 优化

### 修改文件

#### `backend/app/routers/progress.py` — 项目编号去子系统后缀

- **修改位置**：`distribute_record()` 函数
- **修改内容**：分发时将系统编号 `QZXGC-202602007-03` 去掉末尾子系统序号，项目编号存为 `QZXGC-202602007`；移除旧的按原始 system_id 查重，改为按转换后编号查重

#### `frontend/src/views/ProjectProgress.vue` — 分发状态精细化 + 默认列调整

- **分发判断**：白名单模式，仅"未开始"状态可分发；备注含"注销"不可分发；方案和报告都已打印视为实际完成
- **状态显示**：不可分发记录显示实际项目状态（如"现场测评"、"建设整改"），而非笼统的"已完结"
- **默认显示列**：移除"是否完结"，新增"方案打印"、"报告打印"、"备注"

#### `frontend/src/views/ProjectForm.vue` — 取消按钮返回上一页

- **修改内容**：编辑项目页面的"取消"按钮从固定跳转项目列表改为 `router.back()` 返回上一页

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/routers/progress.py` |
| **修改** | `frontend/src/views/ProjectProgress.vue` |
| **修改** | `frontend/src/views/ProjectForm.vue` |

### 测试方式

1. 分发系统编号为 `XXX-03` 格式的记录，确认创建的项目编号为 `XXX`（无 `-03` 后缀）
2. 进度表格中"现场测评"、"建设整改"等状态的记录显示实际状态文字，不显示分发按钮
3. 备注含"注销"的记录不可分发
4. 默认显示列包含"方案打印"、"报告打印"、"备注"，不含"是否完结"
5. 编辑项目页点击"取消"返回项目详情页而非项目列表

---

## v5.2 — Bug修复：分发功能完善 + UI 修复

### 修改文件

#### `backend/app/routers/progress.py` — 分发接口补全

- **实施负责人**：分发时自动将第一个选中的员工设为 `implementation_manager_id`
- **系统信息**：分发时自动从爬取数据创建 `System` 记录（系统编号、名称、等级）

#### `frontend/src/views/ProjectDetail.vue` — 去重编辑按钮

- **修改位置**：第 29 行
- **修改内容**：删除重复的「编辑项目」按钮，保留第 22 行的

#### `frontend/src/views/ProjectProgress.vue` — 已完结隐藏分发

- **修改内容**：已完结的记录操作列显示"已完结"文字，不再显示分发按钮

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/routers/progress.py` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |
| **修改** | `frontend/src/views/ProjectProgress.vue` |

### 测试方式

1. 分发一条记录给员工，进入项目详情确认"实施负责人"显示该员工名称
2. 确认分发后的项目包含系统信息（系统名称、系统等级）
3. 进入任意项目详情页，确认右上角只有一个「编辑项目」按钮
4. 进度表格中已完结的记录，操作列显示"已完结"而非分发按钮

---

## v5.1 — 进度数据按经理过滤 + 快速分发

经理登录后只看到自己作为项目经理的爬取数据，并可直接从进度表格选择员工分发项目。

### 修改文件

#### `backend/app/routers/progress.py` — 数据过滤 + 分发接口

- **修改位置**：`get_records()` 和 `export_records()` 函数
- **修改内容**：新增按 `current_user.display_name == project_manager` 过滤逻辑，经理只能查看和导出自己负责的项目数据
- **新增接口**：`POST /api/progress/records/{record_id}/distribute`，从爬取记录自动创建项目并分配给选中员工，含重复分发校验

#### `backend/app/schemas/progress.py` — 新增分发 Schema

- **新增**：`ProgressDistributeRequest`（`assignee_ids: List[int]`）

#### `frontend/src/api/index.js` — 新增分发 API 调用

- **新增**：`progressApi.distribute(recordId, data)`

#### `frontend/src/views/ProjectProgress.vue` — 分发操作列 + 弹窗

- **表格**：经理视角新增「操作」列（sticky 定位），每行显示「分发」按钮
- **弹窗**：点击分发后弹出员工多选弹窗，展示系统名称/项目名称/客户名称，勾选员工后确认分发
- **数据**：页面挂载时自动加载员工列表

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/routers/progress.py` |
| **修改** | `backend/app/schemas/progress.py` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `frontend/src/views/ProjectProgress.vue` |

### 测试方式

1. 以经理身份登录，进入任意项目进度页面，确认只显示 `project_manager` 与自己 `display_name` 一致的记录
2. 导出 Excel，确认同样只包含自己负责的记录
3. 点击任意记录的「分发」按钮，在弹窗中勾选员工并确认，验证项目管理中出现新建的项目且已分配
4. 对同一条记录再次点击分发，确认提示"项目编号已存在"

---

## v5.0 — 项目进度模块：多类型数据爬取与管理

从内部项目管理系统爬取项目进度数据，支持 7 种项目类型（等保测评、密码评估、安全评估、风险评估、软件测试、安全服务、综合服务），在 Web 端查看、搜索、导出 Excel。

### 新增文件

#### `backend/app/models/progress.py` — 数据模型

- **功能**：定义 `ProgressRecord`（24 个业务字段 + 项目类型 + 批次号）和 `ProgressScrapeLog`（爬取日志）两个数据库模型
- **`PROJECT_TYPE_NAMES`**：7 种项目类型的中英文映射

#### `backend/app/schemas/progress.py` — Pydantic Schema

- **功能**：请求/响应数据验证，包含 `ProgressRecordResponse`、`ProgressListResponse`、`ProgressScrapeRequest`、`ProgressScrapeLogResponse`、`ProgressConfigResponse`、`ProgressConfigUpdate`

#### `backend/app/services/progress_scraper.py` — 爬虫服务

- **功能**：封装 `ProgressScraper` 类，实现 PFX 证书处理、OCR 验证码自动登录、分页数据爬取
- **实现原理**：通过 `PROJECT_TYPE_PATHS` 映射不同项目类型到不同 API 路径，复用同一套登录和数据获取逻辑
- **配置文件**：`backend/progress_config.json`（运行时自动创建）

#### `backend/app/routers/progress.py` — API 路由

- **6 个端点**：
  - `POST /api/progress/{type}/scrape` — 触发爬取（经理权限）
  - `GET /api/progress/{type}/records` — 分页查询（支持搜索）
  - `GET /api/progress/{type}/records/export` — 导出 Excel
  - `GET /api/progress/{type}/logs` — 爬取日志
  - `GET /api/progress/config` — 获取配置
  - `PUT /api/progress/config` — 更新配置（经理权限）

#### `frontend/src/views/ProjectProgress.vue` — 前端页面

- **功能**：数据表格（11 列关键字段）、搜索、分页、手动爬取、导出 Excel、爬取日志折叠面板
- **路由切换**：通过 `watch(projectType)` 监听路由参数变化，自动重新加载数据

---

### 修改文件

#### `backend/app/models/__init__.py` — 导入新模型

- **修改内容**：新增 `from app.models.progress import ProgressRecord, ProgressScrapeLog, ProjectType, PROJECT_TYPE_NAMES`

#### `backend/app/routers/__init__.py` — 导出新路由

- **修改内容**：新增 `from app.routers.progress import router as progress_router`

#### `backend/app/main.py` — 注册路由

- **修改内容**：导入并注册 `progress_router`

#### `backend/requirements.txt` — 添加依赖

- **修改内容**：新增 `requests==2.31.0`、`ddddocr>=1.4.11`

#### `frontend/src/api/index.js` — 添加 API

- **修改内容**：新增 `progressApi` 组（scrape, getRecords, exportExcel, getLogs, getConfig, updateConfig）

#### `frontend/src/router/index.js` — 添加路由

- **修改内容**：新增 `/progress/:type` 路由，懒加载 `ProjectProgress.vue`

#### `frontend/src/components/AppLayout.vue` — 侧边栏下拉菜单

- **修改内容**：在「导出完结单」和「用户管理」之间插入「项目进度」可展开菜单组，包含 7 个子项，带圆点指示器和展开/收起动画

---

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `backend/app/models/progress.py` |
| **新增** | `backend/app/schemas/progress.py` |
| **新增** | `backend/app/services/progress_scraper.py` |
| **新增** | `backend/app/routers/progress.py` |
| **新增** | `frontend/src/views/ProjectProgress.vue` |
| **修改** | `backend/app/models/__init__.py` |
| **修改** | `backend/app/routers/__init__.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `backend/requirements.txt` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `frontend/src/router/index.js` |
| **修改** | `frontend/src/components/AppLayout.vue` |

---

### 测试方式

1. 启动后端 `python -m uvicorn app.main:app --reload`，访问 `/docs` 确认 6 条 progress 路由注册成功
2. 前端访问 `/progress/dengbao`，确认页面正常渲染
3. 点击侧边栏「项目进度」下拉菜单，切换不同类型，确认数据独立加载
4. 点击「手动爬取」，确认数据写入数据库并显示在表格中
5. 点击「导出 Excel」，确认下载的文件格式正确

---

## v4.0 — 流程优化：自动分发 + 批量Word模板导出

### 功能1：移除审批完成时间 + 创建项目时自动分发

- **移除审批完成时间**：新建/编辑项目表单不再显示「审批完成时间」字段
- **自动分发**：选择「实施负责人」后创建项目时，自动为该员工创建分配记录并将项目状态设为「已分发」，无需再手动点击「分发项目」
- **移除分发按钮**：项目详情页右上角不再显示「分发项目」按钮及分发模态框

### 功能2：Word导出移到导出完结单页面

- **移除单个导出**：项目详情页右上角不再显示「导出Word」按钮
- **批量Word导出**：导出完结单页面新增「导出Word」按钮，支持批量选择项目导出
- **模板填充**：基于 6 套官方完结单模板（等保/风评/软测/安服/配合检查/值守），按业务类别自动匹配模板并填充项目数据
- **智能打包**：单个项目直接返回 .docx 文件，多个项目自动打包为 .zip

---

### 修改文件

#### `frontend/src/views/ProjectForm.vue` — 移除审批完成时间字段

- **修改位置**：基本信息表单区域、form reactive 对象
- **修改内容**：移除 `approval_date` 输入框和表单字段

#### `backend/app/routers/projects.py` — 创建时自动分发

- **修改位置**：`create_project()` 函数（约 L258-268）
- **修改内容**：创建项目后若设置了 `implementation_manager_id`，自动创建 `ProjectAssignment` 并将状态设为 `assigned`

#### `frontend/src/views/ProjectDetail.vue` — 移除分发按钮和Word导出

- **修改位置**：header-actions 区域、script 逻辑
- **修改内容**：移除「分发项目」按钮、分发模态框、「导出Word」按钮及相关 JS 代码（toggleEmployee, assignProject, exportWord, employees 数据获取）

#### `backend/app/routers/exports.py` — 新增批量Word模板导出

- **修改位置**：新增函数和端点
- **修改内容**：新增 `CATEGORY_TEMPLATE` 映射、`_fill_word_template()` 模板填充函数、`POST /api/exports/word-batch` 批量导出端点

#### `backend/app/schemas/schemas.py` — 新增 WordExportRequest

- **修改位置**：导出模式区域末尾
- **修改内容**：新增 `WordExportRequest(project_ids)` 模式

#### `frontend/src/views/Export.vue` — 新增Word导出按钮

- **修改位置**：导出按钮区域、script 逻辑
- **修改内容**：新增「导出Word」按钮和 `exportWord()` 函数

#### `frontend/src/api/index.js` — 新增批量Word API

- **修改位置**：exportsApi 对象
- **修改内容**：新增 `wordBatch` 方法调用 `/api/exports/word-batch`

### 新增文件

#### `backend/templates/` — 完结单Word模板（6个）

- 等保完结单.docx、风评完结单.docx、软测完结单.docx、安服完结单.docx、配合检查完结单.docx、值守完结单.docx

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `frontend/src/views/ProjectForm.vue` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |
| **修改** | `frontend/src/views/Export.vue` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `backend/app/routers/exports.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **新增** | `backend/templates/`（6个模板文件） |

## 测试方式

1. 启动后端和前端服务
2. **功能1验证**：以经理身份新建项目，确认表单无「审批完成时间」字段；选择实施负责人后提交，确认项目状态直接为「已分发」，进入项目详情确认该员工已出现在人员分配列表中
3. **功能2验证**：进入「导出完结单」页面，选择项目后点击「导出Word」，确认单个项目下载 .docx、多个项目下载 .zip；打开生成的Word文件确认模板正确填充了项目数据

---

## v3.0 — UI 重构：去除"AI 味"，对齐前端设计规范

### 背景

功能型后台管理系统应遵循克制、可预测、信息优先的设计态度。原 UI 存在紫蓝渐变、毛玻璃特效、发光阴影、Emoji 图标、hover 位移动画等典型"AI 味"设计问题，违反 `frontend-design-integrated.md` 多项规范。

### 设计方案

- **配色**：Void Space 暗色（`#0d1117` / `#161b22` / `#58a6ff` / `#f78166`）
- **浅色主题**：GitHub Light 风格（`#f6f8fa` / `#ffffff` / `#0969da`）
- **字体**：标题 DM Serif Display，正文 DM Sans，代码 JetBrains Mono
- **风格**：functional — 紧凑、中性、信息优先、零装饰

---

### 修改文件

#### `frontend/index.html` — 引入 Google Fonts

- **修改位置**：`<head>` 区域
- **修改内容**：添加 `color-scheme` meta、Google Fonts CDN（DM Sans + DM Serif Display + JetBrains Mono）

#### `frontend/src/style.css` — 全局设计系统重构

- **修改内容**：
  - CSS 变量全量替换为 Void Space 配色，浅色主题同步更新为 GitHub Light 风格
  - 字体从 `Inter / Segoe UI / Roboto` 改为 `DM Sans`
  - 移除 `body::before` 紫色渐变装饰背景
  - 移除 `--accent-gradient`、`--shadow-glow` 变量
  - 圆角收紧：`--radius-sm: 6px`、`--radius-md: 8px`、`--radius-lg: 10px`、`--radius-xl: 12px`
  - `.card`：移除 `backdrop-filter`，hover 移除 `translateY` 和 `shadow-glow`
  - `.btn-primary`：渐变改实色，hover 改 `opacity: 0.85`
  - `.btn-danger:hover`：移除发光阴影
  - `.toast`：移除 `backdrop-filter`，`slideIn` 动画改为纯 `fadeIn`
  - `.modal`：圆角降至 `--radius-lg`，`scaleIn` 动画改为 `fadeIn`
  - `.badge-primary`：硬编码 `rgba(99, 102, 241, ...)` 改为 `var(--accent-glow)`
  - `.pagination button.active`：渐变改实色
  - `.checkbox.checked`：渐变改实色
  - `.loading-overlay`：背景色改为 Void Space 色值
  - `code` 元素统一使用 `JetBrains Mono`
  - 新增 `prefers-reduced-motion` 无障碍支持

#### `frontend/src/views/Login.vue` — 登录页重构

- **模板修改**：
  - Emoji 图标（`📋📊👥`）替换为 SVG 图标
  - 修改密码弹窗标题移除 `🔐`
- **样式修改**：
  - 左侧装饰区：渐变背景改为 `var(--bg-tertiary)` + `border-right`
  - 移除 `pulse` 脉冲动画和 `::before` 伪元素
  - logo 背景改为 `var(--accent-glow)`
  - feature 卡片移除 `backdrop-filter`，改为 `border: 1px solid var(--border-color)`
  - 登录容器移除 `backdrop-filter`，圆角降至 `--radius-lg`
  - 标题使用 `DM Serif Display` 字体

#### `frontend/src/components/AppLayout.vue` — 侧边栏优化

- **样式修改**：
  - `.logo`：背景从 `var(--accent-gradient)` 改为实色 `var(--accent-primary)`
  - `.nav-item.active`：硬编码 `rgba(99, 102, 241, 0.15)` 改为 `var(--accent-glow)`
  - `.avatar`：背景从渐变改为实色 `var(--accent-primary)`
  - `.btn-theme:hover`：硬编码色值改为 `var(--accent-glow)`
  - `transition: all` 改为具体属性以提升性能

#### `frontend/src/views/Dashboard.vue` — 仪表盘优化

- **模板修改**：`.stat-icon` 硬编码 `rgba(99, 102, 241, 0.2)` 改为 `var(--accent-glow)`
- **样式修改**：
  - `.page-header h1`：使用 `DM Serif Display` 标题字体
  - `.stat-card`：移除 `backdrop-filter`，hover 移除 `translateY` 和 `box-shadow`
  - `.recent-section`：移除 `backdrop-filter`
  - `.project-card:hover`：移除 `translateY(-2px)` 和发光阴影
  - `.project-code`：使用 `JetBrains Mono` 字体
  - `.notice-item:hover`：移除 `translateX(4px)` 和发光阴影，改为 border-color 变化
  - 硬编码 `#f59e0b` / `#10b981` 改为 `var(--warning)` / `var(--success)`

#### `frontend/src/views/Projects.vue` — 标题字体

- **样式修改**：`.page-header h1` 使用 `DM Serif Display` 标题字体

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `frontend/index.html` |
| **修改** | `frontend/src/style.css` |
| **修改** | `frontend/src/views/Login.vue` |
| **修改** | `frontend/src/components/AppLayout.vue` |
| **修改** | `frontend/src/views/Dashboard.vue` |
| **修改** | `frontend/src/views/Projects.vue` |

---

## 测试方式

1. `cd frontend && npm run build` — 确认无编译错误（已通过）
2. 人工检查：
   - 登录页：无 Emoji、无脉冲动画、无紫色渐变
   - 侧边栏：实色 logo/头像、正确的 active 高亮色
   - 仪表盘：卡片无 hover 位移、无发光阴影
   - 主题切换：深色/浅色均正常
3. 响应式：768px 断点下布局正常

---

## v2.0 — 代码审查修复（15 项问题）

### 新增文件

### `frontend/src/utils/project.js` — 共享工具函数

- **功能**：抽取 `categoryMap`、`getCategoryShort`、`getStatusClass`、`getStatusText` 共享函数
- **原因**：消除 4 个 Vue 组件中的重复定义（DRY 原则）

---

### 修改文件

### `backend/app/routers/auth.py` — 限流器修复 + async 移除

- **修改内容**：
  - [CRITICAL] 替换 `defaultdict(list)` 为有上限（10000 IP）的普通 `dict`，超限时自动清理过期条目
  - 路由函数从 `async def` 改为 `def`（同步 DB 操作不应阻塞事件循环）
  - `change_password` 和 `get_me` 改用 `get_current_user_raw`（绕过改密检查）

### `backend/app/services/auth.py` — 后端强制改密检查

- **修改内容**：
  - [HIGH] 拆分 `get_current_user` 为 `get_current_user_raw`（仅验证 token）和 `get_current_user`（额外检查 `must_change_password`）
  - 未改密用户调用 API 时返回 403，防止绕过前端直接操作

### `backend/app/schemas/schemas.py` — 输入校验 + 死代码清理

- **修改内容**：
  - [HIGH] `LoginRequest` 添加 `min_length=1, max_length=50/128`，防止超长输入攻击
  - [MEDIUM] 移除 `ContributionCreate.assignee_id` 未使用字段

### `backend/app/routers/users.py` — 用户删除修复 + async 移除

- **修改内容**：
  - [HIGH] 删除用户前先清理 `ProjectAssignment` 记录，防止外键孤儿
  - 所有路由从 `async def` 改为 `def`

### `backend/app/routers/exports.py` — 导出权限控制 + async 移除

- **修改内容**：
  - [MEDIUM] Excel/Word 导出添加员工权限校验，员工只能导出自己被分配的项目
  - 所有路由从 `async def` 改为 `def`

### `backend/app/routers/projects.py` — 状态机校验 + async 移除

- **修改内容**：
  - [MEDIUM] `update_project_status` 添加状态转换校验（draft→assigned→completed↔assigned）
  - 所有路由从 `async def` 改为 `def`

### `backend/app/routers/backup.py` — async 移除

- **修改内容**：`export_backup` 和 `download_db` 从 `async def` 改为 `def`（`import_backup` 保留 async，因使用 `await file.read()`）

### `backend/app/main.py` — 启动流程优化

- **修改内容**：
  - [LOW] 移除未使用的 `contextmanager` import，改为 `asynccontextmanager`
  - [LOW] `@app.on_event("startup")` 替换为 `lifespan` 上下文管理器
  - [MEDIUM] `_migrate_db` 细化异常处理（区分 `OperationalError` 和其他异常）
  - [MEDIUM] `_seed_admin` 生产环境失败时抛出 `RuntimeError` 阻止启动
  - 新增 `from sqlalchemy.exc import OperationalError`

### `frontend/src/views/Dashboard.vue` — 使用共享工具

- **修改内容**：移除本地 `categoryMap`/`getCategoryShort`/`getStatusClass`/`getStatusText`，改为从 `utils/project.js` 导入

### `frontend/src/views/Projects.vue` — 使用共享工具

- **修改内容**：同上

### `frontend/src/views/ProjectDetail.vue` — 使用共享工具

- **修改内容**：同上

### `frontend/src/views/Export.vue` — 使用共享工具

- **修改内容**：移除本地 `categoryMap`/`getCategoryShort`，改为从 `utils/project.js` 导入

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `frontend/src/utils/project.js` |
| **修改** | `backend/app/routers/auth.py` |
| **修改** | `backend/app/services/auth.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/routers/users.py` |
| **修改** | `backend/app/routers/exports.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `backend/app/routers/backup.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `frontend/src/views/Dashboard.vue` |
| **修改** | `frontend/src/views/Projects.vue` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |
| **修改** | `frontend/src/views/Export.vue` |

---

## 测试方式

1. 启动后端 `uvicorn app.main:app --reload --port 8000`，确认无报错
2. 启动前端 `npm run dev`，确认页面正常加载
3. 登录管理员账户，验证各页面功能正常
4. 测试改密流程：重置用户密码后，该用户调用非改密 API 应返回 403
5. 测试导出：员工账户尝试导出未分配项目应返回 403
6. 测试状态转换：draft 状态直接改 completed 应返回 400

---
> - v1.8.2: 项目列表页和仪表盘显示完结申请进度，经理登录首页即可看到待确认的提交通知
> - v1.8.1: 移除人员分配中每个人员的"待提交/已提交"状态标签（提交为项目整体操作）
> - v1.8: 员工完结申请功能 — 员工可提交/撤回完结申请，经理可查看提交进度并确认完成
> - v1.7: 人员分配贡献率编辑改造 — 弹窗编辑/删除替代底部独立表单，新增"添加贡献"支持多部门分开记录
> - v1.6: 业务负责人改为文本输入（脱离系统用户）、实施负责人下拉框显示所有用户、新增项目完成状态切换
> - v1.5.1: 前端 DRY 重构 + 低优先级优化（侧边栏提取、主题 composable、表单警告、部门默认值）
> - v1.5: 深度代码审查修复 — 消除冲突文件、安全加固、查询优化、前端健壮性提升（5 CRITICAL + 8 HIGH + 10 MEDIUM）
> - v1.4: 全面代码审查修复（3 CRITICAL + 6 HIGH + 7 MEDIUM + 4 LOW）
> - v1.3: Bug 修复（删除用户级联、员工项目列表重复、工作量统计日期兼容）+ 新增备份与恢复功能
> - v1.2.1: 恢复 PostgreSQL 默认驱动依赖
> - v1.2: 安全改造（管理员分发账户、首次改密、重置密码）+ bcrypt 兼容性修复
> - v1.1: 修改启动行为，关闭 CMD 窗口时自动停止所有子进程

## v1.9 — 后端 API 修复与接口完善

### 修改文件

#### `app/main.py` — 路由顺序修正、新增趋势API、导入加固

- **修改位置**：知识库路由区块（约第 5049-5067 行）、Dashboard 区块（约第 4795 行）、导入端点（约第 2687、3126 行）、系统Word导入（约第 3207 行）

- **修改内容**：
  1. **路由顺序修正（CRITICAL）**：`GET /api/knowledge/download-logs` 和 `POST /api/knowledge/batch-download` 原本定义在 `/{doc_id}` 参数路由之后，导致 FastAPI 将 "download-logs"/"batch-download" 误当作整数参数解析（400错误）。已将两个静态路由移至所有 `/{doc_id}` 路由之前。
  2. **新增趋势API**：新增 `GET /api/dashboard/trend` 端点，返回按月统计的组织和系统新增数量，支持 `months`（1-60）、`industry`、`city`、`level` 过滤参数，自动补全连续月份（无数据月份填0）。
  3. **导入文件大小限制**：`POST /api/organizations/import/excel` 和 `POST /api/systems/import/excel` 新增50MB大小限制校验，防止超大文件拖垮服务。
  4. **系统Word导入错误处理**：`POST /api/systems/import/word` 的DB操作包裹 `try/except` + `db.rollback()`，防止异常时事务悬挂。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `app/main.py` |

---

## 测试方式

- 访问 `GET /api/knowledge/download-logs`：应返回下载日志列表（不再报 422/400）
- 访问 `POST /api/knowledge/batch-download`：传入 `doc_ids` 列表应正常打包下载
- 访问 `GET /api/dashboard/trend?months=6`：应返回最近6个月的趋势数据
- 上传超过50MB的Excel文件至 `/api/organizations/import/excel`：应返回400错误提示
- 导入格式错误的系统Word文件：应返回500错误并无事务残留

---

## v1.8.2 — 项目列表页显示提交进度

### 修改文件

#### `backend/app/schemas/schemas.py` — ProjectListResponse 加进度字段

- **修改内容**：新增 `submitted_count`（已提交员工数）和 `total_employee_count`（总分配员工数）

#### `backend/app/routers/projects.py` — 计算提交进度

- **修改内容**：新增 `_calc_submit_progress()` 辅助函数，按员工去重统计；`get_projects` 返回进度数据

#### `frontend/src/views/Dashboard.vue` — 仪表盘新增完结申请通知卡片

- **修改内容**：经理登录后，仪表盘统计卡片与最近项目之间显示醒目的通知区域，列出所有有员工提交完结申请的进行中项目，每条显示项目名、进度条和 `X/Y 人已提交`，点击可跳转项目详情

#### `frontend/src/views/Projects.vue` — 状态列显示进度

- **修改内容**：进行中的项目状态标签旁显示 `2/3` 格式的提交进度

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `frontend/src/views/Projects.vue` |
| **修改** | `frontend/src/views/Dashboard.vue` |

---

## v1.8.1 — 移除人员分配中的个人提交状态标签

### 修改文件

#### `frontend/src/views/ProjectDetail.vue` — 移除"待提交/已提交"badge

- **修改位置**：人员分配列表中 `.assignee-name` 区域（原第 83-85 行）
- **修改内容**：移除每个分配人员名字旁的 `<span>` 状态标签（"待提交"/"已提交"），因为提交是项目整体操作，不需要在每个人员卡片上单独显示

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `frontend/src/views/ProjectDetail.vue` |

### 测试方式

- 进入已分配项目详情页，确认人员分配列表中人员名字旁不再显示"待提交"标签
- 经理视角标题旁的提交进度统计（如 `2/3 人已提交`）保持不变

---

## v1.8 — 员工完结申请功能

### 修改文件

#### `backend/app/models/models.py` — 新增 AssignmentStatus 枚举 + status 字段

- **修改位置**：ProjectStatus 枚举后、ProjectAssignment 模型
- **修改内容**：
  - 新增 `AssignmentStatus` 枚举：`pending`（待提交）/ `submitted`（已提交完结）
  - `ProjectAssignment` 新增 `status` 字段：`Column(String(20), server_default="pending")`

#### `backend/app/models/__init__.py` — 导出新枚举

- **修改内容**：新增 `AssignmentStatus` 导出

#### `backend/app/main.py` — 兼容旧库自动加列

- **修改位置**：`on_startup` 前新增 `_migrate_db()` 函数
- **修改内容**：启动时检测 `project_assignments` 表是否缺少 `status` 列，缺少则自动 `ALTER TABLE ADD COLUMN`

#### `backend/app/schemas/schemas.py` — AssignmentResponse 加 status 字段

- **修改位置**：`AssignmentResponse` 类
- **修改内容**：新增 `status: str = "pending"` 字段

#### `backend/app/routers/projects.py` — 新增 submit/retract 接口 + 编辑/删除/添加拦截

- **修改内容**：
  - 新增 `PATCH /{project_id}/submit-completion` — 员工提交完结申请（批量锁定自己的所有分配）
  - 新增 `PATCH /{project_id}/retract-completion` — 员工撤回完结申请（批量解锁）
  - `update_assignment` / `delete_assignment` / `add_contribution` — 已提交分配禁止操作
  - `update_project_status` — 标记完成时返回未提交人员名单作为警告信息
  - `get_assignments` — 返回 `status` 字段

#### `frontend/src/api/index.js` — 新增 2 个 API 方法

- **修改内容**：
  - `submitCompletion(projectId)` → PATCH submit-completion
  - `retractCompletion(projectId)` → PATCH retract-completion

#### `frontend/src/views/ProjectDetail.vue` — UI 状态展示 + 按钮逻辑

- **修改内容**：
  - 每条分配显示状态标签：「待提交」/「已提交」
  - 员工 pending 状态：显示「编辑」「删除」「提交完结」按钮
  - 员工 submitted 状态：仅显示「撤回」按钮
  - 经理视角：标题旁显示提交进度（如 `2/3 已提交`）
  - 标记完成时：未全部提交弹出警告显示未提交名单，确认后可强制完成

### 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/models/models.py` |
| **修改** | `backend/app/models/__init__.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |

### 测试方式

1. 启动后端+前端，用员工账号登录，进入已分配项目
2. 填写贡献后点「提交完结」，状态变为「已提交」，编辑/删除按钮消失
3. 点「撤回」，状态回到「待提交」，编辑/删除按钮恢复
4. 用经理账号登录，查看人员分配区域显示提交进度
5. 部分员工未提交时点「标记完成」，弹出警告显示未提交名单，确认后可强制完成
6. 全部员工提交后，点「标记完成」直接弹正常确认框
7. 已完成项目所有操作按钮不可见
8. 删除旧数据库文件，验证新库创建正常；保留旧库文件，验证自动加列

---

## v1.7 — 人员分配贡献率编辑改造

### 修改文件

#### `backend/app/schemas/schemas.py` — 新增 AssignmentUpdate 和 ContributionCreate Schema

- **修改位置**：分配区块（第 128 行后）
- **修改内容**：
  - 新增 `AssignmentUpdate(BaseModel)`，含 `department`、`contribution` 可选字段
  - 新增 `ContributionCreate(BaseModel)`，含 `assignee_id`（经理指定员工）、`department`、`contribution`

#### `backend/app/routers/projects.py` — 新增分配编辑/删除/添加接口

- **修改位置**：文件末尾新增三个 endpoint
- **修改内容**：
  - `PUT /{project_id}/assignments/{assignment_id}` — 编辑分配的部门和贡献率（经理可编辑任意，员工仅自己的，已完成项目禁止修改）
  - `DELETE /{project_id}/assignments/{assignment_id}` — 删除分配记录（仅经理，已完成项目禁止删除）
  - `POST /{project_id}/contributions` — 添加贡献记录（经理可为任意员工添加，员工为自己添加，已完成项目禁止添加）
  - import 新增 `AssignmentUpdate`、`ContributionCreate`

#### `frontend/src/api/index.js` — 新增分配编辑/删除/添加 API

- **修改位置**：`projectsApi` 对象
- **修改内容**：新增 `updateAssignment`、`deleteAssignment`、`addContribution` 方法

#### `frontend/src/views/ProjectDetail.vue` — UI 改造

- **修改内容**：
  - **移除**底部"填写我的贡献信息"独立区块
  - **人员分配列表**每项新增操作按钮：经理可编辑/删除所有分配，员工仅可编辑自己的分配
  - **已完成项目**不显示操作按钮
  - **新增编辑弹窗**：部门 + 贡献率描述两个字段
  - **新增"添加贡献"按钮和弹窗**：员工可为自己添加多条贡献记录（不同部门分开写），经理可为任意员工添加

---

## v1.7 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |

---

## v1.7 测试方式

- 经理登录：点击任意分配的"编辑"按钮，弹窗填写部门和贡献率后保存，确认数据更新
- 经理登录：点击"删除"按钮，确认分配被移除
- 经理登录：点击"添加贡献"按钮，选择员工并填写部门和贡献率，确认新记录出现
- 员工登录：只能看到自己分配的"编辑"按钮，无删除按钮，保存后数据正确
- 员工登录：点击"添加贡献"按钮，为自己添加第二条贡献记录（如渗透部的贡献），确认新记录出现
- 已完成项目：不显示编辑/删除/添加贡献按钮
- 后端 `python -c "from app.routers.projects import router"` 无报错
- 前端 `npm run build` 构建通过

---

## v1.6 — 业务负责人改为文本、实施负责人扩展选择范围、项目状态切换

### 修改文件

#### `backend/app/models/models.py` — 业务负责人字段改为文本

- **修改位置**：`Project` 类、`User` 类
- **修改内容**：
  - `business_manager_id`（Integer FK）→ `business_manager_name`（String(100)，纯文本姓名）
  - 移除 `Project.business_manager` relationship
  - 移除 `User.business_projects` relationship

#### `backend/app/schemas/schemas.py` — Schema 对应更新

- **修改位置**：`ProjectBase`
- **修改内容**：`business_manager_id: Optional[int]` → `business_manager_name: Optional[str]`

#### `backend/app/routers/projects.py` — 项目路由更新 + 新增状态切换接口

- **修改内容**：
  - `project_to_response` 中 `business_manager_name` 直接读取字段值而非关联用户
  - 创建/更新项目使用 `business_manager_name` 字段
  - 移除 `selectinload(Project.business_manager)` 查询加载
  - **新增** `PATCH /{project_id}/status` 接口，经理可将项目标记为已完成或重新开启

#### `backend/app/routers/exports.py` — 导出更新

- **修改内容**：Word 导出中业务负责人从 `project.business_manager.display_name` 改为 `project.business_manager_name`

#### `backend/app/routers/backup.py` — 备份恢复更新

- **修改内容**：备份列名和恢复逻辑从 `business_manager_id`（FK 校验）改为 `business_manager_name`（纯文本）

#### `backend/app/routers/users.py` — 删除用户级联清理

- **修改内容**：移除删除用户时清理 `business_manager_id` 的逻辑（已不再是 FK）

#### `frontend/src/api/index.js` — 新增状态切换 API

- **修改内容**：`projectsApi` 新增 `updateStatus(id, status)` 方法

#### `frontend/src/views/ProjectForm.vue` — 表单改造

- **修改内容**：
  - 业务负责人：从下拉选择框改为文本输入框（`<input>`）
  - 实施负责人：从只加载经理用户改为加载所有用户（`usersApi.getAll()`）
  - 表单字段 `business_manager_id` → `business_manager_name`

#### `frontend/src/views/ProjectDetail.vue` — 新增项目状态切换按钮

- **修改内容**：
  - 进行中项目显示"标记为已完成"按钮（绿色），点击后项目变为已完成
  - 已完成项目显示"重新开启"按钮（橙色），点击后项目恢复为进行中
  - 仅经理可见，操作前有确认弹窗

---

## v1.6 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/models/models.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `backend/app/routers/exports.py` |
| **修改** | `backend/app/routers/backup.py` |
| **修改** | `backend/app/routers/users.py` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `frontend/src/views/ProjectForm.vue` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |

---

## v1.6 测试方式

- **删除旧数据库**（`backend/project_completion.db`），因数据库结构已变更
- 启动项目，新建项目时确认：
  - 业务负责人是文本输入框，可以填任意名字
  - 实施负责人下拉框显示所有用户（包括员工），不再只有经理
- 编辑已有项目，确认业务负责人名称正确回显
- 导出 Word 完结单，确认业务负责人名称正确显示
- 备份导出 JSON，确认包含 `business_manager_name` 字段
- 备份恢复，确认 `business_manager_name` 正确恢复

---

## v1.5.1 — 前端 DRY 重构 + 低优先级优化

### 新增文件

#### `frontend/src/components/AppLayout.vue` — 全局布局组件

- **功能**：统一的侧边栏 + 主内容区布局，使用 `<slot>` 接收页面内容
- **包含**：导航菜单（路由高亮）、用户信息、主题切换、退出登录
- **消除重复**：替代 8 个页面中各自约 80 行的重复侧边栏模板 + 60 行重复 CSS

#### `frontend/src/composables/useTheme.js` — 主题切换 composable

- **功能**：模块级单例 `isDark` ref + `toggleTheme()` 函数
- **消除重复**：替代 8 个页面中各自重复的 `isDark`、`toggleTheme`、`handleLogout` 逻辑

### 修改文件

#### `frontend/src/views/Dashboard.vue` — 使用 AppLayout + 修复统计标签

- **修改**：移除完整侧边栏模板和 CSS，改用 `<AppLayout>` 包裹
- **修复**：员工视角下"全部项目"标签改为"我的项目"（`userStore.isManager ? '全部项目' : '我的项目'`）

#### `frontend/src/views/Workload.vue` — 使用 AppLayout + 修复魔数

- **修改**：移除侧边栏，改用 `<AppLayout>`
- **修复**：进度条宽度计算中的魔数 `300` 提取为命名常量 `MAX_BAR_CONTRIBUTION`

#### `frontend/src/views/ProjectForm.vue` — 使用 AppLayout + 添加系统丢弃警告

- **修改**：移除侧边栏，改用 `<AppLayout>`；补充缺失的主题切换按钮
- **修复**：提交时若有未填写系统名称的系统，弹出 `confirm()` 确认框提醒用户

#### `frontend/src/views/Export.vue` — 使用 AppLayout + 部门默认值

- **修改**：移除侧边栏，改用 `<AppLayout>`
- **修复**：部门默认值从硬编码 `"软测部"` 改为优先读取当前用户的 `department` 字段

#### 其余页面（Projects / ProjectDetail / Users / Backup）

- **统一修改**：移除各自的侧边栏模板（~80 行）、侧边栏 CSS（~60 行）、`isDark`/`toggleTheme`/`handleLogout` 重复逻辑，改用 `<AppLayout>` 包裹

---

## v1.5.1 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `frontend/src/components/AppLayout.vue` |
| **新增** | `frontend/src/composables/useTheme.js` |
| **修改** | `frontend/src/views/Dashboard.vue` |
| **修改** | `frontend/src/views/Projects.vue` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |
| **修改** | `frontend/src/views/ProjectForm.vue` |
| **修改** | `frontend/src/views/Workload.vue` |
| **修改** | `frontend/src/views/Export.vue` |
| **修改** | `frontend/src/views/Users.vue` |
| **修改** | `frontend/src/views/Backup.vue` |

## v1.5.1 测试方式

- `npm run build` 构建通过，零错误
- 访问每个页面，确认侧边栏正常显示且导航高亮正确
- 切换深色/浅色主题，确认所有页面同步生效
- 员工登录仪表盘，确认统计卡片标签显示"我的项目"而非"全部项目"
- 新建项目时添加空系统后提交，确认弹出确认提示
- 导出页面确认部门字段自动填充当前用户部门

---

## v1.5 — 深度代码审查修复

### 删除冲突文件（CRITICAL）

删除 7 个与主代码冲突的重复/未使用文件，消除运行时 import 混淆风险：

| 删除文件 | 原因 |
| :--- | :--- |
| `backend/main.py` | 旧 async 入口，与 `app/main.py`（sync）冲突 |
| `backend/app/models/database.py` | 旧 async 数据库配置（AsyncSession），与 `app/database.py` 冲突 |
| `backend/app/models/user.py` | 重复 User 模型，字段名与 `models/models.py` 不一致 |
| `backend/app/models/project.py` | 重复 Project/System/Assignment 模型 |
| `backend/app/utils/security.py` | 旧 async 认证模块，与 `services/auth.py` 冲突 |
| `backend/app/schemas/project.py` | 新 schema 文件但从未被路由引用 |
| `backend/app/schemas/user.py` | 新 schema 文件但从未被路由引用 |

### CRITICAL 修复

- **备份恢复 SQL 注入**（`routers/backup.py`）— `__import__('sqlalchemy')` 反模式 + f-string 拼接表名替换为 `_ALLOWED_TABLES` 白名单 + 参数化查询
- **备份恢复信任 password_hash**（`routers/backup.py`）— 恢复时始终重置密码为默认值，强制 `must_change_password=True`，防止恶意备份植入已知哈希
- **备份恢复无 FK 校验**（`routers/backup.py`）— 新增 creator_id、manager_id、project_id、assignee_id 引用完整性校验
- **安全头缺失**（`app/main.py`）— 新增 `SecurityHeadersMiddleware`（X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, HSTS）
- **localStorage JSON 解析崩溃**（`stores/user.js`）— 损坏的 localStorage 数据导致白屏，改用 `safeParseUser()` + try/catch

### HIGH 修复

- **joinedload 笛卡尔积**（`routers/projects.py`, `routers/exports.py`）— 所有 `joinedload` 替换为 `selectinload`，消除一对多关系导致的重复行和性能问题
- **登录限速内存泄漏**（`routers/auth.py`）— 成功登录时清除该 IP 的失败记录，失败计数为 0 时 `pop()` 移除 key
- **修改密码允许新旧相同**（`routers/auth.py`）— 新增新旧密码相同检查
- **分发项目不验证 assignee 角色**（`routers/projects.py`）— 新增 assignee_ids 存在性 + employee 角色校验
- **员工可查看任意项目分配**（`routers/projects.py`）— `get_assignments` 新增员工授权检查
- **Excel 导出仅取第一条贡献率**（`routers/exports.py`）— 改为收集所有 assignment 的贡献文本并合并
- **Word 导出 .bold 赋值无效**（`routers/exports.py`）— 修复 `p.add_run().bold = True` 链式调用返回 None 的问题
- **python-multipart CVE-2024-24762**（`requirements.txt`）— 从 0.0.6 升级到 0.0.9

### MEDIUM 修复

- **admin 密码日志泄露**（`app/main.py`）— 生产环境使用 `secrets.token_urlsafe(12)` 生成密码，不在日志中打印
- **根端点信息泄露**（`app/main.py`）— 移除版本号和 docs URL，仅返回 `{"status": "ok"}`
- **admin 种子在模块级执行**（`app/main.py`）— 移至 `@app.on_event("startup")`，避免 import 副作用
- **Schema 缺少字段校验**（`schemas/schemas.py`）— 新增 min_length, max_length, ge, le 等 Field 约束
- **备份恢复错误信息泄露内部细节**（`routers/backup.py`）— 敏感错误仅 `logger.error()`，客户端返回通用消息
- **备份文件仅检查后缀不检查 content_type**（`routers/backup.py`）— 新增 MIME 类型校验
- **Export 文件名注入**（`routers/exports.py`）— 新增 `_sanitize_filename()` 正则清洗
- **must_change_password 路由守卫缺失**（`router/index.js`）— 新增前端守卫阻止未改密用户访问系统
- **下载链接未挂载 DOM**（`ProjectDetail.vue`, `Export.vue`, `Backup.vue`）— 修复 Firefox 下载失败
- **恢复后用户状态不一致**（`Backup.vue`）— `doRestore` 后 `fetchCurrentUser` 失败时自动登出

---

## v1.5 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **删除** | `backend/main.py` |
| **删除** | `backend/app/models/database.py` |
| **删除** | `backend/app/models/user.py` |
| **删除** | `backend/app/models/project.py` |
| **删除** | `backend/app/utils/security.py` |
| **删除** | `backend/app/schemas/project.py` |
| **删除** | `backend/app/schemas/user.py` |
| **修改** | `backend/app/utils/__init__.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `backend/app/routers/auth.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `backend/app/routers/exports.py` |
| **修改** | `backend/app/routers/backup.py` |
| **修改** | `backend/requirements.txt` |
| **修改** | `frontend/src/stores/user.js` |
| **修改** | `frontend/src/router/index.js` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |
| **修改** | `frontend/src/views/Projects.vue` |
| **修改** | `frontend/src/views/Users.vue` |
| **修改** | `frontend/src/views/Export.vue` |
| **修改** | `frontend/src/views/Backup.vue` |

---

## v1.5 测试方式

- 启动项目，确认无 import 报错（冲突文件已删除）
- 验证安全响应头：`curl -I http://localhost:8000/` 检查 X-Content-Type-Options 等头部
- 测试备份恢复：导出 JSON → 手动篡改 password_hash → 导入 → 确认密码被重置为默认值
- 测试分发项目：尝试分发给经理角色用户，验证返回 400
- 测试员工权限：员工访问未分配项目的分配记录，验证返回 404
- 在 Firefox 中测试 Word/Excel/JSON 下载，确认文件正常下载
- 损坏 localStorage 中的 user 数据，刷新页面确认不白屏
- 修改密码时输入相同的新旧密码，验证返回 400

---
> - v1.2.1: 恢复 PostgreSQL 默认驱动依赖（`asyncpg`、`psycopg2-binary`），修复仅改 `DATABASE_URL` 切换 PostgreSQL 时的缺驱动启动失败问题
> - v1.2: 安全改造（管理员分发账户、首次改密、重置密码）+ bcrypt 兼容性修复
> - v1.1: 修改启动行为，关闭 CMD 窗口时自动停止所有子进程

## v1.4 修复清单

### CRITICAL 修复

- **备份导出不再包含密码哈希**（`routers/backup.py`）— 防止敏感信息泄露；恢复时无密码的用户自动设置默认密码并强制改密
- **修改密码需验证旧密码**（`routers/auth.py` + `schemas/schemas.py`）— 首次改密豁免，主动改密必须验证当前密码
- **移除前端不存在的 API 方法**（`api/index.js`）— 删除 `addSystem`/`deleteSystem` 死代码

### HIGH 修复

- **登录接口增加频率限制**（`routers/auth.py`）— 每 IP 60 秒内最多 5 次尝试，超限返回 429
- **员工项目详情权限校验**（`routers/projects.py`）— 员工只能查看分配给自己的项目详情
- **贡献率更新增加项目状态检查**（`routers/projects.py`）— 已完成项目禁止修改贡献率
- **备份导入后重置自增序列**（`routers/backup.py`）— 兼容 SQLite 和 PostgreSQL，防止后续插入主键冲突
- **_seed_admin 增加异常处理**（`main.py`）— try/except 包裹，print 改为 logging
- **Excel 列宽改用 get_column_letter**（`routers/exports.py`）— 支持超过 26 列

### MEDIUM 修复

- **更新项目编号唯一性校验**（`routers/projects.py`）— 防止修改时与其他项目编号冲突导致 500
- **UserRole 枚举值校验**（`routers/users.py`）— 无效角色返回 400 而非 500
- **备份导入文件大小限制 50MB**（`routers/backup.py`）— 防止 OOM
- **项目列表 joinedload 去重**（`routers/projects.py`）— 防止一对多关系产生重复行
- **datetime.utcnow() 替换为 timezone-aware**（`services/auth.py` + `routers/backup.py`）— 兼容 Python 3.12+
- **备份下载 db 路径解析为绝对路径**（`routers/backup.py`）— 防止相对路径在不同 CWD 下找不到文件

### LOW 修复

- **401 拦截改用 Vue Router 跳转**（`api/index.js`）— 避免全页刷新丢失状态
- **移除 launcher.py 未使用的 signal 导入**
- **declarative_base 从 sqlalchemy.orm 导入**（`database.py`）— 修复弃用警告
- **Export.vue 移除未使用的 computed 导入**

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/routers/auth.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `backend/app/routers/users.py` |
| **修改** | `backend/app/routers/backup.py` |
| **修改** | `backend/app/routers/exports.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `backend/app/database.py` |
| **修改** | `backend/app/services/auth.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `frontend/src/views/Export.vue` |
| **修改** | `launcher.py` |

---

## 测试方式

- 启动项目，连续输错密码 6 次，验证第 6 次返回 429
- 以员工身份访问未分配的项目详情 ID，验证返回 403
- 已完成项目尝试修改贡献率，验证返回 400
- 导出 JSON 备份，确认文件中不含 password_hash 字段
- 主动修改密码时不填旧密码，验证返回 400
- 更新项目编号为已存在的编号，验证返回 400
- 导入备份后新建用户/项目，验证 ID 不冲突

### backend/app/routers/backup.py — 数据库备份与恢复 API

- **功能**：提供 JSON 备份导出、SQLite 数据库文件下载、JSON 备份恢复三个接口
- **实现原理**：
  - `POST /api/backup/export` — 遍历所有表数据序列化为 JSON 下载
  - `GET /api/backup/download-db` — 直接复制 SQLite .db 文件供下载（仅 SQLite 模式）
  - `POST /api/backup/import` — 上传 JSON 文件，按依赖顺序清空再恢复所有表数据
- **权限**：所有接口仅经理可操作

### frontend/src/views/Backup.vue — 备份恢复管理页面

- **功能**：前端备份恢复操作界面，包含 JSON 备份下载、数据库文件下载、拖拽上传恢复
- **实现原理**：调用 `backupApi` 进行文件下载和上传，恢复前弹窗二次确认

---

## 修改文件

### backend/app/routers/users.py — 修复删除用户外键级联问题

- **修改位置**：`delete_user` 函数（约第 170 行）
- **修改内容**：删除用户前先将 `projects` 表中该用户作为 `business_manager_id`、`implementation_manager_id`、`creator_id` 的引用置为 NULL，防止外键约束错误

### backend/app/routers/projects.py — 修复员工项目列表重复 + 工作量统计日期查询

- **修改位置**：`get_projects` 函数（约第 134 行）、`get_workload_stats` 函数（约第 47 行）
- **修改内容**：
  - 员工项目列表改用子查询过滤，避免 `joinedload + join` 产生重复记录
  - 工作量统计将 `extract()` 日期函数改为字符串范围比较，兼容 SQLite 和 PostgreSQL

### backend/app/main.py — 注册备份路由

- **修改位置**：路由导入和注册（第 9、66 行）
- **修改内容**：新增 `backup_router` 导入和 `app.include_router(backup_router)`

### backend/app/routers/__init__.py — 导出备份路由

- **修改位置**：模块导入（第 5 行）
- **修改内容**：新增 `from app.routers.backup import router as backup_router`

### frontend/src/api/index.js — 新增备份恢复 API

- **修改位置**：文件末尾
- **修改内容**：新增 `backupApi` 对象，包含 `exportJson`、`downloadDb`、`importJson` 三个方法

### frontend/src/router/index.js — 新增备份页面路由

- **修改位置**：路由配置数组
- **修改内容**：新增 `/backup` 路由，需要 `requiresAuth` 和 `requiresManager` 权限

### frontend/src/views/*.vue — 所有页面侧边栏新增”备份恢复”导航

- **修改位置**：各页面 sidebar-nav 区域
- **修改内容**：在”用户管理”链接后新增”备份恢复”导航项（仅经理可见）

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | `backend/app/routers/backup.py` |
| **新增** | `frontend/src/views/Backup.vue` |
| **修改** | `backend/app/routers/users.py` |
| **修改** | `backend/app/routers/projects.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `backend/app/routers/__init__.py` |
| **修改** | `frontend/src/api/index.js` |
| **修改** | `frontend/src/router/index.js` |
| **修改** | `frontend/src/views/Dashboard.vue` |
| **修改** | `frontend/src/views/Projects.vue` |
| **修改** | `frontend/src/views/ProjectForm.vue` |
| **修改** | `frontend/src/views/ProjectDetail.vue` |
| **修改** | `frontend/src/views/Workload.vue` |
| **修改** | `frontend/src/views/Export.vue` |
| **修改** | `frontend/src/views/Users.vue` |

---

## 测试方式

- 启动项目（`start.bat`），以经理身份登录
- 验证侧边栏出现”备份恢复”导航项
- 点击”JSON 备份”下载 `.json` 文件，验证文件内容包含 users/projects/systems/project_assignments 数据
- 点击”数据库文件备份”下载 `.db` 文件
- 上传之前下载的 `.json` 文件进行恢复，确认弹出二次确认弹窗，确认后提示恢复成功并显示统计
- 以员工身份登录，验证侧边栏不显示”备份恢复”
- 验证删除一个已分配为业务负责人的用户不再报错
- 以员工身份登录，验证项目列表无重复记录

# 修改记录 — 项目完结单管理平台

> **修订记录**
>
> - v1.2: 安全改造（管理员分发账户、首次改密、重置密码）+ bcrypt 兼容性修复
> - v1.1: 修改启动行为，关闭 CMD 窗口时自动停止所有子进程

## 新增文件 (如有)

_无新增文件_

---

## 修改文件

### backend/app/models/models.py — 用户模型新增字段

- **修改位置**：`User` 类
- **修改内容**：
  - 导入 `Boolean`，新增 `must_change_password = Column(Boolean, default=True, nullable=False)` 字段
  - 用于标记用户是否需要首次登录修改密码

### backend/app/models/user.py — 同步用户模型

- **修改位置**：`User` 类
- **修改内容**：同步添加 `must_change_password` 字段

### backend/app/routers/auth.py — 认证路由安全改造

- **修改位置**：整个文件重写
- **修改内容**：
  - 移除 `/register` 公开注册路由（任何人可注册任意角色 → 禁止公开注册）
  - 新增 `POST /api/auth/change-password` 修改密码接口
  - 登录和获取当前用户接口均返回 `must_change_password` 标志

### backend/app/routers/users.py — 新增重置密码接口

- **修改位置**：新增 `reset_password` 函数，所有 `UserResponse` 返回
- **修改内容**：
  - 新增 `POST /api/users/{user_id}/reset-password` 接口（仅经理权限），密码重置为 `123456`
  - 所有 `UserResponse` 返回值增加 `must_change_password` 字段

### backend/app/schemas/schemas.py — Schema 更新

- **修改位置**：`RegisterRequest`、`UserResponse`、新增 `ChangePasswordRequest`
- **修改内容**：
  - 删除 `RegisterRequest` 类
  - `UserResponse` 增加 `must_change_password: bool` 字段
  - 新增 `ChangePasswordRequest` 类

### backend/app/main.py — 初始管理员种子数据

- **修改位置**：`Base.metadata.create_all` 之后
- **修改内容**：首次启动如数据库无用户，自动创建管理员 `admin / admin123`（需首次改密）

### backend/requirements.txt — 锁定 bcrypt 版本

- **修改位置**：依赖列表
- **修改内容**：新增 `bcrypt==4.0.1`，解决 passlib 与新版 bcrypt 4.1+ 不兼容问题

### launcher.py — 改进依赖更新机制

- **修改位置**：`install_backend_deps()` 函数
- **修改内容**：对比 `requirements.txt` 与 `.deps_installed` 修改时间，依赖文件更新后自动重新安装

### frontend/src/views/Login.vue — 移除注册、新增改密弹窗

- **修改位置**：整个文件重写
- **修改内容**：
  - 移除注册表单和注册/登录切换
  - 新增首次登录强制修改密码弹窗
  - 底部提示文案改为"账户由管理员统一分配"

### frontend/src/views/Users.vue — 新增重置密码按钮

- **修改位置**：操作列、script 部分
- **修改内容**：操作列增加"重置密码"按钮和确认弹窗

### frontend/src/stores/user.js — 状态管理更新

- **修改位置**：整个文件重写
- **修改内容**：移除 `register` 方法，新增 `changePassword` 方法和 `mustChangePassword` 计算属性

### frontend/src/api/index.js — API 更新

- **修改位置**：`authApi`、`usersApi`
- **修改内容**：移除 `register`，新增 `changePassword` 和 `resetPassword`

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `backend/app/models/models.py` |
| **修改** | `backend/app/models/user.py` |
| **修改** | `backend/app/routers/auth.py` |
| **修改** | `backend/app/routers/users.py` |
| **修改** | `backend/app/schemas/schemas.py` |
| **修改** | `backend/app/main.py` |
| **修改** | `backend/requirements.txt` |
| **修改** | `launcher.py` |
| **修改** | `frontend/src/views/Login.vue` |
| **修改** | `frontend/src/views/Users.vue` |
| **修改** | `frontend/src/stores/user.js` |
| **修改** | `frontend/src/api/index.js` |

---

## 测试方式

1. **删除旧数据库**：删除 `backend/project_completion.db`（新增了字段，旧库不兼容）
2. 运行 `start.bat`，确认自动创建默认管理员 `admin / admin123`
3. 登录 admin 账户，验证弹出修改密码弹窗
4. 修改密码后正常进入系统
5. 在用户管理页创建新用户，验证新用户首次登录也需改密
6. 测试重置密码功能：点击重置后该用户密码变为 `123456`，再次登录需改密
7. 确认登录页无注册入口


## 修改文件

### launcher.py — 启动行为改为"关窗即停"

- **修改位置**：`start_backend()`、`start_frontend()`、`main()` 函数及模块级代码
- **修改内容**：
  - 移除 `subprocess.CREATE_NEW_CONSOLE`，后端/前端不再在独立窗口中启动
  - 新增 `_child_processes` 全局列表统一管理所有子进程
  - 新增 `cleanup()` 函数 + `atexit.register(cleanup)` 确保退出时终止子进程
  - `main()` 函数改为持续循环等待，支持 `Ctrl+C` 和直接关闭窗口两种退出方式
  - 移除启动后的 `input()` 阻塞提示，改为自动打开浏览器

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | `launcher.py` |
| **新增** | `CHANGES.md` |

---

## 测试方式

- 运行 `start.bat`，确认后端和前端服务正常启动
- 关闭 CMD 窗口，确认后端（端口 8000）和前端（端口 5173）进程均已自动停止
- 无需再去任务管理器手动终止进程
