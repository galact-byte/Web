import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectSummary, ProjectDocument } from '../types';
import { createProjectDocument, deleteProject, listProjects, loadProject, saveProject } from '../utils/db';
import { exportDataPackage, importDataPackage } from '../utils/exportImport';
import ImportDialog from './ImportDialog';

interface ProjectListProps {
  onOpenProject: (projectId: string, isNewProject?: boolean) => void;
}

function getProjectDisplayName(project: ProjectSummary): string {
  return project.meta.projectName.trim() || project.meta.systemName.trim() || project.meta.unitName.trim() || '未命名项目';
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function matchesSearch(project: ProjectSummary, keyword: string): boolean {
  const text = [
    project.meta.projectCode,
    project.meta.projectName,
    project.meta.unitName,
    project.meta.systemName,
  ].join(' ').toLowerCase();
  return text.includes(keyword.trim().toLowerCase());
}

const ProjectList: React.FC<ProjectListProps> = ({ onOpenProject }) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importTargetId, setImportTargetId] = useState<string | null>(null);

  const refreshProjects = async () => {
    setLoading(true);
    try {
      setProjects(await listProjects());
    } catch (err) {
      alert(`加载项目列表失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    return projects.filter((project) => matchesSearch(project, search));
  }, [projects, search]);

  const handleCreateProject = async () => {
    try {
      const doc = createProjectDocument();
      await saveProject(doc);
      await refreshProjects();
      onOpenProject(doc.id, true);
    } catch (err) {
      alert(`创建项目失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleDeleteProject = async (project: ProjectSummary) => {
    if (!window.confirm(`确定要删除“${getProjectDisplayName(project)}”吗？此操作不可撤销。`)) return;
    try {
      await deleteProject(project.id);
      await refreshProjects();
    } catch (err) {
      alert(`删除项目失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const handleExportProject = async (project: ProjectSummary) => {
    try {
      const doc = await loadProject(project.id);
      if (!doc) {
        alert('导出失败：项目不存在或已被删除');
        return;
      }
      await exportDataPackage(doc.meta, doc.categories, doc.assets);
    } catch (err) {
      alert(`导出失败：${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const importIntoProject = async (file: File, mode: 'overwrite' | 'merge'): Promise<boolean> => {
    if (!importTargetId) return false;
    const targetDoc = await loadProject(importTargetId);
    if (!targetDoc) {
      alert('导入失败：目标项目不存在或已被删除');
      return false;
    }

    const result = await importDataPackage(
      file,
      mode,
      targetDoc.assets,
      targetDoc.categories,
      targetDoc.meta
    );
    if (!result.success || !result.data) {
      alert(result.message);
      return false;
    }

    const nextDoc: ProjectDocument = {
      id: targetDoc.id,
      meta: result.data.meta,
      categories: result.data.categories,
      assets: result.data.assets,
      createdAt: targetDoc.createdAt,
      updatedAt: Date.now(),
    };
    await saveProject(nextDoc);
    await refreshProjects();
    alert(result.message);
    return true;
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-8 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">测评证据采集工具</h1>
            <p className="mt-1 text-sm text-slate-500">请选择项目开始采集，或新建一个项目。</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索项目编号、名称、单位或系统"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-80"
            />
            <button
              onClick={handleCreateProject}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              新建项目
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.2fr_1.1fr_1.1fr_0.7fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-600">
            <span>项目</span>
            <span>单位名称</span>
            <span>系统名称</span>
            <span>资产数</span>
            <span className="text-right">操作</span>
          </div>

          {loading ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">正在加载项目列表...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              {search.trim() ? '没有找到匹配的项目' : '暂无项目，请点击“新建项目”开始。'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="grid grid-cols-[1.2fr_1.1fr_1.1fr_0.7fr_1fr] gap-4 px-5 py-4 text-sm text-slate-700 transition-colors hover:bg-blue-50/40"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{getProjectDisplayName(project)}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>编号：{project.meta.projectCode || '未填写'}</span>
                      <span>更新：{formatTime(project.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="truncate self-center">{project.meta.unitName || '未填写'}</div>
                  <div className="truncate self-center">{project.meta.systemName || '未填写'}</div>
                  <div className="self-center">{project.assetCount}</div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => onOpenProject(project.id)}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      打开
                    </button>
                    <button
                      onClick={() => handleExportProject(project)}
                      className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                    >
                      导出数据包
                    </button>
                    <button
                      onClick={() => setImportTargetId(project.id)}
                      className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      导入数据包
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project)}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <ImportDialog
        isOpen={!!importTargetId}
        onClose={() => setImportTargetId(null)}
        onImportOverwrite={(file) => importIntoProject(file, 'overwrite')}
        onImportMerge={(file) => importIntoProject(file, 'merge')}
      />
    </div>
  );
};

export default ProjectList;
