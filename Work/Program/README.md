# 项目完结单管理平台

在线项目完结单管理系统，支持经理/员工角色区分、项目管理、分发、季度工作量统计、深浅主题切换和 Excel/Word 导出。

---

## 🚀 快速开始

### 一键启动

**Windows** — 双击 `start.bat`

**Linux/macOS** — 运行 `bash start.sh`

> 脚本会自动检查环境、安装依赖、启动前后端服务并打开浏览器。

### 手动启动

### 环境要求
- Python 3.9+
- Node.js 18+

### 启动后端

```bash
cd backend

# 安装依赖
pip install fastapi uvicorn sqlalchemy python-jose[cryptography] passlib[bcrypt] python-multipart openpyxl python-docx

# 启动服务
uvicorn app.main:app --reload --port 8000
```

后端启动后访问 http://localhost:8000/docs 查看 API 文档。

### 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端启动后访问 http://localhost:5173

---

## 📋 功能清单

| 功能模块 | 说明 |
|----------|------|
| 用户认证 | 登录/注册，JWT Token 认证 |
| 角色区分 | 经理可管理所有项目，员工只能看自己被分配的项目 |
| 项目录入 | 项目编号、名称、客户、业务类别、地点等 |
| 多系统支持 | 一个项目可包含多个系统 |
| 项目分发 | 经理可将项目分发给员工 |
| 贡献率填写 | 员工填写部门和人员贡献率 |
| Excel 导出 | 批量导出季度完结单表格 |
| Word 导出 | 单个项目完结单文档 |
| 工作量统计 | 按季度汇总各人员的贡献率，支持展开项目明细 |
| 主题切换 | 支持深色/浅色主题，设置自动保存 |

---

## 🏗️ 项目结构

```
Program/
├── backend/                  # 后端（Python FastAPI）
│   └── app/
│       ├── main.py          # 入口
│       ├── database.py      # 数据库配置
│       ├── models/          # 数据模型
│       ├── schemas/         # 请求/响应模式
│       ├── routers/         # API 路由
│       └── services/        # 业务逻辑
│
├── frontend/                 # 前端（Vue 3 + Vite）
│   └── src/
│       ├── api/             # API 调用
│       ├── stores/          # 状态管理
│       ├── router/          # 路由配置
│       └── views/           # 页面组件
│           ├── Dashboard     # 仪表盘
│           ├── Projects      # 项目管理
│           ├── Workload      # 工作量统计
│           ├── Export        # 导出完结单
│           └── Users         # 用户管理
│
└── Request/                  # 原始需求文档
```

---

## ⚙️ 配置说明

### 数据库切换

默认使用 SQLite，生产环境可切换到 PostgreSQL：

```bash
# 设置环境变量
export DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

### JWT 密钥配置

生产环境请修改 `backend/app/services/auth.py` 中的 `SECRET_KEY`。

---

## 📝 使用流程

1. **注册账户** - 选择经理或员工角色
2. **创建项目**（经理）- 填写项目信息和系统
3. **分发项目**（经理）- 将项目分配给员工
4. **填写贡献率**（员工）- 补充部门和贡献率信息
5. **导出完结单** - 选择项目导出 Excel 或 Word
6. **查看工作量** - 访问“工作量统计”了解各人员季度贡献
7. **切换主题** - 点击侧边栏底部☁️/🌙图标切换深浅主题

---

## 📦 技术栈

- **前端**：Vue 3 + Vite + Vue Router + Pinia + Axios
- **后端**：Python FastAPI + SQLAlchemy + JWT
- **数据库**：SQLite / PostgreSQL
- **导出**：openpyxl + python-docx

---

## 📄 License

MIT
