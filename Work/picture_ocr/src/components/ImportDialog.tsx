import React, { useEffect, useState, useRef } from 'react';
import { isEvidencePackageFile } from '../utils/evidencePackage';

interface ImportDialogProps {
  isOpen: boolean;
  targetProjectName: string;
  onClose: () => void;
  onImportOverwrite: (file: File, password: string) => Promise<boolean | void>;
  onImportMerge: (file: File, password: string) => Promise<boolean | void>;
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

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPassword('');
      setImporting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async (mode: 'overwrite' | 'merge') => {
    if (!selectedFile) return;
    setImporting(true);

    let shouldClose = false;
    try {
      const success = mode === 'overwrite'
        ? await onImportOverwrite(selectedFile, password)
        : await onImportMerge(selectedFile, password);
      if (success === false) return;
      shouldClose = true;
      onClose();
    } catch (err) {
      alert(`导入失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setImporting(false);
      if (shouldClose) {
        setSelectedFile(null);
      }
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (!importing) onClose(); }}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-800 mb-1">导入数据包</h2>
        <p className="mb-4 text-sm text-gray-500">目标项目：<span className="font-medium text-slate-800">{targetProjectName}</span></p>

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
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {selectedFile && (
          <div className="mb-4 p-2 bg-gray-50 rounded text-sm text-gray-600 truncate">
            已选择：{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
          </div>
        )}

        {selectedFile && isEvidencePackageFile(selectedFile) && (
          <label className="mb-4 block text-sm text-gray-600">加密采集包密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={importing} className="mt-2 block w-full border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none" />
          </label>
        )}

        {/* Mode selection */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => handleImport('overwrite')}
            disabled={!selectedFile || (isEvidencePackageFile(selectedFile) && !password) || importing}
            className="px-4 py-3 text-sm rounded-lg border-2 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="font-semibold">覆盖导入</div>
            <div className="text-xs mt-1 opacity-70">替换当前全部数据</div>
          </button>
          <button
            onClick={() => handleImport('merge')}
            disabled={!selectedFile || (isEvidencePackageFile(selectedFile) && !password) || importing}
            className="px-4 py-3 text-sm rounded-lg border-2 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="font-semibold">合并导入</div>
            <div className="text-xs mt-1 opacity-70">按资产合并去重</div>
          </button>
        </div>

        {importing && (
          <div className="text-center text-sm text-blue-600 mb-4">
            正在导入数据，请稍候...
          </div>
        )}

        <button
          onClick={onClose}
          disabled={importing}
          className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default ImportDialog;
