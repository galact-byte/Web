// Web 模式存储用量：封装 navigator.storage.estimate()，供“存储设置”面板展示。
// 桌面 Electron 版数据目录可迁移，不依赖此模块。

export interface StorageEstimateResult {
  /** 浏览器是否支持 navigator.storage.estimate() */
  supported: boolean;
  /** 已用字节数（不支持或未知时为 null） */
  usage: number | null;
  /** 配额字节数（不支持或未知时为 null） */
  quota: number | null;
  /** usage/quota 比例，0–1；无法计算时为 null */
  ratio: number | null;
}

/** 用量占配额达到此比例即视为偏高，触发告警与清理引导。 */
export const STORAGE_WARN_RATIO = 0.8;

export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  const fallback: StorageEstimateResult = { supported: false, usage: null, quota: null, ratio: null };
  try {
    if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.estimate !== 'function') {
      return fallback;
    }
    const estimate = await navigator.storage.estimate();
    const usage = typeof estimate.usage === 'number' ? estimate.usage : null;
    const quota = typeof estimate.quota === 'number' ? estimate.quota : null;
    const ratio = usage != null && quota != null && quota > 0 ? usage / quota : null;
    return { supported: true, usage, quota, ratio };
  } catch {
    // 某些隐私模式/权限下 estimate 会抛错，按不支持处理。
    return fallback;
  }
}

/** 人类可读的字节数，如 1.5 GB / 820 MB / 512 KB。 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '未知';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}
