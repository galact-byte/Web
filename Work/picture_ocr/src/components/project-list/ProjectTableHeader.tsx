import React from 'react';
import { PROJECT_TABLE_GRID_CLASS } from './projectListUi';

interface ProjectTableHeaderProps {
  allSelected: boolean;
  disabled: boolean;
  onToggleAll: () => void;
}

const ProjectTableHeader: React.FC<ProjectTableHeaderProps> = ({ allSelected, disabled, onToggleAll }) => {
  return (
    <div className={`${PROJECT_TABLE_GRID_CLASS} border-b border-slate-200 bg-white px-6 py-3 text-xs font-semibold text-slate-500`}>
      <label className="flex items-center justify-center" title="全选当前筛选结果">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          disabled={disabled}
          className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      </label>
      <span>项目</span>
      <span>单位名称</span>
      <span>系统名称</span>
      <span className="text-center">资产数</span>
      <span className="text-center">操作</span>
    </div>
  );
};

export default ProjectTableHeader;
