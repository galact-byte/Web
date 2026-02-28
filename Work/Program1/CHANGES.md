# 修改记录 — 定级备案管理系统（收口：忽略测试残留并推送）

> **修订记录**
>
> - v1.2.24: 更新 `.gitignore` 忽略 `tests/runtime/` 测试残留目录，整理当前变更并准备推送到远端仓库。

## 新增文件 (如有)

无

---

## 修改文件

### .gitignore — 测试残留忽略规则补充

- **修改位置**：`Python 缓存` 段落。
- **修改内容**：新增 `tests/runtime/`，避免测试运行产物反复出现在工作区。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.24 记录。
- **修改内容**：记录本次忽略规则收口与推送准备。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | .gitignore |
| **修改** | CHANGES.md |

---

## 测试方式

- 变更为忽略规则与文档更新，无运行时逻辑改动；
- 已在此前步骤完成 `unittest` 全量回归验证（13/13 通过）。

# 修改记录 — 定级备案管理系统（安全加固：强制改密策略与布尔参数解析）

> **修订记录**
>
> - v1.2.23: 后端强制执行“需改密”策略（仅放行改密/登出/查看自身信息），并修复 `require_password_change` 字符串输入被误判为 `True` 的问题，补充对应回归测试。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 强制改密策略与布尔解析

- **修改位置**：`security_middleware`、`require_roles`、`create_user`。
- **修改内容**：
  - 新增 `parse_optional_bool`，显式解析 `true/false`、`1/0`，非法值返回 400；
  - 新增 `_is_password_change_exempt` 并在鉴权链路启用：
    - `must_change_password=true` 时，仅允许访问 `/api/auth/change-password`、`/api/auth/logout`、`/api/auth/me`；
    - 其余受保护接口返回 403，避免“临时密码长期可用”。

### tests/test_api.py — 安全回归与兼容调整

- **修改位置**：新增 `test_12`、`test_13`，调整 `test_10`。
- **修改内容**：
  - `test_12_must_change_password_is_enforced_server_side`：验证“需改密”账号被后端拦截、改密后恢复访问；
  - `test_13_require_password_change_explicit_bool_parse`：验证 `"false"` 被正确解析为 `False`，非法值返回 400；
  - `test_10_permission_boundaries`：显式传入 `require_password_change=False`，保持其原始“权限边界”测试意图。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.23 记录。
- **修改内容**：记录本次安全修复与测试结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_12_must_change_password_is_enforced_server_side -v`
- 新增用例：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_13_require_password_change_explicit_bool_parse -v`
- 全量回归：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（权限修复：改密会话失效与重置按钮参数编码）

> **修订记录**
>
> - v1.2.22: 修复改密后旧 token 仍可使用的问题；修复用户管理页重置密码按钮参数编码不完整导致的脚本异常风险，并补充回归测试。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 改密后会话立即失效

- **修改位置**：`/api/auth/change-password`。
- **修改内容**：改密成功后删除该用户全部 `AuthSession`，确保旧 token 立即失效，避免未授权会话继续使用。

### app/templates/login.html — 重置按钮参数安全编码

- **修改位置**：`loadUsers`、`resetPassword`。
- **修改内容**：
  - 新增 `encodeUserArg`，对用户名进行 URL 编码后再传入事件参数，避免反斜杠/换行等字符破坏内联脚本；
  - `resetPassword` 内部解码用户名后用于提示；
  - 补充 `escapeHtml`，避免用户列表展示字段直接插入 HTML。

### tests/test_api.py — 安全回归测试

- **修改位置**：新增 `test_11_change_password_revokes_old_sessions`。
- **修改内容**：验证用户改密后旧 token 访问 `/api/auth/me` 返回 401，且旧密码不可登录、新密码可登录。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.22 记录。
- **修改内容**：记录本次安全修复及测试结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/login.html |
| **修改** | tests/test_api.py |
| **修改** | CHANGES.md |

---

## 测试方式

