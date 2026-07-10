import React, { useEffect, useState } from 'react';
import { useAppState, useDispatch } from '../context/AppContext';
import { getAssetById } from '../context/appReducer';
import { getImageFilesFromClipboard, readImageFiles } from '../utils/imageFiles';
import ItemCard from './ItemCard';

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

  const activeAsset = activeAssetId ? getAssetById(assets, activeAssetId) : undefined;
  const activeCategory = activeAsset
    ? categories.find((c) => c.id === activeAsset.categoryId)
    : undefined;

  useEffect(() => {
    setPasteTargetItemId(null);
  }, [activeAsset?.id]);

  useEffect(() => {
    if (pasteTargetItemId && !activeAsset?.items.some((item) => item.id === pasteTargetItemId)) {
      setPasteTargetItemId(null);
    }
  }, [activeAsset?.items, pasteTargetItemId]);

  useEffect(() => {
    const handleWindowPaste = async (event: ClipboardEvent) => {
      if (!activeAsset || !pasteTargetItemId) return;
      if (isTextEditingElement(document.activeElement)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const imageFiles = getImageFilesFromClipboard(event);
      if (imageFiles.length === 0) return;

      const targetItem = activeAsset.items.find((item) => item.id === pasteTargetItemId);
      if (!targetItem) return;

      event.preventDefault();
      const images = await readImageFiles(imageFiles);
      images.forEach((image) => {
        dispatch({
          type: 'ADD_IMAGE',
          payload: { assetId: activeAsset.id, itemId: targetItem.id, image },
        });
      });
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [activeAsset, pasteTargetItemId, dispatch]);

  if (!activeAssetId || !activeAsset) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]">
        <div className="text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  return (
    <main className="flex-1 overflow-y-auto bg-slate-100 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="mx-auto max-w-6xl px-8 py-8">
        {/* Asset header */}
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
            <span className="text-red-500">{activeAsset.items.filter((i) => i.required).length} 项必填</span>
          </div>
          {!pasteTargetItemId && <p className="mt-3 text-sm text-amber-600">请先选择粘贴目标，再按 Ctrl+V 粘贴截图。</p>}
        </div>

        {/* Add item */}
        <div className="sticky top-0 z-10 mb-6 border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newItemLabel}
              onChange={(e) => setNewItemLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddItem();
              }}
              placeholder="添加自定义检查项..."
              className="flex-1 border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleAddItem}
              disabled={!newItemLabel.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-base bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加
            </button>
          </div>

        </div>

        {/* Check items */}
        {activeAsset.items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">暂无检查项，请在下方添加</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeAsset.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                assetId={activeAsset.id}
                isPasteTarget={item.id === pasteTargetItemId}
                onSelectPasteTarget={(itemId) => setPasteTargetItemId(itemId)}
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
    </main>
  );
};

export default ContentArea;
