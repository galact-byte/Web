/**
 * 图片字节独立存储的纯逻辑（不碰 IndexedDB，便于单独验证）。
 *
 * 背景：图片以 Base64 内联在项目文档里，每加一张照片都要把整份文档重写一遍（写放大），
 * 大项目一次保存要几十秒，正是「拍着拍着卡死」「刚拍的照片关窗就没了」的根因。
 * 拆分后文档只保留图片元数据（引用），字节存进独立的 images store。
 *
 * 迁移期「内联」与「引用」两种形态必须共存：
 * - 内联：image.data 有值，直接用（尚未搬迁的老项目）
 * - 引用：image.data 为 undefined，按 `${projectId}:${imageId}` 去 images store 取
 */

export const IMAGES_STORE_NAME = 'images';
export const IMAGES_PROJECT_INDEX = 'by_project';

export interface ImageLike {
  id: string;
  fileName: string;
  /** 迁移完成后为 undefined，字节改存 images store。 */
  data?: string;
  caption: string;
  uploadedAt: string;
}

export interface ItemLike {
  id: string;
  images: ImageLike[];
}

export interface AssetLike {
  id: string;
  items: ItemLike[];
}

export interface DocLike {
  id: string;
  assets: AssetLike[];
}

/** images store 里的一条图片记录。 */
export interface StoredImage {
  /** 主键：`${projectId}:${imageId}`。 */
  key: string;
  projectId: string;
  imageId: string;
  data: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}

export interface InlineImageEntry {
  assetId: string;
  itemId: string;
  image: ImageLike;
}

export interface ImageReconcilePlan {
  /** 文档引用了、但 images store 里没有字节的图片 id。 */
  missing: string[];
  /** images store 里有字节、但文档已不再引用的图片 id（孤儿，占空间）。 */
  orphans: string[];
}

export interface MigrationState {
  /** 已完成搬迁的项目 id。 */
  completedIds: string[];
  /** 搬迁失败的项目 id：保持内联形态继续可用，不反复重试。 */
  damagedIds: string[];
}

export function imageRecordKey(projectId: string, imageId: string): string {
  return `${projectId}:${imageId}`;
}

/** 从 data URL 解析 MIME 类型；解析不出时按 image/jpeg 处理（历史图片多为 JPEG）。 */
export function parseMimeType(data: string): string {
  const match = /^data:([^;,]+)[;,]/.exec(data);
  return match ? match[1] : 'image/jpeg';
}

/** 估算 Base64 图片的实际字节数（去掉 data URL 头与填充符）。 */
export function estimateBase64Bytes(data: string): number {
  if (!data) return 0;
  const commaIndex = data.indexOf(',');
  const body = commaIndex >= 0 ? data.slice(commaIndex + 1) : data;
  if (!body) return 0;
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
}

/** 把一张内联图片转成 images store 记录；已是引用形态（无 data）时返回 null。 */
export function buildStoredImage(projectId: string, image: ImageLike): StoredImage | null {
  if (typeof image.data !== 'string' || image.data.length === 0) return null;
  return {
    key: imageRecordKey(projectId, image.id),
    projectId,
    imageId: image.id,
    data: image.data,
    fileName: image.fileName,
    mimeType: parseMimeType(image.data),
    byteSize: estimateBase64Bytes(image.data),
    createdAt: image.uploadedAt || new Date().toISOString(),
  };
}

/** 收集文档里仍然内联着字节的图片（迁移目标）。 */
export function collectInlineImages(doc: DocLike): InlineImageEntry[] {
  const entries: InlineImageEntry[] = [];
  for (const asset of doc.assets ?? []) {
    for (const item of asset.items ?? []) {
      for (const image of item.images ?? []) {
        if (typeof image.data === 'string' && image.data.length > 0) {
          entries.push({ assetId: asset.id, itemId: item.id, image });
        }
      }
    }
  }
  return entries;
}

/** 文档引用到的全部图片 id（含内联与引用两种形态），用于对账。 */
export function collectImageRefs(doc: DocLike): string[] {
  const ids: string[] = [];
  for (const asset of doc.assets ?? []) {
    for (const item of asset.items ?? []) {
      for (const image of item.images ?? []) {
        if (image && typeof image.id === 'string') ids.push(image.id);
      }
    }
  }
  return ids;
}

/**
 * 去掉已搬迁图片的内联 data，保留全部元数据。
 * 纯函数：返回新文档，原文档不变（迁移事务失败时可以原样回退）。
 */
export function stripInlineImageData<T extends DocLike>(doc: T, migratedIds: Set<string>): T {
  return {
    ...doc,
    assets: (doc.assets ?? []).map((asset) => ({
      ...asset,
      items: (asset.items ?? []).map((item) => ({
        ...item,
        images: (item.images ?? []).map((image) => {
          if (!migratedIds.has(image.id)) return image;
          const { data: _data, ...rest } = image;
          return rest as ImageLike;
        }),
      })),
    })),
  } as T;
}

/** 对账：文档引用的图片 id 集合 vs images store 里该项目实际存在的主键集合。 */
export function planImageReconcile(
  projectId: string,
  refIds: string[],
  storedKeys: IDBValidKey[]
): ImageReconcilePlan {
  const prefix = `${projectId}:`;
  const storedIds = new Set(
    storedKeys
      .map((key) => String(key))
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
  );
  const refSet = new Set(refIds);
  return {
    missing: refIds.filter((id) => !storedIds.has(id)),
    orphans: Array.from(storedIds).filter((id) => !refSet.has(id)),
  };
}

/**
 * 挑出还需要搬迁的项目：已完成的跳过，已知损坏的跳过（保持内联形态，功能不受影响）。
 * 迁移中途强杀后重启，凭这份状态从断点继续，不会重头再来。
 */
export function planMigrationTargets(allProjectIds: string[], state: MigrationState): string[] {
  const done = new Set(state.completedIds ?? []);
  const damaged = new Set(state.damagedIds ?? []);
  return allProjectIds.filter((id) => !done.has(id) && !damaged.has(id));
}
