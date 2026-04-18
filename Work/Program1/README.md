# 衡鉴 · 定级备案管理系统（FastAPI）

本项目根据 `需求.docx` 实现了一个可本地测试、可部署的首版系统，包含单位信息、系统信息、自动报告、流程管控、数据看板、知识库管理等模块。

快速使用可直接看：[用户操作手册](./USER_GUIDE.md)

## 1. 技术栈

- 后端: FastAPI + SQLAlchemy
- 数据库: 默认 SQLite，可切换 MySQL / 达梦 / 人大金仓
- 前端: Jinja2 模板 + 原生 JS + Chart.js
- 报告导出: python-docx + reportlab

## 2. 快速启动（一键）

双击运行项目根目录下的 `start.bat` 即可：

- 自动创建虚拟环境 `.venv`
- 优先使用 `requirements.lock.txt`，缺失时回退到 `requirements.txt`
- 推荐 Python 3.12.x（默认兼容运行，可按需开启严格检查）
- 启动服务: `http://127.0.0.1:8011`（可通过环境变量 `APP_PORT` 覆盖）

## 3. 手动启动

```powershell
cd E:\vscode\Programs\Program1
python -m venv .venv
.\.venv\Scripts\activate
if (Test-Path .\requirements.lock.txt) {
  python -m pip install -i https://pypi.org/simple --timeout 20 --retries 1 -r requirements.lock.txt
} else {
  python -m pip install -i https://pypi.org/simple --timeout 20 --retries 1 -r requirements.txt
}
python -m uvicorn app.main:app --host 0.0.0.0 --port 8011 --reload
```

依赖一致性说明：

- 默认策略为“兼容优先”：有 `requirements.lock.txt` 用锁定依赖；没有则回退到 `requirements.txt`。
- 如需严格模式，可设置：
  - `STRICT_DEP_LOCK=1`（必须有 `requirements.lock.txt`）
  - `STRICT_PY312=1`（必须使用 Python 3.12.x）

页面入口：

- 看板: `http://127.0.0.1:8011/`
- 单位管理: `http://127.0.0.1:8011/organizations`
- 系统管理: `http://127.0.0.1:8011/systems`
- 报告管理: `http://127.0.0.1:8011/reports`
- 流程管控: `http://127.0.0.1:8011/workflow`
- 模板管理: `http://127.0.0.1:8011/templates`
- 知识库: `http://127.0.0.1:8011/knowledge`
- 登录与用户: `http://127.0.0.1:8011/login`
- API 文档: `http://127.0.0.1:8011/docs`

精简交付版启动：

- 双击 `start_lite.bat`
- 或设置 `APP_LITE_MODE=1` 后启动

文档开关（建议生产关闭）：

- `ENABLE_API_DOCS=1` 开启
- `ENABLE_API_DOCS=0` 关闭
- 未设置时默认关闭（等同 `0`）
- 当开启后，`/docs`、`/redoc`、`/openapi.json` 仅管理员可访问，且需携带有效登录令牌。

权限开关：

- `STRICT_AUTH=1` 启用严格鉴权（未登录不可访问受控接口）
- `STRICT_AUTH=0` 兼容模式（默认）
- `API_AUTH_REQUIRED=1` 启用 API 全局登录校验（完整版默认开启）
- `API_AUTH_REQUIRED=0` 关闭 API 全局登录校验（仅建议本地调试）

安全开关（建议服务器开启）：

- `FORCE_HTTPS=1` 通过反向代理启用 HTTPS 后，强制仅 HTTPS 访问。
- 登录防暴力破解参数：
  - `LOGIN_MAX_FAILS`（默认 5）
  - `LOGIN_FAIL_WINDOW_MINUTES`（默认 10）
  - `LOGIN_LOCK_MINUTES`（默认 15）

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

- 基础信息管理: 单位新增、编辑、查询、归档、回收站恢复、变更历史、Excel/Word 导入导出、附件管理、客户采集链接/二维码、客户提交审核入库
- 系统信息管理: 多系统关联单位、复制复用、归档、回收站恢复、变更历史、Excel/Word 导入导出、附件管理
- 报告生成: 自动生成定级报告/备案表/专家评审意见表，支持版本管理、章节增删改顺序、版本差异对比、提交审核、驳回重提、Word/PDF 导出（PDF 可选密码加密）
- 报告模板与签章: 模板中心化管理（上传/分类/版本/恢复/测试填充）、地市+级别模板匹配、签章信息设置并随导出输出
- 官方模板导入: 支持从项目根目录 `01-*.docx`、`02-*.docx`、`03-*.docx` 一键导入为默认模板，导入时自动去除测试样例信息
- 流程管控: 默认流程配置、节点负责人/时限规则、流程推进、超时/临期提醒（站内/邮件可选）、异常状态与轨迹记录、时限延长
- 数据看板: 地区分布、行业分布、级别分布、多维筛选、图表下钻、地图热力图、Excel/PDF/截图导出、全屏展示
- 知识库: 上传、分类检索（模糊/精确）、启用/下架、下载、批量下载、置顶、元数据编辑、新版本上传、版本回滚、下载日志
- 权限体系: 登录、会话令牌、用户与角色管理（admin/reviewer/evaluator）
- 删除申请: 单位/系统删除申请、管理员审核（通过/驳回）、软删除回收站保留30天
- 附件能力: 单文件上传、批量上传、预览、下载、删除

## 6. 测试

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

## 7. 官方模板导入（可选）

将本地模板文件放在项目根目录（文件名建议）：

- `01-*.docx`：备案表模板
- `02-*.docx`：定级报告模板
- `03-*.docx`：专家评审意见表模板

然后在“模板管理”页面点击“导入本地官方模板”，系统会：

- 自动导入为模板管理记录；
- 自动设为各类型默认模板；
- 自动对模板中的样例测试数据做脱敏替换。

## 8. 部署建议

- 用 MySQL/国产数据库替代 SQLite
- 使用反向代理（Nginx）和进程托管（systemd/supervisor）
- 挂载独立附件存储目录（`uploads/`）
- 生产环境关闭 `--reload`
