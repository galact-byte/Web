import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppState, useDispatch } from '../context/AppContext';
import { getAssetById } from '../context/appReducer';
import { getImageFilesFromClipboard, readImageFiles } from '../utils/imageFiles';
import ItemCard from './ItemCard';

interface DragOverlayState {
  label: string;
  sortIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ItemDragState {
  pointerId: number;
  sourceItemId: string;
  startX: number;
  startY: number;
  handle: HTMLButtonElement;
  hasDragged: boolean;
  previewItemIds: string[] | null;
  overlayOffsetX: number;
  overlayOffsetY: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

const ITEM_AUTO_SCROLL_EDGE_PX = 80;
const ITEM_AUTO_SCROLL_MAX_SPEED_PX = 18;

function isTextEditingElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

const ContentArea: React.FC = () => {
  const { assets, activeAssetId, categories } = useAppState();
  const dispatch = useDispatch();
  const [newItemLabel, setNewItemLabel] = useState('');
  const [pasteTargetItemId, setPasteTargetItemId] = useState<string | null>(null);
  const [isSortingItems, setIsSortingItems] = useState(false);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [previewItemIds, setPreviewItemIds] = useState<string[] | null>(null);
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null);
  const dragStateRef = useRef<ItemDragState | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const previewItemIdsRef = useRef<string[] | null>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const itemListRef = useRef<HTMLDivElement>(null);
  const itemRectsRef = useRef(new Map<string, DOMRect>());
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollPointerRef = useRef<PointerPosition | null>(null);
  const isSortingItemsRef = useRef(isSortingItems);
  isSortingItemsRef.current = isSortingItems;

  const activeAsset = activeAssetId ? getAssetById(assets, activeAssetId) : undefined;
  const activeAssetRef = useRef(activeAsset);
  activeAssetRef.current = activeAsset;
  const activeCategory = activeAsset
    ? categories.find((category) => category.id === activeAsset.categoryId)
    : undefined;

  const captureItemRects = useCallback(() => {
    const nextRects = new Map<string, DOMRect>();
    itemListRef.current?.querySelectorAll<HTMLElement>('[data-item-id]').forEach((element) => {
      const itemId = element.dataset.itemId;
      if (itemId) nextRects.set(itemId, element.getBoundingClientRect());
    });
    itemRectsRef.current = nextRects;
  }, []);

  const setPreviewOrder = useCallback((nextItemIds: string[] | null) => {
    captureItemRects();
    previewItemIdsRef.current = nextItemIds;
    setPreviewItemIds(nextItemIds);
  }, [captureItemRects]);

  const updateSortPreviewForPointer = useCallback((currentDrag: ItemDragState, clientX: number, clientY: number) => {
    const currentAsset = activeAssetRef.current;
    if (!currentAsset) return;

    const target = Array.from(itemListRef.current?.querySelectorAll<HTMLElement>('[data-item-id]') ?? [])
      .find((candidate) => {
        if (candidate.dataset.itemId === currentDrag.sourceItemId) return false;
        const bounds = candidate.getBoundingClientRect();
        return clientX >= bounds.left
          && clientX <= bounds.right
          && clientY >= bounds.top
          && clientY <= bounds.bottom;
      });
    const targetItemId = target?.dataset.itemId;
    if (!target || !targetItemId) return;

    const targetBounds = target.getBoundingClientRect();
    const placeAfter = clientY > targetBounds.top + targetBounds.height / 2;
    const nextItemIds = currentAsset.items
      .map((item) => item.id)
      .filter((currentItemId) => currentItemId !== currentDrag.sourceItemId);
    const targetIndex = nextItemIds.indexOf(targetItemId);
    if (targetIndex < 0) return;

    nextItemIds.splice(targetIndex + (placeAfter ? 1 : 0), 0, currentDrag.sourceItemId);
    if (!currentDrag.previewItemIds || nextItemIds.some((id, index) => id !== currentDrag.previewItemIds?.[index])) {
      currentDrag.previewItemIds = nextItemIds;
      setPreviewOrder(nextItemIds);
    }
  }, [setPreviewOrder]);

  const stopItemAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    autoScrollPointerRef.current = null;
  }, []);

  const getItemAutoScrollSpeed = useCallback((pointer: PointerPosition): number => {
    const main = mainContentRef.current;
    if (!main) return 0;

    const bounds = main.getBoundingClientRect();
    if (pointer.x < bounds.left || pointer.x > bounds.right) return 0;
    const edgeSize = Math.min(ITEM_AUTO_SCROLL_EDGE_PX, bounds.height / 3);
    if (edgeSize <= 0) return 0;

    if (pointer.y >= bounds.top && pointer.y < bounds.top + edgeSize) {
      const intensity = 1 - (pointer.y - bounds.top) / edgeSize;
      return -Math.max(2, Math.round(ITEM_AUTO_SCROLL_MAX_SPEED_PX * intensity));
    }
    if (pointer.y <= bounds.bottom && pointer.y > bounds.bottom - edgeSize) {
      const intensity = 1 - (bounds.bottom - pointer.y) / edgeSize;
      return Math.max(2, Math.round(ITEM_AUTO_SCROLL_MAX_SPEED_PX * intensity));
    }
    return 0;
  }, []);

  const updateItemAutoScroll = useCallback((pointer: PointerPosition) => {
    autoScrollPointerRef.current = pointer;
    if (getItemAutoScrollSpeed(pointer) === 0) {
      stopItemAutoScroll();
      return;
    }
    if (autoScrollFrameRef.current !== null) return;

    const continueScrolling = () => {
      autoScrollFrameRef.current = null;
      const currentDrag = dragStateRef.current;
      const currentPointer = autoScrollPointerRef.current;
      const main = mainContentRef.current;
      if (!currentDrag?.hasDragged || !currentPointer || !main || !isSortingItemsRef.current) {
        stopItemAutoScroll();
        return;
      }

      const speed = getItemAutoScrollSpeed(currentPointer);
      const maximumScrollTop = Math.max(0, main.scrollHeight - main.clientHeight);
      const nextScrollTop = Math.min(maximumScrollTop, Math.max(0, main.scrollTop + speed));
      if (speed === 0 || nextScrollTop === main.scrollTop) {
        stopItemAutoScroll();
        return;
      }

      main.scrollTop = nextScrollTop;
      updateSortPreviewForPointer(currentDrag, currentPointer.x, currentPointer.y);
      autoScrollFrameRef.current = window.requestAnimationFrame(continueScrolling);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(continueScrolling);
  }, [getItemAutoScrollSpeed, stopItemAutoScroll, updateSortPreviewForPointer]);

  const clearItemDrag = useCallback(() => {
    stopItemAutoScroll();
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    dragStateRef.current = null;
    setDragItemId(null);
    setDragOverlay(null);
    setPreviewOrder(null);
  }, [setPreviewOrder, stopItemAutoScroll]);

  useEffect(() => {
    setPasteTargetItemId(null);
    setIsSortingItems(false);
    clearItemDrag();
    return clearItemDrag;
  }, [activeAsset?.id, clearItemDrag]);

  useEffect(() => {
    if (pasteTargetItemId && !activeAsset?.items.some((item) => item.id === pasteTargetItemId)) {
      setPasteTargetItemId(null);
    }
    if (dragItemId && !activeAsset?.items.some((item) => item.id === dragItemId)) {
      clearItemDrag();
    }
  }, [activeAsset?.items, clearItemDrag, dragItemId, pasteTargetItemId]);

  useLayoutEffect(() => {
    const previousRects = itemRectsRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    itemListRef.current?.querySelectorAll<HTMLElement>('[data-item-id]').forEach((element) => {
      const itemId = element.dataset.itemId;
      const previousRect = itemId ? previousRects.get(itemId) : undefined;
      const nextRect = element.getBoundingClientRect();
      if (!previousRect || reduceMotion) return;

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (deltaX === 0 && deltaY === 0) return;
      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
      );
    });
  }, [previewItemIds]);

  useEffect(() => {
    if (isSortingItems) return;

    const handleWindowPaste = async (event: ClipboardEvent) => {
      const currentAsset = activeAssetRef.current;
      if (!currentAsset || !pasteTargetItemId) return;
      if (isTextEditingElement(document.activeElement)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const imageFiles = getImageFilesFromClipboard(event);
      if (imageFiles.length === 0) return;

      const targetItem = currentAsset.items.find((item) => item.id === pasteTargetItemId);
      if (!targetItem) return;

      event.preventDefault();
      const images = await readImageFiles(imageFiles);
      if (isSortingItemsRef.current) return;

      images.forEach((image) => {
        dispatch({
          type: 'ADD_IMAGE',
          payload: { assetId: currentAsset.id, itemId: targetItem.id, image },
        });
      });
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [dispatch, isSortingItems, pasteTargetItemId]);

  const handleSortHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>, itemId: string) => {
    if (!isSortingItems || !event.isPrimary || event.button !== 0) return;

    if (dragStateRef.current) clearItemDrag();
    event.preventDefault();
    const handle = event.currentTarget;
    const sourceCard = handle.closest<HTMLElement>('[data-item-id]');
    const sourceBounds = sourceCard?.getBoundingClientRect();
    if (!sourceBounds) return;

    const dragState: ItemDragState = {
      pointerId: event.pointerId,
      sourceItemId: itemId,
      startX: event.clientX,
      startY: event.clientY,
      handle,
      hasDragged: false,
      previewItemIds: null,
      overlayOffsetX: event.clientX - sourceBounds.left,
      overlayOffsetY: event.clientY - sourceBounds.top,
    };
    dragStateRef.current = dragState;

    const finishDrag = (shouldCommit: boolean) => {
      stopItemAutoScroll();
      const currentDrag = dragStateRef.current;
      if (currentDrag && currentDrag.pointerId === event.pointerId) {
        const currentAsset = activeAssetRef.current;
        const previewIds = currentDrag.previewItemIds;
        if (
          shouldCommit
          && currentDrag.hasDragged
          && currentAsset
          && previewIds
          && previewIds.some((itemId, index) => itemId !== currentAsset.items[index]?.id)
        ) {
          dispatch({
            type: 'REORDER_ITEMS',
            payload: { assetId: currentAsset.id, itemIds: previewIds },
          });
        }
        dragStateRef.current = null;
      }

      if (handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      dragCleanupRef.current = null;
      setDragItemId(null);
      setDragOverlay(null);
      setPreviewOrder(null);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag || currentDrag.pointerId !== moveEvent.pointerId) return;

      const movedDistance = Math.hypot(
        moveEvent.clientX - currentDrag.startX,
        moveEvent.clientY - currentDrag.startY
      );
      if (movedDistance < 8) return;

      const currentAsset = activeAssetRef.current;
      const sourceItem = currentAsset?.items.find((item) => item.id === currentDrag.sourceItemId);
      if (!currentAsset || !sourceItem) return;
      if (!currentDrag.hasDragged) {
        currentDrag.hasDragged = true;
        currentDrag.handle.setPointerCapture(currentDrag.pointerId);
      }

      setDragItemId(currentDrag.sourceItemId);
      setDragOverlay({
        label: sourceItem.label,
        sortIndex: currentAsset.items.findIndex((item) => item.id === sourceItem.id) + 1,
        x: moveEvent.clientX - currentDrag.overlayOffsetX,
        y: moveEvent.clientY - currentDrag.overlayOffsetY,
        width: sourceBounds.width,
        height: sourceBounds.height,
      });
      updateSortPreviewForPointer(currentDrag, moveEvent.clientX, moveEvent.clientY);
      updateItemAutoScroll({ x: moveEvent.clientX, y: moveEvent.clientY });
      moveEvent.preventDefault();
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId === event.pointerId) finishDrag(true);
    };

    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === event.pointerId) finishDrag(false);
    };

    dragCleanupRef.current = () => finishDrag(false);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  };

  if (!activeAssetId || !activeAsset) {
    return (
      <main className="flex flex-1 items-center justify-center bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]">
        <div className="text-center text-gray-400">
          <svg className="mx-auto mb-4 h-16 w-16 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-base">请从左侧选择一个资产查看检查项</p>
        </div>
      </main>
    );
  }

  const handleAddItem = () => {
    if (!newItemLabel.trim()) return;
    dispatch({
      type: 'ADD_ITEM',
      payload: { assetId: activeAsset.id, label: newItemLabel.trim() },
    });
    setNewItemLabel('');
  };

  const enterSortingMode = () => {
    setPasteTargetItemId(null);
    clearItemDrag();
    setIsSortingItems(true);
  };

  const exitSortingMode = () => {
    clearItemDrag();
    setIsSortingItems(false);
  };

  const visibleItems = previewItemIds
    ? previewItemIds
      .map((itemId) => activeAsset.items.find((item) => item.id === itemId))
      .filter((item): item is (typeof activeAsset.items)[number] => !!item)
    : activeAsset.items;

  return (
    <main ref={mainContentRef} className="flex-1 overflow-y-auto bg-slate-100 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="mb-8">
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-950">{activeAsset.name}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-base text-slate-600">
            {activeCategory && (
              <span className="inline-flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7v10a2 2 0 002 2h10a2 2 0 002-2V7M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                </svg>
                {activeCategory.name}
              </span>
            )}
            <span>·</span>
            <span>总计 {activeAsset.items.length} 项检查</span>
            <span>·</span>
            <span className="text-red-500">{activeAsset.items.filter((item) => item.required).length} 项必填</span>
          </div>
          {!isSortingItems && !pasteTargetItemId && (
            <p className="mt-3 text-sm text-amber-600">请先选择粘贴目标，再按 Ctrl+V 粘贴截图。</p>
          )}
        </div>

        <div className="sticky top-0 z-10 mb-6 border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          {isSortingItems ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-950">检查项排序</h3>
                <p className="text-sm text-slate-600" role="status" aria-live="polite">
                  按住右侧六点手柄，移至另一项后再松开；普通编辑、上传和粘贴操作已暂时关闭。
                </p>
              </div>
              <button
                type="button"
                onClick={exitSortingMode}
                className="min-h-11 bg-blue-600 px-5 text-base text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                完成排序
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newItemLabel}
                onChange={(event) => setNewItemLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAddItem();
                }}
                placeholder="添加自定义检查项..."
                className="min-h-11 min-w-0 flex-1 border border-gray-300 px-3 text-base focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!newItemLabel.trim()}
                className="inline-flex min-h-11 items-center gap-1.5 bg-blue-600 px-5 text-base text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                添加
              </button>
              <button
                type="button"
                onClick={enterSortingMode}
                className="min-h-11 border border-slate-300 bg-white px-4 text-base text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                调整顺序
              </button>
            </div>
          )}
        </div>

        {activeAsset.items.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-sm">暂无检查项，请在上方添加</p>
          </div>
        ) : (
          <div ref={itemListRef} className={`space-y-6 ${isSortingItems ? 'touch-manipulation' : ''}`}>
            {visibleItems.map((item, index) => (
              <ItemCard
                key={item.id}
                item={item}
                sortIndex={index + 1}
                assetId={activeAsset.id}
                isSorting={isSortingItems}
                isDragSource={item.id === dragItemId}
                onSortHandlePointerDown={handleSortHandlePointerDown}
                isPasteTarget={!isSortingItems && item.id === pasteTargetItemId}
                onSelectPasteTarget={isSortingItems ? undefined : setPasteTargetItemId}
                onRename={(itemId, newLabel) =>
                  dispatch({
                    type: 'RENAME_ITEM',
                    payload: { assetId: activeAsset.id, itemId, newLabel },
                  })
                }
                onRemove={(itemId) =>
                  dispatch({
                    type: 'REMOVE_ITEM',
                    payload: { assetId: activeAsset.id, itemId },
                  })
                }
                onToggleRequired={(itemId) =>
                  dispatch({
                    type: 'TOGGLE_REQUIRED',
                    payload: { assetId: activeAsset.id, itemId },
                  })
                }
                onAddImage={(assetId, itemId, image) =>
                  dispatch({
                    type: 'ADD_IMAGE',
                    payload: { assetId, itemId, image },
                  })
                }
                onRemoveImage={(assetId, itemId, imageId) =>
                  dispatch({
                    type: 'REMOVE_IMAGE',
                    payload: { assetId, itemId, imageId },
                  })
                }
                onUpdateCaption={(assetId, itemId, imageId, caption) =>
                  dispatch({
                    type: 'UPDATE_IMAGE_CAPTION',
                    payload: { assetId, itemId, imageId, caption },
                  })
                }
                onReorderImages={(assetId, itemId, imageIds) =>
                  dispatch({
                    type: 'REORDER_IMAGES',
                    payload: { assetId, itemId, imageIds },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
      {dragOverlay && (
        <div
          data-drag-overlay
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex items-center gap-4 border border-blue-500 bg-white px-4 py-3 text-slate-950 shadow-lg"
          style={{
            left: dragOverlay.x,
            top: dragOverlay.y,
            width: dragOverlay.width,
            height: dragOverlay.height,
            transform: 'rotate(1deg)',
          }}
        >
          <span className="w-8 text-center text-sm font-semibold text-slate-500">{dragOverlay.sortIndex}</span>
          <span className="min-w-0 flex-1 text-base font-bold leading-6">{dragOverlay.label}</span>
          <span className="flex min-h-11 min-w-11 items-center justify-center border border-slate-300 text-slate-700">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" />
            </svg>
          </span>
        </div>
      )}
    </main>
  );
};

export default ContentArea;
