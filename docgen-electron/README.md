# DocGenPro

基于模板的 Word 文档批量生成工具，提供图形化界面，适用于等保测评授权文档等标准化文档的快速生成。

## ✨ 特性

- 🖥️ **图形化界面** - 基于 Electron + Vue 3 + Element Plus，操作简单直观
- 📝 **模板驱动** - 支持 `.docx` 模板，通过 JSON 规则定义填充逻辑
- 📊 **表格支持** - 自动处理文档中的表格内容填充
- 🚀 **批量生成** - 一次填写信息，批量输出多份文档

## 📦 安装

### 环境要求

- Node.js 18+
- Python 3.8+（仅开发时需要）

### 安装依赖

```bash
npm install
```

## 🚀 使用

### 开发模式

```bash
npm run dev
```

### 打包发布

```bash
# 1. 打包 Python 核心（如有修改）
pip install pyinstaller
pyinstaller --onefile --distpath resources/bin -n main3 main3.py

# 2. 打包 Electron 应用
npm run build
```

打包后的安装程序位于 `dist_setup` 目录。

## 📁 项目结构

```
docgen-electron/
├── src/
│   ├── main/          # Electron 主进程
│   ├── preload/       # 预加载脚本
│   └── renderer/      # Vue 3 前端界面
├── templates/         # Word 文档模板 (.docx)
├── rules/             # 填充规则 (.json)
├── information.json   # 项目信息配置
└── Projects.json      # 批量项目配置
```

## 📋 内置模板

| 模板 | 说明 |
|------|------|
| 08 | 风险告知与规避方案 |
| 11 | 现场测评授权书 |
| 13 | 自愿放弃验证测试声明 |
| 14 | 工具测试授权书 |
| 17 | 渗透测试授权书 |
| 20 | 测评环境恢复确认表 |

## 🛠️ 技术栈

- **前端**: Vue 3 + Element Plus + Pinia
- **桌面框架**: Electron 28 + electron-vite
- **文档处理**: Python + python-docx

## 📄 许可证

MIT License
