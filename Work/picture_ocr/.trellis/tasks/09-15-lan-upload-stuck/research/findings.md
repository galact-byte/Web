# 局域网上传卡住：证据与复现

## 现场证据

用户报告刚才多次失败集中在“政务服务中心”系统：拍照后一直同步中，改用系统相机拍照再从相册选择也失败。热点离电脑很近。终端反复输出：

```text
[REQUEST ERROR] Exception calling "ReadByte" with "0" argument(s): "Unable to read data from the transport connection: An existing connection was forcibly closed by the remote host."
```

该输出与 `start-server.ps1:164` 捕获 `Read-HttpRequest` 错误的格式一致，现场优先定位 Web ZIP PowerShell 服务。`ReadByte` 位于请求头读取阶段（`start-server.ps1:68`），正文使用 `Read`；日志没有来源、路径、时间和关联编号，不能据此断定每条错误对应一张未上传图片，更不能断言是项目数据损坏。

## 已复现的问题

运行：

```bash
node .trellis/tasks/09-15-lan-upload-stuck/research/reproduce-web-head-of-line.mjs
```

在临时目录复制原版服务脚本，生成最小静态首页，临时 loopback 端口、`-NoBrowser` 启动，不接触用户真实服务或 IndexedDB。一个 TCP 连接建立后不发送请求；同时请求正常控制状态；然后主动 reset 空闲连接并重测。

实际输出：

```json
{
  "baselineMs": 610,
  "idleSocketBlocksControl": true,
  "observationMs": 2516,
  "afterDisconnectMs": 57,
  "readByteResetLogged": true
}
```

结论：一个未提交完整请求的连接足以阻塞其他控制请求；断开后恢复，并产生同类 ReadByte 日志。这是代码缺陷的真实运行证据，不是现场网络包回放，也不是已恢复用户照片。

脚本目前是基线诊断，断言旧版存在阻塞。修复实施时转为正向回归：空闲/半包连接存在期间其他请求仍须成功；不能用旧诊断断言作为修复后的通过标准。

## 代码链路

| 证据位置 | 事实与影响 |
| --- | --- |
| `start-server.ps1:164` | accept 后同步读完整头/正文、处理、写响应、关闭，再 accept 下一个。收发单次 timeout 15 秒。控制、静态、手机 API 共用这个循环。 |
| `start-server.ps1:65` / `:68` | 正文同步 Read / 头逐字节 ReadByte，超时为单次 I/O，并非整个连接总时限；持续慢传还可延长等待。 |
| `start-server.ps1:164` | `$request` 每轮没有先置空，读新请求失败可能引用上一轮已关闭 stream；异常被二次 catch 吞掉。 |
| `src/components/LanMobileCollector.tsx:183` / `:195` / `:207` | 上传、状态查询无网络时限；uploadingItemId 只有 finally 释放，所有拍照/相册入口共用锁。 |
| `src/components/LanMobileCollector.tsx:89` | 快照读取卡住也会锁住 refreshInFlightRef，后续轮询被跳过。 |
| `src/utils/lanBridge.ts:83` / `:136` | 控制请求无时限，pending 查询卡住会一直占用 pollInFlight，导致电脑不再领取待保存图片。 |
| `src/utils/lanBridge.ts:111` + `start-server.ps1:142` | 确认请求重试；服务器重复确认返回 404，丢失确认响应后可能无限重试；无会话世代隔离。 |
| `start-server.ps1:148` + `electron/main.cjs:50` | 每次上传由服务端重新生成 requestId；重新 POST 无法天然去重。 |
| `src/App.tsx:240` + `src/utils/db.ts:697` | 图片 id 已按 `lan-${requestId}` 派生；数据库同 id 替换、不同 id 新增，可复用该边界实现稳定重试。 |
| `electron/main.cjs:52` + `src/components/LanMobileCollector.tsx:183` | 桌面确认超时 20 秒；Web 确认名义约 20 秒（还未算网络时间）。 |
| `src/utils/db.ts:44` / `:46` / `:697` | 图片写入允许 120 秒；withTimeout 仅拒绝 Promise，不取消实际事务。外层超时不能证明底层没写入。 |
| `src/utils/imageCompression.ts:111` / `:124` / `:138` | createImageBitmap、img 解码、toBlob 没有挂起兜底。仅 await 成功/失败才进入下一阶段，属于需覆盖的边界，尚未复现为现场根因。 |

## 方案依据与限制

- 本任务以当前实现为参照，复用现有两端宿主、bridge、图片 id 和三 store 事务，不引入服务框架或数据库迁移。
- `.trellis/spec/backend/index.md` 仍声称没有服务端，与现有 Electron/PowerShell 宿主不符；不能据此忽略 Web 服务问题。实施后修正对应适用范围和新增的实际契约，避免扩大为整套 spec 重写。
- 既有 `verify-web-lan-server.ps1` 验证正常请求、安全边界与保存确认，但全程串行，不覆盖空闲连接阻塞；现有源码正则检查也不能替代网络故障注入。
- 本机隔离复现不能确认现场连接为何中断（浏览器取消/预连接、切系统相机导致页面挂起、网络瞬断均未排除）。没有读取用户“政务服务中心”真实库，尚不知具体哪些图片是否已提交。
