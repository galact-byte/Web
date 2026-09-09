# 技术设计：图片字节拆分独立 store

## 现状

```ts
// src/types/index.ts:27
export interface ImageData {
  id: string;
  fileName: string;
  data: string;   // ← Base64，内联在文档里
  caption: string;
  uploadedAt: string;
}
```

`saveProject(doc)` 把整棵 `assets[].items[].images[]` 连同全部 Base64 一次性写入 `projects` store。新增一张图 = 重写全部历史字节。

图片字节的消费方（全部需要适配）：`ContentArea` / `ImageThumbnail` / `ImageViewer` / `UploadZone` / `MobileCollector` / `MobileProjectList` / `ProjectList` / `exportImport` / `imageCompression` / `wordDocument`。

## 目标模型

```
projects        : ProjectDocument（图片仅存引用，文档体积回落到 KB 级）
images          : { key: `${projectId}:${imageId}`, projectId, imageId, data, fileName, mimeType, byteSize, createdAt }
                  index: by_project (projectId)
projectSummaries: 不变（列表仍只读摘要）
```

`ImageData.data` 由必填改为可选（`data?: string`）：
- 已迁移的图片：文档里无 `data`，按需从 images store 取
- 未迁移的图片：文档里仍有 `data`，直接用

这样迁移期两种形态共存，读取路径统一走一个解析函数。

## 关键决策

### D1 引用形态：保留 `ImageData` 结构，仅让 `data` 变可选
不新建 `ImageRef` 类型。理由：`ImageData` 已在 10+ 组件里使用，改类型名会引发大范围机械改动；`data?: string` 让 TS 编译器**主动指出**所有直接读 `.data` 的地方，逐个改成走解析函数，改动可控且不会漏。

### D2 读取入口：`resolveImageData(projectId, image): Promise<string>`
- 有 `image.data` → 直接返回（未迁移形态）
- 否则 → 从 images store 按 `${projectId}:${image.id}` 取
- 批量场景（报告导出、数据包导出）提供 `resolveImagesForProject(projectId)` 一次性按索引取，避免 N 次事务

组件层用一个 `useImageData(image)` hook 承载异步取数 + 加载态，避免每个组件各写一套。

### D3 写入入口：`addImageToProject(projectId, assetId, itemId, image)`
在**同一事务**内：写 images 记录 + 读改写 projects 文档（此时文档已是 KB 级，重写代价可忽略）+ 更新摘要 `assetCount`。

这一步同时消解了并发覆盖：图片写入不再依赖调用方内存里的整份文档快照，手机上传与电脑端各自走这个入口，互不覆盖。

### D4 迁移：DB_VERSION=5，升级只建表，搬迁异步分批
- `onupgradeneeded`：仅 `createObjectStore('images')` + 建 `by_project` 索引。**绝不遍历数据**（v0.6.0 事故：遍历异常中止 versionchange，全库回滚）。
- 搬迁 `migrateInlineImages()`：按项目逐个处理，单项目内一次事务完成"写 images 记录 → 读回校验 → 去掉文档内 data"。
- 进度记录在独立 `migrationState` 键（或复用现有 meta store），中断后重启从未完成的项目继续。
- 单项目失败：记录 `damagedIds`，跳过但继续其余项目（保持文档内联 data 不动，功能不受影响）。

#### D4.1 数据不丢的四道闸（硬性要求）

1. **升级不碰数据**：`onupgradeneeded` 只建表建索引，零遍历、零读写。升级阶段在结构上不可能丢数据。
2. **写 → 校验 → 删，同一个事务**：搬迁单个项目时，先把每张图写进 images store，**在同一事务内按 key 读回、逐张比对字节长度与内容**，全部一致才去掉文档里的 `data`。任何一步失败 → 事务 abort → 该项目原样保留内联字节。IndexedDB 事务是原子的，不存在"删了但没写成"的中间态。
3. **按项目提交，不做全库大事务**：一个项目一个事务。空间峰值只多出"当前这一个项目"，不是全库翻倍；中途强杀最多损失当前项目的搬迁进度（数据仍是内联形态，完好）。
4. **失败即停在老形态**：搬不动的项目保持 `data` 内联，读取路径本就兼容两种形态，用户完全无感，只是这个项目暂时享受不到性能改善。

#### D4.2 迁移前备份引导
迁移启动前在存储设置面板提示"建议先导出一次数据包备份"（桌面版可导到非 C 盘）。备份可选、不阻塞迁移，但发布说明里要写明推荐。

### D5 删除：删项目/项目组时同事务用 `by_project` 索引清理 images
否则孤儿字节永久占用（用户库已 381MB，不能再漏）。

### D6 关窗兜底
图片一落地就独立成记录，文档只剩 KB 级元数据，卸载时的 flush 能在窗口关闭前完成。额外补 `beforeunload`：若仍有未完成的写入，阻止关闭并提示"正在保存"。

### D7 对账
`ensureSummariesSynced` 扩展：按项目比对"文档引用的 imageId 集合" vs "images store 里该项目的实际 key 集合"，差集即丢失图片，进修复报告与诊断包。

## 兼容性与回滚

- DB v5 发布后不可降级回 v4 代码（v4 不认识 images store，会把引用当成没有 data 的空图）。**这是单向操作，需在发布说明中明确。**
- 但这是**使用层面**的限制，不是数据损坏：字节仍在 images store 里，装回 v0.7.0 即恢复显示。
- 迁移未完成时应用完全可用（两种形态共存），因此可以先发布、后台慢慢搬。
- 迁移失败的项目保持内联形态，永远不会因为迁移而丢字节（先写后删同事务）。

## 分阶段

**P0 止血（可单独发版）**：不动存储模型，先堵住正在丢数据的路径 —— `beforeunload` 拦截未完成保存 + 关窗提示。
**P1 存储模型**：images store + 读写入口 + 迁移 + 删除清理。
**P2 全链路适配**：组件、导入导出、报告、压缩、局域网上传。
**P3 对账与验收**：自检对账、诊断包、真实数据迁移演练、两端实测。
