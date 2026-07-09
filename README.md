# Programs - 个人项目集合

本仓库包含我的个人学习和项目开发代码，主要涵盖前端学习、AI 客户端、文档生成工具、安全工具、Android 应用和工作项目等内容。

---

## 📁 项目目录

### 1. front/ - 前端学习与实践代码
- **技术栈**: HTML, CSS, JavaScript
- **内容**: 前端基础练习、组件开发、特效实现等
- **用途**: 学习和练习前端技术

### 2. ai-client/ - AI 模型客户端
- **技术栈**: Tauri 2.0 + Vue 3 + TypeScript + Vite
- **特性**:
  - 支持多模型服务商 (OpenAI, Claude, Gemini, DeepSeek, OpenRouter)
  - 现代化 Glassmorphism UI 设计
  - 自定义背景图片和透明度调节
  - Markdown 渲染与代码高亮
  - 本地存储 API Key，安全无忧
- **启动命令**: `npm run tauri dev`
- **构建命令**: `npm run tauri:build`

### 3. docgen-electron/ - 过程文档输出客户端 (DocGenPro)
- **技术栈**: Electron + Vue 3 + TypeScript + Python docx
- **用途**: 等保测评过程文档自动化生成
- **特性**:
  - 基于 `.docx` 模板文件生成文档
  - 自定义规则填充内容
  - 支持表格处理
  - 批量文档导出功能
- **启动命令**: `npm run dev`
- **构建命令**: `npm run build`


### 4. Reduce/ - 短视频时间控制 App
- **技术栈**: Kotlin 1.9 + Jetpack Compose + Material 3
- **用途**: 控制刷短视频时间，识别"刷短视频"行为（竖屏 + 连续滑动），超时后温和拦截
- **特性**:
  - 行为识别：通过屏幕方向和滚动频率判断，横屏看普通视频不受影响
  - 灵活限制：支持 0~240 分钟每日时限
  - 限制理由：预设/自定义理由，超时弹窗展示
  - 温和拦截：遮罩提示倒计时后自动回到桌面
  - 预设目标：内置抖音、快手、小红书、B站、微博、YouTube、TikTok 等
- **构建命令**: 双击 `build-release.bat` 或见 `Reduce/README.md`

### 5. test/ - 工具集与实验项目
包含多个独立的小工具和实验代码：

#### 5.1 test/webui/ - CodeAudit WebUI（代码安全审计工具）
- **技术栈**: Flask + Python + LLM API（OpenAI 兼容接口 / Anthropic Claude）
- **用途**: 通过调用大模型 API 对代码进行自动化安全审计
- **特性**:
  - 粘贴或上传代码文件，一键发起安全审计
  - 审计记录管理，按状态筛选
  - 报告导出（Markdown / HTML）
  - 可视化的风险等级标识
- **环境要求**: Python 3.8+ / MySQL 5.7+
- **启动命令**: 双击 `start.bat` 或 `python app.py`

#### 5.2 test/game/ - 控制台打字游戏（四语言版本）
- **技术栈**: Python / Java / C++ / C#
- **用途**: 用 4 种语言实现同一个打字游戏，帮助理解语法差异
- **详情**: 见 `test/game/README.md`

#### 5.3 其他工具
- **update.bat** — CLIProxyAPI 自动更新脚本（版本检测、自动备份、保留配置）
- **md2bbcode.html** — Markdown 转 BBCode 在线转换工具
- **漫画上色工作流** — ComfyUI 漫画上色 JSON 工作流配置

### 6. Work/ - 工作项目

#### 6.1 Work/Program/ - 项目完结单管理平台
- **技术栈**: FastAPI + Vue 3 + Vite + SQLAlchemy
- **用途**: 在线项目完结单管理系统
- **特性**:
  - 支持经理/员工角色区分
  - 项目管理、分发与贡献率填写
  - 季度工作量统计
  - 项目进度爬取（支持 OCR 验证码自动登录、分页爬取、Excel 导出）
  - Excel/Word 批量导出
  - 深浅主题切换
  - JWT Token 认证
  - 支持 Docker Compose 一键部署
