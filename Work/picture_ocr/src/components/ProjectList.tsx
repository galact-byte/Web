import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectDocument, ProjectGroup, ProjectGroupSummary, ProjectMeta, ProjectSummary } from '../types';
import {
  createProjectGroupWithSystems,
  createSystemForGroup,
  createProjectDocument,
  splitSystemNames,
  deleteProject,
  deleteProjectGroup,
  listProjectGroups,
  loadProject,
  saveProject,
  updateProjectGroupAndSystems,
} from '../utils/db';
import { exportDataPackage, importDataPackage, importEncryptedDataPackage } from '../utils/exportImport';
import { isEvidencePackageFile } from '../utils/evidencePackage';
import ImportDialog from './ImportDialog';
import ProjectListHeader from './project-list/ProjectListHeader';
import ProjectGroupDialog, { type ProjectGroupDialogMode } from './project-list/ProjectGroupDialog';
import { useConfirmDialog } from './ConfirmDialog';
interface ProjectListProps {
  onOpenProject: (projectId: string, isNewProject?: boolean) => void;
}

interface DialogState {
  mode: ProjectGroupDialogMode;
  group: ProjectGroup | null;
  system: ProjectSummary | null;
}

const actionButton = 'inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap border px-2.5 py-1.5 text-xs font-medium transition-colors';
const projectListGrid = 'grid-cols-[44px_minmax(0,1fr)_160px] lg:grid-cols-[44px_minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_64px_160px] 2xl:grid-cols-[44px_minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_64px_448px]';

function getSystemDisplayName(project: ProjectSummary): string {
  return project.meta.systemName.trim() || '未命名系统';
}

function getGroupDisplayName(summary: ProjectGroupSummary): string {
  const group = summary.group;
  if (!group) return summary.id === 'ungrouped' ? '未分组 / 单系统项目' : '项目组记录缺失';
  return group.projectName.trim() || group.unitName.trim() || '未命名项目组';
}

function formatTime(timestamp: number): string {
  return timestamp
    ? new Date(timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '-';
}

function matchesSearch(summary: ProjectGroupSummary, keyword: string): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;
  return [
    summary.group?.projectCode,
    summary.group?.projectName,
    summary.group?.unitName,
    ...summary.systems.flatMap((system) => [system.meta.projectCode, system.meta.projectName, system.meta.unitName, system.meta.systemName]),
  ].join(' ').toLowerCase().includes(normalizedKeyword);
}

