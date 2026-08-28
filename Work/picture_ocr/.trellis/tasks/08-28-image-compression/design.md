# 技术设计：图片入库压缩与存量瘦身

## 架构决策：压缩集中在共享前端

图片最终以 base64 data URL 存入 IndexedDB。两条运行路径的服务端（Electron `electron/lanServer.cjs`、Web ZIP `start-server.ps1`）都只是把上传字节**原样** base64 包成 data URL 再转发给桌面渲染进程落库，不做图像处理。因此：

- **所有压缩放在浏览器 canvas 端完成**，服务端保持 relay-only，无需改动，也天然覆盖 Electron + Web ZIP 两条路径。
- 手机端压缩在上传前完成，额外收益是网络只传压缩后的几百 KB。

## 新增共享工具：`src/utils/imageCompression.ts`

统一的 canvas 压缩实现，供三处入库入口 + 存量批处理复用。

```
interface CompressOptions { maxEdge?: number; quality?: number; skipBelowBytes?: number; }
// 默认 maxEdge=1920, quality=0.82, skipBelowBytes≈600*1024

// 从 File/Blob 压缩（手机上传、电脑导入）
compressImageBlob(input: Blob, opts?): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; changed: boolean }>

// 从已存 data URL 压缩（存量批处理）；不值得压缩时 changed=false 返回原值
compressDataUrl(dataUrl: string, opts?): Promise<{ dataUrl: string; changed: boolean; before: number; after: number }>
```

实现要点：
- 用 `createImageBitmap(blob, { imageOrientation: 'from-image' })` 解码并自动应用 EXIF 方向；不支持该选项的浏览器回退到 `<img>` + 方向兜底。
- 目标尺寸：`scale = min(1, maxEdge / max(w, h))`，只缩不放。
- `canvas.toBlob(..., 'image/jpeg', quality)` 输出；估算 data URL 字节 = `Math.floor(base64Length * 3 / 4)`。
- **跳过条件**：源为位图且（长边 ≤ maxEdge 且 体积 < skipBelowBytes）→ 不处理，changed=false。
- **只减不增**：若压缩结果 ≥ 原体积，保留原图，changed=false。
- 透明/小 PNG 截图：命中跳过条件时原样保留，避免 PNG→JPEG 糊字。

## 三处入库入口改动

1. `src/components/LanMobileCollector.tsx`
   - `uploadImage`：POST 前 `compressImageBlob(file)`，用压缩后的 blob 与 `image/jpeg` content-type 上传；文件名后缀调整为 `.jpg`。
   - `captureCameraFrame`：绘制到 canvas 时按 maxEdge 缩放，再 `toBlob('image/jpeg', 0.82)`。
2. `src/utils/imageFiles.ts`
   - `readImageFile`：先 `compressImageBlob(file)`，用压缩结果生成 `ImageData.data`；跳过时用原 data URL。

## 存量批处理

桌面端提供「压缩现有图片」操作（作用域：当前项目组的全部系统，或单个系统）：
- 遍历目标系统文档的 `assets[].items[].images[]`，对每张 `image.data` 调 `compressDataUrl`；`changed` 时替换 data，保留 `id/fileName/caption/uploadedAt`。
- 通过 `utils/db` 的 `loadProject` / `saveProject` 逐系统读改写；累计 before/after 字节与压缩张数。
- 二次确认对话框（说明会就地改写已存图片、不可逆），完成后弹出「压缩 N 张，节省 X MB」。
- 幂等：再次运行时已压缩的图命中跳过条件不再处理。
- 入口位置在实现阶段定位（项目组视图 / 项目列表工具栏），复用现有对话框风格。

## 兼容性与风险

- 不改 `LanCollectorSnapshot/System/Upload` 结构，故不触发 `vite-env.d.ts` 与 `lanBridge.ts` 双定义同步约束（#303）。
- 存量批处理会就地改写已存 data URL：仅在变小时替换、保留元数据、可重复执行；风险集中在此步，需确认对话框 + 完成报告。
- 导出报告清晰度是硬验收：批处理后用真实系统导出 Word 抽查文字清晰度。

## 验证方式

- 单元：`imageCompression` 的缩放比例、跳过条件、只减不增、方向。
- 手动：手机上传/拍照、电脑导入各产出 ≤ ~800KB；对 445MB 真实系统跑批处理并导出报告核对清晰度与体积。
- `tsc` + 构建；Electron 与 Web ZIP 冒烟。
