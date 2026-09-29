/**
 * 系统归档文件格式（明文 ZIP）。
 *
 * 结构 = 普通数据包（manifest.json + images/）+ archive.json。
 * - 普通「导入数据包」会忽略 archive.json，因此归档文件在任何版本都能作为新系统导入（兜底路径）。
 * - 正式恢复只走 openArchive → loadArchiveImages：逐张校验 SHA-256，按记录的 data URL 头原样重建，
 *   不压缩、不改 id，保证导出报告清晰度与归档前一致。
 * - Blob ↔ data URL 只用 FileReader / atob，禁止 fetch（CSP connect-src 'self'）。
 */
import JSZip from 'jszip';
import { buildDataPackageZip } from './exportImport';
import { blobToDataUrl, dataUrlToBlob } from './imageCompression';
import { buildStoredImage, type StoredImage } from './imageStore';
import type { ExportPackage, ProjectDocument, ProjectGroup } from '../types';

export const ARCHIVE_FORMAT = 'evidence-archive';
export const ARCHIVE_VERSION = 1;
const ARCHIVE_FILE = 'archive.json';
const MANIFEST_FILE = 'manifest.json';

export interface ArchiveImageEntry {
  id: string;
  /** ZIP 内路径，与 manifest.json 的 ImageRef.path 一致。 */
  path: string;
  /** 原 data URL 逗号前的头部，如 `data:image/png;base64`，恢复时原样拼回。 */
  header: string;
  mimeType: string;
  fileName: string;
  createdAt: string;
  byteSize: number;
  sha256: string;
}

export interface ArchiveManifest {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  projectId: string;
  groupId: string | null;
  systemName: string;
  archivedAt: number;
  appVersion: string;
  group: ProjectGroup | null;
  fingerprint: string;
  images: ArchiveImageEntry[];
}

export interface BuiltArchive {
  blob: Blob;
  manifest: ArchiveManifest;
  imageBytes: number;
}

export interface OpenedArchive {
  zip: JSZip;
  manifest: ArchiveManifest;
  packageManifest: ExportPackage;
}

/** 可直接展示给用户的归档错误（中文原因）。 */
export class ArchiveFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveFormatError';
  }
}

const HEX64 = /^[0-9a-f]{64}$/;
const DATA_HEADER = /^data:([^,;]+)(;[^,]*)?;base64$/;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  // 复制到独立 ArrayBuffer，避免视图偏移/共享缓冲带来的摘要偏差。
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return toHex(await crypto.subtle.digest('SHA-256', copy.buffer));
}

/** 指纹 = 系统 id + 按 id 排序的（id, 大小, 摘要）清单的 SHA-256；绑定到具体系统与具体图片内容。 */
export async function computeArchiveFingerprint(
  projectId: string,
  images: Array<Pick<ArchiveImageEntry, 'id' | 'byteSize' | 'sha256'>>
): Promise<string> {
  const canonical = JSON.stringify({
    projectId,
    images: [...images]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((image) => [image.id, image.byteSize, image.sha256]),
  });
  return sha256Hex(new TextEncoder().encode(canonical));
}

function collectImageRefPaths(manifest: ExportPackage): Map<string, string> {
  const paths = new Map<string, string>();
  for (const category of manifest.categories) {
    for (const asset of category.assets) {
      for (const item of asset.items) {
        for (const ref of item.images) paths.set(ref.id, ref.path);
      }
    }
  }
  return paths;
}

/**
 * 从已补齐字节（hydrate 后）的文档生成归档文件。任一图片缺字节即拒绝，
 * 以免生成「看起来完整」但少图的归档后再删本地数据。
 */
