/**
 * 系统归档/恢复编排（design.md 5.3 / 5.4）。
 *
 * 归档顺序：整理内联图片 → 对账（有缺图就拒绝）→ 打包 → 写入目标目录 → 从磁盘读回逐张校验
 * → 库内单事务提交（比对引用与字节集合，删除本地字节并打标记）。
 * 任何一步失败都不删除本地数据；失败原因如实返回，由界面汇总展示。
 */
import type { ProjectGroup } from '../types';
import {
  commitProjectArchive,
  ensureProjectImagesMigrated,
  hydrateProjectImages,
  loadProject,
  loadProjectGroup,
  reconcileProjectImages,
  restoreProjectArchive,
} from './db';
import { buildArchive, loadArchiveImages, openArchive, verifyArchiveImages } from './archiveFormat';
import type { ArchiveTarget } from './archiveTarget';
import { clearImageCache } from './imageCache';
import { collectImageRefs, collectInlineImages } from './imageStore';

export interface ArchiveOutcome {
  projectId: string;
  systemName: string;
  status: 'archived' | 'skipped' | 'failed';
  message: string;
  /** 已写入目标目录的文件名（失败时也可能有，见 invalidFileLeft）。 */
  fileName?: string;
  /** 目标目录里留下的文件未通过校验，可删除。 */
  invalidFileLeft?: boolean;
  /** 本地释放的图片原始字节数。 */
  freedBytes?: number;
}

export interface ArchiveProgress {
  /** 从 1 开始。 */
  index: number;
  total: number;
  projectId: string;
}

export interface ArchiveOptions {
  now?: () => number;
}

const INVALID_NAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const MAX_NAME_ATTEMPTS = 99;

function appVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';
}

