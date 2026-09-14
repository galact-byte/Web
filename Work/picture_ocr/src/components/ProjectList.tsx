import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ProjectDocument, ProjectGroup, ProjectGroupSummary, ProjectMeta, ProjectSummary } from '../types';
import {
  createProjectGroupWithSystems,
  createSystemForGroup,
  createProjectDocument,
  splitSystemNames,
  deleteProject,
  deleteProjectGroup,
  getLastSummaryRepairReport,
  migrateInlineImages,
  listProjectGroups,
  loadProject,
  saveProject,
  saveProjectWithImages,
  hydrateProjectImages,
  updateProjectGroupAndSystems,
} from '../utils/db';
import { exportDataPackage, importDataPackage, importEncryptedDataPackage } from '../utils/exportImport';
import { isEvidencePackageFile } from '../utils/evidencePackage';
import { compressProjectImages } from '../utils/imageCompression';
import { claimSummaryRepairNotice } from '../utils/summaryRepair';
import { formatBytes } from '../utils/storageEstimate';
import ImportDialog from './ImportDialog';
import StorageSettingsDialog from './StorageSettingsDialog';
import ProjectListHeader from './project-list/ProjectListHeader';
import ProjectActions, { type ProjectListAction } from './project-list/ProjectActions';
import { GROUP_LIST_GRID, SYSTEM_LIST_GRID, LIST_ACTION_CLASS as actionButton } from './project-list/projectListUi';
import { splitProjectViews, filterGroups, filterSystems, selectedVisibleSystems, listLocationKey, groupUpdatedAt, type ProjectListLocation, type ProjectListViewState } from './project-list/projectListViews';
import ProjectGroupDialog, { type ProjectGroupDialogMode } from './project-list/ProjectGroupDialog';
import { useConfirmDialog } from './ConfirmDialog';
import { useToast } from './Toast';
interface ProjectListProps {
  viewState: ProjectListViewState;
  onViewStateChange: React.Dispatch<React.SetStateAction<ProjectListViewState>>;
  onOpenProject: (projectId: string, isNewProject?: boolean) => void;
  /** 启动项目组级手机局域网采集（仅在桌面/Web ZIP 存在桥时由 App 传入）。 */
  onStartLanCollector?: (groupId: string | null, groupTitle: string, systemIds: string[]) => void;
}

interface DialogState {
  mode: ProjectGroupDialogMode;
  group: ProjectGroup | null;
  system: ProjectSummary | null;
}


function getSystemDisplayName(project: ProjectSummary): string {
  return project.meta.systemName.trim() || '未命名系统';
}

function getGroupDisplayName(summary: ProjectGroupSummary): string {
  const group = summary.group;
  if (!group) return summary.systems[0]?.meta.projectName.trim() || '项目组记录缺失';
  return group.projectName.trim() || group.unitName.trim() || '未命名项目组';
}

