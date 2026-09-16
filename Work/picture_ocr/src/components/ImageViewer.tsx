import React, { useEffect, useCallback, useRef, useState } from 'react';
import type { ImageData } from '../types';
import { useAppContext } from '../context/AppContext';
import { useImageSrc } from '../hooks/useImageSrc';

interface ImageViewerProps {
  images: ImageData[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  currentIndex,
  onClose,
  onNavigate,
}) => {
  const currentImage = images[currentIndex];
  const { projectId } = useAppContext();
  const src = useImageSrc(projectId, currentImage);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const resetView = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    setView({ scale: 1, x: 0, y: 0 });
  }, []);

  const constrain = useCallback((next: { scale: number; x: number; y: number }) => {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image || !viewport) return next;
    const maxX = Math.max(0, (image.offsetWidth * next.scale - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * next.scale - viewport.clientHeight) / 2);
    return { ...next, x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
  }, []);

  const zoom = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const viewport = viewportRef.current;
    if (!viewport || !imageRef.current?.naturalWidth) return;
    const rect = viewport.getBoundingClientRect();
    const anchorX = clientX === undefined ? 0 : clientX - rect.left - rect.width / 2;
    const anchorY = clientY === undefined ? 0 : clientY - rect.top - rect.height / 2;
    setView(previous => {
      const scale = Math.max(0.25, Math.min(5, previous.scale * factor));
      const ratio = scale / previous.scale;
      return constrain({ scale, x: anchorX - (anchorX - previous.x) * ratio, y: anchorY - (anchorY - previous.y) * ratio });
    });
  }, [constrain]);

  useEffect(() => {
    resetView();
  }, [currentImage?.id, src, resetView]);

  useEffect(() => {
    window.addEventListener('resize', resetView);
    return () => window.removeEventListener('resize', resetView);
  }, [resetView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // 原生非 passive 监听阻止页面随滚轮滚动，缩放只作用于预览图片。
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
      zoom(Math.exp(-Math.max(-200, Math.min(200, delta)) * 0.002), event.clientX, event.clientY);
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [zoom]);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, images.length, onNavigate]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (['Escape', 'ArrowLeft', 'ArrowRight', '+', '=', '-', '0'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        case 'ArrowRight':
          goNext();
          break;
        case '+':
        case '=':
          zoom(1.25);
          break;
        case '-':
          zoom(0.8);
          break;
        case '0':
          resetView();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, goPrev, goNext, zoom, resetView]);

  // Prevent body scroll while open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  if (!currentImage) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      className="fixed inset-0 z-50 overflow-hidden bg-black/80"
      onClick={onClose}
    >
      {/* Counter */}
      <div className="absolute top-4 left-4 text-white/70 text-sm bg-black/40 px-3 py-1 rounded-full">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Close button */}
      <button
        ref={closeRef}
        type="button"
        aria-label="关闭图片预览"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute z-10 top-4 right-4 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2.5 transition-colors"
        title="关闭 (ESC)"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Prev button */}
      {currentIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          type="button"
          aria-label="上一张"
          className="absolute z-10 left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-3 transition-colors"
          title="上一张 (←)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div ref={viewportRef} className="absolute inset-x-4 top-16 bottom-24 flex items-center justify-center overflow-hidden">
        {src ? (
          <img
            ref={imageRef}
            src={src}
            alt={currentImage.fileName}
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, cursor: view.scale > 1 ? dragging ? 'grabbing' : 'grab' : 'default', touchAction: view.scale > 1 ? 'none' : 'auto' }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => { e.stopPropagation(); resetView(); }}
            onPointerDown={(e) => {
              if (e.button !== 0 || view.scale <= 1 || dragRef.current) return;
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              const drag = dragRef.current;
              if (!drag || drag.id !== e.pointerId) return;
              const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
              drag.x = e.clientX; drag.y = e.clientY;
              setView(previous => constrain({ ...previous, x: previous.x + dx, y: previous.y + dy }));
            }}
            onPointerUp={(e) => {
              if (dragRef.current?.id !== e.pointerId) return;
              dragRef.current = null;
              setDragging(false);
              if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => { dragRef.current = null; setDragging(false); }}
            onLostPointerCapture={() => { dragRef.current = null; setDragging(false); }}
            draggable={false}
          />
        ) : (
          <div className="flex h-40 w-64 items-center justify-center rounded-lg bg-black/40 text-sm text-white/80">图片加载中…</div>
        )}
      </div>

      {/* Next button */}
      {currentIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          type="button"
          aria-label="下一张"
          className="absolute z-10 right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-3 transition-colors"
          title="下一张 (→)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Caption */}
      <div className="absolute bottom-4 inset-x-4 flex flex-col items-center gap-2 text-white text-sm pointer-events-none">
        {currentImage.caption && (
          <div className="bg-black/60 px-4 py-1 rounded-full max-w-full truncate">{currentImage.caption}</div>
        )}
        <p className="bg-black/60 px-3 py-1 rounded-full text-white/80 text-center">
          <span title="相对适应窗口的比例">{Math.round(view.scale * 100)}%</span>
          {' · 滚轮缩放 · 拖动查看 · 双击复位'}
        </p>
      </div>
    </div>
  );
};

export default ImageViewer;
