# 项目完结单管理平台

在线项目完结单管理系统，支持经理/员工角色区分、项目管理、分发、季度工作量统计、深浅主题切换和 Excel/Word 导出。

---

## 🚀 快速开始

### 一键启动

**Windows** — 双击 `start.bat`

**Linux/macOS** — 运行 `bash start.sh`

> 脚本会自动检查环境、安装依赖、启动前后端服务并打开浏览器。
>
> - `ENV=dev` 时：启动开发模式后端和 Vite 开发服务器
> - `ENV=prod` 时：启动生产模式后端，并执行前端构建后用 `vite preview` 预览生产包

### 手动启动

### 环境要求
- Python 3.10 - 3.12（推荐 3.12；不支持 3.13+ / 3.14）
- Node.js 20.19+ 或 22.12+（推荐 Node.js 22 LTS；匹配 Vite 8 要求）

### 启动后端

```bash
cd backend

# 安装依赖
python -m pip install -r requirements.txt

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

### 生产部署说明

正式部署推荐使用 Docker Compose。前端生产构建默认使用相对路径 `/api` 访问后端，Compose 部署会由 Nginx 容器托管前端静态文件，并将 `/api` 反向代理到后端容器。

部署默认启用 HTTPS：Nginx 容器首次启动时会自动生成自签名证书（存于 `frontend_ssl` 卷，重建不丢），HTTP 请求统一 301 跳转到 HTTPS。这是必需的——前端登录通过浏览器 `crypto.subtle` 加密密码，该 API 仅在安全上下文（HTTPS / localhost）下可用，纯 HTTP 访问会导致登录静默失败，且明文传输不安全。如需正式证书，把 `server.crt` / `server.key` 放进证书卷覆盖即可。

#### Docker Compose 部署（推荐）

服务器要求：

- Linux 服务器
- Docker Engine
- Docker Compose v2（可执行 `docker compose version`）
- 服务器防火墙 / 安全组放行 `HTTPS_PORT`（默认 `443`）和 `HTTP_PORT`（默认 `80`，用于跳转）

首次部署：

```bash
# 1. 进入项目目录
cd Program

# 2. 复制生产配置模板
cp .env.production.example .env.production

# 3. 编辑生产配置
vim .env.production
```

`.env.production` 必须修改这些值：

```bash
POSTGRES_PASSWORD=强数据库密码
SECRET_KEY=强随机密钥
DEFAULT_ADMIN_PASSWORD=首次登录管理员密码
CORS_ORIGINS=https://你的服务器IP或域名
```

可选项：`SSL_CN` 填服务器 IP / 域名（自签名证书标识用），`HTTP_PORT` / `HTTPS_PORT` 默认 `80` / `443`。

真实的 `.env.production` 包含密钥和数据库密码，已被 `.gitignore` 忽略；不要提交到代码仓库。模板 `.env.production.example` 会保留在仓库中，方便迁移到其他服务器。

生成 `SECRET_KEY`：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

启动部署：

```bash
bash deploy.sh
```

部署完成后访问：

```text
https://服务器IP
```

> 自签名证书浏览器会提示"不安全"，点"高级 → 继续访问"即可（内部系统可接受）。

常用运维命令：

```bash
# 查看容器状态
docker compose --env-file .env.production ps

# 查看日志
docker compose --env-file .env.production logs -f

# 只看后端日志
docker compose --env-file .env.production logs -f backend

# 更新代码后重新构建并启动
docker compose --env-file .env.production up -d --build

# 停止服务（不删除数据卷）
docker compose --env-file .env.production down
```

数据持久化：

- PostgreSQL 数据保存在 Compose 项目的 `postgres_data` volume 中，实际名称会带当前 Compose 项目前缀
- 后端运行数据保存在 Compose 项目的 `backend_data` volume 中，实际名称会带当前 Compose 项目前缀
- 爬虫配置文件在容器内使用 `/app/data/progress_config.json`，会随 `backend_data` 持久化
- TLS 自签名证书保存在 `frontend_ssl` volume 中，容器重建不会重新生成；如需更换证书可删除该卷或直接覆盖卷内 `server.crt` / `server.key`

数据库备份：

```bash
# 导出 PostgreSQL 数据
docker compose --env-file .env.production exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup.sql

