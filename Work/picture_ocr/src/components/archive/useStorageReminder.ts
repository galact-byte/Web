import { useCallback, useEffect, useState } from 'react';
import type { ProjectGroupSummary } from '../../types';
import { computeStorageStats } from '../../utils/storageStats';
import { getStorageEstimate } from '../../utils/storageEstimate';
import { evaluateReminder, getDataDiskFree, loadReminderSettings, snoozeReminder, type ReminderResult } from '../../utils/storageReminder';

/**
 * 列表加载完成后空闲时检查一次存储提醒（design.md 第 4 节），不阻塞列表。
 * 统计走缓存，久未修改的系统不重读字节；任何一步失败都只让对应条件视为不满足。
 */
export function useStorageReminder(groups: ProjectGroupSummary[], ready: boolean) {
  const [result, setResult] = useState<ReminderResult | null>(null);
  const [checkKey, setCheckKey] = useState(0);
  const [checkedKey, setCheckedKey] = useState(-1);

  useEffect(() => {
    if (!ready || checkedKey === checkKey) return;
    const controller = new AbortController();
    // Electron/Chrome 都有 requestIdleCallback；保留 setTimeout 兜底以防其它浏览器。
    const idle = typeof window.requestIdleCallback === 'function';
    const run = async () => {
      const systems = groups.flatMap((summary) => summary.systems);
      const [stats, estimate, diskFree] = await Promise.all([
        computeStorageStats(systems, { signal: controller.signal }).catch(() => []),
        getStorageEstimate().catch(() => null),
        getDataDiskFree(),
      ]);
      if (controller.signal.aborted) return;
      setResult(evaluateReminder({
        usageBytes: estimate?.supported ? estimate.usage : null,
        diskFree,
        systems: stats,
      }, loadReminderSettings(), Date.now()));
      setCheckedKey(checkKey);
    };
    const handle = idle
      ? window.requestIdleCallback(() => void run(), { timeout: 5000 })
      : window.setTimeout(() => void run(), 2000);
    return () => {
      controller.abort();
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, [ready, groups, checkKey, checkedKey]);

  const snooze = useCallback(() => {
    snoozeReminder(Date.now());
    setResult((current) => current && current.level === 'normal' ? { ...current, level: 'none', snoozed: true } : current);
  }, []);

  /** 归档、恢复或修改阈值后重新检查。 */
  const recheck = useCallback(() => setCheckKey((key) => key + 1), []);

  return { result, snooze, recheck };
}
