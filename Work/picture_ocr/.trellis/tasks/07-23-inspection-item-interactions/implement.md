# 检查项交互与安全排序 Implementation Plan

**Goal:** 让手动新增检查项默认必填并置顶，并以独立排序模式提供鼠标/触屏安全的实时预览排序与边缘自动滚动。

**Architecture:** `appReducer` 负责新增默认值和经完整 ID 列表确认的排序；`ContentArea` 管理未持久化的预览顺序、Pointer Events、悬浮副本、FLIP 与自动滚动；`ItemCard` 在普通/排序模式分别渲染。领域状态变更沿现有 `AppProvider` 自动保存链路持久化。

**Tech Stack:** React 18、TypeScript strict、Vite、Tailwind CSS、原生 Pointer Events、Web Animations API、Node `assert`、Chrome CDP 浏览器回归。

## 已执行步骤

- [x] 先以 Node reducer/source-contract 脚本建立 `ADD_ITEM` 默认必填置顶与 `REORDER_ITEMS` 安全校验的 RED/GREEN 回归。
- [x] 在 reducer 实现完整 ID、数量、去重和未知 ID 校验的 `REORDER_ITEMS`；无效 payload 保持原 state。
- [x] 实现普通/排序模式隔离和仅手柄可发起的 Pointer Events 排序；移除无功能竖向三点。
- [x] 将拖拽体验升级为未持久化的 `previewItemIds`：悬浮副本跟随指针，源项显示占位，其余项目 FLIP 实时让位；仅 PointerUp 提交，PointerCancel 还原。
- [x] 为主滚动容器加入边缘自动滚动（80px 触发区、每帧最多 18px），滚动每帧重算预览，并覆盖离开边缘、边界、抬起、取消、退出、资产切换和卸载清理。
- [x] 增加生产预览 Chrome CDP 回归，覆盖鼠标/触摸拖动、实时预览、提交、取消还原与上下边缘自动滚动。
- [x] 更新 README、变更记录、共享 Trellis 规范、版本号和人工维护的 GitHub Release 文案；Web 与 Electron 都走共享前端代码。

## 验证记录

以下命令已成功执行：

```bash
node scripts/verify-inspection-item-interactions.mjs
node scripts/verify-inspection-item-pointer-drag.mjs
npm run build
npm run verify:evidence-package
npm run verify:lan-server
npm run verify:lan-mobile-picker
npm run verify:web-lan-server
npm run verify:pwa-build
```

Windows 工作区的标准 `npm run desktop:build` 在 `desktop-dist/win-unpacked.tmp` 重命名时出现环境性 `EPERM`。改用临时输出目录运行 `electron-builder --win --dir` 成功，并已检查生成的 `app.asar` 含实时排序悬浮副本和 `requestAnimationFrame` 前端入口。

提交前会再次执行 `git diff --check`，然后按 Trellis 顺序提交工作改动、归档任务及记录 journal；随后推送 `main`、创建并推送 annotated tag `picture-ocr-v0.4.4`，等待 GitHub Release workflow 并回读实际发布信息。