function formatTime(timestamp: number): string {
  return timestamp
    ? new Date(timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '-';
}

const ProjectList: React.FC<ProjectListProps> = ({ viewState, onViewStateChange, onOpenProject, onStartLanCollector }) => {
  const [groups, setGroups] = useState<ProjectGroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoredLocationRef = useRef<string | null>(null);
  const { projects, independent } = useMemo(() => splitProjectViews(groups), [groups]);
  const location = viewState.location ?? (projects.length === 0 && independent.length > 0 ? { kind: 'independent' as const } : { kind: 'groups' as const });
  const locationKey = listLocationKey(location);
  const search = viewState.positions[locationKey]?.search ?? '';
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(() => new Set());
  const [importTargetId, setImportTargetId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);
  const [storageSettingsOpen, setStorageSettingsOpen] = useState(false);
  const [compressingSystemId, setCompressingSystemId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmDialog();
  const showToast = useToast();

  // 桌面版：启动时若自定义数据目录不可用已回退默认，提示一次。
  useEffect(() => {
    if (!window.evidenceData) return;
    void window.evidenceData.getLocation()
      .then((location) => { if (location.startupWarning) showToast(location.startupWarning, 'error'); })
      .catch(() => { /* 忽略 */ });
  }, [showToast]);

  const refreshProjects = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const nextGroups = await listProjectGroups();
      setGroups(nextGroups);
      setLoaded(true);
      const availableIds = new Set(nextGroups.flatMap(summary => summary.systems.map(system => system.id)));
      setSelectedProjectIds(current => new Set([...current].filter(id => availableIds.has(id))));
      // 存储自检的结果必须让用户知道：被找回的项目、以及读不出来的坏记录都不能静默处理。
      const repair = getLastSummaryRepairReport();
      if (repair && claimSummaryRepairNotice(repair)) {
        if (repair.repaired > 0) {
          showToast(`存储自检：已找回 ${repair.repaired} 个未显示的项目。`, 'success');
        }
        if (repair.damagedIds.length > 0) {
          showToast(`存储自检：有 ${repair.damagedIds.length} 条项目记录读不出内容，请到「存储设置→导出诊断包」发给技术支持。`, 'error');
        }
      }
    } catch (err) {
      const message = `加载项目列表失败：${err instanceof Error ? err.message : '未知错误'}`;
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshProjects(); }, []);

  // 存量图片后台搬迁：只在列表页（没打开项目时）跑，避开编辑中的自动保存；
  // 延迟启动让首屏列表先渲染完，逐项目事务 + 进度可续跑，中途关窗不会损坏数据。
  useEffect(() => {
    const timer = setTimeout(() => {
      void migrateInlineImages().then((report) => {
        if (report.migrated > 0) {
          showToast(`已优化 ${report.migrated} 个系统的图片存储，之后拍照保存会快很多。`, 'success');
        }
      }).catch(() => { /* 搬迁失败不影响使用，错误已进诊断包 */ });
    }, 3000);
    return () => clearTimeout(timer);
  }, [showToast]);

  const activeGroup = location.kind === 'group' ? projects.find(summary => summary.id === location.groupId) : undefined;
  const filteredGroups = useMemo(() => filterGroups(projects, search), [projects, search]);
  const filteredSystems = useMemo(() => filterSystems(location.kind === 'independent' ? independent : activeGroup?.systems ?? [], search), [location.kind, independent, activeGroup, search]);
  const selectedSystems = useMemo(() => selectedVisibleSystems(filteredSystems, selectedProjectIds), [filteredSystems, selectedProjectIds]);
  const allFilteredSelected = filteredSystems.length > 0 && filteredSystems.every((system) => selectedProjectIds.has(system.id));
  const importTarget = groups.flatMap((group) => group.systems).find((system) => system.id === importTargetId);

  const getImportTargetName = (system: ProjectSummary): string => {
    const parentGroup = system.groupId ? groups.find((group) => group.id === system.groupId)?.group : null;
    return parentGroup ? `${getGroupDisplayName({ id: parentGroup.id, group: parentGroup, systems: [] })} / ${getSystemDisplayName(system)}` : getSystemDisplayName(system);
  };

  const navigate = (nextLocation: ProjectListLocation, clearSearch = false) => {
    setSelectedProjectIds(new Set());
    onViewStateChange(current => ({
      location: nextLocation,
      positions: {
        ...current.positions,
        [locationKey]: { search, scrollY: window.scrollY },
        ...(clearSearch ? { [listLocationKey(nextLocation)]: { search: '', scrollY: 0 } } : {}),
      },
    }));
    if (listLocationKey(nextLocation) === locationKey && clearSearch) window.scrollTo(0, 0);
  };

  const changeSearch = (value: string) => {
    setSelectedProjectIds(new Set());
    onViewStateChange(current => ({ ...current, location,
      positions: { ...current.positions, [locationKey]: { search: value, scrollY: 0 } },
    }));
  };

  const openSystem = (systemId: string) => {
    onViewStateChange(current => ({ ...current, location,
      positions: { ...current.positions, [locationKey]: { search, scrollY: window.scrollY } },
    }));
    onOpenProject(systemId);
  };

  useLayoutEffect(() => {
    if (!loaded || loading || loadError) return;
    if (location.kind === 'group' && !activeGroup) {
      setSelectedProjectIds(new Set());
      onViewStateChange(current => ({ ...current, location: { kind: 'groups' } }));
      return;
    }
    if (!viewState.location) onViewStateChange(current => ({ ...current, location }));
    if (restoredLocationRef.current !== locationKey) {
      restoredLocationRef.current = locationKey;
      headingRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, viewState.positions[locationKey]?.scrollY ?? 0);
    }
  }, [loaded, loading, loadError, location, locationKey, activeGroup, viewState, onViewStateChange]);

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
      showToast(`删除选中系统失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleDeleteSystem = async (system: ProjectSummary) => {
    if (!await confirm({ title: '删除系统', message: `确定要删除系统“${getSystemDisplayName(system)}”吗？\n\n此操作会删除该系统的所有资产、检查项和截图，且不可撤销。`, confirmText: '删除系统', tone: 'danger' })) return;
    try {
      await deleteProject(system.id);
      setSelectedProjectIds((current) => { const next = new Set(current); next.delete(system.id); return next; });
      await refreshProjects();
    } catch (err) {
      showToast(`删除系统失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
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
      showToast(`删除项目组失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleExportSystem = async (system: ProjectSummary) => {
    try {
      const document = await loadProject(system.id);
      if (!document) { showToast('导出失败：系统不存在或已被删除', 'error'); return; }
      await exportDataPackage(document.meta, document.categories, document.assets, document.id);
    } catch (err) {
      showToast(`导出失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleCompressSystem = async (system: ProjectSummary) => {
    if (compressingSystemId) return;
    const ok = await confirm({
      title: '压缩现有图片',
      message: `将把系统“${getSystemDisplayName(system)}”中已存的图片就地压缩变小（长边 1920px、保持清晰），用于加快返回项目和导出报告。\n\n此操作会改写已存图片且不可撤销，导出报告的清晰度基本不变。是否继续？`,
      confirmText: '开始压缩',
      tone: 'default',
    });
    if (!ok) return;
    setCompressingSystemId(system.id);
    try {
      const document = await loadProject(system.id);
      if (!document) { showToast('压缩失败：系统不存在或已被删除', 'error'); return; }
      // 字节在独立 store：先补齐再压缩，写回时由 saveProjectWithImages 重新拆回 images store。
      const result = await compressProjectImages(await hydrateProjectImages(document));
      if (result.changedCount > 0) {
        await saveProjectWithImages(result.doc);
        await refreshProjects();
      }
      if (result.changedCount === 0 && result.failedCount === 0) {
        showToast(`共扫描 ${result.total} 张，没有需要压缩的图片，所有图片都已足够小。`, 'info');
        return;
      }
      if (result.changedCount === 0) {
        showToast(`共扫描 ${result.total} 张，压缩失败：${result.failedCount} 张未能处理，原图已保留。`, 'error');
        return;
      }
      const failNote = result.failedCount > 0 ? `，另有 ${result.failedCount} 张未能处理已保留原图` : '';
      showToast(`共扫描 ${result.total} 张，压缩 ${result.changedCount} 张，节省 ${formatBytes(result.savedBytes)}${failNote}。`, 'success');
    } catch (err) {
      showToast(`压缩失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
    } finally {
      setCompressingSystemId(null);
    }
  };

  const importIntoSystem = async (file: File, password: string, mode: 'overwrite' | 'merge'): Promise<{ success: boolean; message: string }> => {
    if (!importTargetId) return { success: false, message: '导入失败：未指定目标系统' };
    try {
      const targetDocument = await loadProject(importTargetId);
      if (!targetDocument) return { success: false, message: '导入失败：目标系统不存在或已被删除' };
      const result = isEvidencePackageFile(file)
        ? await importEncryptedDataPackage(file, password, mode, targetDocument.assets, targetDocument.categories, targetDocument.meta)
        : await importDataPackage(file, mode, targetDocument.assets, targetDocument.categories, targetDocument.meta);
      if (!result.success || !result.data) return { success: false, message: result.message };
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
      await saveProjectWithImages(nextDocument);
      await refreshProjects();
      return { success: true, message: result.message };
    } catch (err) {
      return { success: false, message: `导入失败：${err instanceof Error ? err.message : '未知错误'}` };
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
      let createdLocation: ProjectListLocation | null = null;
      if (dialogState.mode === 'create-group') {
        const systemNames = splitSystemNames(values.systemName);
        if (systemNames.length === 1) {
          await saveProject(createProjectDocument({ ...values, systemName: systemNames[0] }));
          createdLocation = { kind: 'independent' };
        } else {
          const systems = await createProjectGroupWithSystems(values, systemNames);
          const groupId = systems[0]?.groupId;
          if (groupId) createdLocation = { kind: 'group', groupId };
        }
      } else if (dialogState.mode === 'add-system' && dialogState.group) {
        await createSystemForGroup(dialogState.group, values.systemName);
        createdLocation = { kind: 'group', groupId: dialogState.group.id };
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
        if (!document) { showToast('保存失败：目标系统不存在或已被删除', 'error'); return false; }
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
      if (createdLocation) navigate(createdLocation, true);
      setDialogState(null);
      return true;
    } catch (err) {
      showToast(`保存失败：${err instanceof Error ? err.message : '未知错误'}`, 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const systemActions = (system: ProjectSummary): ProjectListAction[] => [
    ...(onStartLanCollector ? [{ label: '手机采集', className: 'md:hidden', onClick: () => onStartLanCollector(system.groupId, getSystemDisplayName(system), [system.id]) }] : []),
    { label: '编辑', onClick: () => setDialogState({ mode: 'edit-system', group: activeGroup?.group ?? null, system }) },
    { label: '导出数据包', onClick: () => void handleExportSystem(system) },
    { label: compressingSystemId === system.id ? '正在压缩…' : '压缩图片', disabled: compressingSystemId !== null, onClick: () => void handleCompressSystem(system) },
    { label: '导入数据包', onClick: () => setImportTargetId(system.id) },
    { label: '删除', danger: true, onClick: () => void handleDeleteSystem(system) },
  ];
  const groupActions = (summary: ProjectGroupSummary): ProjectListAction[] => {
    const group = summary.group;
    return [
      ...(onStartLanCollector ? [{ label: '手机采集', className: 'md:hidden', disabled: summary.systems.length === 0,
        onClick: () => onStartLanCollector(summary.id, getGroupDisplayName(summary), summary.systems.map(system => system.id)) }] : []),
      ...(group ? [
        { label: '编辑项目组', onClick: () => setDialogState({ mode: 'edit-group', group, system: null }) },
        { label: '删除项目组', danger: true, onClick: () => void handleDeleteGroup(summary) },
      ] : []),
    ];
  };
  const isGroupList = location.kind === 'groups';
  const grid = isGroupList ? GROUP_LIST_GRID : SYSTEM_LIST_GRID;
  const realGroupCount = projects.filter(summary => summary.group).length;
  const orphanCount = projects.length - realGroupCount;
  const title = activeGroup ? getGroupDisplayName(activeGroup) : isGroupList ? '多系统项目' : '独立系统';
  const emptyMessage = search.trim() ? `没有找到匹配的${isGroupList ? '项目' : '系统'}`
    : isGroupList ? '暂无多系统项目，新建项目时填写多个系统名称即可创建。'
    : location.kind === 'group' ? '此项目暂无系统。' : '暂无独立系统，新建项目时填写一个系统名称即可创建。';

  return (
    <div className="min-h-screen bg-slate-100">
      <ProjectListHeader search={search} searchLabel={isGroupList ? '搜索项目或组内系统' : '搜索当前列表的系统'} showSelection={!isGroupList} selectedCount={selectedSystems.length} onSearchChange={changeSearch} onDeleteSelected={handleDeleteSelectedProjects} onCreateProject={() => setDialogState({ mode: 'create-group', group: null, system: null })} onOpenStorageSettings={() => setStorageSettingsOpen(true)} />
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8">
        <h2 className="mb-4 text-2xl font-bold text-slate-950">项目管理中心</h2>
        <nav aria-label="项目分类" className="mb-6 flex flex-wrap gap-2 border-b border-slate-300">
          <button type="button" aria-current={location.kind !== 'independent' ? 'page' : undefined} onClick={() => navigate({ kind: 'groups' })}
            className={`${actionButton} rounded-none border-x-0 border-t-0 border-b-2 ${location.kind !== 'independent' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}>
            多系统项目 <span className="ml-2 tabular-nums">{realGroupCount}</span>{orphanCount > 0 && <span className="ml-2 text-xs text-red-700">另有 {orphanCount} 个异常组</span>}
          </button>
          <button type="button" aria-current={location.kind === 'independent' ? 'page' : undefined} onClick={() => navigate({ kind: 'independent' })}
            className={`${actionButton} rounded-none border-x-0 border-t-0 border-b-2 ${location.kind === 'independent' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}>
            独立系统 <span className="ml-2 tabular-nums">{independent.length}</span>
          </button>
        </nav>
        <section aria-labelledby="project-list-title">
          {location.kind === 'group' && <button type="button" onClick={() => navigate({ kind: 'groups' })} className={`${actionButton} mb-3 border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>返回项目管理</button>}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 id="project-list-title" ref={headingRef} tabIndex={-1} className="break-words text-lg font-semibold text-slate-900 focus-visible:outline focus-visible:outline-blue-600">{title}</h3>
              {activeGroup && <p className="mt-1 break-words text-sm text-slate-600">{activeGroup.group?.unitName || activeGroup.systems[0]?.meta.unitName || '未填写单位'} · {activeGroup.systems.length} 个系统</p>}
              {activeGroup && !activeGroup.group && <p className="mt-2 text-sm text-red-700">项目组记录缺失，系统数据仍保留，可打开或导出系统。</p>}
            </div>
            {activeGroup && <div className="flex flex-wrap gap-2">
              {activeGroup.group && <button type="button" onClick={() => setDialogState({ mode: 'add-system', group: activeGroup.group, system: null })} className={`${actionButton} border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100`}>添加系统</button>}
              {onStartLanCollector && <button type="button" disabled={activeGroup.systems.length === 0} onClick={() => onStartLanCollector(activeGroup.id, title, activeGroup.systems.map(system => system.id))} className={`${actionButton} border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100`}>手机采集</button>}
              {activeGroup.group && <ProjectActions label={`${title}的项目操作`} actions={groupActions(activeGroup).filter(action => action.label !== '手机采集')} />}
            </div>}
          </div>
          {loadError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 border border-red-200 bg-red-50 p-4 text-red-800"><span>{loadError}{loaded ? '，下方保留上次成功加载的列表。' : ''}</span><button type="button" disabled={loading} onClick={() => void refreshProjects()} className={`${actionButton} border-red-300 bg-white`}>重试</button></div>}
          <div key={locationKey + search} aria-busy={loading} className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className={`grid ${grid} items-center gap-3 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 sm:px-4`}>
              {!isGroupList && <label className="flex min-h-11 items-center justify-center"><input aria-label="全选当前可见系统" type="checkbox" checked={allFilteredSelected} onChange={toggleAllFilteredProjects} disabled={filteredSystems.length === 0} className="h-4 w-4" /></label>}
              <span>{isGroupList ? '项目名称' : '系统名称'}</span><span className="hidden lg:block">单位名称</span><span className="hidden lg:block">最后更新</span><span className="hidden text-center lg:block">{isGroupList ? '系统数' : '资产数'}</span><span className="hidden text-right md:block">操作</span>
            </div>
            {!loaded ? <p className="px-6 py-12 text-center text-sm text-slate-600">{loading ? '正在加载项目列表…' : '列表尚未加载，请重试。'}</p>
              : (isGroupList ? filteredGroups.length : filteredSystems.length) === 0 ? <div className="px-6 py-12 text-center text-sm text-slate-600"><p>{emptyMessage}</p>{search.trim() && <button type="button" onClick={() => changeSearch('')} className={`${actionButton} mt-3 border-slate-300 text-slate-700 hover:bg-slate-100`}>清除搜索</button>}</div>
              : isGroupList ? filteredGroups.map(summary => (
                <div key={summary.id} data-group-id={summary.id} className={`grid ${GROUP_LIST_GRID} items-center gap-3 border-b border-slate-200 px-3 py-4 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50 sm:px-4`}>
                  <div className="min-w-0"><button type="button" onClick={() => navigate({ kind: 'group', groupId: summary.id })} className="min-h-11 break-words text-left font-semibold text-slate-950 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-blue-600">{getGroupDisplayName(summary)}</button>
                    {!summary.group && <p className="text-xs text-red-700">项目组记录缺失 · 系统数据仍保留</p>}
                    <p className="mt-1 break-words text-xs text-slate-600 lg:hidden">{summary.group?.unitName || summary.systems[0]?.meta.unitName || '未填写单位'} · {summary.systems.length} 个系统 · {formatTime(groupUpdatedAt(summary))}</p>
                  </div>
                  <span className="hidden break-words lg:block">{summary.group?.unitName || summary.systems[0]?.meta.unitName || '未填写'}</span>
                  <span className="hidden text-xs lg:block">{formatTime(groupUpdatedAt(summary))}</span><span className="hidden text-center tabular-nums lg:block">{summary.systems.length}</span>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => navigate({ kind: 'group', groupId: summary.id })} className={`${actionButton} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>进入项目</button>
                    {onStartLanCollector && <button type="button" disabled={summary.systems.length === 0} onClick={() => onStartLanCollector(summary.id, getGroupDisplayName(summary), summary.systems.map(system => system.id))} className={`${actionButton} hidden border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 md:inline-flex`}>手机采集</button>}
                    {groupActions(summary).length > 0 && <div className={!summary.group ? 'md:hidden' : undefined}><ProjectActions label={`${getGroupDisplayName(summary)}的项目操作`} actions={groupActions(summary)} /></div>}
                  </div>
                </div>
              )) : filteredSystems.map(system => (
                <div key={system.id} data-system-id={system.id} className={`grid ${SYSTEM_LIST_GRID} items-center gap-3 border-b border-slate-200 px-3 py-4 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50 sm:px-4`}>
                  <label className="flex min-h-11 items-center justify-center"><input aria-label={`选择${getSystemDisplayName(system)}`} type="checkbox" checked={selectedProjectIds.has(system.id)} onChange={() => toggleProjectSelection(system.id)} className="h-4 w-4" /></label>
                  <div className="min-w-0"><button type="button" onClick={() => openSystem(system.id)} className="min-h-11 break-words text-left font-semibold text-slate-950 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-blue-600">{getSystemDisplayName(system)}</button><p className="mt-1 break-words text-xs text-slate-600 lg:hidden">{system.meta.unitName || '未填写单位'} · {formatTime(system.updatedAt)} · {system.assetCount} 项资产</p></div>
                  <span className="hidden break-words lg:block">{system.meta.unitName || '未填写'}</span><span className="hidden text-xs lg:block">{formatTime(system.updatedAt)}</span><span className="hidden text-center tabular-nums lg:block">{system.assetCount}</span>
                  <div className="col-span-2 flex flex-wrap justify-end gap-2 md:col-span-1">
                    <button type="button" onClick={() => openSystem(system.id)} className={`${actionButton} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>打开</button>
                    {onStartLanCollector && <button type="button" onClick={() => onStartLanCollector(system.groupId, getSystemDisplayName(system), [system.id])} className={`${actionButton} hidden border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 md:inline-flex`}>手机采集</button>}
                    <ProjectActions label={`${getSystemDisplayName(system)}的系统操作`} actions={systemActions(system)} />
                  </div>
                </div>
              ))}
          </div>
        </section>
      </main>
      <ProjectGroupDialog open={!!dialogState} mode={dialogState?.mode ?? 'create-group'} group={dialogState?.group ?? null} system={dialogState?.system?.meta ?? null} onClose={() => { if (!saving) setDialogState(null); }} onSave={handleSaveDialog} />
      <ImportDialog isOpen={!!importTargetId} targetProjectName={importTarget ? getImportTargetName(importTarget) : '未知系统'} onClose={() => setImportTargetId(null)} onImportOverwrite={(file, password) => importIntoSystem(file, password, 'overwrite')} onImportMerge={(file, password) => importIntoSystem(file, password, 'merge')} />
      {storageSettingsOpen && <StorageSettingsDialog onClose={() => setStorageSettingsOpen(false)} />}
      {dialog}
    </div>
  );
};

export default ProjectList;
