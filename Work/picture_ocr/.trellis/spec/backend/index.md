# 后端与本地宿主规范

本项目同时交付 Web ZIP 和 Electron。两者都有局域网临时采集服务，但项目数据仍由浏览器/渲染进程的 IndexedDB 持久化，没有云数据库或 ORM。

## 适用范围

- Web ZIP：`start-server.ps1`，Windows PowerShell 5.1 + 内嵌 .NET 异步网络帮助类；默认电脑来源固定 `http://127.0.0.1:51730/`。
- Electron：`electron/lanServer.cjs` 处理 HTTP，`electron/main.cjs` / preload 将保存任务交给渲染进程。
- [局域网上传恢复契约](./lan-upload.md)：修改上传、会话、控制轮询、保存回执和相关故障处理前必读。
- 存储与 UI 继续遵守 [前端规范](../frontend/index.md)。

本目录旧的 directory/database/error/logging/quality 文档描述的是早期纯浏览器阶段；其中“没有本地服务”的表述不适用于现有 LAN 宿主。当前宿主范围以本索引及 `lan-upload.md` 为准，不因此引入云服务、数据库框架或运行时依赖。
