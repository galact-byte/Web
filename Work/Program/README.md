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

后端启动后访问 http://localhost:8000/docs 查看 API 文档（仅开发模式可用）。

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
| 用户认证 | 管理员分发账户，首次登录强制改密，JWT Token 认证 |
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
├── start.bat                 # 一键启动入口（Windows）
├── launcher.py               # 启动脚本（环境检查、依赖安装、服务启动）
│
├── backend/                  # 后端（Python FastAPI）
│   ├── .env.example          # 环境变量配置模板
│   └── app/
│       ├── main.py           # 入口（含安全配置）
│       ├── database.py       # 数据库配置
│       ├── models/           # 数据模型
│       ├── schemas/          # 请求/响应模式
│       ├── routers/          # API 路由
│       └── services/         # 业务逻辑（含 JWT 认证）
│
├── frontend/                 # 前端（Vue 3 + Vite）
│   └── src/
│       ├── api/              # API 调用
│       ├── stores/           # 状态管理
│       ├── router/           # 路由配置
│       └── views/            # 页面组件
│           ├── Dashboard      # 仪表盘
│           ├── Projects       # 项目管理
│           ├── Workload       # 工作量统计
│           ├── Export         # 导出完结单
│           └── Users          # 用户管理
│
└── Request/                  # 原始需求文档
```

---

## ⚙️ 配置说明

复制 `backend/.env.example` 为 `backend/.env`，按需修改配置项：

```bash
cp backend/.env.example backend/.env
```

### 环境模式

| 变量 | 值 | 说明 |
|------|------|------|
| `ENV` | `dev`（默认） | 开发模式：启用 Swagger 文档（`/docs`），使用默认密钥 |
| `ENV` | `prod` | 生产模式：禁用 Swagger 文档，强制要求设置 `SECRET_KEY` |

### 数据库

默认使用 SQLite（零配置，开箱即用），部署到服务器时可通过 `DATABASE_URL` 环境变量切换，**无需改代码**。

#### SQLite（默认，本地开发）

无需配置，数据存储在 `backend/project_completion.db` 文件中。

#### PostgreSQL（推荐生产环境）

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/project_completion
```

> 驱动 `psycopg2-binary` 已包含在 `requirements.txt` 中，无需额外安装。

#### MySQL

```bash
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/project_completion
```

> 需额外安装驱动：`pip install pymysql`

#### 国产数据库

项目基于 SQLAlchemy ORM，支持通过安装对应驱动连接国产数据库：

| 数据库 | DATABASE_URL 格式 | 驱动安装 |
|--------|------------------|----------|
| 达梦 (DM) | `dm+dmPython://user:pwd@host:5236/dbname` | `pip install dmPython` |
| 人大金仓 (KingbaseES) | `postgresql://user:pwd@host:54321/dbname` | `pip install psycopg2-binary`（兼容 PG 协议） |
| GaussDB | `postgresql://user:pwd@host:5432/dbname` | `pip install psycopg2-binary`（兼容 PG 协议） |

> **提示**：人大金仓和 GaussDB 兼容 PostgreSQL 协议，直接使用 PostgreSQL 连接方式即可。达梦需安装官方 Python 驱动 `dmPython`。

#### 注意事项

- 项目基于 SQLAlchemy ORM，全部通过 Python 对象操作，**没有手写 SQL**，因此切换数据库无需修改业务代码
- 切换 PostgreSQL / 人大金仓 / GaussDB：只需修改 `DATABASE_URL`，驱动已内置
- 切换 MySQL / 达梦：修改 `DATABASE_URL` + 安装对应驱动包
- 切换数据库后首次启动会自动建表
- 如数据库中无用户，会自动创建默认管理员 `admin / admin123`

### JWT 密钥（生产环境必须修改）

```bash
# 生成强随机密钥
python -c "import secrets; print(secrets.token_urlsafe(64))"

# 填入 .env
SECRET_KEY=生成的密钥
```

> ⚠️ **生产环境未设置 `SECRET_KEY` 时，服务器将拒绝启动。**

### CORS 跨域

```bash
# 多个来源用逗号分隔
CORS_ORIGINS=https://你的前端域名
```

---

## 📝 使用流程

1. **首次启动** - 系统自动创建管理员 `admin / admin123`，首次登录需改密
2. **管理员创建用户** - 在用户管理页添加员工/经理账户
3. **创建项目**（经理）- 填写项目信息和系统
4. **分发项目**（经理）- 将项目分配给员工
5. **填写贡献率**（员工）- 补充部门和贡献率信息
6. **导出完结单** - 选择项目导出 Excel 或 Word
7. **查看工作量** - 访问"工作量统计"了解各人员季度贡献
8. **切换主题** - 点击侧边栏底部图标切换深浅主题

---

## 📦 技术栈

- **前端**：Vue 3 + Vite + Vue Router + Pinia + Axios
- **后端**：Python FastAPI + SQLAlchemy + JWT
- **数据库**：SQLite / PostgreSQL
- **导出**：openpyxl + python-docx

---

## 📄 License

MIT