- 单测（新增用例）：`.\.venv_clean\Scripts\python.exe -m unittest tests.test_api.ApiFlowTests.test_11_change_password_revokes_old_sessions -v`
- 全量回归：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`

# 修改记录 — 定级备案管理系统（目录整理与干净环境验证）

> **修订记录**
>
> - v1.2.21: 清理项目可再生产物（缓存、测试残留、自动生成 Word），补充虚拟环境忽略规则，并在全新虚拟环境完成依赖安装与运行验证。

## 新增文件 (如有)

无

---

## 修改文件

### .gitignore — 虚拟环境忽略补充

- **修改位置**：`Python 虚拟环境` 段落。
- **修改内容**：新增 `.venv_clean/`，避免干净验证环境目录污染工作区变更。

### CHANGES.md — 变更记录追加

- **修改位置**：文件顶部新增 v1.2.21 记录。
- **修改内容**：记录本次目录整理与环境验证结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | .gitignore |
| **修改** | CHANGES.md |
| **删除** | tests/runtime/manual.db-journal |
| **删除** | tests/runtime/test_1771997075345.db-journal |
| **删除** | tests/runtime/test_1771997123382.db-journal |

---

## 测试方式

- 依赖一致性检查：`.\.venv_clean\Scripts\python.exe -m pip check`
- 单元/集成测试：`.\.venv_clean\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 启动冒烟：`.\.venv_clean\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8011`（启动成功后主动停止）

# 修改记录 — 定级备案管理系统（提权执行规则补充）

> **修订记录**
>
> - v1.2.20: 在仓库贡献规范中补充“pip/删除操作需用户确认后提权”的执行约定，统一后续协作行为。

## 新增文件 (如有)

无

---

## 修改文件

### AGENTS.md — 沙箱提权规则补充

- **修改位置**：新增 `Sandbox Escalation Rules` 章节。
- **修改内容**：
  - 明确 `pip` 与删除操作在用户确认后才请求提权；
  - 规定 pip 前置环境信息输出与安装参数；
  - 规定删除仅限用户批准路径，且默认不删精简版文件。

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.20 记录。
- **修改内容**：记录本次提权规则落地。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | AGENTS.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：文档检查（`AGENTS.md`、`CHANGES.md`）
- 结果：规则描述与现有协作流程一致，无代码行为变更

# 修改记录 — 定级备案管理系统（兼容优先的依赖策略修正）

> **修订记录**
>
> - v1.2.19: 调整启动策略为默认兼容运行（可回退），并保留可选严格模式，避免“锁死”影响协作与部署。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 默认兼容 + 可选严格

- **修改位置**：Python 版本校验与依赖文件选择逻辑。
- **修改内容**：
  - 默认不强制 Python 3.12，仅提示推荐版本；
  - 默认优先 `requirements.lock.txt`，缺失时回退 `requirements.txt`；
  - 新增可选严格开关：
    - `STRICT_PY312=1`：强制 Python 3.12.x
    - `STRICT_DEP_LOCK=1`：强制存在 `requirements.lock.txt`

### start_lite.bat — 与完整版一致的兼容策略

- **修改位置**：Python 版本校验与依赖文件选择逻辑。
- **修改内容**：
  - 同步默认兼容策略与可选严格开关；
  - 保留安装失败即退出保护，避免异常状态继续启动。

### README.md — 启动与部署说明修正

- **修改位置**：快速启动与手动启动章节。
- **修改内容**：
  - 将“强制锁定”描述改为“优先 lock、可回退 requirements”；
  - 新增严格模式环境变量说明（按需启用）。

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.19 记录。
- **修改内容**：说明本次从“强制策略”回调为“兼容优先策略”。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | README.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：待本次变更后复测

# 修改记录 — 定级备案管理系统（依赖锁定策略整合）

> **修订记录**
>
> - v1.2.18: 启动脚本改为强制 `requirements.lock.txt` + Python 3.12，阻断依赖与解释器版本漂移。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 完整版启动依赖策略收敛

- **修改位置**：Python 检测、依赖文件选择逻辑。
- **修改内容**：
  - 不再回退 `requirements.txt`，强制要求 `requirements.lock.txt` 存在。
  - 新增 Python 主次版本校验，仅允许 `3.12.x`。
  - 缺失锁文件或版本不匹配时直接退出，避免“本机可用、他机失败”。

### start_lite.bat — 精简版启动依赖策略收敛

- **修改位置**：Python 检测、依赖文件选择逻辑、安装失败处理。
- **修改内容**：
  - 与完整版一致，强制 `requirements.lock.txt` 与 Python `3.12.x`。
  - 依赖安装失败时立即退出，避免带病启动。
  - 保留精简版入口与行为，不删除任何精简版文件。

### README.md — 部署一致性说明补充

- **修改位置**：快速启动、手动启动命令说明。
- **修改内容**：
  - 明确一键启动按锁定依赖安装且校验 Python 3.12。
  - 手动安装命令改为 `requirements.lock.txt`（含超时/重试参数）。
  - 新增“依赖一致性说明”，要求随代码分发锁文件。

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.18 记录。
- **修改内容**：记录依赖锁定策略整合与验证结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | README.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：`Ran 10 tests in 6.909s, OK`（有 FastAPI `on_event` 弃用告警，不影响结果）

