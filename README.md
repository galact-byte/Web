# Programs - 个人项目集合

本仓库包含我的个人学习和项目开发代码，主要涵盖前端学习、AI 客户端、文档生成工具和 Android 应用等内容。

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

### 4. Program/ - 项目完结单管理平台
- **技术栈**: FastAPI + Vue 3 + Vite + SQLAlchemy
- **用途**: 在线项目完结单管理系统
- **特性**:
  - 经理/员工角色区分
  - 项目录入与分发
  - 贡献率填写
  - Excel/Word 批量导出
- **启动命令**: 见 `Program/README.md`

### 5. Reduce/ - 短视频时间控制 App (Reduce)
- **技术栈**: Kotlin 1.9 + Jetpack Compose + Material 3
- **用途**: 控制刷短视频时间，识别"刷短视频"行为（竖屏 + 连续滑动），超时后温和拦截
- **特性**:
  - 行为识别：通过屏幕方向和滚动频率判断，横屏看普通视频不受影响
  - 灵活限制：支持 0~240 分钟每日时限
  - 限制理由：预设/自定义理由，超时弹窗展示
  - 温和拦截：遮罩提示倒计时后自动回到桌面
  - 预设目标：内置抖音、快手、小红书、B站、微博、YouTube、TikTok 等
- **构建命令**: 双击 `build-release.bat` 或见 `Reduce/README.md`

### 6. test/ - 测试代码
- **用途**: 各类测试和实验代码

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- Python 3.8+ (docgen-electron 需要)
- Rust (ai-client 构建需要)
- JDK 17 + Android SDK 34 (Reduce 构建需要)

### 安装依赖
```bash
# AI 客户端
cd ai-client
npm install

# 文档生成客户端
cd docgen-electron
npm install

# 项目完结单管理平台
cd Program/backend
pip install fastapi uvicorn sqlalchemy python-jose[cryptography] passlib[bcrypt] python-multipart openpyxl python-docx
cd ../frontend
npm install

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

# 项目完结单管理平台
cd Program/backend
uvicorn app.main:app --reload --port 8000
# 另开终端
cd Program/frontend
npm run dev
```

---

## 🛠️ 技术栈总结

| 项目 | 核心框架 | UI 库 | 构建工具 |
|------|----------|-------|----------|
| ai-client | Tauri + Vue 3 | Vanilla CSS | Vite |
| docgen-electron | Electron + Vue 3 | Element Plus | electron-vite |
| Program | FastAPI + Vue 3 | Vanilla CSS | Vite |
| Reduce | Kotlin + Jetpack Compose | Material 3 | Gradle |
| front | Vanilla JS/CSS | - | - |


---

## 📄 许可证

MIT License

---

*持续更新中...* ✨
