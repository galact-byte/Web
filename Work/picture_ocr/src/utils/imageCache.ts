/**
 * 图片字节的按需读取与内存缓存。
 *
 * v5 起图片字节存在独立的 images store，文档里只有引用，因此界面显示时需要按需取字节。
 * 同一张图会被缩略图、大图查看器、报告预览重复请求，这里做两件事：
 * - inflight 去重：并发请求同一张图只开一次事务
 * - LRU 缓存：限制常驻内存的图片数量，避免把整个项目的 Base64 又堆回内存（那就白拆了）
 */
import { imageRecordKey } from './imageStore';
import { resolveImageData } from './db';
import type { ImageData } from '../types';

// 缩略图墙一屏最多几十张，60 条足够覆盖滚动窗口，又不会让内存回到"整份文档常驻"的老路。
const MAX_CACHED_IMAGES = 60;

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

function touch(key: string, value: string): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHED_IMAGES) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
}

/** 同步查缓存，命中则可直接渲染，不产生闪烁。 */
export function peekImageSrc(projectId: string, imageId: string): string | undefined {
  const key = imageRecordKey(projectId, imageId);
  const hit = cache.get(key);
  if (hit !== undefined) touch(key, hit);
  return hit;
}

/** 取一张图片的可渲染字节；内联形态直接返回，引用形态查缓存或读库。 */
export async function loadImageSrc(projectId: string, image: ImageData): Promise<string | null> {
  if (typeof image.data === 'string' && image.data.length > 0) return image.data;
  const key = imageRecordKey(projectId, image.id);
  const cached = cache.get(key);
  if (cached !== undefined) {
    touch(key, cached);
    return cached;
  }
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = resolveImageData(projectId, image)
    .then((data) => {
      if (typeof data === 'string' && data.length > 0) touch(key, data);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

/** 图片被替换或删除后作废缓存，避免继续显示旧字节。 */
export function invalidateImage(projectId: string, imageId: string): void {
  cache.delete(imageRecordKey(projectId, imageId));
}

/** 切换/关闭项目时清空，防止跨项目常驻内存。 */
export function clearImageCache(projectId?: string): void {
  if (!projectId) {
    cache.clear();
    return;
  }
  const prefix = `${projectId}:`;
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** 预热缓存：批量读取结果直接塞进缓存（导出、迁移后复用）。 */
export function primeImageCache(projectId: string, entries: Map<string, string>): void {
  for (const [imageId, data] of entries) {
    touch(imageRecordKey(projectId, imageId), data);
  }
}