# 修改记录 — 定级备案管理系统（无用产物清理）

> **修订记录**
>
> - v1.2.17: 清理临时环境与缓存目录，清空导出产物目录，保留精简版启动与说明文件。

## 新增文件 (如有)

无

---

## 修改文件

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.17 记录。
- **修改内容**：记录本次无用文件清理范围与结果。

### 文件系统（运行产物）— 目录清理

- **修改位置**：项目根目录及导出目录。
- **修改内容**：
  - 删除：`.venv_fresh/`
  - 删除：`.tmp/`
  - 删除：`.pytest_cache/`
  - 清空：`exports/`（保留目录结构）
  - 保留确认：`start_lite.bat`、`README_LITE.md`

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | CHANGES.md |
| **删除** | .venv_fresh/ |
| **删除** | .tmp/ |
| **删除** | .pytest_cache/ |
| **清空** | exports/ |

---

## 测试方式

- 执行：目录存在性检查（`Test-Path`）
- 结果：`.venv_fresh/.tmp/.pytest_cache` 均为 `False`，`exports` 为 `True` 且文件数 `0`
- 执行：`git status --short`
- 结果：未出现精简版文件删除（`start_lite.bat`、`README_LITE.md` 仍在）

# 修改记录 — 定级备案管理系统（贡献指南补充）

> **修订记录**
>
> - v1.2.16: 新增仓库贡献指南 `AGENTS.md`，统一项目结构、开发命令、测试与提交流程说明。

## 新增文件 (如有)

### AGENTS.md — 贡献者指南

- **功能**：为协作者提供统一的仓库约定与快速上手入口。
- **实现原理**：基于现有目录、脚本与测试命令抽取可执行规范，避免泛化说明。
- **结构/映射**：覆盖项目结构、构建/运行命令、编码规范、测试规范、提交/PR 规范与安全配置提示。

---

## 修改文件

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.16 记录。
- **修改内容**：补充本次 `AGENTS.md` 新增及验证结果。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | AGENTS.md |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：PowerShell 词数统计（`AGENTS.md`）
- 结果：`301`（满足 200-400 词要求）
- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：`Ran 10 tests in 8.986s, OK`（存在 FastAPI `on_event` 弃用告警，不影响通过）

# 修改记录 — 定级备案管理系统（测试目录恢复与忽略规则确认）

> **修订记录**
>
> - v1.2.15: 恢复误删的 `tests` 目录文件，并确认 `.gitignore` 已覆盖测试产物忽略规则。

## 新增文件 (如有)

无

---

## 修改文件

### tests/test_api.py — 测试脚本恢复

- **修改位置**：从版本库恢复文件内容。
- **修改内容**：恢复接口集成测试用例文件，继续作为回归保障。

### tests/runtime/*.db-journal — 测试运行产物恢复

- **修改位置**：从版本库恢复已跟踪的 journal 文件。
- **修改内容**：恢复如下已跟踪文件：
  - `tests/runtime/manual.db-journal`
  - `tests/runtime/test_1771997075345.db-journal`
  - `tests/runtime/test_1771997123382.db-journal`

### CHANGES.md — 变更记录补充

- **修改位置**：文件顶部新增 v1.2.15 记录。
- **修改内容**：记录测试目录恢复与忽略规则验证结论。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | tests/test_api.py |
| **修改** | tests/runtime/manual.db-journal |
| **修改** | tests/runtime/test_1771997075345.db-journal |
| **修改** | tests/runtime/test_1771997123382.db-journal |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`E:\vscode\Programs\Work\Program1\.venv_fresh\Scripts\python.exe -m pytest -q`
- 结果：`10 passed, 4 warnings`
- 忽略规则校验：`git check-ignore -v --no-index` 验证 `*.db-journal`、`__pycache__/`、`.pytest_cache/` 均命中 `.gitignore` 规则。

# 修改记录 — 定级备案管理系统（依赖兼容锁定）

> **修订记录**
>
> - v1.2.14: 新增完整依赖锁定清单并调整启动脚本优先安装锁定版本，降低新机器安装漂移导致的不兼容风险。

## 新增文件 (如有)

### requirements.lock.txt — 完整依赖锁定清单

- **功能**：固定主依赖及传递依赖版本，保证不同机器安装结果一致。
- **实现原理**：基于已验证可用环境导出 `pip freeze`，安装时优先读取该文件。
- **结构/映射**：纯 `package==version` 列表，覆盖 FastAPI、Uvicorn、SQLAlchemy 及其传递依赖。

