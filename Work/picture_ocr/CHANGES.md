# 修改记录 — Picture OCR

## 2026-07-21 — v0.4.2 手机采集兼容性与响应式项目列表

### 背景与目标
- 改善部分 Android / HarmonyOS 浏览器扫码后仅显示相册的问题，并消除局域网会话对话框中重复的关闭操作。
- 适配 Windows 不同屏幕尺寸与 DPI 缩放下的项目列表，避免操作按钮拥挤或不自然换行。

### 影响与兼容性
- 手机端继续使用单一“拍照 / 选择图片”入口，移除 `capture="environment"` 的相机强制指令，由 Android、iOS 和 HarmonyOS 的浏览器/系统选择器提供可用的拍照或相册选项。
- 图片格式白名单仍为 PNG、JPEG、GIF、WebP 和 BMP，未增加 HEIC；已有服务端校验和 Word 导出行为不变。
- 窄窗口将低频项目操作收纳至“更多操作”，宽屏保留全部快捷操作；不改变项目数据、局域网会话或导入导出协议。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `src/components/LanMobileCollector.tsx` | 移除 `capture="environment"`，保留单一图片选择入口和既有格式限制。 |
| 修改 | `src/components/LanCollectorDialog.tsx` | 移除底部重复“关闭”按钮，保留右上角关闭与明确的会话启停操作。 |
| 修改 | `src/components/ProjectList.tsx` | 为项目表格添加窄/宽屏列布局和低频操作菜单。 |
| 修改 | `src/components/project-list/ProjectListHeader.tsx` | 调整搜索与操作区的自适应换行、间距及触控高度。 |
| 新增 | `scripts/verify-lan-mobile-picker.mjs` | 校验图片入口、对话框操作及响应式布局约束。 |
| 修改 | `package.json`、`package-lock.json` | 升级版本至 `0.4.2` 并登记专项验证命令。 |

### 验证
- `npm run verify:lan-mobile-picker`：通过单一图片入口、取消相机强制、会话操作和响应式布局约束验证。
- `npm run verify:lan-server`、`npm run verify:web-lan-server`、`npm run verify:evidence-package`：通过局域网服务、Web ZIP 会话和数据包回归验证。
- `npm run build`、`npm run verify:pwa-build`：通过 TypeScript、生产构建及 PWA 构建产物验证。
- `git diff --check`：通过。

### 已知限制与后续
- 手机系统文件选择器展示的拍照/相册选项由具体浏览器与系统版本决定，仍需在目标 vivo、iPhone 和华为设备上完成扫码烟测。
- 历史 HEIC 照片仍不在支持范围内；若需支持，应单独实现并验证 HEIC 转 JPEG 的完整上传、校验、存储和报告导出链路。

## 2026-07-20 — Web ZIP 与 Windows 客户端统一手机局域网实时采集

### 背景与目标
- 将原本仅 Electron 客户端可用的“手机局域网采集”扩展至 Web ZIP；两种交付形态均为推荐的实时采集路径。
- 保留既有 Electron 实现和普通 ZIP 数据包导入/导出；`.evidence` 仅保留历史兼容和紧急恢复，不再推荐作为日常流程。

### 影响与兼容性
- `启动测评证据采集工具.bat` 仍启动同一 `start-server.ps1`，但 PowerShell 现作为真正的局域网会话宿主：电脑页面只通过 loopback 控制 API 启停会话，手机只通过随机 token 访问快照、上传白名单图片及查询保存结果。
- 为避免 `HttpListener` URL ACL / 通配符权限问题，Web ZIP 始终先用精确 `TcpListener` 绑定 localhost；仅在用户启动会话时再绑定所选 RFC1918 私有 IPv4，并在停止、切换或超时后释放该监听。未连接 Wi-Fi/热点时不阻断电脑端项目管理，手机采集链接仅在所选私有地址上生效。
- 上传图片只存在 PowerShell 内存待确认队列；浏览器 IndexedDB 成功或失败确认后立即移除。手机先得到 `202`，仅轮询到 `201` 时显示保存成功。
- HTTP 不加密，仍仅限同一可信 Wi-Fi 或可信个人热点；防火墙应仅允许专用网络。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 修改 | `start-server.ps1` | 从 localhost 静态服务升级为受限控制/手机 API、静态资源边界和内存交付确认的 TCP 宿主。 |
| 新增 | `src/utils/lanBridge.ts` | 统一 Electron 原生桥与 localhost Web 控制桥；Web 使用短轮询交付图片。 |
| 修改 | `src/App.tsx`、`src/components/ProjectList.tsx`、`src/components/LanCollectorDialog.tsx` | Web/Electron 共用可用性检测、项目入口、会话对话框和 IndexedDB 保存确认。 |
| 修改 | `src/components/LanMobileCollector.tsx` | 移动端在电脑端保存确认前保持等待，不提前报告成功。 |
| 新增 | `scripts/verify-web-lan-server.ps1` | Windows PowerShell 验证控制端、token、白名单、类型校验、交付确认、关闭失效和静态边界。 |
| 修改 | `README.md`、`.github/workflows/release-picture-ocr.yml`、`package.json` | 统一推荐流程、Release Notes 和验证命令。 |

