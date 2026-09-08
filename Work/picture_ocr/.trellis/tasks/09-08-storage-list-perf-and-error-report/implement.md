# 执行计划

不可逆点：一旦 `DB_VERSION` 升到 4 并发布，客户端不能再退回 v3 代码打开该库（IDB 不允许降级）。数据不丢，但代码只能前进修复。

## 步骤

### S1 摘要 store 基础（db.ts）
- [ ] 加常量 `PROJECT_SUMMARIES_STORE_NAME`、`DB_VERSION=4`、`StoredProjectSummary` 类型、`summaryFromDoc()`、`rebuildSummaries()`（游标回填，供 upgrade 复用）。
- [ ] `onupgradeneeded` 新增 summaries store + index，并在 upgrade 事务内游标回填存量。
- 验证：`npm run build` 通过（类型 OK）。

### S2 读取路径改摘要
- [ ] `listProjects` / `listProjectGroups` 只读 summaries(+groups) store；移除 `cloneAssets`/全量 `normalizeProjectDocument`。
- 验证：build 通过；`verify-list-summary-store.mjs` 断言列表路径不含 `cloneAssets`。

### S3 写/删/迁移路径维护摘要
- [ ] `saveProject`、`createProjectGroupWithSystems`、`updateProjectGroupAndSystems`、`deleteProject`、`deleteProjectGroup`、`migrateLegacyProjectIfNeeded` 事务加入 summaries 维护。
- 验证：`verify-list-summary-store.mjs` 断言各函数含 summaries 操作；纯函数计数逻辑测试通过。

### S4 DB 超时兜底
- [ ] `withTimeout` + `DB_OP_TIMEOUT_MS`，包裹 openDB 与事务 Promise。
- 验证：build 通过；`verify-error-report.mjs` 断言存在。

### S5 报错采集模块
- [ ] 新增 `src/utils/errorLog.ts`（记录/读取/清空/诊断报告/下载）。
- [ ] `main.tsx` 安装全局 handler；错误经通道提示 Toast。
- 验证：build；`verify-error-report.mjs` 通过。

### S6 诊断入口 UI
- [ ] 存储设置面板加「导出诊断包」+ 最近错误计数；清空走确认框。
- 验证：build；手动核对入口渲染。

### S7 校验脚本 + 回归
- [ ] 新增两支 verify 脚本并挂到 package.json scripts。
- [ ] 跑全部相关 `verify:*` + `npm run build`。

## 验证命令
```
npm run build
node scripts/verify-list-summary-store.mjs
node scripts/verify-error-report.mjs
node scripts/verify-image-compression.mjs
node scripts/verify-lan-image-sink.mjs
node scripts/verify-evidence-package.mjs
node scripts/verify-storage-estimate.mjs
```

## 回滚点
- 每步 build 绿。S1-S3 若发现摘要一致性问题，可先只保留 S2 读取兜底（读摘要失败回退全量扫描一次）再排查。
- 代码层回滚保留在提交前；发布后 DB 版本不可逆（见顶部）。
