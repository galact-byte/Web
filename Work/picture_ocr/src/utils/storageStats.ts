/**
 * 每系统图片占用统计（design.md 2.2）。结果缓存在 localStorage，不入库。
 * 缓存有效：updatedAt 与摘要一致、归档状态一致，且（未归档时）by_project 条数与缓存一致。
 * 压缩会改 updatedAt，增删图片会改条数，所以久未修改的系统一直命中缓存。
 * 失效时用游标逐条累加 byteSize，一次只持有一条记录；未整理（仍有内联字节）的系统不读整份文档，只标记待整理。
 */
import type { ProjectSummary } from '../types';
import { countProjectImages, getProjectsNeedingMigration, measureProjectImages } from './db';

const CACHE_KEY = 'evidence-storage-stats-v1';

export interface SystemStorageStat {
  projectId: string;
  groupId: string | null;
  updatedAt: number;
  /** 已归档时为归档张数；否则为本地 images store 条数。 */
  imageCount: number;
  /** 本地图片字节（已归档恒为 0）。 */
  imageBytes: number;
  archived: boolean;
  /** 图片尚未整理进独立存储，字节未计入，也不作为归档候选。 */
  needsMigration: boolean;
  computedAt: number;
}

interface CacheEntry {
  updatedAt: number;
  imageCount: number;
  imageBytes: number;
  archived: boolean;
  computedAt: number;
}

export interface StatsOptions {
  signal?: AbortSignal;
  now?: () => number;
  /** 每完成一个系统回调一次。 */
  onProgress?: (done: number, total: number) => void;
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return ['updatedAt', 'imageCount', 'imageBytes', 'computedAt'].every((key) => typeof entry[key] === 'number')
    && typeof entry.archived === 'boolean';
}

export function readStatsCache(): Record<string, CacheEntry> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, value]) => isCacheEntry(value))) as Record<string, CacheEntry>;
  } catch {
    return {};
  }
}

function writeStatsCache(cache: Record<string, CacheEntry>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 写不进只会导致下次重算。
  }
}

async function statOf(summary: ProjectSummary, cached: CacheEntry | undefined, now: number): Promise<CacheEntry> {
  const archived = Boolean(summary.archive);
  const sameVersion = cached && cached.updatedAt === summary.updatedAt && cached.archived === archived;
  if (archived) {
    // 本地无字节，不读库；张数取归档记录。
    if (sameVersion) return cached;
    return { updatedAt: summary.updatedAt, imageCount: summary.archive?.imageCount ?? 0, imageBytes: 0, archived, computedAt: now };
  }
  if (sameVersion && (await countProjectImages(summary.id)) === cached.imageCount) return cached;
  const measure = await measureProjectImages(summary.id);
  return { updatedAt: summary.updatedAt, imageCount: measure.count, imageBytes: measure.bytes, archived, computedAt: now };
}

/**
 * 逐系统统计，每完成一个立即写缓存，可随时中断、下次续跑。
 * 单个系统读失败不中断整体（该系统本轮不出现在结果里）。
 */
export async function computeStorageStats(summaries: ProjectSummary[], options: StatsOptions = {}): Promise<SystemStorageStat[]> {
  const now = options.now ?? Date.now;
  const cache = readStatsCache();
  const known = new Set(summaries.map((summary) => summary.id));
  for (const id of Object.keys(cache)) if (!known.has(id)) delete cache[id];
  writeStatsCache(cache);

  const needsMigration = getProjectsNeedingMigration(summaries.map((summary) => summary.id));
  const stats: SystemStorageStat[] = [];
  for (const summary of summaries) {
    if (options.signal?.aborted) break;
    let entry: CacheEntry;
    try {
      entry = await statOf(summary, cache[summary.id], now());
    } catch {
      continue;
    }
    cache[summary.id] = entry;
    writeStatsCache(cache);
    stats.push({
      projectId: summary.id,
      groupId: summary.groupId,
      updatedAt: summary.updatedAt,
      imageCount: entry.imageCount,
      imageBytes: entry.imageBytes,
      archived: entry.archived,
      needsMigration: !entry.archived && needsMigration.has(summary.id),
      computedAt: entry.computedAt,
    });
    options.onProgress?.(stats.length, summaries.length);
  }
  return stats;
}
