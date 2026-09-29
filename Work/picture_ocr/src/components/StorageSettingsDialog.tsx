import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from './Toast';
import { useConfirmDialog } from './ConfirmDialog';
import { formatBytes, getStorageEstimate, STORAGE_WARN_RATIO, type StorageEstimateResult } from '../utils/storageEstimate';
import { clearErrorLog, downloadDiagnostics, getErrorLog } from '../utils/errorLog';
import {
  ensureSummariesSynced,
  getStoreDiagnostics,
  getImageMigrationProgress,
  migrateInlineImages,
  type StoreDiagnostics,
  type ImageMigrationProgress,
} from '../utils/db';
import type { SummaryRepairReport } from '../utils/summaryRepair';
import { getPersistenceState, requestPersistence, type PersistenceState } from '../utils/storagePersistence';
import { getDataDiskFree, loadReminderSettings, saveReminderSettings, type ReminderSettings } from '../utils/storageReminder';

interface StorageSettingsDialogProps {
  onClose: () => void;
  /** 打开「占用明细与归档」。 */
  onOpenArchive?: () => void;
  onReminderSettingsChanged?: () => void;
}

const GB = 1024 * 1024 * 1024;

const PERSISTENCE_TEXT: Record<PersistenceState, string> = {
  granted: '已开启：磁盘紧张时浏览器不会自动清除本工具的数据。',
  denied: '未获批准：浏览器在磁盘紧张时仍可能清除本工具的数据。是否批准由浏览器根据使用情况决定（常用、加入书签后更容易获批），请定期归档或导出备份。',
  unsupported: '当前浏览器不支持持久存储，请定期归档或导出备份。',
};

