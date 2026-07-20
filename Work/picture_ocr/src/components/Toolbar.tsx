import React from 'react';
import { useAppState } from '../context/AppContext';

interface ToolbarProps {
  onBackToProjects: () => void;
  onOpenProjectInfo: () => void;
  onExportWord: () => void;
  onManageTemplates: () => void;
  onOpenLanCollector?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onBackToProjects,
  onOpenProjectInfo,
  onExportWord,
  onManageTemplates,
  onOpenLanCollector,
}) => {
  const { meta } = useAppState();
  const projectTitle = meta.projectName.trim() || meta.systemName.trim() || '未命名项目';

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onBackToProjects}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7M8 12h13" />
          </svg>
          返回项目列表
        </button>
        <div className="h-7 w-px bg-slate-200" />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold text-slate-950">测评证据采集平台</h1>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-600">项目：{projectTitle}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onOpenLanCollector && <button
          onClick={onOpenLanCollector}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm text-sky-800 transition-colors hover:bg-sky-100"
        >
          手机局域网采集
        </button>}
        <button
          onClick={onManageTemplates}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
          </svg>
          模板管理
        </button>
        <button
          onClick={onExportWord}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
          报告
        </button>
        <button
          onClick={onOpenProjectInfo}
          className="inline-flex items-center gap-1.5 rounded-[2px] border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 transition-colors hover:bg-amber-100"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />
          </svg>
          项目信息
        </button>
      </div>
    </header>
  );
};

export default Toolbar;
