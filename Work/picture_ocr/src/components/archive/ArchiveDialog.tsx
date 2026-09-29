import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectGroupSummary, ProjectSummary } from '../../types';
import { archiveProjects, type ArchiveOutcome } from '../../utils/archive';
import { chooseArchiveTarget, isArchiveTargetSupported, type ArchiveTarget } from '../../utils/archiveTarget';
import { computeStorageStats, type SystemStorageStat } from '../../utils/storageStats';
import { formatBytes } from '../../utils/storageEstimate';
import { formatTime, getGroupDisplayName, getSystemDisplayName } from '../project-list/projectListViews';
import { useConfirmDialog } from '../ConfirmDialog';

interface ArchiveDialogProps {
  groups: ProjectGroupSummary[];
  /** 打开时预选的系统（提醒条「去归档」传入久未修改的候选）。 */
  initialSelectedIds?: string[];
  onClose: () => void;
  /** 有系统归档成功后调用，用于刷新列表。 */
  onArchived: () => void;
}

type Phase = 'loading' | 'select' | 'running' | 'done';

interface Row {
  system: ProjectSummary;
  stat: SystemStorageStat | null;
  /** 不可归档时的原因。 */
  blocked: string | null;
}

interface Section {
  id: string;
  title: string;
  rows: Row[];
  bytes: number;
}

const primaryButton = 'border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

function blockedReason(stat: SystemStorageStat | null): string | null {
  if (!stat) return '读取失败';
  if (stat.archived) return '已归档';
  if (stat.needsMigration) return '待整理';
  if (stat.imageCount === 0) return '无图片';
  return null;
}

