import React, { useEffect, useState } from 'react';
import {
  getPwaReadiness,
  requestPwaInstall,
  subscribePwaReadiness,
  type PwaReadiness,
  type ReadinessState,
} from '../utils/pwa';

function statusText(state: ReadinessState): string {
  if (state === 'ready') return '可用';
  if (state === 'unavailable') return '不可用';
  return '检查中';
}

function statusClass(state: ReadinessState): string {
  if (state === 'ready') return 'text-emerald-700';
  if (state === 'unavailable') return 'text-amber-700';
  return 'text-slate-500';
}

const PwaReadinessCard: React.FC = () => {
  const [readiness, setReadiness] = useState<PwaReadiness>(() => getPwaReadiness());

  useEffect(() => subscribePwaReadiness(setReadiness), []);

  const canInstall = readiness.installState === 'installable';
  const installLabel = readiness.installState === 'installed'
    ? '已安装'
    : readiness.installState === 'manual'
      ? '请用浏览器分享菜单“添加到主屏幕”'
      : canInstall
        ? '可安装'
        : '暂不可安装';

  return (
    <section className="mb-4 border border-slate-200 bg-white p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">现场离线准备</h2>
        {canInstall && <button onClick={() => void requestPwaInstall()} className="border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100">安装到设备</button>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">安全上下文</dt><dd className={readiness.secureContext ? 'text-emerald-700' : 'text-amber-700'}>{readiness.secureContext ? 'HTTPS / localhost' : '不可用'}</dd></div>
        <div><dt className="text-slate-500">Web Crypto</dt><dd className={readiness.webCrypto ? 'text-emerald-700' : 'text-amber-700'}>{readiness.webCrypto ? '可用' : '不可用'}</dd></div>
        <div><dt className="text-slate-500">IndexedDB</dt><dd className={statusClass(readiness.indexedDb)}>{statusText(readiness.indexedDb)}</dd></div>
        <div><dt className="text-slate-500">SW 缓存</dt><dd className={statusClass(readiness.serviceWorker)}>{statusText(readiness.serviceWorker)}</dd></div>
        <div className="col-span-2 sm:col-span-1"><dt className="text-slate-500">安装状态</dt><dd className={readiness.installState === 'installed' || readiness.installState === 'installable' ? 'text-emerald-700' : 'text-slate-600'}>{installLabel}</dd></div>
      </dl>
      {readiness.offlineReason && <p className="mt-3 text-sm text-amber-700">{readiness.offlineReason}</p>}
    </section>
  );
};

export default PwaReadinessCard;
