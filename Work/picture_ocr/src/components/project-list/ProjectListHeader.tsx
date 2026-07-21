import React from 'react';

interface ProjectListHeaderProps {
  search: string;
  selectedCount: number;
  onSearchChange: (value: string) => void;
  onDeleteSelected: () => void;
  onCreateProject: () => void;
}

const ProjectListHeader: React.FC<ProjectListHeaderProps> = ({
  search,
  selectedCount,
  onSearchChange,
  onDeleteSelected,
  onCreateProject,
}) => {
  return (
    <header className="border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border-2 border-blue-600 text-blue-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l7 4v5c0 4.2-2.9 7.2-7 9-4.1-1.8-7-4.8-7-9V7l7-4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-blue-700">Evidence Workspace</h1>
            <p className="text-xs text-slate-500">测评证据采集工具</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 xl:flex-nowrap">
          <label className="flex h-11 min-w-0 basis-full items-center border border-slate-300 bg-slate-50 px-3 text-slate-500 focus-within:border-blue-400 focus-within:bg-white sm:basis-[16rem] sm:flex-1 xl:w-[320px] xl:flex-none">
            <svg className="mr-3 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.2-5.2M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search projects..."
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </label>
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            className="inline-flex h-11 min-w-[108px] items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            title="勾选项目后批量删除"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.8 12.1A2 2 0 0116.2 21H7.8a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
            </svg>
            删除选中{selectedCount > 0 ? ` ${selectedCount}` : ''}
          </button>
          <button
            onClick={onCreateProject}
            className="inline-flex h-11 min-w-[108px] items-center justify-center gap-2 border border-blue-300 bg-blue-50 px-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建项目
          </button>
        </div>
      </div>
    </header>
  );
};

export default ProjectListHeader;
