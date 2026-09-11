# 执行计划

## 当前完成

- [x] 读取本次诊断，核对历史会话与 0.6.1 至 0.7.2 修复语义。
- [x] 检查自检、图片存储/迁移、诊断导出和数据目录代码。
- [x] 记录远程保全步骤与已知恢复边界。
- [x] 运行现有摘要自检、诊断导出、数据目录验证，全部通过。

## 实施记录（用户已批准，任务 in_progress）

- [x] 审阅 PRD/design/implement 后 task.py start（主会话已完成）；读取相关层 specs，本轮不修改 UI。
- [x] RED：隔离 Chrome 与 Electron 均复现缺失 API、null/缺失对账误报一致、旧 completed 跳过已知异常。
- [x] GREEN：只读诊断统计、迁移状态纠正和对账无效值处理，不加恢复功能。
- [x] 两端正常记录（含真实内联图片搬迁）、缺失记录、null/非法返回模拟、错误事件、abort、超时、重复执行；诊断路径主文档/图片写删次数为零，失败原文档与图片保留。
- [x] 新增 scripts/verify-null-record-diagnosis.mjs：每端独立临时 profile，HTTP 测试页仅加载数据库模块，不加载正式应用或备份清理入口；正常路径使用原生 IndexedDB keyPath=id/key。
- [x] 最终验证：主会话复跑新增回归 Web 32/32、Electron 32/32；`npm run verify:summary-repair` 44/44、`npm run verify:error-report` 19/19、`npm run verify:image-store` 76/76、`npm run verify:data-location` 29/29、`npm run verify:list-summary-store` 24/24、`npm run verify:pending-writes` 29/29、`npm run build`、`git diff --check` 全通过。项目无独立 lint 命令，build 含严格 TypeScript 检查。
- [x] 主会话完成差异审阅与回归；发现进度读取仍把历史异常计入完成，新增两端 RED 后将异常过滤统一到 readMigrationState，进度和执行使用一致判定。原始诊断状态仍原样报告。不提交、发布或归档。

### 测试性质与边界

- `node scripts/verify-null-record-diagnosis.mjs`：使用已安装 Chrome、Electron 与 esbuild，不新增依赖。Electron 使用独立测试 main 和临时 userData，不是打包 EXE 全 UI 验收。
- 正常/缺失/store 缺失/索引缺失/版本不变/数据保留为真实 IDB 行为；null、非法文档、error、超时用受控返回值或平台方法替换模拟。没有构造不符合 keyPath 的 null 数据库。
- 诊断不含图片字节；关联计数不代表图片有效、可恢复或资产归属。
- 未接触开发者或客户真实库，不能声称重现远程底层损坏或恢复数据。
- 首轮 build 的计数联合类型推断错误已修复；既有摘要源码断言更新为报告局部引用，并由真实调用断言验证报告对象及异常详情完整保留。

## 远程阻塞

只有客户数据库副本、相关旧备份或故障前数据包到位，才能验证真实记录和可恢复范围。缺失这些输入不阻塞本地诊断改进，但不得宣称恢复完成。

## 风险点

- db.ts 的迁移完成状态与异常重试逻辑可能影响已有完成列表，需要兼容旧 localStorage 状态。
- errorLog.ts 的诊断导出必须不包含图片字节；导出仍走普通 a download。
- 所有新增源码正则测试先归一化 CRLF；新增只读统计不引入依赖。
- 若实施需要新增用户数据写路径，应接入 trackWrite 并补验证；当前方案不新增用户数据 store 写入。