const ArchiveDialog: React.FC<ArchiveDialogProps> = ({ groups, initialSelectedIds, onClose, onArchived }) => {
  const { confirm, dialog } = useConfirmDialog();
  const supported = isArchiveTargetSupported();
  const [phase, setPhase] = useState<Phase>('loading');
  const [statsDone, setStatsDone] = useState(0);
  const [stats, setStats] = useState<Map<string, SystemStorageStat>>(() => new Map());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null);
  const [outcomes, setOutcomes] = useState<ArchiveOutcome[]>([]);
  const [targetLabel, setTargetLabel] = useState('');
  const [error, setError] = useState('');
  const initialRef = useRef(initialSelectedIds);
  // 以打开时的列表为准：归档成功后外层列表会刷新，不能因此重新统计、把对话框打回选择步骤。
  const [snapshot] = useState(groups);

  const systems = useMemo(() => snapshot.flatMap((summary) => summary.systems), [snapshot]);

  useEffect(() => {
    const controller = new AbortController();
    void computeStorageStats(systems, { signal: controller.signal, onProgress: (done) => setStatsDone(done) }).then((list) => {
      if (controller.signal.aborted) return;
      const map = new Map(list.map((stat) => [stat.projectId, stat]));
      setStats(map);
      const preset = (initialRef.current ?? []).filter((id) => !blockedReason(map.get(id) ?? null));
      setSelected(new Set(preset));
      setPhase('select');
    });
    return () => controller.abort();
  }, [systems]);

  const sections = useMemo<Section[]>(() => snapshot
    .filter((summary) => summary.systems.length > 0)
    .map((summary) => {
      const rows = summary.systems
        .map((system) => { const stat = stats.get(system.id) ?? null; return { system, stat, blocked: blockedReason(stat) }; })
        .sort((a, b) => (b.stat?.imageBytes ?? 0) - (a.stat?.imageBytes ?? 0));
      const grouped = Boolean(summary.group) || summary.systems.some((system) => system.groupId);
      return {
        id: summary.id,
        title: grouped ? getGroupDisplayName(summary) : '独立系统',
        rows,
        bytes: rows.reduce((sum, row) => sum + (row.stat?.imageBytes ?? 0), 0),
      };
    })
    .sort((a, b) => b.bytes - a.bytes), [snapshot, stats]);

  const totalBytes = sections.reduce((sum, section) => sum + section.bytes, 0);
  const selectedBytes = [...selected].reduce((sum, id) => sum + (stats.get(id)?.imageBytes ?? 0), 0);
  const running = phase === 'running';

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleSection = (section: Section) => setSelected((current) => {
    const ids = section.rows.filter((row) => !row.blocked).map((row) => row.system.id);
    const next = new Set(current);
    const all = ids.length > 0 && ids.every((id) => next.has(id));
    ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
    return next;
  });

  const handleStart = async () => {
    setError('');
    // Web 端目录选择必须在点击事件里立即调用，之前不能 await 其它异步操作。
    // 同盘确认只会出现在桌面端（Web 无法判断盘符），桌面目录框不需要用户手势，可直接重选。
    let target: ArchiveTarget | null = null;
    for (;;) {
      try {
        target = await chooseArchiveTarget();
      } catch (err) {
        setError(err instanceof Error ? err.message : '无法选择保存位置');
        return;
      }
      if (!target) return;
      if (target.sameDriveAsData !== true) break;
      const keep = await confirm({
        title: '保存位置与数据在同一块盘',
        message: `所选目录「${target.label}」与本工具的数据在同一块磁盘上，归档后这块盘的剩余空间基本不会增加。\n\n建议改选其它盘（如 D 盘）或移动硬盘。`,
        confirmText: '仍然保存到这里',
        cancelText: '重新选择',
        tone: 'default',
      });
      if (keep) break;
    }

    const ids = sections.flatMap((section) => section.rows).map((row) => row.system.id).filter((id) => selected.has(id));
    const names = new Map(systems.map((system) => [system.id, getSystemDisplayName(system)]));
    setTargetLabel(target.label);
    setPhase('running');
    const result = await archiveProjects(ids, target, (step) => setProgress({ index: step.index, total: step.total, name: names.get(step.projectId) ?? '' }));
    setOutcomes(result);
    setPhase('done');
    if (result.some((outcome) => outcome.status === 'archived')) onArchived();
  };

  const archived = outcomes.filter((outcome) => outcome.status === 'archived');
  const failed = outcomes.filter((outcome) => outcome.status === 'failed');
  const skipped = outcomes.filter((outcome) => outcome.status === 'skipped');
  const freed = archived.reduce((sum, outcome) => sum + (outcome.freedBytes ?? 0), 0);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="archive-dialog-title" className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/55 px-4" onClick={() => { if (!running) onClose(); }}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="archive-dialog-title" className="text-base font-semibold text-slate-950">占用明细与归档</h2>
          <button onClick={onClose} disabled={running} className="text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {phase === 'loading' && <p className="py-10 text-center text-sm text-slate-600">正在统计各系统的图片占用（{statsDone} / {systems.length}）…</p>}

          {phase === 'select' && <>
            <p className="text-xs leading-5 text-slate-600">
              归档会把所选系统的图片打包保存到你选择的目录（建议选 C 盘以外的盘或移动硬盘），校验文件完整后才删除本地图片；项目、资产和检查项都保留在列表里，需要时用归档文件恢复。每个系统生成一个文件，也可以用「导入数据包」打开。
            </p>
            {!supported && <p role="alert" className="mt-3 border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">当前浏览器不支持选择保存目录，无法归档。请用 Chrome 或 Edge 打开本工具；为避免把归档存进 C 盘「下载」目录，这里不提供下载方式。</p>}
            <p className="mt-3 text-xs text-slate-500">本地图片共 {formatBytes(totalBytes)}，按占用从大到小排列。</p>
            <div className="mt-2 border border-slate-200">
              {sections.map((section) => {
                const selectable = section.rows.filter((row) => !row.blocked);
                const allChecked = selectable.length > 0 && selectable.every((row) => selected.has(row.system.id));
                return <div key={section.id} data-archive-section={section.id} className="border-b border-slate-200 last:border-b-0">
                  <label className="flex items-center gap-3 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
                    <input type="checkbox" className="h-4 w-4" checked={allChecked} disabled={selectable.length === 0} onChange={() => toggleSection(section)} aria-label={`全选${section.title}`} />
                    <span className="min-w-0 flex-1 break-words">{section.title}</span>
                    <span className="whitespace-nowrap text-xs font-normal tabular-nums text-slate-600">{formatBytes(section.bytes)}</span>
                  </label>
                  {section.rows.map((row) => (
                    <label key={row.system.id} data-archive-system={row.system.id} className={`flex items-center gap-3 border-t border-slate-100 px-3 py-2 text-sm ${row.blocked ? 'text-slate-400' : 'text-slate-700 hover:bg-slate-50'}`}>
                      <input type="checkbox" className="h-4 w-4" checked={selected.has(row.system.id)} disabled={!!row.blocked} onChange={() => toggle(row.system.id)} aria-label={`选择${getSystemDisplayName(row.system)}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words">{getSystemDisplayName(row.system)}</span>
                        <span className="block text-xs text-slate-500">最后修改 {formatTime(row.system.updatedAt)} · {row.stat?.imageCount ?? '-'} 张</span>
                      </span>
                      {row.blocked && <span className="whitespace-nowrap border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{row.blocked}</span>}
                      <span className="w-20 whitespace-nowrap text-right text-xs tabular-nums">{row.stat?.archived ? '-' : formatBytes(row.stat?.imageBytes ?? null)}</span>
                    </label>
                  ))}
                </div>;
              })}
            </div>
            {sections.some((section) => section.rows.some((row) => row.blocked === '待整理')) && <p className="mt-2 text-xs text-slate-500">「待整理」的系统图片还存放在旧格式里，先在存储设置里完成「图片存储优化」后才能归档。</p>}
            {error && <p role="alert" className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </>}

          {phase === 'running' && progress && <div className="py-8 text-center">
            <p className="text-sm text-slate-800">正在归档第 {progress.index} / {progress.total} 个系统：{progress.name}</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-md overflow-hidden bg-slate-100"><div className="h-full bg-blue-500" style={{ width: `${Math.round(((progress.index - 1) / progress.total) * 100)}%` }} /></div>
            <p className="mt-3 text-xs text-slate-500">保存到：{targetLabel}。请勿关闭窗口。</p>
          </div>}

          {phase === 'done' && <div className="space-y-3 text-sm">
            <p className="text-slate-800">
              {archived.length > 0 ? `已归档 ${archived.length} 个系统，释放约 ${formatBytes(freed)}。` : '没有系统完成归档。'}
              {failed.length > 0 && <span className="text-red-700"> {failed.length} 个失败。</span>}
              {skipped.length > 0 && <span className="text-slate-600"> {skipped.length} 个已是归档状态，已跳过。</span>}
            </p>
            {archived.length > 0 && <p className="text-xs leading-5 text-slate-500">归档文件保存在：{targetLabel}。请妥善保管，恢复时需要用到。浏览器回收磁盘空间可能有延迟，存储设置里的「已用」不一定立即下降。</p>}
            {failed.length > 0 && <ul className="space-y-2">
              {failed.map((outcome) => <li key={outcome.projectId} className="border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
                <span className="font-semibold">{outcome.systemName || '未命名系统'}</span>：{outcome.message}
                {outcome.fileName && <span className="block">{outcome.invalidFileLeft ? `目录里的「${outcome.fileName}」无效，可以删除。` : `目录里的「${outcome.fileName}」是完整的，但本地数据未清理。`}</span>}
              </li>)}
            </ul>}
          </div>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          {phase === 'select' && <>
            <span className="mr-auto text-xs text-slate-600">已选 {selected.size} 个系统，约 {formatBytes(selectedBytes)}</span>
            <button onClick={onClose} className={secondaryButton}>取消</button>
            <button onClick={() => void handleStart()} disabled={!supported || selected.size === 0} className={primaryButton}>选择保存位置并归档…</button>
          </>}
          {phase === 'loading' && <button onClick={onClose} className={secondaryButton}>取消</button>}
          {phase === 'done' && <button onClick={onClose} className={primaryButton}>完成</button>}
        </div>
      </div>
      {dialog}
    </div>
  );
};

export default ArchiveDialog;