export async function buildArchive(input: {
  doc: ProjectDocument;
  group: ProjectGroup | null;
  archivedAt: number;
  appVersion: string;
}): Promise<BuiltArchive> {
  const { doc } = input;
  const { zip, manifest: packageManifest } = buildDataPackageZip(doc.meta, doc.categories, doc.assets);
  const paths = collectImageRefPaths(packageManifest);
  const images: ArchiveImageEntry[] = [];
  let imageBytes = 0;
  for (const asset of doc.assets) {
    for (const item of asset.items) {
      for (const image of item.images) {
        if (typeof image.data !== 'string' || !image.data.startsWith('data:')) {
          throw new ArchiveFormatError(`图片「${image.fileName || image.id}」本地数据缺失，不能归档`);
        }
        const commaIndex = image.data.indexOf(',');
        const header = image.data.slice(0, commaIndex);
        const match = DATA_HEADER.exec(header);
        const path = paths.get(image.id);
        if (commaIndex < 0 || !match || !path) {
          throw new ArchiveFormatError(`图片「${image.fileName || image.id}」数据格式无法识别，不能归档`);
        }
        const bytes = new Uint8Array(await dataUrlToBlob(image.data).arrayBuffer());
        const record = buildStoredImage(doc.id, image);
        images.push({
          id: image.id,
          path,
          header,
          mimeType: match[1],
          fileName: image.fileName,
          createdAt: record?.createdAt ?? image.uploadedAt,
          byteSize: bytes.byteLength,
          sha256: await sha256Hex(bytes),
        });
        imageBytes += bytes.byteLength;
      }
    }
  }
  const manifest: ArchiveManifest = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    projectId: doc.id,
    groupId: doc.groupId ?? null,
    systemName: doc.meta.systemName || doc.meta.projectName || '',
    archivedAt: input.archivedAt,
    appVersion: input.appVersion,
    group: input.group,
    fingerprint: await computeArchiveFingerprint(doc.id, images),
    images,
  };
  zip.file(ARCHIVE_FILE, JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  return { blob, manifest, imageBytes };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseImageEntry(value: unknown): ArchiveImageEntry | null {
  if (!isRecord(value)) return null;
  const { id, path, header, mimeType, fileName, createdAt, byteSize, sha256 } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof path !== 'string' || !path.startsWith('images/')) return null;
  if (typeof header !== 'string' || DATA_HEADER.exec(header)?.[1] !== mimeType) return null;
  if (typeof mimeType !== 'string' || typeof fileName !== 'string' || typeof createdAt !== 'string') return null;
  if (typeof byteSize !== 'number' || !Number.isInteger(byteSize) || byteSize < 0) return null;
  if (typeof sha256 !== 'string' || !HEX64.test(sha256)) return null;
  return { id, path, header, mimeType, fileName, createdAt, byteSize, sha256 };
}

function parseArchiveManifest(value: unknown): ArchiveManifest {
  if (!isRecord(value)) throw new ArchiveFormatError('归档清单格式无效');
  if (value.format !== ARCHIVE_FORMAT || value.version !== ARCHIVE_VERSION) {
    throw new ArchiveFormatError('不支持的归档格式或版本，请使用生成该文件的版本恢复');
  }
  const { projectId, groupId, systemName, archivedAt, appVersion, group, fingerprint, images } = value;
  if (typeof projectId !== 'string' || projectId.length === 0) throw new ArchiveFormatError('归档清单缺少系统标识');
  if (groupId !== null && typeof groupId !== 'string') throw new ArchiveFormatError('归档清单的项目组标识无效');
  if (typeof archivedAt !== 'number' || typeof fingerprint !== 'string' || !HEX64.test(fingerprint)) {
    throw new ArchiveFormatError('归档清单缺少时间或指纹');
  }
  if (!Array.isArray(images)) throw new ArchiveFormatError('归档清单缺少图片列表');
  const parsed = images.map(parseImageEntry);
  if (parsed.some((entry) => entry === null)) throw new ArchiveFormatError('归档清单中有无效的图片条目');
  const entries = parsed as ArchiveImageEntry[];
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new ArchiveFormatError('归档清单中有重复的图片');
  }
  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    projectId,
    groupId: groupId ?? null,
    systemName: typeof systemName === 'string' ? systemName : '',
    archivedAt,
    appVersion: typeof appVersion === 'string' ? appVersion : 'unknown',
    group: isRecord(group) ? (group as unknown as ProjectGroup) : null,
    fingerprint,
    images: entries,
  };
}