function sanitizePart(value: string, fallback: string): string {
  const cleaned = value.replace(INVALID_NAME_CHARS, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 60);
  return cleaned || fallback;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 组显示名规则同项目列表与手机采集（#165）：项目名称优先，空则单位名称。 */
export function buildArchiveFileName(
  group: Pick<ProjectGroup, 'projectName' | 'unitName'> | null,
  systemName: string,
  date: Date
): string {
  const groupName = group ? (group.projectName || '').trim() || (group.unitName || '').trim() : '';
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `归档_${sanitizePart(groupName, '未命名项目组')}_${sanitizePart(systemName, '未命名系统')}_${stamp}.zip`;
}

async function pickFreeName(target: ArchiveTarget, baseName: string): Promise<string> {
  if (!(await target.exists(baseName))) return baseName;
  const stem = baseName.replace(/\.zip$/i, '');
  for (let n = 2; n <= MAX_NAME_ATTEMPTS; n += 1) {
    const candidate = `${stem}(${n}).zip`;
    if (!(await target.exists(candidate))) return candidate;
  }
  throw new Error('目标目录中同名归档文件过多，请换一个保存位置');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 归档单个系统。不抛异常，结果写在返回值里。 */
export async function archiveProject(projectId: string, target: ArchiveTarget, options: ArchiveOptions = {}): Promise<ArchiveOutcome> {
  const now = options.now ?? Date.now;
  let systemName = '';
  const fail = (message: string, extra: Partial<ArchiveOutcome> = {}): ArchiveOutcome => ({ projectId, systemName, status: 'failed', message, ...extra });

  let doc;
  try {
    doc = await loadProject(projectId);
  } catch (error) {
    return fail(`读取系统失败：${messageOf(error)}`);
  }
  if (!doc) return fail('系统不存在或已被删除');
  systemName = doc.meta.systemName || doc.meta.projectName || '';
  if (doc.archive) return { projectId, systemName, status: 'skipped', message: '该系统已归档', fileName: doc.archive.fileName };

  if (collectInlineImages(doc).length > 0) {
    const migrated = await ensureProjectImagesMigrated(projectId);
    const reloaded = migrated ? await loadProject(projectId).catch(() => null) : null;
    if (!reloaded || collectInlineImages(reloaded).length > 0) return fail('该系统图片尚未整理完成，暂不能归档');
    doc = reloaded;
  }

  const expectedIds = collectImageRefs(doc);
  if (expectedIds.length === 0) return fail('该系统没有图片，无需归档');

  try {
    const plan = await reconcileProjectImages(projectId);
    if (plan.missing.length > 0) return fail(`有 ${plan.missing.length} 张图片本地已缺失，不能归档（可在存储设置中运行自检查看）`);
  } catch (error) {
    return fail(`图片对账失败，未归档：${messageOf(error)}`);
  }

  let built;
  let fileName: string;
  try {
    const group = doc.groupId ? await loadProjectGroup(doc.groupId) : null;
    const archivedAt = now();
    built = await buildArchive({ doc: await hydrateProjectImages(doc), group, archivedAt, appVersion: appVersion() });
    // 独立系统没有项目组，用系统自身的项目/单位名称命名，避免文件名变成「未命名项目组」。
    fileName = await pickFreeName(target, buildArchiveFileName(group ?? doc.meta, systemName, new Date(archivedAt)));
  } catch (error) {
    return fail(`生成归档文件失败，本地数据未改动：${messageOf(error)}`);
  }

  try {
    await target.write(fileName, built.blob);
  } catch (error) {
    return fail(`归档文件写入失败，本地数据未改动：${messageOf(error)}`);
  }

  try {
    const opened = await openArchive(await target.read(fileName));
    if (opened.manifest.projectId !== projectId || opened.manifest.fingerprint !== built.manifest.fingerprint) {
      throw new Error('读回的文件与刚生成的归档不一致');
    }
    await verifyArchiveImages(opened);
  } catch (error) {
    return fail(`归档文件读回校验未通过（${messageOf(error)}），本地数据未删除；文件「${fileName}」无效，可删除`, { fileName, invalidFileLeft: true });
  }

  try {
    await commitProjectArchive(projectId, expectedIds, {
      archivedAt: built.manifest.archivedAt,
      fileName,
      locationLabel: target.label,
      imageCount: built.manifest.images.length,
      imageBytes: built.imageBytes,
      fingerprint: built.manifest.fingerprint,
    });
  } catch (error) {
    return fail(`归档文件「${fileName}」已保存，但本地数据未清理：${messageOf(error)}`, { fileName });
  }
  clearImageCache(projectId);
  return { projectId, systemName, status: 'archived', message: '已归档', fileName, freedBytes: built.imageBytes };
}

/** 按顺序逐个归档（控制内存峰值），单个失败不影响其它。 */
export async function archiveProjects(
  projectIds: string[],
  target: ArchiveTarget,
  onProgress?: (progress: ArchiveProgress) => void,
  options: ArchiveOptions = {}
): Promise<ArchiveOutcome[]> {
  const outcomes: ArchiveOutcome[] = [];
  for (let i = 0; i < projectIds.length; i += 1) {
    onProgress?.({ index: i + 1, total: projectIds.length, projectId: projectIds[i] });
    outcomes.push(await archiveProject(projectIds[i], target, options));
  }
  return outcomes;
}

/**
 * 用归档文件恢复一个已归档系统：原样写回图片（不压缩、不改 id）。
 * 任何不匹配都抛出可展示的中文错误，本地保持已归档状态。
 */
export async function restoreProject(projectId: string, file: Blob): Promise<void> {
  const doc = await loadProject(projectId);
  if (!doc) throw new Error('系统不存在或已被删除');
  if (!doc.archive) throw new Error('该系统未归档，无需恢复');
  const opened = await openArchive(file);
  if (opened.manifest.projectId !== projectId) {
    throw new Error(`该文件是「${opened.manifest.systemName || '另一个系统'}」的归档，不是当前系统的`);
  }
  if (opened.manifest.fingerprint !== doc.archive.fingerprint) {
    throw new Error(`该文件不是该系统当前的归档（可能是更早一次归档生成的），请选择「${doc.archive.fileName}」`);
  }
  const records = await loadArchiveImages(opened);
  await restoreProjectArchive(projectId, opened.manifest.fingerprint, records);
  clearImageCache(projectId);
}
