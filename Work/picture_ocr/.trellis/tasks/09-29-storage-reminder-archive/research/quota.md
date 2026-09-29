# P0 实测结论（2026-09-29，本机 Windows，C 盘剩余 84.7GB / D 盘剩余 15.7GB）

探针：`.trellis/.runtime/p0/probe.mjs`（Chrome 153、Edge 154，有头与无头，隔离新 profile，页面 http://127.0.0.1）；`.trellis/.runtime/p0/el/main.cjs`（Electron 43.1.0）。

| 项 | Chrome 153 | Edge 154 | Electron 43 |
|---|---|---|---|
| isSecureContext（127.0.0.1） | true | true | true |
| showDirectoryPicker | function | function | function |
| estimate().quota | usage + 10 GiB（固定） | usage + 10 GiB（固定） | 约 84.7GB（随磁盘） |
| persisted() 初始 | false | false | true |
| persist() | false（新 profile 未批准） | false | true |
| fs.statfsSync(userData) | — | — | 84.68GB，与 PS Get-PSDrive C 一致 |

## 结论

1. **Web 端 quota 不能用来推算磁盘剩余。** 写入数据后复测：quota = 10740074608 = usage(2656368) + 10737418240，严格是「已用 + 10GiB」的防指纹静态值。design.md 4.2 的「quota − usage」假设不成立，降级方案「占用占 quota 80%」也无意义（永远 < 100%，恒定 10GiB 余量）。
   - **替代**：Web 版由本机 `start-server.ps1` 提供，新增本机专用控制接口 `GET /api/control/disk-free`（沿用 loopback + `x-evidence-control: 1` 校验），返回 `%LOCALAPPDATA%` 所在盘（Chrome/Edge 默认用户数据目录）的真实剩余与盘符。接口不可用（旧脚本/直接打开文件）时磁盘条件视为未知，不误报。
2. **Web 端持久存储**：新 profile 下 Chrome/Edge 均静默拒绝。实际用户 profile 视使用频率/书签/安装 PWA 可能被批准；界面必须如实显示「未批准」并给出提高批准概率的做法（安装为应用），不能宣称已受保护。
3. **桌面端**：persist 直接为 true；磁盘剩余用主进程 `fs.statfs(userData)`，已验证与系统一致。
4. **目录选择**：两浏览器在 127.0.0.1 下均有 showDirectoryPicker。实际弹框交互（选 D 盘、写入、读回）需人工操作，放到 P7 人工验收；自动化脚本在 CDP 下注入测试目录句柄。
