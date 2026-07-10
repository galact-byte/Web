import React, { useState, useEffect } from 'react';
import type { ProjectMeta } from '../types';
import { useAppContext, useAppState } from '../context/AppContext';

interface ProjectInfoDialogProps {
  open: boolean;
  onClose: () => void;
}

const ProjectInfoDialog: React.FC<ProjectInfoDialogProps> = ({ open, onClose }) => {
  const { meta } = useAppState();
  const { updateProjectMeta } = useAppContext();
  const [form, setForm] = useState<ProjectMeta>({ ...meta });
  const [errors, setErrors] = useState<{ unitName?: string; systemName?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...meta });
      setErrors({});
    }
  }, [open, meta]);

  if (!open) return null;

  const handleSave = async () => {
    const unitName = form.unitName.trim();
    const systemName = form.systemName.trim();
    const nextErrors = {
      unitName: unitName ? undefined : '请填写单位名称',
      systemName: systemName ? undefined : '请填写系统名称',
    };
    setErrors(nextErrors);
    if (nextErrors.unitName || nextErrors.systemName) return;

    setSaving(true);
    try {
      await updateProjectMeta({
        ...form,
        projectCode: form.projectCode.trim(),
        projectName: form.projectName.trim(),
        unitName,
        systemName,
      });
      onClose();
    } catch (err) {
      alert(`保存项目信息失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">项目信息</h2>
          <p className="mt-1 text-sm text-gray-500">项目编号、项目名称和日期为选填项。</p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">项目编号（选填）</label>
            <input
              type="text"
              value={form.projectCode}
              onChange={(e) => setForm({ ...form, projectCode: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例：HJ-2026-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">项目名称（选填）</label>
            <input
              type="text"
              value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="例：XX系统等保测评"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">单位名称 <span className="text-red-600">*</span></label>
            <input
              type="text"
              value={form.unitName}
              onChange={(e) => { setErrors((current) => ({ ...current, unitName: undefined })); setForm({ ...form, unitName: e.target.value }); }}
              className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${errors.unitName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              placeholder="例：XX科技有限公司"
              aria-invalid={!!errors.unitName}
            />
            {errors.unitName && <p className="mt-1 text-xs text-red-600">{errors.unitName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">系统名称 <span className="text-red-600">*</span></label>
            <input
              type="text"
              value={form.systemName}
              onChange={(e) => { setErrors((current) => ({ ...current, systemName: undefined })); setForm({ ...form, systemName: e.target.value }); }}
              className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${errors.systemName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
              placeholder="例：XX业务系统"
              aria-invalid={!!errors.systemName}
            />
            {errors.systemName && <p className="mt-1 text-xs text-red-600">{errors.systemName}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期（选填）</label>
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
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectInfoDialog;
