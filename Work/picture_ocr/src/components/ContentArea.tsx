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
      <main className="flex-1 flex items-center justify-center bg-slate-50">
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
    <main className="flex-1 overflow-y-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Asset header */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-slate-900">{activeAsset.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-base text-slate-500">
            {activeCategory && <span>{activeCategory.name}</span>}
            <span>· 总计 {activeAsset.items.length} 个检查项</span>
            <span className="text-red-500">· {activeAsset.items.filter((i) => i.required).length} 个必填</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            先点击某个检查项卡片边缘设为粘贴目标，然后直接按 Ctrl+V 粘贴截图。
            {!pasteTargetItemId && <span className="ml-2 text-amber-600">当前还未选择粘贴目标。</span>}
          </p>
        </div>

        {/* Check items */}
        {activeAsset.items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">暂无检查项，请在下方添加</p>
          </div>
        ) : (
          <div className="space-y-5">
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

        {/* Add item */}
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <input
            type="text"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem();
            }}
            placeholder="添加自定义检查项..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleAddItem}
            disabled={!newItemLabel.trim()}
            className="px-5 py-2.5 text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            添加
          </button>
        </div>
      </div>
    </main>
  );
};

export default ContentArea;
