import React, { useEffect, useState } from 'react';

interface EncryptedExportDialogProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  onExport: (password: string) => Promise<void>;
}

const EncryptedExportDialog: React.FC<EncryptedExportDialogProps> = ({ open, title = '导出加密采集包', onClose, onExport }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmation('');
      setError('');
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleExport = async () => {
    if (!password) return setError('请输入加密密码。');
    if (password !== confirmation) return setError('两次输入的密码不一致。');
    setSubmitting(true);
    setError('');
    try {
      await onExport(password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出加密采集包失败。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4" onClick={() => { if (!submitting) onClose(); }}>
      <div className="w-full max-w-md bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-700">设置密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" disabled={submitting} className="mt-1.5 w-full border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </label>
          <label className="block text-sm font-medium text-slate-700">确认密码
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" disabled={submitting} className="mt-1.5 w-full border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} disabled={submitting} className="border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">取消</button>
          <button onClick={() => void handleExport()} disabled={submitting} className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{submitting ? '正在加密...' : '导出 .evidence'}</button>
        </div>
      </div>
    </div>
  );
};

export default EncryptedExportDialog;
