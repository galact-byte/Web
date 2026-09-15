# 局域网上传恢复契约

## 1. 范围与触发

修改 `start-server.ps1`、`electron/lanServer.cjs` / `main.cjs`、`lanBridge.ts`、`lanUpload.ts`、手机采集页或 LAN 入库路径时适用。两端都要验证。沿用现有来源、白名单、图片压缩与三 store 原子写入，无新增依赖或数据库迁移。

## 2. 接口

- `GET /api/session?token=…`：快照增加可选 `uploadRecovery: 1`。
- `POST /api/upload?token=…&projectId=…&assetId=…&itemId=…&requestId=…[&retry=1]`：图片原始字节；服务验证 MIME/签名/大小、身份与目标。
- `GET /api/upload-status?token=…&requestId=…`：核对原请求。
- Web `/api/control/pending` 返回 `requestId/sessionId/attempt/projectId/assetId/itemId/image`；`POST /api/control/confirm` 接受 `requestId/sessionId/attempt/success`。
- Electron `lan:image` 与 `lan:image-result` 使用同一身份三元组；preload 透传，main 不重新生成请求编号。
- `synchronizeUpload(job, phase, signal)` 位于 `src/utils/lanUpload.ts`；`requestJson/withDeadline/abortable` 位于 `asyncDeadline.ts`。

## 3. 数据与生命周期

- 手机每张待传图用 `crypto.getRandomValues` 生成稳定编号；无 HTTPS 的 LAN 不能依赖 `randomUUID`。服务接受 16–80 位字母/数字/下划线/短横线。
- 同会话同编号绑定原始 project/asset/item、MIME 和服务端 SHA-256；冲突 409。重试不生成新编号，落库图片 id 为 `lan-${requestId}`。
- 状态元数据最多 4096 条，保留到会话结束；待保存最多 8 张。已完成记录释放图片字节。仅明确 failed 且人工 `retry=1` 才重新派发。
- Web pending 不因 GET 被删除；保存完成后 confirm 删除队列。相同确认幂等成功，旧 attempt/session 或冲突结果 409。桥接层只重发保存结果，不重复执行已完成保存；请求单次 8 秒，轮询 finally 解锁，代际校验隔离停止/新会话。
- 无 requestId 的旧客户端保持服务端生成编号的兼容入口；新客户端在旧宿主上不承诺安全重传。桌面新版请求先返回 202，旧请求保留等待 201 的行为。
- 手机内存只保留一张原图、压缩字节和固定目标。处理 15 秒、上传 45 秒、请求/完整 JSON 响应 8 秒、主动等待保存 30 秒。恢复前台依据真实截止时间检查；token 变更和卸载取消旧工作，旧快照不能覆盖新会话。
- Web 网络每连接异步收发，PowerShell 主循环只处理完整请求；最多 32 连接，非 loopback 最多占到 28，为本机控制保留容量。头 32KiB / 5 秒、正文 10MiB / 45 秒、发送 10 秒总预算。拒绝非法/重复 Content-Length 和 Transfer-Encoding。单连接失败不退出服务，日志不记录 token 或图片。
- `addImageToProject` 不再套“只拒绝 Promise”的通用超时；120 秒时请求 abort，以真实 oncomplete/onabort 结算并释放 trackWrite。事务 error 记录原因但不提前释放；迟到 complete 仍为成功。其他数据库路径没有随本任务重构。

## 4. 校验与错误矩阵

| 条件 | API/界面 |
| --- | --- |
| 当前会话未接收 | 404 + `not_received`，可同 id 发送 |
| 排队/保存中 | 202 + `pending`，等待或保留原图稍后核对 |
| 真实提交 | 201 + `saved`；刷新快照获取计数，不额外 +1 |
| 明确落库失败 | 503 + `failed`，人工同 id 重试 |
| 连接/确认超时 | 尚未确认，不声称未保存或成功 |
| 身份/目标/内容冲突 | 409，不重定向到当前选择目标 |
| 会话失效/服务关闭 | 401 或连接失败；原图保留，不跨会话重传 |
| 类型/容量/并发边界 | 400/403/413/415/429；保留当前文件与恢复操作 |

## 5. 正常、边界与错误案例

正常：选图 → 压缩 → 202 → 原子事务 complete → 保存回执 → 状态 201。

边界：上传响应丢失，但事务成功；手机用原编号查询 201，不再次添图。事务完成通知迟到时手机显示尚未确认，迟到确认后核对仍只一张。

错误：解码一直不返回时，预算结束回退原图，迟到 bitmap 调用 close；不可取消的异步资源必须有迟到释放路径。照片只保留在当前页面，刷新、关闭或浏览器回收不保证恢复；普通 `<a download>` 保存原图，放弃前确认且说明不取消电脑端已开始的保存。

## 6. 必须验证

- `node scripts/verify-web-lan-connections.mjs`：真实 PS 空闲/半包/reset/慢读不拖住控制，总时限、非法 framing、32 连接上限。正文/发送预算仅在临时副本缩短；OS 缓冲完成发送时不冒称复现了发送超时。
- `node scripts/verify-lan-upload-recovery.mjs`：两端同 id 去重、目标/字节冲突、失败人工重试、重复/迟到确认、8 张队列容量；Web 旧会话隔离。
- `node scripts/verify-lan-deadlines.mjs`、`verify-lan-mobile-recovery.mjs`、`verify-lan-write-lifecycle.mjs`：响应体挂起、前后台截止时间、迟到资源、稳定目标/编号、实际事务终态与关闭保护。
- 先 `npm run build`，再 `node scripts/verify-lan-upload-ui.mjs`：真实 PS + 浏览器、正式 Electron main/preload + 临时 userData；丢回执、写入失败、迟到事务事件、解码挂起、同 id 恢复，核对真实 IDB 引用/字节数量；375/768/1440px、状态播报和真实 Enter。
- 现有 LAN server/mobile-picker/image-sink、image-compression/image-store/pending-writes/error-report、Web LAN 和 PWA 检查；`git diff --check`。
- 不使用真实用户数据或重启用户正在采集的服务。隔离浏览器与受控故障不等于手机相机权限、热点和浏览器被系统回收的真机验证。

## 7. 反例与正确做法

错误：每次 POST 新建 requestId；20 秒没有确认就认定写入失败并删除关联；重试再次添图。

正确：固定身份与目标，只有真实持久化提交才确认成功；网络等待结束只表示尚未确认，保留原图和原编号核对。事务保护持续到真实终态，旧 session/attempt 的回执不污染新结果。
