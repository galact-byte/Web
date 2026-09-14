# 实施计划与验证记录

## 实施前门槛

- [x] 用户回复「可以，请继续吧」批准实施，已运行 task.py start。
- [x] 已加载 trellis-before-dev、frontend-design、ui-ux-pro-max 与 change-log，沿用现有结构与风格。
- [x] 实施前工作区只有本任务规划文件，未动其他任务。

## 有序步骤

1. [x] Red：新增真实 TypeScript 分类测试，缺失模块时按预期失败；覆盖真实组零/一/多系统、独立系统、缺组记录与不可变性。旧页面混排与返回丢失经原代码确认，未单独启动旧构建作浏览器 RED。
2. [x] Green：实现轻量视图派生、两页签、组内导航、计数、异常组与空态；db.ts 不变。
3. [x] App 保存每个位置的搜索/滚动，选择限当前可见系统；验证 remount、外部删除、失败重试和零系统组。
4. [x] 更新共享网格与实际行渲染，统一更多菜单；保持创建规则并定位结果，验证采集与导入目标。
5. [x] 更新旧布局断言，新增真实菜单键盘/外部点击/单展开和三档宽度回归；修复浏览器发现的底部菜单首次展开占流问题，并确认 RED → GREEN。
6. [x] 完成 trellis-check 主会话全范围检查、生产构建与双端隔离 UI 回归；未启用子代理，未引入依赖。
7. [x] 同步状态/组件/质量规范和 CHANGES.md，准备集中交付。
8. [x] 用户已确认提交方案，并追加授权推送 main 与发布 Release；按功能更新使用 v0.8.0，提交后归档与记录会话，再推送 main 和 `picture-ocr-v0.8.0` 标签。

## 自动验证

实施阶段新增并运行：

```bash
node scripts/verify-project-list-views.mjs
```

现有相关回归：

```bash
npm run verify:lan-mobile-picker
npm run verify:list-summary-store
npm run verify:summary-repair
npm run verify:image-store
npm run verify:image-compression
npm run verify:pending-writes
npm run verify:evidence-package
npm run build
npm run verify:pwa-build
git diff --check
```

当前没有 lint 命令。上述命令已全部通过；另运行 `node scripts/verify-project-list-ui.mjs`，网页 14 组、Electron 13 组回归全部通过。报告与三档截图位于 `.trellis/.runtime/project-list-qa/`（忽略）。

## 真实验证矩阵

全部使用合成数据和隔离存储，覆盖网页生产构建与 Electron 临时 userData，不接触真实用户项目。

- [x] A1/A2：混合数据分类/计数、异常组打开与真实 ZIP 导出通过。
- [x] A3：375/768/1440px 列表和菜单边界、底部向上展开、单菜单、外部点击，以及 CDP Enter/Tab/Escape 与焦点恢复通过；无桥网页隐藏采集入口。
- [x] A4：Web 生产 bridge 对接受控 HTTP control 夹具，Electron 正式 main/preload/LAN 服务，均验证组/系统范围与上传目标、图片计数；真实 ZIP 合并/覆盖保留目标归属，编辑/压缩/删除确认及完成通过。
- [x] A5：搜索、切页、进出组清空选择，确认仅含可见目标；组内全选实际删除通过。
- [x] A6：组内/独立工作区返回、搜索/滚动恢复、删除当前组与最后系统、加载失败重试通过。
- [x] A7：单/多新建、添加系统后清空过滤，取消和受控保存失败不跳转通过。
- [x] A8：生产首屏文档/图片读取均为 0；既有摘要修复去重、图片迁移与 pending-writes 契约回归全绿。

限制：隔离 Electron 使用正式入口加载生产 dist，未构建安装器；Web control 与保存/加载故障为受控模拟，未使用真实手机或客户数据。当前系统卸载会 flushSave，因此外部删除夹具在另一系统工作区期间删除原组；不声称修复跨窗口自动保存覆盖。

## 风险与回退点

- UI 状态接线后先验证 remount 恢复，再批量修改 JSX。
- 旧源码断言失败需区分“已评审的旧布局被替换”和真实回归，保留等价行为证据。
- 无数据格式变更；回退只回退本任务代码与文档，不清库、不删除异常记录。
- 用户后续批准发版：远端最新正式版 v0.7.3，采用 v0.8.0；package.json、锁文件与 RELEASE-NOTES.md 同步。
- 发布检查补充执行并通过：生产构建、verify:lan-server、检查项交互及 Pointer 浏览器回归、verify:data-location（29/29）、verify:storage-estimate（9/9）、verify:web-lan-server（正式 PowerShell 宿主）、verify:pwa-build。
- 推送 main 和发布标签后即结束，不轮询等待 Actions；安装器与网页 ZIP 由 CI 生成。
