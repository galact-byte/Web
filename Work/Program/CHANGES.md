# 修改记录 — 项目完结单管理平台

> **修订记录**
>
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
