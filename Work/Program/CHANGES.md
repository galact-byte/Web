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
