import React from 'react';
import type { ProjectSummary } from '../../types';
import { PROJECT_TABLE_GRID_CLASS } from './projectListUi';

interface ProjectTableRowProps {
  project: ProjectSummary;
  selected: boolean;
  displayName: string;
  updatedAtLabel: string;
  onToggleSelected: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onExport: () => void;
  onImport: () => void;
  onDelete: () => void;
}

const actionButtonBase = 'inline-flex h-9 min-w-[72px] items-center justify-center gap-1.5 border px-2.5 text-xs transition-colors';

const ProjectTableRow: React.FC<ProjectTableRowProps> = ({
  project,
  selected,
  displayName,
  updatedAtLabel,
  onToggleSelected,
  onOpen,
  onEdit,
  onExport,
  onImport,
  onDelete,
}) => {
  return (
    <div className={`${PROJECT_TABLE_GRID_CLASS} min-h-[76px] border-b border-slate-200 bg-white px-6 py-3 text-sm text-slate-700 last:border-b-0 hover:bg-slate-50`}> 
      <label className="flex items-center justify-center" title="选择项目">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      </label>

      <div className="min-w-0">
        <div className="break-words text-sm font-semibold leading-5 text-slate-950">{displayName}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>编号：{project.meta.projectCode || '未填写'}</span>
          <span>更新：{updatedAtLabel}</span>
        </div>
      </div>

      <div className="break-words leading-5 text-slate-700">{project.meta.unitName || '未填写'}</div>
      <div className="break-words leading-5 text-slate-700">{project.meta.systemName || '未填写'}</div>
      <div className="text-center">
        <span className="inline-flex min-w-7 justify-center border border-blue-100 bg-blue-50 px-2 py-0.5 text-sm font-medium text-blue-700">
          {project.assetCount}
        </span>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onOpen} className={`${actionButtonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14m-3-7H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2" />
          </svg>
          打开
        </button>
        <button onClick={onEdit} className={`${actionButtonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4L16.5 3.5z" />
          </svg>
          编辑
        </button>
        <button onClick={onExport} className={`${actionButtonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v10m0 0l-4-4m4 4l4-4M5 20h14" />
          </svg>
          导出
        </button>
        <button onClick={onImport} className={`${actionButtonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V10m0 0l-4 4m4-4l4 4M5 4h14" />
          </svg>
          导入
        </button>
        <button onClick={onDelete} className={`${actionButtonBase} border-red-200 bg-white text-red-600 hover:bg-red-50`} title="删除项目">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.8 12.1A2 2 0 0116.2 21H7.8a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
          </svg>
          删除
        </button>
      </div>
    </div>
  );
};

export default ProjectTableRow;
