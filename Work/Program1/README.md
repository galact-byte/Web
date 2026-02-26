# 定级备案管理系统（FastAPI）

本项目根据 `需求.docx` 实现了一个可本地测试、可部署的首版系统，包含单位信息、系统信息、自动报告、流程管控、数据看板、知识库管理等模块。

## 1. 技术栈

- 后端: FastAPI + SQLAlchemy
- 数据库: 默认 SQLite，可切换 MySQL / 达梦 / 人大金仓
- 前端: Jinja2 模板 + 原生 JS + Chart.js
- 报告导出: python-docx + reportlab

## 2. 快速启动（一键）

双击运行项目根目录下的 `start.bat` 即可：

- 自动创建虚拟环境 `.venv`
- 自动安装依赖
- 启动服务: `http://127.0.0.1:8000`

## 3. 手动启动

```powershell
cd E:\vscode\Programs\Program1
python -m venv .venv
.\.venv\Scripts\activate
python -m pip install -i https://pypi.org/simple -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

页面入口：

- 看板: `http://127.0.0.1:8000/`
- 单位管理: `http://127.0.0.1:8000/organizations`
- 系统管理: `http://127.0.0.1:8000/systems`
- 报告管理: `http://127.0.0.1:8000/reports`
- 知识库: `http://127.0.0.1:8000/knowledge`
- API 文档: `http://127.0.0.1:8000/docs`

文档开关（建议生产关闭）：

- `ENABLE_API_DOCS=1` 开启
- `ENABLE_API_DOCS=0` 关闭
- 未设置时默认关闭（等同 `0`）

## 4. 数据库配置

通过环境变量 `DATABASE_URL` 切换数据库。

### SQLite（默认）

```text
sqlite:///./app.db
```

### MySQL（推荐生产）

```text
mysql+pymysql://user:password@127.0.0.1:3306/filing_db?charset=utf8mb4
```

### 达梦 / 人大金仓

本项目数据层使用通用 SQLAlchemy 写法，可接入国产数据库。  
需安装对应厂商驱动和 SQLAlchemy 方言后，配置 `DATABASE_URL` 即可（连接串格式以你现场驱动文档为准）。

## 5. 功能覆盖说明

- 基础信息管理: 单位新增、编辑、查询、归档、回收站恢复、变更历史、Excel/Word 导入导出、附件管理
- 系统信息管理: 多系统关联单位、复制复用、归档、回收站恢复、变更历史、Excel/Word 导入导出、附件管理
- 报告生成: 自动生成定级报告/备案表/专家评审意见表，支持版本管理、提交审核、驳回重提、Word/PDF 导出
- 流程管控: 默认流程配置、流程推进、异常状态与轨迹记录
- 数据看板: 地区分布、行业分布、级别分布、关键汇总指标
- 知识库: 上传、分类检索、启用/下架、下载、批量下载与下载日志

## 6. 测试

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

## 7. 部署建议

- 用 MySQL/国产数据库替代 SQLite
- 使用反向代理（Nginx）和进程托管（systemd/supervisor）
- 挂载独立附件存储目录（`uploads/`）
- 生产环境关闭 `--reload`