---

## 修改文件

### start.bat — 依赖安装策略加固

- **修改位置**：依赖文件选择、安装命令、环境信息输出。
- **修改内容**：
  - 新增 `DEP_FILE` 逻辑，优先 `requirements.lock.txt`，不存在时回退 `requirements.txt`；
  - 依赖安装改为显式参数：`-i https://pypi.org/simple --timeout 20 --retries 1`；
  - 安装前打印 Python 版本、pip 版本、解释器路径，便于定位环境差异。

### start_lite.bat — 依赖安装策略加固

- **修改位置**：Python 检测、依赖文件选择、安装命令。
- **修改内容**：
  - 新增 Python 可用性检测与版本/路径输出；
  - 新增 `DEP_FILE` 逻辑并优先锁定依赖文件；
  - 安装命令改为显式索引/超时/重试参数。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | requirements.lock.txt |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`E:\vscode\Programs\Work\Program1\.venv_fresh\Scripts\python.exe -m pytest -q`
- 结果：`10 passed, 4 warnings`

# 修改记录 — 定级备案管理系统（启动脚本可用性验证）

> **修订记录**
>
> - v1.2.13: 实机运行 `start.bat`，确认启动链路可用并可正常响应页面请求。

## 新增文件 (如有)

无

---

## 修改文件

### CHANGES.md — 启动脚本验证记录补充

- **修改位置**：文件顶部新增 v1.2.13 记录。
- **修改内容**：
  - 在项目目录实际执行 `start.bat`；
  - 通过 `http://127.0.0.1:8011/login` 连通性检查验证服务已启动；
  - 验证后主动停止进程，避免端口占用。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：在 `E:\vscode\Programs\Work\Program1` 运行 `start.bat`
- 检查：访问 `http://127.0.0.1:8011/login`
- 结果：脚本启动成功，HTTP 可达

# 修改记录 — 定级备案管理系统（全新虚拟环境重装验证）

> **修订记录**
>
> - v1.2.12: 在全新 `.venv_fresh` 环境完成依赖逐包安装与测试执行，确认从零安装可用。

## 新增文件 (如有)

无

---

## 修改文件

### CHANGES.md — 安装验证记录补充

- **修改位置**：文件顶部新增 v1.2.12 记录。
- **修改内容**：
  - 记录全新虚拟环境路径：`E:\vscode\Programs\Work\Program1\.venv_fresh`；
  - 记录依赖安装策略：逐包安装、`-i https://pypi.org/simple --timeout 20 --retries 1`；
  - 记录验证结果：`pip check` 无冲突、`pytest` 全通过。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | CHANGES.md |

---

## 测试方式

- 执行：`E:\vscode\Programs\Work\Program1\.venv_fresh\Scripts\python.exe -m pip check`
- 结果：`No broken requirements found.`
- 执行：`E:\vscode\Programs\Work\Program1\.venv_fresh\Scripts\python.exe -m pytest -q`
- 结果：`10 passed, 4 warnings`

# 修改记录 — 定级备案管理系统（登录页与账号策略调整）

> **修订记录**
>
> - v1.2.11: 移除登录页测试账号暴露与一键填充；新增“用户首次改密、管理员重置密码”能力，支持管理员统一分发账号。

## 新增文件 (如有)

无

---

## 修改文件

### app/templates/login.html — 登录与账号管理交互重构

- **修改位置**：登录面板、管理员用户管理面板、前端脚本。
- **修改内容**：
  - 移除内置测试账号文案与一键填充按钮。
  - 登录输入框改为空白，不再预填账号密码。
  - 新增“当前用户修改密码”面板。
  - 管理员用户管理新增“首次改密”选项与“重置密码”操作按钮。

### app/models.py — 用户字段扩展

- **修改位置**：`UserAccount` 模型。
- **修改内容**：新增 `must_change_password`、`password_updated_at` 字段，用于记录首次改密状态与密码更新时间。

### app/main.py — 账号策略后端实现

- **修改位置**：启动初始化、认证接口、用户管理接口。
- **修改内容**：
  - 启动时自动补齐 `user_accounts` 缺失字段（兼容已有数据库）。
  - 登录返回 `must_change_password` 状态。
  - 新增 `POST /api/auth/change-password`（用户自行改密）。
  - 新增 `POST /api/auth/users/{user_id}/reset-password`（管理员重置密码）。
  - 管理员创建账号支持 `require_password_change`，用于控制首次登录改密标记。

