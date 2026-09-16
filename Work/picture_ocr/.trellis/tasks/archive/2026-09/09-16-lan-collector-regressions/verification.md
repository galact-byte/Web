# 实施验证记录

## 结论与环境
基于 `fb96034`，用户批准实施后完成三项修复。生产构建、隔离 Web（PowerShell 服务 + Chrome）与 Electron（正式 main/preload + 临时 userData）自动化通过。只使用合成照片、隔离数据库/端口；未修改服务协议、生产超时、固定端口、DB 版本或系统电源策略。用户已批准提交、推送并发布 v0.8.3，Release 由既有标签工作流构建。

发布前已将 package.json/package-lock.json 同步到 0.8.3，并重新通过构建、PWA、组名快照、手机恢复、差异及任务上下文检查；本轮没有追加应用逻辑修改。

## Red → Green 与验收映射

| 需求 | 原问题与失败证据 | 最终验证 |
| --- | --- | --- |
| A1/A2 后台恢复 | 电脑已经保存但手机停在未确认；只加手机恢复事件仍漏掉手机持续前台、仅电脑暂停 | 生命周期脚本双端各 11 项通过，其中覆盖手机网络暂停、双方冻结电脑先恢复、仅电脑冻结、双方冻结手机先恢复。恢复不追加 POST，4 张照片对应 4 条引用/4 条字节，目标仍为原系统。 |
| A3 名称 | 工作台传入空标题，快照不读真实组；列表改名若不碰巧赶上卸载后的刷新，手机一直显示旧名称 | `verify-lan-group-snapshot.mjs` 验证真实组优先、改名、空名、单/多系统、独立/缺组及读取失败；真实 UI 从工作台启动，工作台保存后更新，再返回列表等待旧重建结束后改名，手机和会话标题同步、范围不变。列表完整双端回归验证列表启动的组级/系统级范围。 |
| A4 拍照 | 缺 API/非安全上下文仍尝试网页相机，失败后要求再次点击 | 双端验证一次点击 capture input、非安全上下文不调用网页相机、取消后重入；安全上下文权限拒绝保留人工回退，合成媒体流预览取消后 tracks 全部 ended，相册取消无上传。 |

红灯日志：`.trellis/.runtime/lan-lifecycle-red.log`、`lan-lifecycle-visible-red.log`、`lan-list-rename-idle-red.log`。名称单元脚本也在修复前捕获占位名错误；这些历史失败日志保留用于追溯，不代表最终状态。

完整列表回归曾发现新加入的构建代际会被对话框初始化重复报告的 running=false 作废；已改为只在运行状态真正变化时作废。最终列表回归 Web 19 / Electron 18 项通过，日志 `lan-project-list-final.log`。

## 已执行检查

- `npm run build`：TypeScript、Vite、Service Worker 均成功；最后一次应用代码修改后重新构建。
- `node scripts/verify-lan-upload-ui.mjs --lifecycle`：最终双端 22 项通过；`.trellis/.runtime/lan-lifecycle-final.log` 与 `lan-upload-qa/lifecycle-report.json`。
- `node scripts/verify-lan-upload-ui.mjs`：原上传双端各 7 组通过，包含丢响应/回执、写入失败、迟到事务、解码挂起、token 切换、卸载资源释放；375/768/1440px、44px 按钮及真实 Enter。人工查看 Web 375px 与桌面服务手机页 768px 截图，布局/文案无溢出。报告和截图 `lan-upload-qa/`。
- `node scripts/verify-project-list-ui.mjs`：修复初始化竞态及列表回调后最终双端 37 项通过，三档尺寸、真实键盘、菜单/焦点、数据操作和采集范围均通过。
- `verify-web-lan-connections.mjs`、`verify-lan-upload-recovery.mjs`、`verify-lan-deadlines.mjs`、`verify-lan-mobile-recovery.mjs`、`verify-lan-write-lifecycle.mjs`、`verify-lan-group-snapshot.mjs`：通过；单次只读查询覆盖 saved/pending/not_received/failed，会话失效及自动模式不发送。
- `verify:lan-server`、`verify:web-lan-server`、`verify:lan-mobile-picker`、`verify:lan-image-sink`、`verify:pending-writes`、`verify:image-store`、`verify:image-compression`、`verify:error-report`、`verify-project-list-views.mjs`、`verify:pwa-build`：通过。相关日志 `.trellis/.runtime/lan-regression-*.log`。
- 最后一次构建后再次运行 mobile-recovery、group-snapshot、mobile-picker、PWA 检查，均通过。`git diff --check` 与任务上下文校验通过。

首轮汇总 `lan-regression-all.log` 中保留了列表回归的失败，最终结果以 `lan-project-list-final.log` 为准；未修改失败日志制造全绿。

## 复核与约束
- 恢复状态查询复用 `queryUploadStatus`；自动核对不会发照片，人工明确失败重试仍沿用同一编号/目标。
- 只在真实 saved 回执后清理原图；网络查询失败保留状态。手机请求单飞，恢复事件合并，低频查询有取消与卸载清理。
- 名称保存通过现有 AppContext 或列表持久化路径，不新增写库入口；组名读取失败向上传播，不覆盖真实数据。
- 摄像头能力判断在同步用户手势内执行，不用 UA 猜测；权限失败保留人工回退。
- 无新依赖、数据库迁移、临时禁用类型检查或生产调试日志。相关 LAN 契约、状态与质量规范及 CHANGES.md 已更新。

## 实测边界与集中验收
- `--lifecycle` 不关闭 Chrome 后台计时器节流，Electron 测试入口通过 `LAN_TEST_BACKGROUND=1` 跳过禁用节流；CDP 冻结/解冻与网络故障是可重复模拟。网络等待预算只在测试页缩短，未修改生产超时。
- 没有锁定用户电脑，也没有真机手机；不能声称已经实测 Windows 自动锁屏、具体手机 Wi-Fi/电源策略或原生相机选择器。普通 HTTP 下只能验证直接激活 capture input，系统是否继续弹来源选择由手机浏览器决定。
- `[CONNECTION CLOSED] phase=header path=unknown timeout=False` 可由空连接关闭独立产生，本次未将它当成照片失败根因；现场故障的所有成因仍未确认。
- 当前页面关闭/刷新/被系统回收后仍不保证原图恢复。电脑真正睡眠或断网时不承诺后台传输。
- 用户集中验收：启动更新构建后，在 Web 和桌面各启动一次采集；分别让电脑锁屏后手机拍照、手机拍完锁屏、两边锁屏后按两种顺序解锁，观察恢复后的确认与电脑图片数；会话内从工作台/列表改名，手机页头应更新；Chrome 分开选择模式点击拍照，不再先经历网页相机失败再点回退。
