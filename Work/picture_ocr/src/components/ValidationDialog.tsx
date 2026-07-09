import React from 'react';
import type { ValidationMissing } from '../utils/wordExport';

interface ValidationDialogProps {
  isOpen: boolean;
  missing: ValidationMissing[];
  onContinue: () => void;
  onCancel: () => void;
}

const ValidationDialog: React.FC<ValidationDialogProps> = ({
  isOpen,
  missing,
  onContinue,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-lg font-bold text-gray-800">必填项缺失提醒</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            以下 {missing.length} 个必填检查项尚未上传截图，请确认是否继续导出：
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">分类</th>
                <th className="pb-2 font-medium">资产</th>
                <th className="pb-2 font-medium">检查项</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 text-gray-700">{item.categoryName}</td>
                  <td className="py-2 text-gray-700">{item.assetName}</td>
                  <td className="py-2 text-red-600">{item.itemLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-6 pt-3 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            返回补充
          </button>
          <button
            onClick={onContinue}
            className="px-4 py-2 text-sm text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
          >
            继续导出
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidationDialog;