### tests/test_api.py — 账号策略测试补充

- **修改位置**：`test_10_permission_boundaries`。
- **修改内容**：
  - 新增“首次登录需改密”状态验证；
  - 新增用户改密后旧密码失效、新密码可登录验证；
  - 新增管理员重置密码后再次标记“需改密”验证。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/templates/login.html |
| **修改** | app/models.py |
| **修改** | app/main.py |
| **修改** | tests/test_api.py |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：`10/10 OK`

# 修改记录 — 定级备案管理系统（用户操作手册）

> **修订记录**
>
> - v1.2.10: 新增可直接交给测试人员使用的用户操作手册，补充角色化流程与现场常见问题处理指引。

## 新增文件 (如有)

### USER_GUIDE.md — 用户操作手册

- **功能**：为测试人员、业务人员提供可执行的操作步骤。
- **实现原理**：按角色拆分工作流（测评师/审核人/管理员），并补充标准业务闭环与故障排查。
- **结构/映射**：覆盖“快速开始 -> 角色操作 -> 模板操作 -> 看板知识库 -> 常见问题 -> 检查清单”。

---

## 修改文件

### README.md — 手册入口补充

- **修改位置**：文档开头说明区。
- **修改内容**：新增“用户操作手册”链接，便于测试人员打开即用。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **新增** | USER_GUIDE.md |
| **修改** | README.md |

---

## 测试方式

- 启动系统后按 `USER_GUIDE.md` 第 3 节“标准业务闭环”逐步执行。
- 验证不同角色登录后菜单可见范围与操作权限符合手册描述。

# 修改记录 — 定级备案管理系统（鉴权回归修复与权限边界加固）

> **修订记录**
>
> - v1.2.9: 修复启用全局鉴权后的前端请求断点；补强客户采集与报告审核权限边界，消除可用性与越权风险。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 组织采集与报告审核接口权限加固

- **修改位置**：组织采集链接、客户提交审核、报告提交/审核/签章/章节顺序调整接口。
- **修改内容**：
  - 组织采集链接创建/查询/启停、客户提交列表/审核改为登录角色校验。
  - 报告审核接口限制为 `admin/reviewer`，防止普通测评角色直接审核通过。
  - 报告提交、签章、章节顺序调整接口补充登录身份校验并规范写入操作者。

### app/templates/*.html — 启用鉴权后的前端断点修复

- **修改位置**：`organizations.html`、`systems.html`、`workflow.html`、`knowledge.html`、`templates.html`。
- **修改内容**：
  - 修复未携带登录令牌的 API 调用，统一补齐 `authHeaders()`。
  - 模板下载链接增加令牌透传，避免开启鉴权后下载失败。
  - 流程实例展示修正负责人字段显示（`current_owner`）。

### tests/test_api.py — 权限边界回归测试新增

- **修改位置**：新增 `test_10_permission_boundaries`。
- **修改内容**：
  - 验证未登录访问采集链接列表返回 401；
  - 验证 evaluator 角色无法执行报告审核（403）；
  - 验证 evaluator 登录后可访问其允许范围接口。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/organizations.html |
| **修改** | app/templates/systems.html |
| **修改** | app/templates/workflow.html |
| **修改** | app/templates/knowledge.html |
| **修改** | app/templates/templates.html |
| **修改** | tests/test_api.py |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 结果：`10/10 OK`

# 修改记录 — 定级备案管理系统（安全加固）

> **修订记录**
>
> - v1.2.8: 完成 API 文档与接口访问加固，补充登录防暴力破解、密码哈希升级、基础 XSS 防护与安全响应头。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 后端安全能力增强

- **修改位置**：鉴权、登录、全局中间件、输入校验。
- **修改内容**：
  - 增加 API 全局登录校验中间件（`API_AUTH_REQUIRED`，完整版默认开启）。
  - 增加安全响应头（`CSP`、`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy` 等）。
  - 增加可选 HTTPS 强制访问开关（`FORCE_HTTPS`）。
  - 登录接口增加失败次数限制与临时锁定，缓解暴力破解。
  - 密码哈希从单次 `sha256` 升级为 `PBKDF2-SHA256+salt`，兼容旧哈希并在成功登录后自动迁移。
  - 新增文本/嵌套 payload 安全校验，拦截含脚本特征输入，降低存储型 XSS 风险。

### app/templates/index.html — 看板鉴权与输出转义

