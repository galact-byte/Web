# 执行计划：图片字节拆分独立 store

按 P0 → P3 推进。P0 可独立发版（用户端正在丢数据，先止血）。

## P0 止血（独立发版 v0.6.3）

- [x] `src/utils/pendingWrites.ts`：写入追踪（`trackWrite` 包裹 db 写路径，引用计数 + 订阅）
- [x] `db.ts`：`saveProject` / `saveProjectGroup` / `updateProjectGroupAndSystems` / `deleteProject` / `deleteProjectGroup` 全部走 `trackWrite`
- [x] 装 `beforeunload`（`installUnloadGuard`，`main.tsx` 调用）：有未完成写入时 `preventDefault()`
- [x] Electron 侧 `win.on('close')` 拦截 + `dialog` 三选项（等待写完自动关 / 取消 / 仍然退出），`writes:pending` IPC 上报
- [x] 界面"正在保存，请勿关闭窗口…"指示条（`App.tsx`，`useSyncExternalStore`）
- [x] RED→GREEN：`scripts/verify-pending-writes.mjs` 29 项断言全绿
- [x] 真实浏览器验证（Playwright + 22MB 图片入库）：保存中拦截关闭 ✓、指示出现 ✓、写完自动放行 ✓、刷新后图片仍在 ✓
- [ ] 发版：新写 RELEASE-NOTES → push main → tag `picture-ocr-v0.6.3`

## P1 存储模型

- [ ] RED：`scripts/verify-image-store.mjs` —— 断言 `images` store 定义、key 格式、`by_project` 索引、删除清理、迁移先写后删
- [ ] `types/index.ts`：`ImageData.data` 改为可选（编译器会标出所有直接读 `.data` 的点，作为 P2 清单）
- [ ] `db.ts`：`DB_VERSION=5`，`onupgradeneeded` 只建 `images` store + 索引（严禁遍历数据）
- [ ] `db.ts`：`addImageToProject` / `removeImageFromProject`（同事务写字节 + 改文档 + 更新摘要）
- [ ] `db.ts`：`resolveImageData` / `resolveImagesForProject`（兼容内联与引用两种形态）
- [ ] `db.ts`：`deleteProject` / `deleteProjectGroup` 同事务按 `by_project` 清理 images
- [ ] `db.ts`：`migrateInlineImages()` 按项目分批、进度可续跑、单项目失败不影响其余
- [ ] GREEN：verify 脚本全绿

## P2 全链路适配

- [ ] `useImageData` hook（异步取数 + 加载态 + 失败提示）
- [ ] 组件：`ImageThumbnail` / `ImageViewer` / `ContentArea` / `UploadZone` / `MobileCollector` / `MobileProjectList` / `ProjectList`
- [ ] `App.tsx` + `lanImageSink`：手机上传改走 `addImageToProject`，删除整份文档读改写
- [ ] `AppContext`：`addImageAndSave` 改为写字节 + 轻量文档更新
- [ ] `exportImport`：导入导出（含 `.evidence` 加密包）按新模型组装，导入时逐张写 images
- [ ] `wordDocument`：批量 `resolveImagesForProject`，**保持原分辨率内嵌**
- [ ] `imageCompression` 存量瘦身：改为逐条更新 images 记录（不再重写文档）
- [ ] 回归：`verify:evidence-package` / `verify:image-compression` / `verify:lan-image-sink` / `verify:list-summary-store` / `verify:summary-repair` / `verify:error-report` 全绿

## P3 对账与验收

- [ ] `ensureSummariesSynced` 扩展图片对账（文档引用 vs images 实际），结果进修复报告
- [ ] 诊断包 + 存储设置面板展示图片对账结果
- [ ] 迁移演练：构造 300MB+ 量级库跑迁移，中途强杀再重启验证续跑
- [ ] Playwright + 真实 IndexedDB 端到端：新增图 → 关窗 → 重开仍在；并发写不互相覆盖
- [ ] 性能量化：5 张图项目 vs 50 张图项目，单张新增写入耗时同量级
- [ ] 桌面 exe 与网页版双端实测
- [ ] 发版：新写 RELEASE-NOTES（含"不可降级"提示）→ tag `picture-ocr-v0.7.0`

## 验证命令

```bash
npm run build
npm run verify:image-store        # 新增
npm run verify:summary-repair
npm run verify:list-summary-store
npm run verify:error-report
npm run verify:evidence-package
npm run verify:image-compression
npm run verify:lan-image-sink
```

## 回滚点

- P0 独立成版，出问题可单独回退，不牵动存储模型
- P1 迁移"先写后删同事务"，失败项目保持内联形态，功能不受影响
- DB v5 发布后**不可降级**回 v4 代码（v4 不认 images store），发布说明必须写明
