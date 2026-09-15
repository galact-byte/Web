# 实施验收记录

用户已明确批准方案并要求继续实施。应用修改与隔离验证已完成；随后用户授权提交、推送并发布 v0.8.2。版本号、锁文件及发布说明已同步，发布由标签推送触发 CI 构建；不等待远端构建结果。没有打开、修改真实用户库，也没有重启正在使用的服务。

## 验收对应

| 验收 | 已验证证据 | 限制 |
| --- | --- | --- |
| A1 连接隔离与边界 | `verify-web-lan-connections.mjs`：真实 PowerShell 空闲、半头、半正文、reset、慢读期间正常控制请求 <2 秒；非法 framing、头总时限、正文总时限、32 连接上限/释放通过 | 正文 1200ms/发送 1000ms 仅在临时副本；慢读发送被 OS 缓冲完成，未触发该次发送截止时间，不能声称已实测发送超时 |
| A2 单图恢复与资源 | `verify-lan-deadlines.mjs` / `verify-lan-mobile-recovery.mjs` / 双端 UI：HTTP 完整响应预算、前后台真实截止时间、原图下载入口、解码挂起回退、迟到 bitmap close、token 变化及卸载 URL 回收通过 | 未模拟手机进程被系统回收；原图只保留当前页内存。相机权限/系统选图入口沿用现有逻辑，实际相机硬件未测 |
| A3 身份及真实保存 | 双端协议：重复 POST、内容/目标冲突、明确失败人工重试、重复与迟到回执；双端真实 IDB：上传响应丢失、Web confirm 响应丢失、延迟 complete、只一条引用/字节、目标选择变化不误投通过；既有 image-sink 检查不存在目标/越权拒绝 | 测试数据为合成数据，没有读取现场系统的历史照片 |
| A4 不确定结果与会话 | 实际 IDB 写路径抛错不报成功；实际提交而完成事件延迟先显示尚未确认，迟到完成后核对成功；HTTP 挂起、会话停止、token 变更后可下载原图，不能跨会话重传；真实事务生命周期 mock 注入 complete/abort/error，pending 写保护直到终态 | 电脑页面不可用以“保存不完成/迟到通知”与会话停止覆盖，未穷举操作系统强杀/突然断电 |
| A5 日志 | 接收、保存回执日志关联 requestId / sessionId / attempt / 目标；连接错误只记录 phase/path/timeout；协议脚本断言日志不含 token 或图像 Base64 | 无现场抓包，不能从旧 ReadByte 日志确定哪一张图是否已保存 |
| A6 构建与回归 | 构建、相关现有回归、两端各 7 组实际链路、375/768/1440px 截图、44px 操作区、状态语义、真实 Enter、diff 检查通过 | 未制作安装器、未真机热点验收 |

## 最终已通过命令

```bash
node scripts/verify-web-lan-connections.mjs
node scripts/verify-lan-upload-recovery.mjs
node scripts/verify-lan-deadlines.mjs
node scripts/verify-lan-mobile-recovery.mjs
node scripts/verify-lan-write-lifecycle.mjs
npm run build
node scripts/verify-lan-upload-ui.mjs
npm run verify:lan-server
npm run verify:web-lan-server
npm run verify:lan-mobile-picker
npm run verify:lan-image-sink
npm run verify:image-compression
npm run verify:image-store
npm run verify:pending-writes
npm run verify:error-report
npm run verify:pwa-build
git diff --check
```

- image-store 76/76、pending-writes 29/29、error-report 19/19。
- UI 最终结果：Web 7 / Electron 7 组通过；`.trellis/.runtime/lan-upload-qa/report.json` 与双端三档 PNG，不提交临时资产。
- PS 5.1 中文输出在 Git Bash 转录显示乱码，脚本退出 0；脚本本体保持 UTF-8 BOM。已去除 PowerShell 异步任务返回值落到终端的杂音。
- 测试曾因固定 1700ms 断言回执重试而存在竞态，现改为等待真实 `lostConfirmations >= 2` 的有界条件；没有增加应用重试次数。

## 复核与交接

主会话按 trellis-check 完成规范、协议跨层、资源释放及测试复核；未派子代理，不称独立审阅。执行依据包括现有 frontend-design / ui-ux-pro-max 风格与可访问性约束、change-log；已更新 CHANGES 和七节协议 spec。

`electron/preload.cjs` 无须改动：既有透传保留新增字段，正式 main/preload 的双端运行验证了接线。无需新增发布文件，Web C# helper 内嵌 PS 脚本。

整组协议回退只回退本任务代码，不回退数据库、不清空用户数据。用户真机验收可以集中检查：拍照/相册正常同步；断网后当前原图可保存；重连核对只出现一张；恢复后继续下一张。已卡住的历史照片是否保存，仍需要在原项目中核对，不能据此声称已找回。