- **修改位置**：看板接口请求、下钻列表渲染、导出链接。
- **修改内容**：
  - 看板请求统一携带登录令牌。
  - 下钻表格动态内容做 HTML 转义。
  - 导出 Excel/PDF 时自动带令牌参数，避免开启全局鉴权后导出失败。

### app/templates/reports.html — 报告页鉴权与输出转义

- **修改位置**：报告列表与操作请求脚本。
- **修改内容**：
  - 生成、审核、章节管理、对比等接口统一携带令牌。
  - 报告列表动态字段转义，降低前端注入风险。
  - Word/PDF 导出链接自动附带令牌参数，兼容全局鉴权。

### start.bat / start_lite.bat — 启动参数安全默认值

- **修改位置**：环境变量初始化区。
- **修改内容**：
  - 完整版默认 `API_AUTH_REQUIRED=1`。
  - 精简交付启动脚本显式设置 `API_AUTH_REQUIRED=0`。

### README.md / README_LITE.md — 安全配置说明补充

- **修改位置**：启动与环境变量说明章节。
- **修改内容**：补充 `API_AUTH_REQUIRED`、`FORCE_HTTPS`、登录防暴力破解参数说明。

### tests/test_api.py — 测试环境参数兼容

- **修改位置**：`setUpClass`。
- **修改内容**：测试启动时显式设置 `API_AUTH_REQUIRED=0`，避免影响现有功能回归测试。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/index.html |
| **修改** | app/templates/reports.html |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | README.md |
| **修改** | README_LITE.md |
| **修改** | tests/test_api.py |

---

## 测试方式

- 执行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 重点验证：
  - 未登录访问受保护 API 返回 401；
  - 登录失败连续触发后返回 429；
  - 登录成功后旧密码哈希可自动迁移；
  - 看板/报告页在登录态下请求与导出正常。

# 修改记录 — 定级备案管理系统（默认端口调整）

> **修订记录**
>
> - v1.2.7: 默认运行端口由 8000 调整为 8011，避免与既有项目端口冲突；启动脚本支持 `APP_PORT` 自定义覆盖。

## 新增文件 (如有)

无

---

## 修改文件

### start.bat — 端口可配置化

- **修改位置**：启动参数与环境变量初始化区。
- **修改内容**：新增 `APP_PORT` 默认值 `8011`；新增 `PUBLIC_BASE_URL` 联动；`uvicorn` 与访问提示改为使用 `%APP_PORT%`。

### start_lite.bat — 端口可配置化

- **修改位置**：启动参数区。
- **修改内容**：新增 `APP_PORT` 默认值 `8011`；新增 `PUBLIC_BASE_URL` 联动；启动提示与 `uvicorn` 端口改为 `%APP_PORT%`。

### app/main.py — 服务基础地址默认值调整

- **修改位置**：`PUBLIC_BASE_URL` 常量。
- **修改内容**：默认值由 `http://127.0.0.1:8000` 调整为 `http://127.0.0.1:8011`，与启动脚本默认端口保持一致。

### README.md — 启动与访问地址更新

- **修改位置**：快速启动、手动启动、页面入口章节。
- **修改内容**：所有示例地址与命令端口改为 `8011`，并补充 `APP_PORT` 可覆盖说明。

### README_LITE.md — 手动启动示例更新

- **修改位置**：手动启动命令块。
- **修改内容**：新增 `set APP_PORT=8011`，并将启动命令端口改为 `%APP_PORT%`。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | start.bat |
| **修改** | start_lite.bat |
| **修改** | app/main.py |
| **修改** | README.md |
| **修改** | README_LITE.md |

---

## 测试方式

- 启动：双击 `start.bat`，确认控制台显示 `http://127.0.0.1:8011`。
- 访问：打开 `http://127.0.0.1:8011/` 与 `http://127.0.0.1:8011/login`。
- 可选覆盖：执行 `set APP_PORT=8020` 后再启动，确认服务监听与访问地址切换为 8020。

# 修改记录 — 定级备案管理系统（登录与角色可见性优化）

> **修订记录**
>
> - v1.2.4: 修复非管理员登录后误报失败；增加管理员与普通用户界面可见性区分；补充内置账号一键填充。

## 新增文件 (如有)

无

---

## 修改文件

### app/templates/base.html — 导航与角色可见性控制

- **修改位置**：侧边栏导航与页面底部角色脚本。
- **修改内容**：新增 `data-role-only` 控制（如模板管理仅管理员可见、流程管控仅管理员/审核员可见）；新增 `applyRoleUI()` 并在 `/api/auth/me` 返回后统一刷新角色可见区域。

