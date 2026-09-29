import React from 'react';
import type { ReminderReason, ReminderResult } from '../../utils/storageReminder';
import { formatBytes } from '../../utils/storageEstimate';
import { LIST_ACTION_CLASS } from '../project-list/projectListUi';

interface StorageReminderBannerProps {
  result: ReminderResult;
  onArchive: () => void;
  onSnooze: () => void;
}

function describe(reason: ReminderReason): string {
  switch (reason.kind) {
    case 'usage':
      return `本工具已占用 ${formatBytes(reason.usageBytes)}，超过提醒线 ${formatBytes(reason.limitBytes)}。`;
    case 'disk-low':
      return `数据所在的 ${reason.drive || '磁盘'} 只剩 ${formatBytes(reason.freeBytes)}，低于提醒线 ${formatBytes(reason.minBytes)}。`;
    case 'disk-urgent':
      return `数据所在的 ${reason.drive || '磁盘'} 只剩 ${formatBytes(reason.freeBytes)}，已低于紧急线 ${formatBytes(reason.minBytes)}。磁盘写满后新拍的图片可能保存失败。`;
    case 'stale':
      return `有 ${reason.count} 个系统超过 ${reason.staleDays} 天没有修改，图片约 ${formatBytes(reason.bytes)}，可以归档到其它盘。`;
  }
}

const StorageReminderBanner: React.FC<StorageReminderBannerProps> = ({ result, onArchive, onSnooze }) => {
  const urgent = result.level === 'urgent';
  return (
    <div role={urgent ? 'alert' : 'status'} data-storage-reminder={result.level} className={`mb-4 flex flex-col gap-3 border p-4 text-sm sm:flex-row sm:items-center ${urgent ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{urgent ? '磁盘空间严重不足' : '存储空间提醒'}</p>
        {result.reasons.map((reason) => <p key={reason.kind} className="leading-6">{describe(reason)}</p>)}
      </div>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onArchive} className={`${LIST_ACTION_CLASS} text-white ${urgent ? 'border-red-600 bg-red-600 hover:bg-red-700' : 'border-blue-600 bg-blue-600 hover:bg-blue-700'}`}>去归档</button>
        {!urgent && <button type="button" onClick={onSnooze} className={`${LIST_ACTION_CLASS} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>稍后提醒</button>}
      </div>
    </div>
  );
};

export default StorageReminderBanner;
