# 实施计划与验证记录

## 授权与基线

- [x] 用户批准创建任务，评审需求、设计与实施计划后回复「可以，请继续吧」批准实施；task.py start 已将任务激活为 in_progress。
- [x] 参考旧版原地展开，复用当前摘要、菜单与共享网格，不恢复混排。
- [x] 保留工作区已有 ProjectList.tsx 去除重复分类标题的修正。

## 执行步骤

1. [x] 按 trellis-before-dev、frontend-design、ui-ux-pro-max 与 change-log 加载规范；主会话直接实施，无额外依赖或子代理。
2. [x] RED：新增纯逻辑测试因 filterGroupSystems 缺失而失败；更新 UI 核心断言在旧生产构建因「初次全部展开」失败。
3. [x] GREEN：App 持有页签与两套展开 ID；项目原地多组展开、共享系统行，移除详情导航。
4. [x] 接回新建/添加展开定位、搜索恢复、单组选择和删除；保存与刷新分开，刷新失败不重复保存，重试成功后定位。
5. [x] 双端 UI 夹具更新为原地展开，保留 ZIP 导入导出及组/系统采集上传；增加首次/全部收起/工作区重挂载、搜索清除、选择清理、真实展开键盘与焦点。
6. [x] trellis-check 主会话全范围检查，生产构建和双端隔离回归通过；检查 375/768/1440px 独立/项目列表、层级、菜单和无重复标题。
7. [x] trellis-update-spec 同步状态/组件/质量规范，CHANGES.md 记录验证与限制。
8. [x] 用户验收新版布局后明确批准提交、推送和 Release 发布；按 v0.8.1 交付，工作提交后归档并记录会话。

## 验证命令与结果

以下命令全部通过：

```bash
node scripts/verify-project-list-views.mjs
npm run verify:lan-mobile-picker
npm run verify:list-summary-store
npm run verify:summary-repair
npm run verify:pending-writes
npm run verify:evidence-package
npm run build
npm run verify:pwa-build
node scripts/verify-project-list-ui.mjs
git diff --check
```

- 摘要读取 24/24、自检修复 44/44、pending-writes 29/29；采集 UI、加密数据包、纯派生测试与构建/PWA 通过。项目未配置独立 lint 命令。
- 最终 UI 整套无参数执行：Web 19 组、Electron 18 组通过。当前报告为 `.trellis/.runtime/project-list-qa/results.json`，最终日志为 `.trellis/.runtime/project-group-layout-final.log`；截图分别为 `<platform>-<width>.png` 和 `<platform>-groups-<width>.png`，均为忽略的测试产物。
- 桌面自动化曾因窗口被遮挡后的计时器节流超时；隔离测试入口调用 setBackgroundThrottling(false) 后在原超时内全绿。CDP 命令增加有界等待、断连即失败，避免失败截图永久等待；可用 --web-only / --desktop-only 定位环境问题，不以单端或旧报告代替最终整套结果。

## 验收映射

- [x] A1/A2：真实 Enter/Space 展开收起、多个同时展开；默认全展开、全收起后刷新/返回、搜索清除恢复及滚动返回通过。
- [x] A3：空组、单系统组、异常组和独立分类正确；生产首屏 documents=0/images=0。
- [x] A4：选择另一个项目清前组选中项，收起/搜索/切页清选择；组内全选实际删除，确认目标不含隐藏系统。
- [x] A5：异常组真实 ZIP 导出、合并/覆盖导入保持目标与图片；搜索仅展示一个系统时组级采集仍含全组，系统级只含一项；两端上传计数及目标正确。
- [x] A6：单/多新建、添加后展开定位、取消/保存失败、保存成功但刷新失败与重试、删除组/最后系统、外部删除落点通过。
- [x] A7/A8：三档独立/项目截图、菜单边界、键盘及收起焦点，Chrome 和 Electron 正式入口回归通过。

## 截图反馈后的排版修订

- [x] 根据用户截图 `C:/Users/g1582/Desktop/1789388723506.png` 调整：44px 展开区域与 20px 箭头、项目标题栏、组内独立表头、全选并入表头，选择后显示删除。保留单位不同的系统信息。
- [x] 构建、纯逻辑、采集 UI 与 PWA 检查通过；加入长名称、单位差异、展开入口尺寸、表头/数据对齐及资产数不换行断言后，无参数双端完整回归 Web 19 / Electron 18 全绿，人工查看大屏与窄屏新截图。

## v0.8.1 发布检查

发布前同步 package.json、package-lock.json 与 RELEASE-NOTES.md 为 0.8.1，重新构建和 PWA 检查通过；加密数据包、桌面 LAN、采集 UI、检查项交互、真实 Pointer 拖拽、数据目录、存储估算及 Web ZIP 服务检查全部通过。功能回归沿用本任务最终布局版本 Web 19 / Electron 18 组完整报告；发布时未改应用逻辑。推送 main 与标签触发现有 GitHub Actions 生成 Windows 与 Web 资产，按用户约定不等待远端构建。

## 验证边界与回退

测试使用合成数据和临时 profile/userData，不操作真实库。Web control 与加载/保存故障为受控模拟；Electron 使用正式 main/preload、临时数据目录和生产 dist，未生成安装器；未用真实手机/Wi-Fi 验收。

外部删除夹具在另一个系统工作区期间删除原组，避免卸载 flushSave 重建记录，不声称解决跨窗口自动保存覆盖。

无数据库迁移、图片预取或跨组批量删除。回退仅回退本次展示、状态与测试改动，保留已授权的标题去重修正；不清库。
