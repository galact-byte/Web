import React, { useState } from 'react';
import type { ImageData } from '../types';
import { useConfirmDialog } from './ConfirmDialog';

interface ImageThumbnailProps {
  image: ImageData;
  onRemove: (imageId: string) => void;
  onClick: (imageId: string) => void;
  onUpdateCaption: (imageId: string, caption: string) => void;
  onDragStart?: (e: React.DragEvent, imageId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, imageId: string) => void;
}

const ImageThumbnail: React.FC<ImageThumbnailProps> = ({
  image,
  onRemove,
  onClick,
  onUpdateCaption,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionValue, setCaptionValue] = useState(image.caption);
  const { confirm, dialog } = useConfirmDialog();

  const handleFinishCaption = () => {
    if (captionValue.trim() !== image.caption) {
      onUpdateCaption(image.id, captionValue.trim());
    }
    setEditingCaption(false);
  };

  return (
    <div
      className="relative group"
      draggable
      onDragStart={(e) => onDragStart?.(e, image.id)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.(e, image.id);
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative h-40 w-40 overflow-hidden border border-slate-200 bg-slate-50 p-1 cursor-pointer"
        onClick={() => onClick(image.id)}
      >
        <img
          src={image.data}
          alt={image.fileName}
          className="h-full w-full object-cover"
          draggable={false}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(image.id);
            }}
            className="p-1.5 bg-white/90 rounded-full hover:bg-white transition-colors"
            title="放大查看"
          >
            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const confirmed = await confirm({
                title: '删除图片',
                message: `确定要删除这张图片吗？\n\n文件：${image.fileName || '未命名图片'}\n此操作不可撤销。`,
                confirmText: '删除图片',
                tone: 'danger',
              });
              if (confirmed) {
                onRemove(image.id);
              }
            }}
            className="p-1.5 bg-white/90 rounded-full hover:bg-white transition-colors"
            title="删除"
          >
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Image count badge */}
        {image.fileName && (
          <span className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
            {image.fileName.split('.').pop()?.toUpperCase()}
          </span>
        )}
      </div>

      {dialog}

      {/* Caption */}
      <div className="mt-2 max-w-40">
        {editingCaption ? (
          <input
            type="text"
            value={captionValue}
            onChange={(e) => setCaptionValue(e.target.value)}
            onBlur={handleFinishCaption}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishCaption();
              if (e.key === 'Escape') setEditingCaption(false);
            }}
            className="w-full rounded border border-blue-300 px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
            autoFocus
            placeholder="添加备注..."
          />
        ) : (
          <p
            className="truncate text-sm text-slate-700 cursor-pointer hover:text-slate-950"
            onClick={() => {
              setCaptionValue(image.caption);
              setEditingCaption(true);
            }}
            title={image.caption || '点击添加备注'}
          >
            {image.caption || '添加备注...'}
          </p>
        )}
      </div>
    </div>
  );
};

export default ImageThumbnail;