### 验证
- `npm run verify:web-lan-server`：通过 Web ZIP 局域网控制、token、白名单、静态边界、上传确认和停止失效验证。
- `npm run build`、`npm run verify:lan-server`、`npm run verify:pwa-build`、`npm run verify:evidence-package`：通过。

### 已知限制与后续
- Web ZIP 只支持 Windows PowerShell 5.1+；没有可用私有 IPv4、被防火墙或企业网络策略阻断时无法建立手机会话，并会显示真实错误。
- 未在真实手机设备上自动化验证；交付前需按 README 在可信同网段完成扫码、拍照、保存确认和会话关闭烟测。

## 2026-07-20 — Windows Electron 手机局域网实时采集

### 背景与目标
- 为 Windows Electron 客户端增加同一可信局域网内的手机实时拍照/选图同步，作为日常手机采集的推荐流程。
- 移除普通项目列表中的“导出加密采集包”入口；普通 ZIP“导出数据包 / 导入数据包”保留。
- `.evidence` 加密离线采集包及历史手机页保留为既有数据兼容、离线场景紧急恢复能力，不再作为推荐的日常手机采集路径。

### 影响与兼容性
- Electron 主进程启动单一临时 HTTP 会话，只暴露带随机令牌的采集快照与白名单图片上传；停止、切换/退出工作台或退出客户端后会话失效。
- 新增 `qrcode` 浏览器依赖，用于离线生成手机访问二维码。
- `.evidence` 格式、Web ZIP、IndexedDB 项目数据结构及既有离线手机入口保持兼容；桌面“导入数据包”继续支持导入 `.evidence`。LAN HTTP 不使用 Web Crypto、PWA 或 Service Worker，传输不加密，只能用于可信同网段。

### 文件与实现
| 操作 | 路径 | 说明 |
|---|---|---|
| 新增 | `electron/lanServer.cjs` | 无 Electron 运行时依赖的令牌认证局域网 HTTP 服务、静态资源限制及上传校验。 |
| 新增 | `electron/preload.cjs` | 仅暴露启动/停止/查询会话与受控图片通知的白名单 IPC。 |
| 修改 | `electron/main.cjs` | 安全桌面壳、局域网接口检测、会话生命周期与渲染器通知。 |
| 新增 | `src/components/LanCollectorDialog.tsx` | Windows 工作台的会话、二维码、网络与防火墙说明对话框。 |
| 新增 | `src/components/LanMobileCollector.tsx` | `#/lan/<token>` 手机只读采集快照、拍照/选图上传界面。 |
| 修改 | `src/App.tsx`、`src/components/ProjectList.tsx`、`src/components/Toolbar.tsx` | Electron 入口、路由、当前项目图片写回和会话关闭；项目列表只保留普通数据包导入/导出与 Electron 局域网采集入口。 |
| 新增 | `scripts/verify-lan-server.cjs` | Node 内置断言验证局域网服务安全边界与关闭行为。 |
| 修改 | `README.md`、`package.json`、`package-lock.json` | 实际操作/安全边界说明、二维码依赖和验证命令。 |

### 验证
- `node scripts/verify-lan-server.cjs`：通过认证拒绝、快照读取、资产/检查项白名单、非图片/超限拒绝、图片通知与关闭失效验证。
- `npm run build`：通过 TypeScript、Vite 构建与 Service Worker 资源生成。

### 已知限制与后续
- LAN 仅在 Windows Electron 客户端中可用；普通 Web ZIP 不提供实时同步。
- `.evidence` 离线流程不再作为日常采集操作入口，仅用于历史兼容与紧急恢复。
- HTTP 不具备传输保密性；仅限可信 Wi-Fi 或可信个人热点。Windows 防火墙或企业网络策略可能阻止手机访问。
- 当前服务不做跨网络、账号、多用户或自动发现；会话 URL 需通过二维码或复制方式在同网段手机浏览器打开。多网卡环境由用户在弹窗选择手机实际可访问的 Wi-Fi/热点地址。
