import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from './Toast';
import { useConfirmDialog } from './ConfirmDialog';
import { formatBytes, getStorageEstimate, STORAGE_WARN_RATIO, type StorageEstimateResult } from '../utils/storageEstimate';
import { getExportAskLocation, isSaveFilePickerSupported, setExportAskLocation } from '../utils/exportPreference';

interface StorageSettingsDialogProps {
  onClose: () => void;
}

const StorageSettingsDialog: React.FC<StorageSettingsDialogProps> = ({ onClose }) => {
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

  // Web 态
  const [estimate, setEstimate] = useState<StorageEstimateResult | null>(null);
  const [askLocation, setAskLocation] = useState<boolean>(() => getExportAskLocation());
  const pickerSupported = isSaveFilePickerSupported();

  useEffect(() => {
    if (desktop) return;
    void getStorageEstimate().then(setEstimate);
  }, [desktop]);

  const toggleAsk = () => {
    const next = !askLocation;
    setAskLocation(next);
    setExportAskLocation(next);
  };

  const highUsage = estimate?.ratio != null && estimate.ratio >= STORAGE_WARN_RATIO;

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
                        存储占用偏高。建议先把项目导出备份到非 C 盘，再删除不再需要的项目释放空间。
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">当前浏览器不支持存储用量查询。</p>
                )}
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  网页版数据存在浏览器本地，无法由应用迁移到其它盘。可通过“导出到非 C 盘 + 删除旧项目”控制占用。
                </p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">导出时询问保存位置</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {pickerSupported
                        ? '开启后，导出数据包 / 加密包 / Word 时会弹出保存框，可直接选择 D 盘等目录。'
                        : '当前浏览器不支持选择保存位置，导出将存入浏览器默认下载目录，可在浏览器设置中修改。'}
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={askLocation && pickerSupported}
                    disabled={!pickerSupported}
                    onClick={toggleAsk}
                    className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                      askLocation && pickerSupported ? 'bg-blue-600' : 'bg-slate-300'
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                        askLocation && pickerSupported ? 'left-[22px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
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
