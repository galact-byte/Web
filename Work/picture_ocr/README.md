# 测评证据采集工具

一个基于 React + Vite + TypeScript 的纯前端工具，用于按等保测评/现场核查要求收集截图证据、整理资产检查项，并导出数据包或 Word 报告。

## 功能特性

- 内置物理环境、网络设备、安全设备、主机设备、系统管理软件、应用系统等分类模板。
- 支持按资产维护检查项，并为每个检查项上传/粘贴截图。
- 使用浏览器 IndexedDB 本地保存数据，无需后端服务。
- 支持 ZIP 数据包导出与导入，便于项目迁移或多人汇总。
- 支持导出 Word 报告，导出前会提示缺失的必填截图。
- 支持维护检查项模板，便于适配不同项目要求。

## 技术栈

- React 18
- TypeScript
- Vite 6
- Tailwind CSS
- IndexedDB
- JSZip
- docx

## 本地开发

环境要求：Node.js 20.19+ 或 22.12+，推荐 Node.js 22 LTS。

```bash
npm ci
npm run dev
```

默认开发地址以 Vite 输出为准，通常是 `http://localhost:5173/`。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`。项目的 Vite 配置使用 `base: './'`，因此构建后的静态文件可以直接部署到任意子路径或本地静态服务器。

如需本地预览构建产物：

```bash
npm run preview
```

## Release 打包

仓库已提供 GitHub Actions 工作流：`.github/workflows/release-picture-ocr.yml`。

### 方式一：推送标签自动发布

```bash
git tag picture-ocr-v0.1.0
git push origin picture-ocr-v0.1.0
```

推送匹配 `picture-ocr-v*` 的标签后，工作流会自动：

1. 安装依赖。
2. 运行 `npm run build`。
3. 将 `dist/`、启动脚本、使用说明、`README.md` 和版本信息打包为 `picture-ocr-<tag>.zip`。
4. 创建或更新 GitHub Release，并上传 ZIP 附件。

ZIP 解压后，同事只需要双击 `启动测评证据采集工具.bat`，浏览器会自动打开本地页面。使用期间不要关闭启动窗口，用完后关闭窗口即可退出。

### 方式二：手动运行工作流

在 GitHub 仓库页面进入 **Actions → Build Picture OCR Release → Run workflow**，填写 release tag 后运行。

## 数据与隐私说明

- 项目数据默认存储在当前浏览器的 IndexedDB 中。
- 截图内容不会上传到服务器；导入、导出和 Word 生成都在浏览器本地完成。
- 更换浏览器、清理站点数据或使用隐私模式可能导致本地数据不可见，请及时导出 ZIP 数据包备份。

## 版本管理建议

- 功能代码、配置、README 和 GitHub workflow 应提交到仓库。
- `node_modules/`、`dist/`、`*.tsbuildinfo`、本地 AI 配置目录、需求计划文档和 Word 参考模板已在 `.gitignore` 中忽略。
