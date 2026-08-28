# 执行计划：图片入库压缩与存量瘦身

## 顺序清单

1. **共享压缩工具** `src/utils/imageCompression.ts`
   - `compressImageBlob(blob, opts)` 与 `compressDataUrl(dataUrl, opts)`；默认 maxEdge=1920 / quality=0.82 / skipBelowBytes≈600KB。
   - EXIF 方向（`createImageBitmap` imageOrientation:'from-image'，含回退）、只缩不放、只减不增、跳过条件、字节估算。
   - 先写单测（缩放比例 / 跳过 / 只减不增），再实现。
   - 验证：`npx tsc --noEmit`、单测通过。

2. **手机上传压缩** `src/components/LanMobileCollector.tsx`
   - `uploadImage`：POST 前压缩，content-type 用 `image/jpeg`，文件名 `.jpg`；压缩失败兜底原文件。
   - `captureCameraFrame`：canvas 按 maxEdge 缩放后 `toBlob('image/jpeg', 0.82)`。
   - 验证：`tsc`；构建后手机端上传一张大图，确认落库 ≤ ~800KB、长边 ≤ 1920、方向正确。

3. **电脑端导入压缩** `src/utils/imageFiles.ts`
   - `readImageFile` 先压缩再生成 `ImageData.data`；跳过时保留原图。
   - 验证：`tsc`；桌面导入大图确认被压缩、小截图不劣化。

4. **存量批量压缩** 桌面 UI
   - 定位入口（项目组视图 / 项目列表工具栏），加「压缩现有图片」按钮 + 二次确认对话框。
   - 遍历目标系统 `loadProject`→压缩 `images[].data`→`saveProject`；保留 id/fileName/caption/uploadedAt；累计张数与节省字节；完成弹「压缩 N 张，节省 X MB」。
   - 幂等、可重复；作用域至少覆盖当前项目组全部系统。
   - 验证：对真实 445MB 系统跑一次，体积降到约 1/6~1/8、张数不变。

5. **全量验证**
   - `npx tsc --noEmit` + `npm run build`。
   - 导出该系统 Word 报告，抽查日志/明细文字清晰可读（硬验收）。
   - Electron 与 Web ZIP 采集+导出冒烟。
   - 更新 `RELEASE-NOTES.md` / 版本号（等用户确认版本号后再定，遵循 #298）。

## 验证命令

- `npx tsc --noEmit`
- `npm run build`
- 单测（若项目已有测试脚本，按其约定运行）

## 回滚点

- 每步独立可回滚；存量批处理是唯一改写已存数据的步骤，改写前确认对话框，且仅在变小时替换、保留元数据、可重复执行。

## 审查门

- 步骤 1 工具单测过后再接入三处入口。
- 存量批处理接入前先在少量图片上验证只减不增与方向正确，再放开到整组。
