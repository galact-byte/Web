# 构建与发布维护说明

本文面向项目维护者。以下 npm 命令在 `Work/picture_ocr` 项目目录执行；发布工作流位于仓库根目录 `.github/workflows/release-picture-ocr.yml`。

## 本地构建

```bash
npm run build
npm run preview
```

构建产物输出到 `dist/`。Vite 使用 `base: './'`，构建后的静态文件可以部署到子路径或本地静态服务器。

Windows 桌面版使用 Electron，当前发布目标为 x64 便携版 exe：

```bash
npm run desktop:pack
```

只验证 Electron 目录构建时使用：

```bash
npm run desktop:build
```

## 版本号约定

以最近一次已发布版本为基础递增，当前 0.x 阶段按改动规模划分：

- 修复、小功能和局部交互改善递增末位（patch），例如大图滚轮缩放：`0.8.3 → 0.8.4`。
- 较大的功能更新、新增独立模块或主要工作流程变化才递增次版本（minor），例如 `0.8.x → 0.9.0`；不因出现任意新功能就自动升次版本。
- 不兼容变更或进入 1.0 等版本阶段调整需单独确认，并说明兼容性和升级影响。

## 发布流程

1. 按本次实际变化重写项目根目录的 `RELEASE-NOTES.md`。使用面向用户的说明，不沿用上一版本文案，不以提交标题代替；文件必须非空。
2. 同步 `package.json`、`package-lock.json` 和 `RELEASE-NOTES.md` 的版本，完成与改动相称的验证。
3. 提交并推送 main，再创建、推送一致的 `picture-ocr-vX.Y.Z` 标签。不要覆盖已发布标签。

推送匹配 `picture-ocr-v*` 的标签后，GitHub Actions 自动安装依赖、构建 Web 和 Windows 桌面版，并创建或更新 GitHub Release：

- Web ZIP 包含 `dist/`、启动脚本、`README.md`、`RELEASE-NOTES.md` 和 `VERSION.txt`。
- Windows 附件为桌面便携版 exe。
- Release 正文直接读取本次 `RELEASE-NOTES.md`，与 ZIP 内发布说明保持一致。

用户授权发布后执行完整流程；推送 main 和标签后汇报，不等待或轮询 Actions 构建结果，由用户查看。

## 手动运行工作流

在 GitHub 仓库进入 **Actions → Build Picture OCR Release → Run workflow**，填写 release tag。

当前手动模式从默认分支读取源码、工作流和发布说明；它不等同于重新构建旧标签源码。需要重发既有版本时，先核对构建内容与目标标签、版本说明是否一致。
