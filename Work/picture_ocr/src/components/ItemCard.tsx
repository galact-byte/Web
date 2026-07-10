import React, { useState, useCallback } from 'react';
import type { CheckItem, ImageData } from '../types';
import { readImageFiles } from '../utils/imageFiles';
import UploadZone from './UploadZone';
import ImageThumbnail from './ImageThumbnail';
import ImageViewer from './ImageViewer';
import { useConfirmDialog } from './ConfirmDialog';

interface ItemCardProps {
  item: CheckItem;
  assetId: string;
  onRename: (itemId: string, newLabel: string) => void;
  onRemove: (itemId: string) => void;
  onToggleRequired: (itemId: string) => void;
  onAddImage: (assetId: string, itemId: string, image: ImageData) => void;
  onRemoveImage: (assetId: string, itemId: string, imageId: string) => void;
  onUpdateCaption: (assetId: string, itemId: string, imageId: string, caption: string) => void;
  onReorderImages: (assetId: string, itemId: string, imageIds: string[]) => void;
  isPasteTarget?: boolean;
  onSelectPasteTarget?: (itemId: string) => void;
}

const ItemCard: React.FC<ItemCardProps> = ({
  item,
  assetId,
  onRename,
  onRemove,
  onToggleRequired,
  onAddImage,
  onRemoveImage,
  onUpdateCaption,
  onReorderImages,
  isPasteTarget = false,
  onSelectPasteTarget,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.label);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [dragImageId, setDragImageId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmDialog();

  const handleStartEdit = () => {
    setEditValue(item.label);
    setEditing(true);
  };

  const handleFinishEdit = () => {
    if (editValue.trim() && editValue.trim() !== item.label) {
      onRename(item.id, editValue.trim());
    }
    setEditing(false);
  };

  // ---- Image file handlers ----
  const handleImageFiles = useCallback(
    async (files: File[]) => {
      const images = await readImageFiles(files);
      images.forEach((image) => onAddImage(assetId, item.id, image));
    },
    [assetId, item.id, onAddImage]
  );

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragImageId || dragImageId === targetId) return;
      const ids = item.images.map((img) => img.id);
      const fromIdx = ids.indexOf(dragImageId);
      const toIdx = ids.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0) return;
      ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, dragImageId);
      onReorderImages(assetId, item.id, ids);
      setDragImageId(null);
    },
    [dragImageId, item.images, assetId, item.id, onReorderImages]
  );

  return (
    <div
      className={`relative overflow-hidden border bg-white shadow-sm transition-all
        ${isPasteTarget
          ? 'border-blue-400 ring-2 ring-blue-100 shadow-blue-100'
          : 'border-slate-200 hover:border-slate-300'
        }
      `}
      onClick={() => onSelectPasteTarget?.(item.id)}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1.5 ${item.required ? 'bg-red-500' : 'bg-slate-300'}`}
        title={item.required ? '必填项' : '选填项'}
      />
      {/* Item header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-8 py-5">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span
            className={`mt-0.5 flex-shrink-0 border px-2 py-0.5 text-xs font-semibold ${
              item.required ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
            title={item.required ? '必填' : '选填'}
          >
            {item.required ? '必填项' : '选填项'}
          </span>
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleFinishEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-full text-base border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                autoFocus
              />
            ) : (
              <span className="block text-base font-bold text-slate-950 leading-6">{item.label}</span>
            )}

          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleRequired(item.id);
            }}
            className={`px-3 py-1 text-sm rounded-[2px] transition-colors ${
              item.required
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
            title={item.required ? '点击设为选填' : '点击设为必填'}
          >
            {item.required ? '必填' : '选填'}
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleStartEdit();
            }}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="重命名"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={async (event) => {
              event.stopPropagation();
              const confirmed = await confirm({
                title: '删除检查项',
                message: `确定要删除“${item.label}”吗？\n\n该检查项下的截图也会被删除，此操作不可撤销。`,
                confirmText: '删除检查项',
                tone: 'danger',
              });
              if (confirmed) {
                onRemove(item.id);
              }
            }}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="删除"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <span className="px-2 py-1 text-lg leading-none text-slate-400" title="更多操作">⋮</span>
        </div>
      </div>

      {/* Image management */}
      <div className="px-8 py-6">
        {isPasteTarget && (
          <div className="mb-4 border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            当前粘贴目标：按 Ctrl+V 可直接粘贴截图到此检查项
          </div>
        )}

        <div className="flex flex-wrap items-start gap-4">
          {item.images.map((img) => (
            <ImageThumbnail
              key={img.id}
              image={img}
              onRemove={(imageId) => onRemoveImage(assetId, item.id, imageId)}
              onClick={(imageId) => {
                const idx = item.images.findIndex((i) => i.id === imageId);
                if (idx >= 0) setViewerIndex(idx);
              }}
              onUpdateCaption={(imageId, caption) =>
                onUpdateCaption(assetId, item.id, imageId, caption)
              }
              onDragStart={(_, imageId) => setDragImageId(imageId)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(_, targetId) => handleDrop(targetId)}
            />
          ))}
          <UploadZone onImageFiles={(files) => void handleImageFiles(files)} />
        </div>
      </div>

      {dialog}

      {/* Image viewer */}
      {viewerIndex !== null && (
        <ImageViewer
          images={item.images}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={(index) => setViewerIndex(index)}
        />
      )}


    </div>
  );
};

export default ItemCard;