const StorageSettingsDialog: React.FC<StorageSettingsDialogProps> = ({ onClose, onOpenArchive, onReminderSettingsChanged }) => {
  const showToast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const desktop = typeof window !== 'undefined' && !!window.evidenceData;

  // 桌面态
  const [info, setInfo] = useState<DataLocationInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!window.evidenceData) return;
    try {
      setInfo(await window.evidenceData.getLocation());
    } catch {
      // 忽略：查询失败保持原状
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleChoose = async () => {
    if (!window.evidenceData || busy) return;
    setBusy(true);
    try {
      const result = await window.evidenceData.chooseLocation();
      if (!result.changed) {
        if (result.error) showToast(result.error, 'error');
        else if (result.reason) showToast(result.reason, 'info');
        return;
      }
      const ok = await confirm({
        title: '需要重启生效',
        message: `数据将迁移到：\n${result.dataDir}\n\n应用需要重启以完成迁移（原数据会保留为临时备份）。是否立即重启？`,
        confirmText: '立即重启',
        cancelText: '稍后',
      });
      if (ok) await window.evidenceData.relaunch();
      else {
        showToast('已记录新位置，下次启动时完成迁移。', 'info');
        await refresh();
      }
    } catch (err) {
      showToast(`更改失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!window.evidenceData || busy || info?.isDefault) return;
    const ok = await confirm({
      title: '恢复默认位置',
      message: '将把数据迁回默认位置（C 盘用户目录），重启后生效。是否继续？',
      confirmText: '恢复并重启',
      cancelText: '取消',
      tone: 'default',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await window.evidenceData.resetLocation();
      if (!result.changed) {
        if (result.reason) showToast(result.reason, 'info');
        return;
      }
      await window.evidenceData.relaunch();
    } catch (err) {
      showToast(`恢复失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBackup = async () => {
    if (!window.evidenceData || busy) return;
    const ok = await confirm({
      title: '删除旧数据备份',
      message: '将永久删除迁移前保留的旧数据备份，删除后无法恢复。是否继续？',
      confirmText: '删除备份',
      cancelText: '取消',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await window.evidenceData.deleteBackup();
      if (result.deleted) {
        showToast('旧数据备份已删除', 'success');
        await refresh();
      } else {
        showToast(result.error ? `删除失败：${result.error}` : '没有可删除的备份', 'info');
      }
    } finally {
      setBusy(false);
    }
  };

  // 诊断与报错（桌面/Web 通用）
  const [errorCount, setErrorCount] = useState(() => getErrorLog().length);
  const [exporting, setExporting] = useState(false);

  const handleExportDiagnostics = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadDiagnostics();
      showToast('诊断包已导出，请把该文件发给技术支持。', 'success');
    } catch (err) {
      showToast(`导出诊断包失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleClearErrors = async () => {
    const ok = await confirm({
      title: '清空错误记录',
      message: '将清除本机保存的最近错误日志（不影响项目数据）。是否继续？',
      confirmText: '清空',
      cancelText: '取消',
      tone: 'default',
    });
    if (!ok) return;
    clearErrorLog();
    setErrorCount(0);
    showToast('错误记录已清空', 'success');
  };

  // 存储自检（桌面/Web 通用）：列表只读摘要 store，若项目文档没有对应摘要就会「看不见」，这里提供人工核对与修复。
  const [stores, setStores] = useState<StoreDiagnostics | null>(null);
  const [repair, setRepair] = useState<SummaryRepairReport | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void getStoreDiagnostics().then(setStores).catch(() => { /* 忽略：读不到保持空 */ });
  }, []);

  const handleSelfCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await ensureSummariesSynced(true);
      setRepair(result);
      setStores(await getStoreDiagnostics());
      if (result.repaired > 0) {
        showToast(`自检完成：找回 ${result.repaired} 个未显示的项目，请返回列表查看。`, 'success');
      } else if (result.damagedIds.length > 0) {
        showToast(`自检完成：${result.damagedIds.length} 条记录读不出内容，请导出诊断包发给技术支持。`, 'error');
      } else {
        showToast('自检完成：项目与列表一致，无需修复。', 'success');
      }
      setErrorCount(getErrorLog().length);
    } catch (err) {
      showToast(`自检失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setChecking(false);
    }
  };

  // 图片存储优化（v5 拆分）：存量内联字节搬到独立 store，进度可见、失败可重试。
  const [migration, setMigration] = useState<ImageMigrationProgress | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrateDone, setMigrateDone] = useState(0);

  useEffect(() => {
    void getImageMigrationProgress().then(setMigration).catch(() => { /* 忽略：读不到保持空 */ });
  }, []);

  const handleMigrateImages = async (force: boolean) => {
    if (migrating) return;
    setMigrating(true);
    setMigrateDone(0);
    try {
      const report = await migrateInlineImages(force, (done) => setMigrateDone(done));
      setMigration(await getImageMigrationProgress());
      setStores(await getStoreDiagnostics());
      if (report.damagedIds.length > 0) {
        showToast(`优化完成：${report.migrated} 个系统已优化，${report.damagedIds.length} 个未能处理（图片完好保留，可稍后重试）。`, 'error');
      } else if (report.migrated > 0) {
        showToast(`优化完成：${report.migrated} 个系统的图片已拆分存储，拍照保存会快很多。`, 'success');
      } else {
        showToast('所有系统都已是优化后的存储形态，无需处理。', 'success');
      }
      setErrorCount(getErrorLog().length);
    } catch (err) {
      showToast(`优化失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setMigrating(false);
    }
  };

  // Web 态
  const [estimate, setEstimate] = useState<StorageEstimateResult | null>(null);

  useEffect(() => {
    if (desktop) return;
    void getStorageEstimate().then(setEstimate);
  }, [desktop]);

  const highUsage = estimate?.ratio != null && estimate.ratio >= STORAGE_WARN_RATIO;

  // 磁盘剩余（两端都显示：桌面为数据目录所在盘，Web 为浏览器数据所在盘）
  const [diskFree, setDiskFree] = useState<DiskFreeInfo | null | undefined>(undefined);
  useEffect(() => { void getDataDiskFree().then(setDiskFree); }, []);

  // 持久存储（仅 Web）
  const [persistence, setPersistence] = useState<PersistenceState | null>(null);
  const [persisting, setPersisting] = useState(false);
  useEffect(() => {
    if (desktop) return;
    void getPersistenceState().then(setPersistence);
  }, [desktop]);
  const handleRequestPersistence = async () => {
    setPersisting(true);
    try {
      const state = await requestPersistence();
      setPersistence(state);
      showToast(state === 'granted' ? '持久存储已开启。' : '浏览器没有批准持久存储，请定期归档或导出备份。', state === 'granted' ? 'success' : 'info');
    } finally {
      setPersisting(false);
    }
  };

  // 提醒阈值（GB / 天，界面上用整数编辑）
  const [reminder, setReminder] = useState<ReminderSettings>(() => loadReminderSettings());
  const [reminderDraft, setReminderDraft] = useState(() => ({
    usage: String(Math.round((reminder.usageLimitBytes / GB) * 10) / 10),
    diskMin: String(Math.round((reminder.diskFreeMinBytes / GB) * 10) / 10),
    diskUrgent: String(Math.round((reminder.diskFreeUrgentBytes / GB) * 10) / 10),
    staleDays: String(reminder.staleDays),
  }));
  const handleSaveReminder = () => {
    const usage = Number(reminderDraft.usage);
    const diskMin = Number(reminderDraft.diskMin);
    const diskUrgent = Number(reminderDraft.diskUrgent);
    const staleDays = Number(reminderDraft.staleDays);
    if (![usage, diskMin, diskUrgent, staleDays].every((value) => Number.isFinite(value) && value > 0)) {
      showToast('提醒阈值必须是大于 0 的数字。', 'error');
      return;
    }
    if (diskUrgent >= diskMin) {
      showToast('磁盘紧急线必须小于磁盘提醒线。', 'error');
      return;
    }
    const next: ReminderSettings = {
      ...reminder,
      usageLimitBytes: Math.round(usage * GB),
      diskFreeMinBytes: Math.round(diskMin * GB),
      diskFreeUrgentBytes: Math.round(diskUrgent * GB),
      staleDays: Math.round(staleDays),
      // 改了阈值就按新标准立即重新判断，不沿用之前的「稍后提醒」。
      snoozedUntil: null,
    };
    saveReminderSettings(next);
    setReminder(next);
    onReminderSettingsChanged?.();
    showToast('提醒设置已保存。', 'success');
  };
  const reminderInput = 'w-20 border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-950">存储设置</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {desktop ? (
            <div className="space-y-4">
              {info?.startupWarning && (
                <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {info.startupWarning}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-slate-700">当前数据存储目录</p>
                <p className="mt-1 break-all border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {info ? info.current : '读取中…'}
                  {info?.isDefault && <span className="ml-2 text-slate-400">（默认位置）</span>}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  项目与图片默认存在 C 盘用户目录。迁移到其它盘可缓解 C 盘占用，C 盘只保留几 KB 指针配置。
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleChoose}
                  disabled={busy}
                  className="border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  更改位置…
                </button>
                <button
                  onClick={handleReset}
                  disabled={busy || !!info?.isDefault}
                  className="border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  恢复默认位置
                </button>
              </div>

              {info?.backup && (
                <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-700">
                    旧数据备份将在 <span className="font-semibold">{info.backup.remainingDays}</span> 天后自动清理
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">{info.backup.dir}</p>
                  <button
                    onClick={handleDeleteBackup}
                    disabled={busy}
                    className="mt-2 border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    立即删除备份
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-700">浏览器存储用量</p>
                {estimate == null ? (
                  <p className="mt-1 text-xs text-slate-500">读取中…</p>
                ) : estimate.supported ? (
                  <div className="mt-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-slate-600">
                        已用 {formatBytes(estimate.usage)} / {formatBytes(estimate.quota)}
                      </span>
                      {estimate.ratio != null && (
                        <span className={highUsage ? 'font-semibold text-red-600' : 'text-slate-500'}>
                          {Math.round(estimate.ratio * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden bg-slate-100">
                      <div
                        className={`h-full ${highUsage ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, Math.round((estimate.ratio ?? 0) * 100))}%` }}
                      />
                    </div>
                    {highUsage && (
                      <p className="mt-2 border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        存储占用偏高。可以把不常用的系统归档到其它盘，释放本地空间。
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">当前浏览器不支持存储用量查询。</p>
                )}
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  网页版数据存在浏览器本地，无法由应用迁移到其它盘。如需控制 C 盘占用，可把不常用的系统归档到 D 盘等位置（下方「归档」）。长期大量使用建议改用桌面版（可将数据目录迁移到 D 盘）。
                </p>
              </div>
              <div data-persistence={persistence ?? 'loading'}>
                <p className="text-sm font-medium text-slate-700">持久存储</p>
                <p className={`mt-1 text-xs leading-5 ${persistence === 'granted' ? 'text-slate-600' : 'text-amber-800'}`}>
                  {persistence ? PERSISTENCE_TEXT[persistence] : '读取中…'}
                </p>
                {persistence === 'denied' && (
                  <button
                    onClick={() => void handleRequestPersistence()}
                    disabled={persisting}
                    className="mt-2 border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {persisting ? '申请中…' : '再次申请'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 border-t border-slate-200 pt-5" data-archive-section>
            <p className="text-sm font-medium text-slate-700">归档与存储提醒</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              归档会把不常用系统的图片打包保存到你选择的目录（建议 C 盘以外），校验无误后删除本地图片，项目仍保留在列表里，需要时用归档文件恢复。
            </p>
            <p className="mt-2 border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600" data-disk-free>
              {diskFree === undefined
                ? '数据所在磁盘：读取中…'
                : diskFree
                  ? `数据所在磁盘 ${diskFree.drive || ''} 剩余 ${formatBytes(diskFree.freeBytes)} / 共 ${formatBytes(diskFree.totalBytes)}`
                  : '无法读取数据所在磁盘的剩余空间（磁盘剩余提醒不会生效）。'}
            </p>
            {onOpenArchive && (
              <button
                onClick={onOpenArchive}
                className="mt-2 border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                查看占用明细与归档…
              </button>
            )}
            <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 text-xs text-slate-600">
              <label htmlFor="reminder-usage">本工具占用超过（GB）</label>
              <input id="reminder-usage" inputMode="decimal" className={reminderInput} value={reminderDraft.usage} onChange={(event) => setReminderDraft((d) => ({ ...d, usage: event.target.value }))} />
              <label htmlFor="reminder-disk-min">磁盘剩余低于（GB）</label>
              <input id="reminder-disk-min" inputMode="decimal" className={reminderInput} value={reminderDraft.diskMin} onChange={(event) => setReminderDraft((d) => ({ ...d, diskMin: event.target.value }))} />
              <label htmlFor="reminder-disk-urgent">紧急提醒：磁盘剩余低于（GB，不受「稍后提醒」影响）</label>
              <input id="reminder-disk-urgent" inputMode="decimal" className={reminderInput} value={reminderDraft.diskUrgent} onChange={(event) => setReminderDraft((d) => ({ ...d, diskUrgent: event.target.value }))} />
              <label htmlFor="reminder-stale">系统超过多少天未修改建议归档</label>
              <input id="reminder-stale" inputMode="numeric" className={reminderInput} value={reminderDraft.staleDays} onChange={(event) => setReminderDraft((d) => ({ ...d, staleDays: event.target.value }))} />
            </div>
            <button
              onClick={handleSaveReminder}
              className="mt-3 border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              保存提醒设置
            </button>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <p className="text-sm font-medium text-slate-700">存储自检</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              如果发现项目列表里少了项目，可先做一次自检：核对库里的项目文档与列表索引，把漏掉的项目重新加回列表（不会删除任何图片）。
            </p>
            <p className="mt-2 border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
              {stores
                ? `项目文档 ${stores.projects} 条 · 列表索引 ${stores.summaries} 条 · 项目组 ${stores.groups} 个${stores.legacyStranded ? ' · 有旧版遗留记录未迁移' : ''}`
                : '读取中…'}
              {stores && stores.projects !== stores.summaries && (
                <span className="ml-1 font-semibold text-amber-700">（数量不一致，建议立即自检）</span>
              )}
            </p>
            {repair && (
              <p className="mt-2 text-xs leading-5 text-slate-600">
                上次自检：找回 {repair.repaired} 个项目、清理 {repair.removedOrphans} 条失效索引
                {repair.damagedIds.length > 0 && (
                  <span className="text-red-600">，{repair.damagedIds.length} 条记录读不出内容（{repair.damagedIds.join('、')}）</span>
                )}
              </p>
            )}
            <button
              onClick={handleSelfCheck}
              disabled={checking}
              className="mt-2 border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checking ? '自检中…' : '立即自检并修复'}
            </button>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <p className="text-sm font-medium text-slate-700">图片存储优化</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              旧版本把图片和项目内容存在一起，每拍一张都要重写整个项目，图多了就会越来越卡。优化会把图片单独存放（不会压缩、不会删图），逐个系统处理，中途关闭下次会接着做。
            </p>
            <p className="mt-2 border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
              {migration
                ? `已优化 ${migration.completed} / ${migration.total} 个系统${migration.pending > 0 ? ` · 待处理 ${migration.pending} 个` : ' · 已全部完成'}`
                : '读取中…'}
              {migration && migration.damaged > 0 && (
                <span className="ml-1 font-semibold text-amber-700">（{migration.damaged} 个未能处理，图片仍完好保留，可重试）</span>
              )}
            </p>
            {migrating && <p className="mt-2 text-xs text-slate-600">正在优化，已处理 {migrateDone} 个系统，请勿关闭窗口…</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => void handleMigrateImages(false)}
                disabled={migrating || (migration !== null && migration.pending === 0)}
                className="border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {migrating ? '优化中…' : '立即优化'}
              </button>
              {migration && migration.damaged > 0 && (
                <button
                  onClick={() => void handleMigrateImages(true)}
                  disabled={migrating}
                  className="border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  重试未完成的系统
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <p className="text-sm font-medium text-slate-700">诊断与报错</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              遇到卡住、无响应或异常时，导出诊断包（含最近错误、版本、存储用量与项目规模）发给技术支持，便于定位问题。诊断包仅保存在本地，导出时由浏览器下载。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportDiagnostics}
                disabled={exporting}
                className="border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? '导出中…' : '导出诊断包'}
              </button>
              <button
                onClick={handleClearErrors}
                disabled={errorCount === 0}
                className="border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                清空错误记录
              </button>
              <span className="text-xs text-slate-500">
                {errorCount > 0 ? `已记录 ${errorCount} 条错误` : '暂无错误记录'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
            关闭
          </button>
        </div>
      </div>
      {dialog}
    </div>
  );
};

export default StorageSettingsDialog;
