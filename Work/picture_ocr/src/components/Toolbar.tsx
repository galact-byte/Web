import React from 'react';

interface ToolbarProps {
  onOpenProjectInfo: () => void;
  onExportData: () => void;
  onImportData: () => void;
  onExportWord: () => void;
  onManageTemplates: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onOpenProjectInfo,
  onExportData,
  onImportData,
  onExportWord,
  onManageTemplates,
}) => {
  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
      <h1 className="text-lg font-bold text-gray-800">测评证据采集工具</h1>
      <div className="flex items-center gap-2">
        <button
          onClick={onImportData}
          className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-md hover:bg-green-100 border border-green-200 transition-colors"
        >
          导入数据包
        </button>
        <button
          onClick={onExportData}
          className="px-3 py-1.5 text-sm bg-orange-50 text-orange-700 rounded-md hover:bg-orange-100 border border-orange-200 transition-colors"
        >
          导出数据包
        </button>
        <button
          onClick={onManageTemplates}
          className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 border border-purple-200 transition-colors"
        >
          模板管理
        </button>
        <button
          onClick={onExportWord}
          className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-md hover:bg-red-100 border border-red-200 transition-colors"
        >
          导出Word报告
        </button>
        <button
          onClick={onOpenProjectInfo}
          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 border border-blue-200 transition-colors"
        >
          项目信息
        </button>
      </div>
    </header>
  );
};

export default Toolbar;
