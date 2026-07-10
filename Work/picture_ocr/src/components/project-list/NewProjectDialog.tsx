import React, { useEffect, useState } from 'react';
import type { ProjectMeta } from '../../types';

interface NewProjectDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  form: ProjectMeta;
  onFormChange: (form: ProjectMeta) => void;
  onClose: () => void;
  onSave: () => Promise<boolean>;
}

const inputClass = 'w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

const NewProjectDialog: React.FC<NewProjectDialogProps> = ({ open, title, description, confirmLabel, form, onFormChange, onClose, onSave }) => {
  const [errors, setErrors] = useState<{ unitName?: string; systemName?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setErrors({});
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    const nextErrors = {
      unitName: form.unitName.trim() ? undefined : '请填写单位名称',
      systemName: form.systemName.trim() ? undefined : '请填写系统名称',
    };
    setErrors(nextErrors);
    if (nextErrors.unitName || nextErrors.systemName) return;

    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" onClick={() => { if (!saving) onClose(); }}>
      <div className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">项目编号（选填）</label>
            <input className={inputClass} value={form.projectCode} onChange={(event) => onFormChange({ ...form, projectCode: event.target.value })} placeholder="例：HJ-2026-001" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">项目名称（选填）</label>
            <input className={inputClass} value={form.projectName} onChange={(event) => onFormChange({ ...form, projectName: event.target.value })} placeholder="例：XX系统等保测评" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">单位名称 <span className="text-red-600">*</span></label>
            <input className={`${inputClass} ${errors.unitName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`} value={form.unitName} onChange={(event) => { setErrors((current) => ({ ...current, unitName: undefined })); onFormChange({ ...form, unitName: event.target.value }); }} placeholder="例：XX科技有限公司" aria-invalid={!!errors.unitName} />
            {errors.unitName && <p className="mt-1 text-xs text-red-600">{errors.unitName}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">系统名称 <span className="text-red-600">*</span></label>
            <input className={`${inputClass} ${errors.systemName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`} value={form.systemName} onChange={(event) => { setErrors((current) => ({ ...current, systemName: undefined })); onFormChange({ ...form, systemName: event.target.value }); }} placeholder="例：XX业务系统" aria-invalid={!!errors.systemName} />
            {errors.systemName && <p className="mt-1 text-xs text-red-600">{errors.systemName}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">日期（选填）</label>
            <input type="date" className={inputClass} value={form.reportDate} onChange={(event) => onFormChange({ ...form, reportDate: event.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} disabled={saving} className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">取消</button>
          <button onClick={() => void handleSave()} disabled={saving} className="border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? '保存中...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default NewProjectDialog;