const ProjectList: React.FC<ProjectListProps> = ({ onOpenProject }) => {
  const [groups, setGroups] = useState<ProjectGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set());
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => new Set());
  const [importTargetId, setImportTargetId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmDialog();

  const refreshProjects = async () => {
    setLoading(true);
    try {
      const nextGroups = await listProjectGroups();
      setGroups(nextGroups);
      setExpandedGroupIds((current) => {
        const availableIds = new Set(nextGroups.map((group) => group.id));
        const next = new Set([...current].filter((id) => availableIds.has(id)));
        if (current.size === 0) nextGroups.forEach((group) => next.add(group.id));
        return next;
      });
    } catch (err) {
      alert(`加载项目列表失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshProjects(); }, []);

  const filteredGroups = useMemo(() => groups.filter((group) => matchesSearch(group, search)), [groups, search]);
  const filteredSystems = useMemo(() => filteredGroups.flatMap((group) => group.systems), [filteredGroups]);
  const selectedSystems = useMemo(() => groups.flatMap((group) => group.systems).filter((system) => selectedProjectIds.has(system.id)), [groups, selectedProjectIds]);
  const allFilteredSelected = filteredSystems.length > 0 && filteredSystems.every((system) => selectedProjectIds.has(system.id));
  const importTarget = groups.flatMap((group) => group.systems).find((system) => system.id === importTargetId);

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
      return next;
    });
  };

  const toggleAllFilteredProjects = () => {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) filteredSystems.forEach((system) => next.delete(system.id));
      else filteredSystems.forEach((system) => next.add(system.id));
      return next;
    });
  };

  const handleDeleteSelectedProjects = async () => {
    if (selectedSystems.length === 0) return;
    const names = selectedSystems.slice(0, 5).map(getSystemDisplayName).join('、');
    const suffix = selectedSystems.length > 5 ? ` 等 ${selectedSystems.length} 个系统` : '';
    if (!await confirm({ title: '删除选中系统', message: `确定要删除选中的 ${selectedSystems.length} 个系统吗？\n\n${names}${suffix}\n\n此操作会删除对应系统的资产、检查项和截图，且不可撤销。`, confirmText: '删除系统', tone: 'danger' })) return;
    try {
      await Promise.all(selectedSystems.map((system) => deleteProject(system.id)));
      setSelectedProjectIds(new Set());
      await refreshProjects();
    } catch (err) {
      alert(`删除选中系统失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleDeleteSystem = async (system: ProjectSummary) => {
    if (!await confirm({ title: '删除系统', message: `确定要删除系统“${getSystemDisplayName(system)}”吗？\n\n此操作会删除该系统的所有资产、检查项和截图，且不可撤销。`, confirmText: '删除系统', tone: 'danger' })) return;
    try {
      await deleteProject(system.id);
      setSelectedProjectIds((current) => { const next = new Set(current); next.delete(system.id); return next; });
      await refreshProjects();
    } catch (err) {
      alert(`删除系统失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleDeleteGroup = async (summary: ProjectGroupSummary) => {
    if (!summary.group) return;
    if (!await confirm({ title: '删除项目组', message: `确定要删除项目组“${getGroupDisplayName(summary)}”及其 ${summary.systems.length} 个系统吗？\n\n此操作会删除该项目组全部系统的资产、检查项和截图，且不可撤销。`, confirmText: '删除项目组', tone: 'danger' })) return;
    try {
      await deleteProjectGroup(summary.group.id);
      setSelectedProjectIds((current) => {
        const next = new Set(current);
        summary.systems.forEach((system) => next.delete(system.id));
        return next;
      });
      await refreshProjects();
    } catch (err) {
      alert(`删除项目组失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleExportSystem = async (system: ProjectSummary) => {
    try {
      const document = await loadProject(system.id);
      if (!document) return alert('导出失败：系统不存在或已被删除');
      await exportDataPackage(document.meta, document.categories, document.assets);
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const importIntoSystem = async (file: File, password: string, mode: 'overwrite' | 'merge'): Promise<boolean> => {
    if (!importTargetId) return false;
    try {
      const targetDocument = await loadProject(importTargetId);
      if (!targetDocument) { alert('导入失败：目标系统不存在或已被删除'); return false; }
      const result = isEvidencePackageFile(file)
        ? await importEncryptedDataPackage(file, password, mode, targetDocument.assets, targetDocument.categories, targetDocument.meta)
        : await importDataPackage(file, mode, targetDocument.assets, targetDocument.categories, targetDocument.meta);
      if (!result.success || !result.data) { alert(result.message); return false; }
      const group = targetDocument.groupId ? await getGroupForSystem(targetDocument.groupId) : null;
      const meta: ProjectMeta = group && mode === 'overwrite'
        ? { ...result.data.meta, projectCode: group.projectCode, projectName: group.projectName, unitName: group.unitName, reportDate: group.reportDate }
        : result.data.meta;
      const nextDocument: ProjectDocument = {
        id: targetDocument.id,
        groupId: targetDocument.groupId,
        meta,
        categories: result.data.categories,
        assets: result.data.assets,
        createdAt: targetDocument.createdAt,
        updatedAt: Date.now(),
      };
      await saveProject(nextDocument);
      await refreshProjects();
      alert(result.message);
      return true;
    } catch (err) {
      alert(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
      return false;
    }
  };

  const getGroupForSystem = async (groupId: string): Promise<ProjectGroup | null> => {
    const summary = groups.find((group) => group.id === groupId);
    return summary?.group ?? null;
  };

  const handleSaveDialog = async (values: { projectCode: string; projectName: string; unitName: string; reportDate: string; systemName: string }): Promise<boolean> => {
    if (!dialogState || saving) return false;
    setSaving(true);
    try {
      if (dialogState.mode === 'create-group') {
        const systemNames = splitSystemNames(values.systemName);
        if (systemNames.length === 1) {
          await saveProject(createProjectDocument({ ...values, systemName: systemNames[0] }));
        } else {
          await createProjectGroupWithSystems(values, systemNames);
        }
      } else if (dialogState.mode === 'add-system' && dialogState.group) {
        await createSystemForGroup(dialogState.group, values.systemName);
      } else if (dialogState.mode === 'edit-group' && dialogState.group) {
        await updateProjectGroupAndSystems({
          ...dialogState.group,
          projectCode: values.projectCode,
          projectName: values.projectName,
          unitName: values.unitName,
          reportDate: values.reportDate,
          updatedAt: Date.now(),
        });
      } else if (dialogState.mode === 'edit-system' && dialogState.system) {
        const document = await loadProject(dialogState.system.id);
        if (!document) { alert('保存失败：目标系统不存在或已被删除'); return false; }
        const meta = dialogState.group
          ? {
              ...document.meta,
              projectCode: dialogState.group.projectCode,
              projectName: dialogState.group.projectName,
              unitName: dialogState.group.unitName,
              reportDate: dialogState.group.reportDate,
              systemName: values.systemName,
            }
          : { ...document.meta, ...values };
        await saveProject({ ...document, meta, updatedAt: Date.now() });
      }
      await refreshProjects();
      return true;
    } catch (err) {
      alert(`保存失败：${err instanceof Error ? err.message : '未知错误'}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <ProjectListHeader search={search} selectedCount={selectedSystems.length} onSearchChange={setSearch} onDeleteSelected={handleDeleteSelectedProjects} onCreateProject={() => setDialogState({ mode: 'create-group', group: null, system: null })} />
      <main className="mx-auto max-w-[1280px] px-8 py-8">
        <section className="mb-6 flex items-end justify-between gap-6 border-b border-slate-300 pb-4">
          <div><h2 className="text-2xl font-extrabold text-slate-950">项目管理中心</h2></div>
          <div className="flex shrink-0 items-center gap-4"><div className="text-sm text-slate-500">共 {groups.length} 个项目组，{groups.flatMap((group) => group.systems).length} 个系统</div></div>
        </section>
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className={`grid ${projectListGrid} items-center gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500 sm:px-6`}>
            <label className="flex items-center justify-center" title="全选当前筛选结果"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFilteredProjects} disabled={filteredSystems.length === 0} className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500" /></label>
            <span>项目组 / 系统</span><span className="hidden lg:block">单位名称</span><span className="hidden lg:block">最后更新</span><span className="hidden lg:block text-center">资产数</span><span className="text-center">操作</span>
          </div>
          {loading ? <div className="px-6 py-14 text-center text-sm text-slate-500">正在加载项目列表...</div> : filteredGroups.length === 0 ? <div className="px-6 py-14 text-center text-sm text-slate-500">{search.trim() ? '没有找到匹配的项目组或系统' : '暂无项目组，请点击右上角“新建项目”创建。'}</div> : (
            <div>{filteredGroups.map((summary) => {
              const isSingleSystem = summary.systems.length === 1;
              const isExpanded = expandedGroupIds.has(summary.id);
              const group = summary.group;
              const renderSystemRow = (system: ProjectSummary, indented: boolean) => (
                <div key={system.id} className={`grid ${projectListGrid} items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50 sm:px-6`}>
                  <label className="flex items-center justify-center" title="选择系统"><input type="checkbox" checked={selectedProjectIds.has(system.id)} onChange={() => toggleProjectSelection(system.id)} className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500" /></label>
                  <div className={`min-w-0 ${indented ? 'border-l-2 border-blue-200 pl-3' : ''}`}><div className="break-words font-semibold text-slate-950">{getSystemDisplayName(system)}</div><div className="mt-1 text-xs leading-5 text-slate-500 lg:hidden">{system.meta.unitName || '未填写'} · {formatTime(system.updatedAt)} · {system.assetCount} 项资产</div></div>
                  <div className="hidden break-words leading-5 lg:block">{system.meta.unitName || '未填写'}</div><div className="hidden break-words leading-5 text-xs lg:block">{formatTime(system.updatedAt)}</div><div className="hidden text-center lg:block"><span className="inline-flex min-w-7 justify-center border border-blue-100 bg-blue-50 px-2 py-0.5 font-medium text-blue-700">{system.assetCount}</span></div>
                  <div className="flex justify-end gap-2"><button onClick={() => onOpenProject(system.id)} className={`${actionButton} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>打开</button><div className="hidden 2xl:flex 2xl:gap-2"><button onClick={() => setDialogState({ mode: 'edit-system', group, system })} className={`${actionButton} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>编辑</button><button onClick={() => void handleExportSystem(system)} className={`${actionButton} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>导出数据包</button><button onClick={() => setImportTargetId(system.id)} className={`${actionButton} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>导入数据包</button><button onClick={() => void handleDeleteSystem(system)} className={`${actionButton} border-red-200 bg-white text-red-600 hover:bg-red-50`}>删除</button></div><details className="relative 2xl:hidden"><summary className={`${actionButton} cursor-pointer list-none border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>更多操作</summary><div className="absolute right-0 z-20 mt-2 grid w-36 gap-1 border border-slate-300 bg-white p-1 shadow-lg"><button onClick={() => setDialogState({ mode: 'edit-system', group, system })} className="min-h-11 px-3 text-left text-sm text-slate-700 hover:bg-slate-100">编辑</button><button onClick={() => void handleExportSystem(system)} className="min-h-11 px-3 text-left text-sm text-slate-700 hover:bg-slate-100">导出数据包</button><button onClick={() => setImportTargetId(system.id)} className="min-h-11 px-3 text-left text-sm text-slate-700 hover:bg-slate-100">导入数据包</button><button onClick={() => void handleDeleteSystem(system)} className="min-h-11 px-3 text-left text-sm text-red-600 hover:bg-red-50">删除</button></div></details></div>
                </div>
              );

              if (isSingleSystem) {
                return renderSystemRow(summary.systems[0], false);
              }

              return <div key={summary.id} className="border-b border-slate-200 last:border-b-0">
                <div className="flex items-center gap-3 bg-slate-50 px-6 py-3">
                  <button onClick={() => toggleGroup(summary.id)} className="flex h-7 w-7 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-100" title={isExpanded ? '折叠系统列表' : '展开系统列表'}>{isExpanded ? '−' : '+'}</button>
                  <div className="min-w-0 flex-1"><div className="break-words font-bold text-slate-900">{getGroupDisplayName(summary)}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>编号：{group?.projectCode || summary.systems[0]?.meta.projectCode || '未填写'}</span><span>单位：{group?.unitName || summary.systems[0]?.meta.unitName || '未填写'}</span><span>日期：{group?.reportDate || summary.systems[0]?.meta.reportDate || '未填写'}</span><span>{summary.systems.length} 个系统</span></div></div>
                  {group && <div className="flex shrink-0 flex-wrap justify-end gap-2"><button onClick={() => setDialogState({ mode: 'add-system', group, system: null })} className={`${actionButton} border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100`}>添加系统</button><button onClick={() => setDialogState({ mode: 'edit-group', group, system: null })} className={`${actionButton} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>编辑项目组</button><button onClick={() => void handleDeleteGroup(summary)} className={`${actionButton} border-red-200 bg-white text-red-600 hover:bg-red-50`}>删除项目组</button></div>}
                </div>
                {isExpanded && <div>{summary.systems.map((system) => renderSystemRow(system, true))}</div>}
              </div>;
            })}</div>
          )}
        </section>
      </main>
      <ProjectGroupDialog open={!!dialogState} mode={dialogState?.mode ?? 'create-group'} group={dialogState?.group ?? null} system={dialogState?.system?.meta ?? null} onClose={() => { if (!saving) setDialogState(null); }} onSave={handleSaveDialog} />
      <ImportDialog isOpen={!!importTargetId} targetProjectName={importTarget ? `${getGroupDisplayName(groups.find((group) => group.id === importTarget.groupId) ?? { id: 'ungrouped', group: null, systems: [importTarget] })} / ${getSystemDisplayName(importTarget)}` : '未知系统'} onClose={() => setImportTargetId(null)} onImportOverwrite={(file, password) => importIntoSystem(file, password, 'overwrite')} onImportMerge={(file, password) => importIntoSystem(file, password, 'merge')} />
      {dialog}
    </div>
  );
};

export default ProjectList;