### app/templates/login.html — 登录流程与管理员面板修复

- **修改位置**：登录脚本与用户管理面板。
- **修改内容**：
  - 非管理员登录后不再自动调用用户列表接口，避免“登录成功后被403覆盖成失败提示”。
  - 用户管理区改为仅管理员可见（`data-role-only="admin"`）。
  - 新增内置账号提示与一键填充按钮（`admin/tester/leader`），降低切换账号时密码填错概率。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/templates/base.html |
| **修改** | app/templates/login.html |

---

## 测试方式

- 启动系统后访问登录页，分别使用以下账号登录验证：
  - `admin/admin123`：应显示用户管理面板，并可加载用户列表；
  - `tester/tester123`、`leader/leader123`：应登录成功，不应出现“读取用户失败”覆盖登录成功提示。
- 观察侧边栏可见性：
  - admin 可见模板管理与流程管控；
  - evaluator/reviewer 根据角色显示受限菜单。

# 修改记录 — 定级备案管理系统（API 文档访问加固）

> **修订记录**
>
> - v1.2.5: API 文档改为管理员令牌访问控制，避免未登录访问导致文档暴露。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 文档路由鉴权改造

- **修改位置**：FastAPI 初始化与文档路由定义。
- **修改内容**：
  - 关闭 FastAPI 默认公开文档路由（`docs_url/redoc_url/openapi_url`）。
  - 新增受保护的 `/docs`、`/redoc`、`/openapi.json` 路由：仅管理员且令牌有效时可访问。
  - 文档页面通过 `token` 参数加载受保护的 OpenAPI 数据，防止未授权读取。

### app/templates/base.html — 文档入口令牌透传

- **修改位置**：侧边栏 API 文档入口与全局脚本。
- **修改内容**：
  - API 文档入口改为脚本打开，自动从 `localStorage` 读取当前登录令牌并拼接到文档地址。
  - 未登录打开文档将返回受控错误，不再直接暴露接口定义。

### README.md — 安全说明补充

- **修改位置**：文档开关说明章节。
- **修改内容**：补充“开启 API 文档后仅管理员+有效令牌可访问”的安全约束说明。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/templates/base.html |
| **修改** | README.md |

---

## 测试方式

- `ENABLE_API_DOCS=1` 启动后：
  - 未登录访问 `/docs` 应返回 401；
  - 普通账号访问 `/docs` 应返回 403；
  - 管理员登录后从页面“API文档”入口打开，Swagger 应可正常展示。

# CHANGES

# 修改记录 — 定级备案管理系统（本地官方模板接入）

> **修订记录**
>
> - v1.2.6: 支持 01/02/03 本地 docx 模板一键导入、脱敏入库并设为默认模板；Word 导出优先按模板字段回填。

## 新增文件 (如有)

无

---

## 修改文件

### app/main.py — 本地模板导入与模板导出接入

- **修改位置**：模板管理接口区、报告导出区。
- **修改内容**：
  - 新增 `/api/templates/import-local-official`：按 `01-*.docx / 02-*.docx / 03-*.docx` 自动导入模板并设置默认。
  - 导入时调用脱敏处理，去除模板中的测试样例值。
  - `export/word` 优先使用报告绑定模板进行字段回填；模板不可用时自动回退到原有通用导出逻辑。

### app/services/reporting.py — 模板脱敏与字段回填能力

- **修改位置**：报告导出服务函数。
- **修改内容**：
  - 新增 `sanitize_template_docx_content()`，对单位名称、系统名称、手机号、邮箱、信用代码、URL 等样例信息做替换脱敏。
  - 新增 `export_report_docx_with_template()`，支持 `{{字段}}` 与 `【字段】` 占位替换及表格按标签回填。

### app/templates/templates.html — 模板页面入口增强

- **修改位置**：模板上传面板脚本区。
- **修改内容**：新增“导入本地官方模板”按钮及前端调用逻辑，导入后自动刷新模板列表并回显结果。

### tests/test_api.py — 回归测试补充

- **修改位置**：`test_07_auth_and_template_flow`。
- **修改内容**：新增临时构造 `01/02/03` docx 并调用本地官方模板导入接口的验证，确保导入能力可用。

### README.md — 模板导入使用说明

- **修改位置**：功能覆盖与操作说明章节。
- **修改内容**：增加“官方模板导入（可选）”步骤和命名规范说明。

---

## 文件清单总览

| 操作 | 文件路径 |
| :--- | :--- |
| **修改** | app/main.py |
| **修改** | app/services/reporting.py |
| **修改** | app/templates/templates.html |
| **修改** | tests/test_api.py |
| **修改** | README.md |

