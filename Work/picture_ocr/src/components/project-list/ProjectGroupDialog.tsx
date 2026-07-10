import React, { useEffect, useState } from 'react';
import type { ProjectGroup, ProjectMeta } from '../../types';
import { createDefaultMeta } from '../../data/defaults';

export type ProjectGroupDialogMode = 'create-group' | 'add-system' | 'edit-group' | 'edit-system';

interface ProjectGroupDialogProps {
  open: boolean;
  mode: ProjectGroupDialogMode;
  group: ProjectGroup | null;
  system: ProjectMeta | null;
  onClose: () => void;
  onSave: (values: {
    projectCode: string;
    projectName: string;
    unitName: string;
    reportDate: string;
    systemName: string;
  }) => Promise<boolean>;
}

interface FormValues {
  projectCode: string;
  projectName: string;
  unitName: string;
  reportDate: string;
  systemName: string;
}

const inputClass = 'w-full border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

function createForm(group: ProjectGroup | null, system: ProjectMeta | null): FormValues {
  return {
    projectCode: group?.projectCode ?? system?.projectCode ?? '',
    projectName: group?.projectName ?? system?.projectName ?? '',
    unitName: group?.unitName ?? system?.unitName ?? '',
    reportDate: group?.reportDate ?? system?.reportDate ?? createDefaultMeta().reportDate,
    systemName: system?.systemName ?? '',
  };
}

const ProjectGroupDialog: React.FC<ProjectGroupDialogProps> = ({ open, mode, group, system, onClose, onSave }) => {
  const [form, setForm] = useState<FormValues>(() => createForm(group, system));
  const [errors, setErrors] = useState<{ unitName?: string; systemName?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(createForm(group, system));
      setErrors({});
      setSaving(false);
    }
  }, [open, group, system]);

  if (!open) return null;

  const isAddingSystem = mode === 'add-system';
  const isEditingGroup = mode === 'edit-group';
  const isGroupedSystemOnly = mode === 'edit-system' && !!group;
  const isSystemOnly = isAddingSystem || isGroupedSystemOnly;
  const title = mode === 'create-group' ? '新建项目' : isAddingSystem ? '添加系统' : isEditingGroup ? '编辑项目组信息' : '编辑系统信息';

  const handleSave = async () => {
    const unitName = form.unitName.trim();
    const systemName = form.systemName.trim();
    const nextErrors = {
      unitName: unitName ? undefined : '请填写单位名称',
      systemName: isEditingGroup || systemName ? undefined : '请填写系统名称',
    };
    setErrors(nextErrors);
    if (nextErrors.unitName || nextErrors.systemName) return;

    setSaving(true);
    try {
      const saved = await onSave({
        ...form,
        projectCode: form.projectCode.trim(),
        projectName: form.projectName.trim(),
        unitName,
        systemName,
      });
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4" onClick={() => { if (!saving) onClose(); }}>
      <div className="w-full max-w-lg border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        <div className="space-y-4 px-6 py-5">
          {!isSystemOnly && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">项目编号（选填）</label>
                <input className={inputClass} value={form.projectCode} onChange={(event) => setForm({ ...form, projectCode: event.target.value })} placeholder="例：HJ-2026-001" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">项目名称（选填）</label>
                <input className={inputClass} value={form.projectName} onChange={(event) => setForm({ ...form, projectName: event.target.value })} placeholder="例：XX煤矿等保测评" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">单位名称 <span className="text-red-600">*</span></label>
                <input className={`${inputClass} ${errors.unitName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`} value={form.unitName} onChange={(event) => { setErrors((current) => ({ ...current, unitName: undefined })); setForm({ ...form, unitName: event.target.value }); }} aria-invalid={!!errors.unitName} />
                {errors.unitName && <p className="mt-1 text-xs text-red-600">{errors.unitName}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">日期（选填）</label>
                <input type="date" className={inputClass} value={form.reportDate} onChange={(event) => setForm({ ...form, reportDate: event.target.value })} />
              </div>
            </>
          )}
          {!isEditingGroup && <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{mode === 'create-group' ? '系统名称（可填写多个）' : '系统名称'} <span className="text-red-600">*</span></label>
            <input className={`${inputClass} ${errors.systemName ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`} value={form.systemName} onChange={(event) => { setErrors((current) => ({ ...current, systemName: undefined })); setForm({ ...form, systemName: event.target.value }); }} placeholder={mode === 'create-group' ? '例：生产调度系统、安全监控系统、人员定位系统' : '例：生产调度系统'} aria-invalid={!!errors.systemName} />
            {errors.systemName && <p className="mt-1 text-xs text-red-600">{errors.systemName}</p>}
          </div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} disabled={saving} className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">取消</button>
          <button onClick={() => void handleSave()} disabled={saving} className="border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? '保存中...' : '保存'}</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectGroupDialog;