# 恢复 PostgreSQL 数据
docker compose --env-file .env.production exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"' < backup.sql
```

#### 国内服务器镜像拉取问题

国内服务器直连 Docker Hub 可能较慢或失败。本项目不绑定单一镜像源，基础镜像都可以在 `.env.production` 中替换：

```bash
PYTHON_IMAGE=python:3.12-slim
NODE_IMAGE=node:22-alpine
NGINX_IMAGE=nginx:alpine
POSTGRES_IMAGE=postgres:16-alpine
```

可选处理方式：

- 配置 Docker registry mirror 后再执行 `bash deploy.sh`
- 将上面的镜像变量替换为你服务器可访问的等价镜像
- 在能访问外网的机器执行 `docker pull` / `docker save`，再在服务器上 `docker load` 离线导入

如果 `deploy.sh` 在构建阶段失败，优先检查镜像拉取日志；部署脚本不会静默跳过失败。

#### 传统部署（备选）

如果服务器资源极紧张，或运维团队更熟悉宿主机部署，也可以使用传统方式：

- 后端：Python 3.12 虚拟环境 + `uvicorn` + `systemd`
- 前端：`npm run build` 后由宿主机 Nginx 托管 `frontend/dist`
- 数据库：宿主机 PostgreSQL

传统部署需要自行维护 systemd unit、Nginx server 配置和数据库备份策略；新部署优先使用 Docker Compose。

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
| 项目进度 | 从内部项目管理系统爬取进度数据，支持 7 种项目类型（等保测评、密码评估、安全评估、风险评估、软件测试、安全服务、综合服务），自动登录（OCR 验证码）、分页爬取、Excel 导出 |
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
│       └── services/         # 业务逻辑（含 JWT 认证、进度爬虫）
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
│           ├── Progress       # 项目进度（爬取/查询/导出）
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

> 应用启动时会自动读取 `backend/.env`。若系统环境变量与 `.env` 同时存在，系统环境变量优先。

### 数据库

默认使用 SQLite（零配置，开箱即用），部署到服务器时可通过 `DATABASE_URL` 环境变量切换，**无需改代码**。

#### SQLite（默认，本地开发）

无需配置，数据存储在 `backend/project_completion.db` 文件中。

#### PostgreSQL（推荐生产环境）

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/project_completion
```

> 驱动 `psycopg2-binary` 已包含在 `requirements.txt` 中，无需额外安装。
> Docker Compose 部署默认使用 `.env.production` 里的 `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD` 生成连接地址，不需要手写 `DATABASE_URL`。

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
- 如数据库中无用户，会自动创建管理员账户 `admin`：本地开发默认密码 `admin123`；设置了 `DEFAULT_ADMIN_PASSWORD`（Docker 部署）时则以该值为准，首次登录强制改密

### JWT 密钥（生产环境必须修改）

```bash
# 生成强随机密钥
python -c "import secrets; print(secrets.token_urlsafe(64))"

# 填入 .env
SECRET_KEY=生成的密钥
```

> ⚠️ **生产环境未设置 `SECRET_KEY` 时，服务器将拒绝启动。**

### 项目进度爬虫

复制 `backend/progress_config.example.json` 为 `backend/progress_config.json`，填入实际配置：

```bash
cp backend/progress_config.example.json backend/progress_config.json
```

```json
{
  "base_url": "https://your-server/XYivUozEqQ.php",
  "pfx_path": "C:\\path\\to\\your.pfx",
  "pfx_password": null,
  "username": "your_username",
  "password": "your_password",
  "cookie": "",
  "page_size": 50
}
```

| 字段 | 说明 |
|------|------|
| `base_url` | 项目管理系统地址 |
| `pfx_path` | 客户端 PFX 证书路径（用于 HTTPS 双向认证） |
| `pfx_password` | PFX 密码，无密码填 `null` |
| `username` / `password` | 系统登录账号密码 |
| `cookie` | PHPSESSID，留空则自动登录（OCR 验证码） |
| `page_size` | 每页爬取数量 |

> 此文件包含敏感凭据，已在 `.gitignore` 中忽略。

### CORS 跨域

```bash
# 多个来源用逗号分隔
CORS_ORIGINS=https://你的前端域名
```

### 前端生产环境 API 地址

- 开发环境默认请求 `http://localhost:8000`
- 生产环境默认请求相对路径 `/api`
- 如果你的生产环境不是通过 Nginx 反代 `/api`，可显式设置：

```bash
VITE_API_URL=https://你的后端地址
```

---

## 💾 备份与恢复

系统提供两种备份方式（经理账户在"备份恢复"页面操作）：

### JSON 备份（推荐）

- **导出**：点击"导出 JSON 备份"，下载包含所有表数据的 `.json` 文件
- **恢复**：点击"导入 JSON 备份"，上传之前导出的 `.json` 文件
- ⚠️ 恢复会**清空现有数据**并用备份数据替换，所有用户密码重置为 `123456`

### SQLite 数据库文件备份

- **导出**：点击"下载数据库文件"，下载 `.db` 文件（仅 SQLite 模式可用）
- **恢复**：需手动操作
  1. 停止后端服务
  2. 用下载的 `.db` 文件替换 `backend/project_completion.db`
  3. 重新启动后端服务

> **提示**：JSON 备份跨数据库通用（SQLite/PostgreSQL/MySQL 均可互相恢复），SQLite 文件备份仅适用于 SQLite 数据库。

---

## 📝 使用流程

1. **首次启动** - 系统自动创建管理员 `admin`（本地开发默认密码 `admin123`；Docker 部署为 `DEFAULT_ADMIN_PASSWORD`），首次登录需改密
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
