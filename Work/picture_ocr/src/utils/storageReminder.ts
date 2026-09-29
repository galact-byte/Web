/**
 * 存储提醒（design.md 第 4 节）：设置/稍后提醒状态 + 纯函数 evaluateReminder + 磁盘剩余读取。
 * 输入缺失（estimate 不支持、磁盘剩余读不到）时对应条件视为不满足，不误报。
 */
import { requestJson } from './asyncDeadline';

const SETTINGS_KEY = 'evidence-storage-reminder-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const GB = 1024 * 1024 * 1024;

export interface ReminderSettings {
  /** 本工具占用超过该值提醒。 */
  usageLimitBytes: number;
  /** 数据所在盘剩余低于该值提醒。 */
  diskFreeMinBytes: number;
  /** 数据所在盘剩余低于该值紧急提醒（无视稍后提醒）。 */
  diskFreeUrgentBytes: number;
  /** 系统超过该天数未修改即列为可归档候选。 */
  staleDays: number;
  snoozeDays: number;
  snoozedUntil: number | null;
}

export const DEFAULT_REMINDER_SETTINGS: Readonly<ReminderSettings> = Object.freeze({
  usageLimitBytes: 2 * GB,
  diskFreeMinBytes: 10 * GB,
  diskFreeUrgentBytes: 3 * GB,
  staleDays: 90,
  snoozeDays: 7,
  snoozedUntil: null,
});

function positive(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function loadReminderSettings(): ReminderSettings {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>;
  } catch {
    // 损坏的设置回退默认值。
  }
  const d = DEFAULT_REMINDER_SETTINGS;
  return {
    usageLimitBytes: positive(raw.usageLimitBytes, d.usageLimitBytes),
    diskFreeMinBytes: positive(raw.diskFreeMinBytes, d.diskFreeMinBytes),
    diskFreeUrgentBytes: positive(raw.diskFreeUrgentBytes, d.diskFreeUrgentBytes),
    staleDays: positive(raw.staleDays, d.staleDays),
    snoozeDays: positive(raw.snoozeDays, d.snoozeDays),
    snoozedUntil: typeof raw.snoozedUntil === 'number' && Number.isFinite(raw.snoozedUntil) ? raw.snoozedUntil : null,
  };
}

export function saveReminderSettings(settings: ReminderSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 写不进只影响下次是否提醒，不影响数据。
  }
}

/** 「稍后提醒」：snoozeDays 天内不再显示普通提醒。 */
export function snoozeReminder(now: number): ReminderSettings {
  const settings = loadReminderSettings();
  const next = { ...settings, snoozedUntil: now + settings.snoozeDays * DAY_MS };
  saveReminderSettings(next);
  return next;
}

export interface ReminderSystemInput {
  projectId: string;
  updatedAt: number;
  imageCount: number;
  imageBytes: number;
  archived: boolean;
  needsMigration: boolean;
}

export interface ReminderInput {
  usageBytes: number | null;
  diskFree: DiskFreeInfo | null;
  systems: ReminderSystemInput[];
}

export type ReminderReason =
  | { kind: 'usage'; usageBytes: number; limitBytes: number }
  | { kind: 'disk-low'; drive: string; freeBytes: number; minBytes: number }
  | { kind: 'disk-urgent'; drive: string; freeBytes: number; minBytes: number }
  | { kind: 'stale'; count: number; bytes: number; staleDays: number };

export interface ReminderResult {
  level: 'none' | 'normal' | 'urgent';
  reasons: ReminderReason[];
  staleCandidates: Array<{ projectId: string; bytes: number }>;
  staleBytes: number;
  /** 有普通提醒但处于「稍后提醒」期内。 */
  snoozed: boolean;
}

export function evaluateReminder(input: ReminderInput, settings: ReminderSettings, now: number): ReminderResult {
  const reasons: ReminderReason[] = [];
  let urgent = false;

  if (input.usageBytes != null && input.usageBytes > settings.usageLimitBytes) {
    reasons.push({ kind: 'usage', usageBytes: input.usageBytes, limitBytes: settings.usageLimitBytes });
  }
  const disk = input.diskFree;
  if (disk && Number.isFinite(disk.freeBytes)) {
    if (disk.freeBytes < settings.diskFreeUrgentBytes) {
      urgent = true;
      reasons.push({ kind: 'disk-urgent', drive: disk.drive, freeBytes: disk.freeBytes, minBytes: settings.diskFreeUrgentBytes });
    } else if (disk.freeBytes < settings.diskFreeMinBytes) {
      reasons.push({ kind: 'disk-low', drive: disk.drive, freeBytes: disk.freeBytes, minBytes: settings.diskFreeMinBytes });
    }
  }

  const staleMs = settings.staleDays * DAY_MS;
  const staleCandidates = input.systems
    .filter((system) => !system.archived && !system.needsMigration && system.imageCount > 0 && now - system.updatedAt > staleMs)
    .map((system) => ({ projectId: system.projectId, bytes: system.imageBytes }))
    .sort((a, b) => b.bytes - a.bytes);
  const staleBytes = staleCandidates.reduce((sum, candidate) => sum + candidate.bytes, 0);
  if (staleCandidates.length > 0) {
    reasons.push({ kind: 'stale', count: staleCandidates.length, bytes: staleBytes, staleDays: settings.staleDays });
  }

  const inSnooze = settings.snoozedUntil != null && now < settings.snoozedUntil;
  let level: ReminderResult['level'] = 'none';
  if (urgent) level = 'urgent';
  else if (reasons.length > 0 && !inSnooze) level = 'normal';
  return { level, reasons, staleCandidates, staleBytes, snoozed: !urgent && reasons.length > 0 && inSnooze };
}

function parseDiskFree(value: unknown): DiskFreeInfo | null {
  if (!value || typeof value !== 'object') return null;
  const { drive, freeBytes, totalBytes } = value as Record<string, unknown>;
  if (typeof freeBytes !== 'number' || !Number.isFinite(freeBytes) || freeBytes < 0) return null;
  if (typeof totalBytes !== 'number' || !Number.isFinite(totalBytes) || totalBytes < freeBytes) return null;
  return { drive: typeof drive === 'string' ? drive : '', freeBytes, totalBytes };
}

/**
 * 数据所在盘的剩余空间。桌面：主进程 statfs(userData)；Web：本机 start-server.ps1 的控制接口
 * （浏览器 quota 恒为 usage+10GiB，不能用来推算）。读不到返回 null。
 */
export async function getDataDiskFree(): Promise<DiskFreeInfo | null> {
  try {
    if (window.evidenceArchive) return parseDiskFree(await window.evidenceArchive.diskFree());
    const { response, data } = await requestJson('/api/control/disk-free', {
      cache: 'no-store',
      headers: { 'x-evidence-control': '1' },
    }, 5000);
    return response.ok ? parseDiskFree(data) : null;
  } catch {
    return null;
  }
}
