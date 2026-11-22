# AI 模型客户端 (AI Model Client)

一个基于 Tauri + Vue 3 构建的现代化 AI 聊天客户端，支持多种主流 AI 模型服务商，拥有精美的毛玻璃特效 (Glassmorphism) UI 和高度个性化的外观设置。

![应用截图](public/bg_default.jpg)

## 主要功能

- **多模型支持**：
    -  **OpenAI** (GPT-3.5, GPT-4, GPT-4o)
    -  **Anthropic Claude** (Claude 3.5 Sonnet, Haiku, Opus)
    -  **Google Gemini** (Gemini 1.5 Pro, Flash)
    -  **DeepSeek** (DeepSeek Chat, Coder)
    -  **OpenRouter** (聚合模型)
    -  **自定义源** (兼容 OpenAI 接口格式)

- ** 现代化 UI 设计**：
    - **毛玻璃特效 (Glassmorphism)**：侧边栏和输入框采用流行的磨砂玻璃质感。
    - **完全响应式**：适配不同尺寸的窗口。
    - **精致图标**：使用高质量 SVG 图标，提升视觉体验。

- ** 高度个性化**：
    - **自定义背景**：支持设置网络图片 URL 或上传本地图片作为背景。
    - **背景调节**：可自由调整背景遮罩颜色和不透明度，兼顾美观与可读性。
    - **本地存储**：API Key 和设置保存在本地浏览器中；共享设备上的其他使用者也可能访问，请勿在共享设备保存密钥。

- ** 聊天体验**：
    - 流式响应 (Streaming Response)
    - Markdown 渲染与代码高亮
    - 对话历史记录管理

## 技术栈

- **Core**: [Tauri](https://tauri.app/) (Rust + WebView)
- **Frontend**: [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: Vanilla CSS (Native Variables)

## 快速开始

### 开发环境

1.  克隆项目：
    ```bash
    git clone https://github.com/your-username/ai-client.git
    cd ai-client
    ```

2.  安装依赖：
    ```bash
    npm install
    # 或者
    yarn install
    ```

3.  启动开发服务器：
    ```bash
    npm run tauri dev
    ```

### 打包构建

构建 Windows/macOS/Linux 应用程序：

```bash
npm run tauri build
```

## 配置说明

点击侧边栏的用户头像或设置图标即可打开配置面板：

1.  **API 配置**：选择服务商，输入 API Key。
2.  **外观设置**：
    - 上传或输入背景图链接。
    - 调整遮罩颜色和透明度以适应不同的背景图。

## 许可证

MIT License
