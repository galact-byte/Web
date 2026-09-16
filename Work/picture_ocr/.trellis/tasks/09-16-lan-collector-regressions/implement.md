# 实施与验证计划

## 启动门禁
- [x] 用户批准创建任务和排查规划。
- [x] 检查当前实现、v0.8.2 前相机代码与上一任务验收；做名称/连接日志隔离探针。
- [x] 确认电脑和手机锁屏均纳入范围，优先电脑自动锁屏；PRD 与设计已补充组合恢复矩阵。
- [x] 用户以“可以，请继续吧”批准实施，已执行 `task.py start`。

## 顺序
1. **R1 Red：复现后台问题。** 扩展现有隔离双端上传验证，后台用例关闭测试专用的禁用节流选项；以双方前台为对照，优先验证电脑页面隐藏/冻结期间手机继续上传，再验证手机上传中/等待回执时暂停，最后覆盖双方暂停及不同恢复顺序，同时检查响应丢失和断网。记录卡住阶段。可控生命周期注入是模拟，不冒充 OS 锁屏；真实锁屏验证按同一矩阵记录可用环境与实测限制。
2. **R1 Green：最小修复。** 按已定位阶段修改恢复触发、状态反馈或服务处理。保存计数按真实事务终态结算；重试复用原身份。验证同一请求恢复后仅一条引用/字节。若需改变架构或协议，先更新方案审阅。
3. **R2 Red → Green：名称。** 通过真实 `buildGroupSnapshot` 与隔离组数据验证工作台/列表启动及组名更新，再接通权威组名和保存后的重建。覆盖单/多系统、独立系统、空名、缺组与过期异步结果。
4. **R3 Red → Green：拍照。** 公共 UI 行为验证无 API/非安全上下文点击“拍照”只触发一次 capture input；安全上下文保留预览，拒绝/取消可恢复。再实现同步能力路由。复用当前 Node/CDP 验证工具，不引入测试框架。
5. **整体验收。** 双端真实 IDB 合成图片链路、恢复与跨系统目标不变、手机标题更新、两种图片入口。截图检查 375/768/1440px、键盘操作及 44px 目标。原生手机相机和 Windows 真实锁屏单列实测边界；自动化可做的检查先完成，不逐项交由用户排错。
6. **收尾。** 按 `trellis-check` 复核，按需要更新 LAN 契约/质量规范及 CHANGES.md；记录已验证内容与限制。提交、发布另依用户授权。

## 验证命令
新增回归优先扩展既有脚本；每轮按改动运行相关项，最后运行下面完整集合：

```bash
npm run build
node scripts/verify-web-lan-connections.mjs
node scripts/verify-lan-upload-recovery.mjs
node scripts/verify-lan-deadlines.mjs
node scripts/verify-lan-mobile-recovery.mjs
node scripts/verify-lan-write-lifecycle.mjs
node scripts/verify-lan-upload-ui.mjs
node scripts/verify-lan-upload-ui.mjs --lifecycle
node scripts/verify-lan-group-snapshot.mjs
npm run verify:lan-server
npm run verify:web-lan-server
npm run verify:lan-mobile-picker
npm run verify:lan-image-sink
npm run verify:pending-writes
npm run verify:image-store
npm run verify:image-compression
npm run verify:error-report
node scripts/verify-project-list-views.mjs
node scripts/verify-project-list-ui.mjs
npm run verify:pwa-build
git diff --check
```

实施、双端回归及规范更新已完成，完整结果见 [verification.md](verification.md)。列表整体回归曾捕获首次快照被重复 false 状态取消的竞态，修复后最终双端全绿。真实 OS 锁屏/手机系统相机未实测。用户已批准提交、推送和发布，版本定为 v0.8.3；由标签 picture-ocr-v0.8.3 触发既有双端 Release 工作流。

## 风险和保护
- `src/utils/lanUpload.ts` / `lanBridge.ts`：恢复触发可能造成并发确认、旧会话串入；检验单飞、abort 和 generation。
- `src/App.tsx` / `lanGroupSnapshot.ts`：保存去抖与构建竞态，名称不能改变会话范围。
- `LanMobileCollector.tsx`：文件 input 必须保有用户激活，媒体流、原图 URL、异步编码必须清理。
- `start-server.ps1` / `electron/lanServer.cjs` / `main.cjs`：只在证据需要时修改，保持双端安全边界和正常关闭逻辑。
- 所有服务、profile、userData 使用临时副本；不停止现用服务、不锁定用户整台电脑来跑无人值守实验。
