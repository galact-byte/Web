/**
 * 统一图片压缩：手机上传、网页相机、电脑导入与存量批处理共用。
 * 纯决策函数（尺寸/跳过/字节估算）与 canvas I/O 分离，前者可在 Node 下用 verify 脚本验证。
 */
import type { ProjectDocument } from '../types';

export interface CompressOptions {
  /** 目标长边像素，只缩不放 */
  maxEdge: number;
  /** JPEG 质量 0~1 */
  quality: number;
  /** 长边已达标且体积低于此值时跳过（字节） */
  skipBelowBytes: number;
  /** 压缩后至少节省这么多字节才替换，避免 JPEG 二次编码抖出十几字节 */
  minSaveBytes: number;
}

export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  maxEdge: 1920,
  quality: 0.82,
  skipBelowBytes: 600 * 1024,
  minSaveBytes: 8 * 1024,
};

export interface TargetSize {
  width: number;
  height: number;
  /** 是否发生缩放（false 表示原尺寸已不超过 maxEdge） */
  scaled: boolean;
}

/** 纯函数：按长边等比缩放目标尺寸，只缩不放。 */
export function computeTargetSize(width: number, height: number, maxEdge: number): TargetSize {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0 || longest <= maxEdge) {
    return { width, height, scaled: false };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scaled: true,
  };
}

/** 纯函数：从 base64 data URL 估算解码后字节数。 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const len = base64.length;
  if (len === 0) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

export interface SkipDecisionInput {
  width: number;
  height: number;
  bytes: number;
  /** 源 MIME，如 image/jpeg；缺省时不按格式跳过 */
  mime?: string;
}

function isJpegMime(mime: string | undefined): boolean {
  if (!mime) return false;
  const normalized = mime.toLowerCase();
  return normalized === 'image/jpeg' || normalized === 'image/jpg' || normalized === 'image/pjpeg';
}

/**
 * 纯函数：是否跳过压缩。
 * 长边已 ≤ maxEdge 且体积 < skipBelowBytes 时跳过（小截图/已压缩图）；
 * 尺寸虽小但体积超阈值仍会重编码，以便把大 PNG 也压下来。
 * 已是 JPEG 且长边已达标的图不再二次编码（避免每次只抖出十几字节）。
 */
export function shouldSkipCompression(input: SkipDecisionInput, opts: CompressOptions): boolean {
  const longest = Math.max(input.width, input.height);
  if (longest <= opts.maxEdge && isJpegMime(input.mime)) return true;
  return longest <= opts.maxEdge && input.bytes < opts.skipBelowBytes;
}

// ————————————————————————————— canvas I/O（仅浏览器可用） —————————————————————————————

export interface CompressBlobResult {
  blob: Blob;
  width: number;
  height: number;
  /** 是否真的做了压缩替换（false 表示返回原图） */
  changed: boolean;
  /** 解码/绘制失败时为 true，调用方应保留原图且不要当成「已足够小」 */
  failed?: boolean;
}

interface DecodedImage {
  draw: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/** 解码为可绘制源并应用 EXIF 方向；优先 createImageBitmap，失败回退 <img>。 */
async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { draw: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // 回退到 <img>
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('图片解码失败。'));
      element.src = url;
    });
    return { draw: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality));
}

/**
 * 压缩 File/Blob。跳过或压缩后不更小时返回原 blob（changed=false）。
 * 解码/绘制失败一律兜底返回原图，绝不因压缩报错而丢图。
 */
export async function compressImageBlob(input: Blob, options?: Partial<CompressOptions>): Promise<CompressBlobResult> {
  const opts: CompressOptions = { ...DEFAULT_COMPRESS_OPTIONS, ...options };
  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeImage(input);
    const { width, height } = decoded;
    if (shouldSkipCompression({ width, height, bytes: input.size, mime: input.type }, opts)) {
      return { blob: input, width, height, changed: false };
    }
    const target = computeTargetSize(width, height, opts.maxEdge);
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: input, width, height, changed: false, failed: true };
    ctx.drawImage(decoded.draw, 0, 0, target.width, target.height);
    const outBlob = await canvasToBlob(canvas, opts.quality);
    if (!outBlob) return { blob: input, width, height, changed: false, failed: true };
    if (outBlob.size >= input.size || input.size - outBlob.size < opts.minSaveBytes) {
      return { blob: input, width, height, changed: false };
    }
    return { blob: outBlob, width: target.width, height: target.height, changed: true };
  } catch {
    return { blob: input, width: 0, height: 0, changed: false, failed: true };
  } finally {
    decoded?.close();
  }
}

