import React, { useEffect, useState, useRef } from 'react';
import { isEvidencePackageFile } from '../utils/evidencePackage';

interface ImportResultInfo {
  success: boolean;
  message: string;
}

interface ImportDialogProps {
  isOpen: boolean;
  targetProjectName: string;
  onClose: () => void;
  onImportOverwrite: (file: File, password: string) => Promise<ImportResultInfo>;
  onImportMerge: (file: File, password: string) => Promise<ImportResultInfo>;
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  targetProjectName,
  onClose,
  onImportOverwrite,
  onImportMerge,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResultInfo | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPassword('');
      setImporting(false);
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async (mode: 'overwrite' | 'merge') => {
    if (!selectedFile || importing) return;
    setImporting(true);
    setResult(null);
    try {
      const info = mode === 'overwrite'
        ? await onImportOverwrite(selectedFile, password)
        : await onImportMerge(selectedFile, password);
      setResult(info);
    } catch (err) {
      setResult({ success: false, message: `导入失败：${err instanceof Error ? err.message : '未知错误'}` });
    } finally {
      setImporting(false);
    }
  };

  const isEncrypted = selectedFile ? isEvidencePackageFile(selectedFile) : false;
  const disableActions = !selectedFile || (isEncrypted && !password) || importing;
  const showSuccess = result?.success === true;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="import-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!importing) onClose(); }}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="import-dialog-title" className="text-lg font-bold text-gray-800 mb-1">导入数据包</h2>
        <p className="mb-4 text-sm text-gray-500">目标项目：<span className="font-medium text-slate-800">{targetProjectName}</span></p>

        {showSuccess ? (
          <div>
            <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">✓</span>
              <div><div className="font-semibold">导入完成</div><div className="mt-1 leading-5">{result?.message}</div></div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              完成
            </button>
          </div>
        ) : (
          <>
            {/* File selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-2">
                请选择 .zip 或 .evidence 数据包文件
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.evidence"
                onChange={handleFileChange}
                disabled={importing}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {selectedFile && (
              <div className="mb-4 p-2 bg-gray-50 rounded text-sm text-gray-600 truncate">
                已选择：{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}

            {selectedFile && isEncrypted && (
              <label className="mb-4 block text-sm text-gray-600">加密采集包密码
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={importing} className="mt-2 block w-full border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
              </label>
            )}

            {result && !result.success && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-700">
                {result.message}
              </div>
            )}

            {/* Mode selection */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => handleImport('overwrite')}
                disabled={disableActions}
                className="px-4 py-3 text-sm rounded-lg border-2 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="font-semibold">覆盖导入</div>
                <div className="text-xs mt-1 opacity-70">替换当前全部数据</div>
              </button>
              <button
                type="button"
                onClick={() => handleImport('merge')}
                disabled={disableActions}
                className="px-4 py-3 text-sm rounded-lg border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="font-semibold">合并导入</div>
                <div className="text-xs mt-1 opacity-70">按资产合并去重</div>
              </button>
            </div>

            {importing && (
              <div className="mb-4" role="status" aria-live="polite">
                <div className="mb-2 text-center text-sm text-blue-600">正在导入数据，请稍候...</div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-100 text-blue-500 progress-indeterminate" />
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              取消
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ImportDialog;
