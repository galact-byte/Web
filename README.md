# Programs - 个人项目集合

本仓库包含我的个人学习和项目开发代码，主要涵盖前端学习、AI 客户端、文档生成工具和工作项目等内容。

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
- **构建命令**: `npm run tauri build`

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

### 4. test/ - 测试代码
- **用途**: 各类测试和实验代码

### 5. Work/ - 工作项目

#### 5.1 Work/Program/ - 项目完结单管理平台
- **技术栈**: FastAPI + Vue 3 + Vite + SQLAlchemy
- **用途**: 在线项目完结单管理系统
- **特性**:
  - 支持经理/员工角色区分
  - 项目管理、分发与贡献率填写
  - Excel/Word 批量导出
  - JWT Token 认证
- **启动**:
  - 后端: `cd backend && uvicorn app.main:app --reload --port 8000`
  - 前端: `cd frontend && npm run dev`

#### 5.2 Work/Program1/ - 定级备案管理系统
- **技术栈**: FastAPI + SQLAlchemy + Jinja2 + Chart.js
- **用途**: 网络安全定级备案管理
- **特性**:
  - 单位与系统信息维护
  - 自动生成定级报告/备案表/专家评审意见表
  - 流程管控（6 步工作流）
  - 数据看板（地区/行业/级别分布）
  - 知识库管理
  - Word/PDF 导出
- **启动**: 双击 `start.bat` 或手动 `uvicorn app.main:app --reload --port 8000`

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Python 3.9+ (Work 项目需要)
- Rust (ai-client 构建需要)

### 安装依赖
```bash
# AI 客户端
cd ai-client
npm install

# 文档生成客户端
cd docgen-electron
npm install
```

### 启动项目
```bash
# AI 客户端开发模式
cd ai-client
npm run tauri dev

# 文档生成客户端开发模式
cd docgen-electron
npm run dev
```

---

## 🛠️ 技术栈总结

| 项目 | 核心框架 | UI 库 | 构建工具 |
|------|----------|-------|----------|
| ai-client | Tauri + Vue 3 | Vanilla CSS | Vite |
| docgen-electron | Electron + Vue 3 | Element Plus | electron-vite |
| front | Vanilla JS/CSS | - | - |
| Work/Program | FastAPI + Vue 3 | - | Vite |
| Work/Program1 | FastAPI + Jinja2 | Chart.js | - |


---

## 📄 许可证

MIT License

---

*持续更新中...* ✨
