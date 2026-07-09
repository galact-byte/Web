import React, { useRef, useState, useCallback } from 'react';
import { getImageFilesFromClipboard } from '../utils/imageFiles';

interface UploadZoneProps {
  onImageFiles: (files: File[]) => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onImageFiles }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imageFiles.length > 0) {
        onImageFiles(imageFiles);
      }
    },
    [onImageFiles]
  );

  // Click to select
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Clipboard paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles = getImageFilesFromClipboard(e);
      if (imageFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        onImageFiles(imageFiles);
      }
    },
    [onImageFiles]
  );

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      className={`
        flex h-44 w-44 flex-shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center
        transition-all duration-150
        ${isDragOver
          ? 'border-blue-400 bg-blue-50 shadow-sm'
          : 'border-gray-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <svg
        className={`mb-3 h-9 w-9 transition-colors ${
          isDragOver ? 'text-blue-500' : 'text-slate-400'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <p className="text-sm font-medium text-slate-700">
        {isDragOver ? '松开鼠标上传' : '点击此处后'}
      </p>
      {!isDragOver && (
        <>
          <p className="mt-1 text-sm text-slate-600">按 <kbd className="rounded border bg-white px-1 py-0.5 text-xs">Ctrl+V</kbd> 粘贴</p>
          <p className="mt-2 text-xs text-slate-400">或拖拽到这里上传</p>
        </>
      )}
    </div>
  );
};

export default UploadZone;
