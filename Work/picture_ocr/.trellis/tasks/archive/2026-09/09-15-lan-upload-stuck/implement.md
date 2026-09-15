# 实施与验证计划

## 当前状态

实施与隔离验证已完成，详见 [verification.md](./verification.md)。用户已批准方案并启动任务，主会话完成修改与 trellis-check 复核；本次未提交或发布。以下保留原始实施清单用于对照，实际覆盖、通过证据与真机限制以验收记录为准。

## 执行顺序

### 1. 加载规范和建立红灯（R1/R7）

- [ ] 用户批准方案后启动任务，使用 trellis-before-dev 加载 frontend component/hook/state/type/quality 规范，补读当前两端源码；主会话直接实施，非必要不派子代理。
- [ ] 将已复现空闲连接阻塞变为正向测试（预期正常请求 <2 秒）；增加半头、半正文、reset、慢读响应、连接上限、总截止时间测试。
- [ ] 测试在临时副本、随机测试端口、NoBrowser 下运行；确认旧版至少空闲连接场景失败，关闭所有自己创建的进程/连接。
- [ ] 实现有界异步收发，保留 PowerShell 主线程会话逻辑，修正每请求状态隔离与脱敏日志。
- [ ] 运行新的网络故障回归 + 既有 Web 宿主安全/正常确认测试。

### 2. 上传身份、确认与真实落库（R4/R5/R6）

- [ ] 为两端新增行为测试：同 id 重发、内容/目标冲突、受理响应丢失、保存回执丢失、重复确认、迟到确认、失败后同 id 人工重试、会话结束。
- [ ] 校验旧版失败后实现服务端稳定编号、状态查询、能力声明和旧客户端兼容路径。
- [ ] 对接 main/preload/types/App，避免主进程二次生成 id；保持三元组白名单和同一图片最多一次引用。
- [ ] 针对 addImageToProject 添加实际事务超时/完成/abort 测试，再修复真实终态与 trackWrite 生命周期。禁止用“包装 Promise 已超时”冒充事务失败或计数归零。
- [ ] Web 控制请求/confirm 增加时限与会话世代，确认一致重复可成功，终态错误不无限重试。
- [ ] 验证当前/非当前系统分流、目标删除、并发添图、未完成写入关闭保护。

### 3. 手机故障恢复（R2/R3）

- [ ] 新增行为测试：图像处理挂起、POST 无响应、响应体不结束、状态查询挂起、页面后台恢复、token 变更、旧请求迟到。
- [ ] 实现单张 pending 状态、阶段反馈、包含响应体的网络预算、原图保留/下载、结果核对和同 id 重试。
- [ ] 图像处理兜底清理 URL/bitmap/计时器；保留各压缩入口与原图失败回退契约。
- [ ] 避免新选图无提示覆盖 pending；明确放弃不会取消服务器上已开始的保存。没有持久化就不声称刷新可恢复。
- [ ] 成功后刷新快照，不因轮询竞态重复累加计数；恢复入口有可见焦点和行内状态播报。

### 4. 完整回归与交接

- [ ] 用真实 PowerShell 服务 + 隔离浏览器 profile 模拟手机上传，验证输入文件→传输→控制桥→IndexedDB→状态查询，不以仅 mock 服务冒充 Web 实际链路。
- [ ] 用正式 Electron main/preload + 临时 userData 验证同一闭环；保留故障注入的照片条数、id、目标和状态报告。
- [ ] 对正常场景、断网/丢响应、迟到提交、电脑页面关闭、会话失效分别检查终态和恢复；真实手机/热点无法自动覆盖时如实列出限制。
- [ ] 检查 375/768/1440px 与键盘/状态播报，保留隔离截图到 `.trellis/.runtime/lan-upload-qa/`，不提交临时资产。
- [ ] 使用 trellis-check；根据已验证结果更新 CHANGES、相关 spec 的实际契约（包括 backend 索引不适用声明过时这一事实），不扩大为规范重写。
- [ ] PRD 验收逐项核对、git diff --check；汇报改动、证据和已知限制。本任务无发版授权。

## 验证命令

当前已执行基线诊断：

```bash
node .trellis/tasks/09-15-lan-upload-stuck/research/reproduce-web-head-of-line.mjs
```

新增并已通过的脚本：

```bash
node scripts/verify-web-lan-connections.mjs
node scripts/verify-lan-upload-recovery.mjs
node scripts/verify-lan-upload-ui.mjs
```

现有相关回归：

```bash
npm run verify:lan-server
npm run verify:lan-mobile-picker
npm run verify:lan-image-sink
npm run verify:image-compression
npm run verify:image-store
npm run verify:pending-writes
npm run verify:error-report
npm run build
npm run verify:web-lan-server
npm run verify:pwa-build
git diff --check
```

先 build 再运行浏览器/Electron UI 脚本。新验证脚本不能只断言源码出现了 timeout/id 字符串；必须注入真实请求/响应/存储故障，断言恢复结果与持久化条数。只在新改动或失败证据要求时重复检查。

## 风险文件和回退点

| 范围 | 文件 | 重点 |
| --- | --- | --- |
| Web 网络 | start-server.ps1 | PS 5.1 与 UTF-8 BOM、收发有界、固定默认端口、白名单、静态路径边界 |
| 桌面协议 | electron/lanServer.cjs、electron/main.cjs、electron/preload.cjs | 稳定 id、迟到 IPC、会话清理、兼容旧 201 路径 |
| 两端桥接 | src/utils/lanBridge.ts、src/vite-env.d.ts、src/App.tsx | 类型/通道一致、真实保存才确认、世代隔离、去重 |
| 手机界面 | src/components/LanMobileCollector.tsx、可能新增局部上传工具 | File 生命周期、旧结果不能覆盖新任务、HTTP 非安全上下文 API 兼容 |
| 共享图片 | src/utils/imageCompression.ts | 超时不丢原图，迟到资源清理，各入口压缩行为不退化 |
| 持久化 | src/utils/db.ts addImageToProject、src/utils/pendingWrites.ts（仅必要接线） | 事务终态、计数释放、三 store 一致，不重构无关路径 |

按上述步骤保持可独立验证的修改块；需要回退时回退整个关联协议集合，不回退或清空用户数据。不要重启、停止或复用用户当前正在进行采集的真实服务。
