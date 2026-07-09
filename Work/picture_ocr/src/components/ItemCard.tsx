import React, { useState, useCallback } from 'react';
import { genId } from '../context/appReducer';
import type { CheckItem, ImageData } from '../types';
import UploadZone from './UploadZone';
import ImageThumbnail from './ImageThumbnail';
import ImageViewer from './ImageViewer';

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
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.label);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [dragImageId, setDragImageId] = useState<string | null>(null);

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
    (files: File[]) => {
      files.forEach((file) => {
        if (file.size > 5 * 1024 * 1024) {
          console.warn(`图片过大 (${(file.size / 1024 / 1024).toFixed(1)}MB): ${file.name}`);
        }
        const reader = new FileReader();
        reader.onload = () => {
          const image: ImageData = {
            id: genId(),
            fileName: file.name,
            data: reader.result as string,
            caption: '',
            uploadedAt: new Date().toISOString(),
          };
          onAddImage(assetId, item.id, image);
        };
        reader.readAsDataURL(file);
      });
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
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 hover:border-gray-300 transition-colors">
      {/* Item header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span
            className={`mt-0.5 flex-shrink-0 inline-block w-2 h-2 rounded-full ${
              item.required ? 'bg-red-400' : 'bg-gray-300'
            }`}
            title={item.required ? '必填' : '选填'}
          />
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
              className="flex-1 text-base border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
          ) : (
            <span className="text-base text-gray-800 leading-6">{item.label}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onToggleRequired(item.id)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              item.required
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
            title={item.required ? '点击设为选填' : '点击设为必填'}
          >
            {item.required ? '必填' : '选填'}
          </button>
          <button
            onClick={handleStartEdit}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="重命名"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (window.confirm('确定要删除该检查项吗？')) {
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
        </div>
      </div>

      {/* Image management */}
      <div className="space-y-3">
        {/* Upload zone */}
        <UploadZone onImageFiles={(files) => handleImageFiles(files)} />

        {/* Image thumbnails grid */}
        {item.images.length > 0 && (
          <div className="flex flex-wrap gap-3">
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
          </div>
        )}
      </div>

      {/* Image viewer */}
      {viewerIndex !== null && (
        <ImageViewer
          images={item.images}
          currentIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onNavigate={(index) => setViewerIndex(index)}
        />
      )}

      {/* Summary line */}
      {item.images.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>已上传 {item.images.length} 张图片</span>
        </div>
      )}
    </div>
  );
};

export default ItemCard;
