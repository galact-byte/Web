# 修改记录 — 项目完结单管理平台

# 修改记录 — 项目完结单管理平台

> **修订记录**
>
> - v1.4: 全面代码审查修复（3 CRITICAL + 6 HIGH + 7 MEDIUM + 4 LOW）
> - v1.3: Bug 修复（删除用户级联、员工项目列表重复、工作量统计日期兼容）+ 新增备份与恢复功能
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