---

## 测试方式

- 运行：`.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- 重点验证：
  - 本地官方模板导入接口返回成功且导入条目完整；
  - 报告生成/导出主流程无回归。

## [1.2.3]

### 单位录入校验与需求对齐

- 对齐 `需求.docx`（基础信息管理模块 1.1 第5条）：
  - 统一社会信用代码恢复严格格式校验（18位大写字母或数字）。
  - 移动电话恢复严格格式校验（11位中国大陆手机号）。
  - 邮箱恢复严格格式校验（标准邮箱格式）。
- 新增后端必填空值拦截：单位名称、统一社会信用代码、单位负责人、单位地址、移动电话、邮箱、所属行业、单位类型、备案地区为空时禁止提交。
- 保留“单位名称不可为 `/`”规则；其他文本字段可按业务需要使用 `/` 占位（不影响上述三类格式字段校验）。
- 前端录入页与客户采集页同步收紧：
  - 明确必填与格式规则提示；
  - 增加提交前即时校验，减少无效请求。
- 测试更新：
  - 单位名称为 `/` 返回 400；
  - 统一社会信用代码/手机号/邮箱为 `/` 返回 400；
  - 其他文本字段使用 `/` 且三类格式字段合法时可提交。

## [1.2.2]

### 单位信息占位策略细化

- 调整为“按字段分级约束”：
  - `单位名称` 继续强约束，禁止填写 `/` 占位，必须录入真实内容。
  - 其他文本必填项保留 `/` 占位能力，降低录入阻塞。
- `统一社会信用代码` 填写 `/` 时，后端自动生成唯一占位编码，避免唯一约束冲突导致保存失败。
- 单位录入页与客户采集页新增前端即时提示与拦截：单位名称为 `/` 时直接提示，不再发起请求。
- 自动化测试新增覆盖：
  - 单位名称为 `/` 时应返回 400；
  - 多次以 `/` 占位提交其他必填项时可正常保存。

## [1.2.1]

### 单位信息录入容错优化

- 放宽单位信息字段校验：`办公电话` 与 `邮箱` 均支持录入 `/` 作为“暂无”占位值。
- 保持原有合法格式校验不变：电话/邮箱在非 `/` 场景下仍按原规则校验。
- 单位录入页与客户采集页增加输入提示，明确“无可填 /”。
- 新增自动化测试覆盖：创建单位时 `office_phone='/'`、`email='/'` 应可成功入库。
## [1.2.0]

### 后端功能补全

- 新增账号与角色能力（admin/reviewer/evaluator）及会话登录机制。
- 新增模板管理能力：上传、列表、编辑、版本、恢复、默认模板、测试填充。
- 报告生成支持按 `report_type + city + level` 自动匹配模板，支持手动指定模板。
- 报告新增签章信息保存与导出注入。
- 新增报告版本差异对比接口：`GET /api/reports/{report_id}/compare/{target_id}`。
- 新增单位/系统删除申请审批流：申请、查询、管理员审核通过/驳回。
- 删除失败提示增强：返回具体阻塞原因（关联系统/关联报告等）。
- 回收站能力增强：单位/系统回收站列表与过期清理。
- 附件能力增强：批量上传、在线预览、下载。
- 流程提醒增强：支持站内消息、邮件、双通道。
- 知识库检索增强：支持模糊/精确检索（`match_mode=fuzzy|exact`）。

### 报告导出与格式优化

- 报告导出内容自动生成目录段。
- Word 导出增加默认字体、字号、行距控制。
- Word/PDF 导出增加页码展示。
- PDF 继续支持可选密码加密。

### 前端体验优化

- 流程管控页面由 JSON 调试回显改为可读状态提示与错误提示。
- 看板按钮区布局优化为横向显示（小屏自动换行）。
- 登录、模板、单位、系统、报告、流程、知识库、客户采集等页面移除面向用户的 JSON 只读框，统一改为可读反馈文案。

### 权限与显示范围

- 看板在 evaluator 角色下仅展示本人权限范围数据。
- 知识库下载与批量下载要求登录后访问。

### 测试与版本

- 应用版本升级为 `1.2.0`。
- 自动化测试更新并通过：
  - `python -m unittest discover -s tests -p "test_*.py" -v`
  - 结果：`9/9 OK`

## [1.0.0]

- 初版实现单位、系统、报告、流程、看板、知识库等模块。
- 提供基础字段校验、导入导出、历史追溯与回收站机制。