/** Blob → base64 data URL。 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * 手动解码 data URL，避免 fetch(data:) 在 file:// 或 CSP connect-src 'self'
 * （桌面 Electron / Web 都写了这条）下抛 "Failed to fetch"。
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx >= 0 ? dataUrl.slice(0, commaIdx) : '';
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const mime = header.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export interface CompressDataUrlResult {
  dataUrl: string;
  changed: boolean;
  /** 压缩前估算字节 */
  before: number;
  /** 压缩后估算字节（未变时等于 before） */
  after: number;
  /** 解码/绘制失败，应保留原图且不要报「已足够小」 */
  failed?: boolean;
}

/** 存量批处理：压缩已存 data URL，仅在更小时替换。 */
export async function compressDataUrl(dataUrl: string, options?: Partial<CompressOptions>): Promise<CompressDataUrlResult> {
  const before = estimateDataUrlBytes(dataUrl);
  try {
    const blob = dataUrlToBlob(dataUrl);
    const result = await compressImageBlob(blob, options);
    if (result.failed) return { dataUrl, changed: false, before, after: before, failed: true };
    if (!result.changed) return { dataUrl, changed: false, before, after: before };
    const nextDataUrl = await blobToDataUrl(result.blob);
    const after = estimateDataUrlBytes(nextDataUrl);
    const minSave = { ...DEFAULT_COMPRESS_OPTIONS, ...options }.minSaveBytes;
    if (after >= before || before - after < minSave) return { dataUrl, changed: false, before, after: before };
    return { dataUrl: nextDataUrl, changed: true, before, after };
  } catch {
    return { dataUrl, changed: false, before, after: before, failed: true };
  }
}

export interface ProjectCompressionResult {
  /** 压缩后的文档（未变时也返回新引用） */
  doc: ProjectDocument;
  /** 扫描的图片总数 */
  total: number;
  /** 实际压缩替换的张数 */
  changedCount: number;
  /** 解码/绘制失败的张数（已保留原图） */
  failedCount: number;
  /** 估算节省字节 */
  savedBytes: number;
}

/**
 * 存量批量压缩：逐张重编码系统文档里的图片，保留 id/fileName/caption/uploadedAt，仅在变小时替换。
 * 逐张（非并发）处理，避免同时解码上百张 8MB 图导致内存陡升。幂等：已压缩的图命中跳过条件不再处理。
 */
export async function compressProjectImages(
  doc: ProjectDocument,
  options?: Partial<CompressOptions>,
  onProgress?: (done: number, total: number) => void
): Promise<ProjectCompressionResult> {
  const total = doc.assets.reduce((sum, asset) => sum + asset.items.reduce((count, item) => count + item.images.length, 0), 0);
  let done = 0;
  let changedCount = 0;
  let failedCount = 0;
  let savedBytes = 0;
  const assets = [];
  for (const asset of doc.assets) {
    const items = [];
    for (const item of asset.items) {
      const images = [];
      for (const image of item.images) {
        const result = await compressDataUrl(image.data, options);
        if (result.failed) {
          failedCount += 1;
          images.push(image);
        } else if (result.changed) {
          changedCount += 1;
          savedBytes += result.before - result.after;
          images.push({ ...image, data: result.dataUrl });
        } else {
          images.push(image);
        }
        done += 1;
        onProgress?.(done, total);
      }
      items.push({ ...item, images });
    }
    assets.push({ ...asset, items });
  }
  return { doc: { ...doc, assets, updatedAt: Date.now() }, total, changedCount, failedCount, savedBytes };
}