- **启动**:
  - 一键启动: 双击 `start.bat`（Windows）或 `bash start.sh`（Linux/macOS）
  - 后端: `cd backend && uvicorn app.main:app --reload --port 8000`
  - 前端: `cd frontend && npm run dev`

#### 6.2 Work/Program1/ - 衡鉴 · 定级备案管理系统
- **技术栈**: FastAPI + SQLAlchemy + Jinja2 + Chart.js + reportlab
- **用途**: 网络安全定级备案管理
- **特性**:
  - 单位与系统信息维护
  - 自动生成定级报告/备案表/专家评审意见表
  - 报告版本管理与差异对比
  - 流程管控（节点负责人/时限/超时提醒）
  - 数据看板（地区/行业/级别分布、地图热力图）
  - 知识库管理（版本控制、批量下载）
  - Word/PDF 导出（PDF 支持密码加密）
  - 模板中心化管理与签章
- **启动**: 双击 `start.bat` 或手动 `uvicorn app.main:app --reload --port 8011`

#### 6.3 Work/picture_ocr/ - 测评证据采集工具
- **技术栈**: React 18 + TypeScript + Vite + Tailwind CSS
- **用途**: 采集、整理等保测评截图证据，导出项目数据包和 Word 报告
- **特性**:
  - 内置物理环境、网络设备、安全设备、主机设备、应用系统等证据分类模板
  - 浏览器 IndexedDB 本地保存，无需后端服务
  - 支持截图上传/粘贴、检查项模板维护、ZIP 导入导出
  - 支持 Word 报告导出和必填截图缺失提示
  - 已配置 GitHub Actions Release 打包流程
- **启动**: `cd Work/picture_ocr && npm ci && npm run dev`
- **Release**: 推送 `picture-ocr-v*` 标签自动打包发布

---

## 🚀 快速开始

### 环境要求
- Node.js 20.19+ 或 22.12+（Work/Program 前端需要，推荐 Node.js 22 LTS）
- Python 3.10 - 3.12（Work/Program 需要，不支持 3.13+）
- Python 3.8+（test/webui 需要，另需 MySQL 5.7+）
- Rust（ai-client 构建需要）
- JDK 17 + Android SDK 34（Reduce 构建需要）

### 安装依赖
```bash
# AI 客户端
cd ai-client
npm install

# 文档生成客户端
cd docgen-electron
npm install

# 项目完结单管理平台
cd Work/Program/backend
pip install -r requirements.txt
cd ../frontend
npm install

# 测评证据采集工具
cd Work/picture_ocr
npm ci

# CodeAudit WebUI (代码安全审计)
cd test/webui
pip install -r requirements.txt

# Reduce (短视频时间控制)
# 环境要求: JDK 17 + Android SDK 34
# 双击 Reduce/build-release.bat 一键构建
```

### 启动项目
```bash
# AI 客户端开发模式
cd ai-client
npm run tauri dev

# 文档生成客户端开发模式
cd docgen-electron
npm run dev

# 项目完结单管理平台（一键启动）
cd Work/Program
start.bat          # Windows
# bash start.sh   # Linux/macOS

# 测评证据采集工具
cd Work/picture_ocr
npm run dev

# CodeAudit WebUI
cd test/webui
python app.py      # 或双击 start.bat
```

---

## 🛠️ 技术栈总结

| 项目 | 核心框架 | UI 库 | 构建工具 |
|------|----------|-------|----------|
| ai-client | Tauri + Vue 3 | Vanilla CSS | Vite |
| docgen-electron | Electron + Vue 3 | Element Plus | electron-vite |
| Reduce | Kotlin + Jetpack Compose | Material 3 | Gradle |
| front | Vanilla JS/CSS | - | - |
| test/webui | Flask + LLM API | Vanilla CSS/JS | - |
| test/game | Python/Java/C++/C# | 控制台 | - |
| Work/Program | FastAPI + Vue 3 | Vanilla CSS | Vite |
| Work/Program1 | FastAPI + Jinja2 | Chart.js + reportlab | - |
| Work/picture_ocr | React + TypeScript | Tailwind CSS | Vite |

---

## 📄 许可证

MIT License

---

*持续更新中...* ✨