/**
 * 打开并做结构校验：ZIP 可解析、两份清单齐全、清单指纹自洽、manifest 引用的图片集合与归档清单一致。
 * 不读图片字节；逐张内容校验见 loadArchiveImages / verifyArchiveImages。
 */
export async function openArchive(blob: Blob): Promise<OpenedArchive> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(blob);
  } catch {
    throw new ArchiveFormatError('归档文件已损坏或不是 ZIP 文件');
  }
  const archiveFile = zip.file(ARCHIVE_FILE);
  if (!archiveFile) throw new ArchiveFormatError('这不是归档文件（缺少 archive.json），请选择归档时生成的文件');
  const packageFile = zip.file(MANIFEST_FILE);
  if (!packageFile) throw new ArchiveFormatError('归档文件缺少 manifest.json');
  let archiveJson: unknown;
  let packageJson: unknown;
  try {
    archiveJson = JSON.parse(await archiveFile.async('string'));
    packageJson = JSON.parse(await packageFile.async('string'));
  } catch {
    throw new ArchiveFormatError('归档文件的清单无法解析，文件可能已损坏');
  }
  const manifest = parseArchiveManifest(archiveJson);
  if (!isRecord(packageJson) || !Array.isArray(packageJson.categories)) {
    throw new ArchiveFormatError('归档文件的 manifest.json 格式无效');
  }
  const packageManifest = packageJson as unknown as ExportPackage;
  const expectedFingerprint = await computeArchiveFingerprint(manifest.projectId, manifest.images);
  if (expectedFingerprint !== manifest.fingerprint) throw new ArchiveFormatError('归档清单被改动过，指纹不一致');
  let refPaths: Map<string, string>;
  try {
    refPaths = collectImageRefPaths(packageManifest);
  } catch {
    throw new ArchiveFormatError('归档文件的 manifest.json 结构无效');
  }
  const entryIds = new Set(manifest.images.map((entry) => entry.id));
  const consistent = refPaths.size === entryIds.size
    && manifest.images.every((entry) => refPaths.get(entry.id) === entry.path);
  if (!consistent) throw new ArchiveFormatError('归档文件中的两份清单不一致');
  return { zip, manifest, packageManifest };
}

async function readVerifiedBytes(opened: OpenedArchive, entry: ArchiveImageEntry): Promise<Uint8Array> {
  const file = opened.zip.file(entry.path);
  if (!file) throw new ArchiveFormatError(`归档文件缺少图片「${entry.fileName || entry.id}」`);
  let bytes: Uint8Array;
  try {
    bytes = await file.async('uint8array');
  } catch {
    throw new ArchiveFormatError(`图片「${entry.fileName || entry.id}」无法读取，文件可能已损坏`);
  }
  if (bytes.byteLength !== entry.byteSize || (await sha256Hex(bytes)) !== entry.sha256) {
    throw new ArchiveFormatError(`图片「${entry.fileName || entry.id}」内容与归档记录不一致`);
  }
  return bytes;
}

/** 逐张校验字节，不在内存中保留（归档写盘后的读回校验用）。 */
export async function verifyArchiveImages(opened: OpenedArchive): Promise<void> {
  for (const entry of opened.manifest.images) await readVerifiedBytes(opened, entry);
}

/** 恢复用：逐张校验后按原头部重建 data URL，生成可直接写回 images store 的记录。 */
export async function loadArchiveImages(opened: OpenedArchive): Promise<StoredImage[]> {
  const { projectId } = opened.manifest;
  const records: StoredImage[] = [];
  for (const entry of opened.manifest.images) {
    const bytes = await readVerifiedBytes(opened, entry);
    const encoded = await blobToDataUrl(new Blob([bytes as BlobPart]));
    const data = `${entry.header},${encoded.slice(encoded.indexOf(',') + 1)}`;
    records.push({
      key: `${projectId}:${entry.id}`,
      projectId,
      imageId: entry.id,
      data,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      byteSize: entry.byteSize,
      createdAt: entry.createdAt,
    });
  }
  return records;
}
