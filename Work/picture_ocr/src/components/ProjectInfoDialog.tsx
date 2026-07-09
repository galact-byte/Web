import React, { useState, useEffect } from 'react';
import type { ProjectMeta } from '../types';
import { useAppState, useDispatch } from '../context/AppContext';

interface ProjectInfoDialogProps {
  open: boolean;
  onClose: () => void;
}

const ProjectInfoDialog: React.FC<ProjectInfoDialogProps> = ({ open, onClose }) => {
  const { meta } = useAppState();
  const dispatch = useDispatch();
  const [form, setForm] = useState<ProjectMeta>({ ...meta });

  useEffect(() => {
    if (open) {
      setForm({ ...meta });
    }
  }, [open, meta]);

  if (!open) return null;

  const handleSave = () => {
    dispatch({ type: 'SET_META', payload: { ...form } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">项目信息</h2>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">项目名称</label>
            <input
              type="text"
              value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例：XX系统等保测评"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">被测单位名称</label>
            <input
              type="text"
              value={form.unitName}
              onChange={(e) => setForm({ ...form, unitName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例：XX科技有限公司"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">测评人员</label>
            <input
              type="text"
              value={form.evaluator}
              onChange={(e) => setForm({ ...form, evaluator: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="姓名"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">报告日期</label>
            <input
              type="date"
              value={form.reportDate}
              onChange={(e) => setForm({ ...form, reportDate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectInfoDialog;
