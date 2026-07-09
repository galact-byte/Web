import React, { useState } from 'react';
import { useAppState, useDispatch } from '../context/AppContext';
import { getAssetById } from '../context/appReducer';
import ItemCard from './ItemCard';

const ContentArea: React.FC = () => {
  const { assets, activeAssetId, categories } = useAppState();
  const dispatch = useDispatch();
  const [newItemLabel, setNewItemLabel] = useState('');

  const activeAsset = activeAssetId ? getAssetById(assets, activeAssetId) : undefined;
  const activeCategory = activeAsset
    ? categories.find((c) => c.id === activeAsset.categoryId)
    : undefined;

  if (!activeAssetId || !activeAsset) {
    return (
      <main className="flex-1 flex items-center justify-center bg-gray-50">
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
    <main className="flex-1 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Asset header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{activeAsset.name}</h2>
          {activeCategory && (
            <span className="text-base text-gray-500">{activeCategory.name}</span>
          )}
          <span className="text-base text-gray-400 ml-2">
            · {activeAsset.items.length} 个检查项
            · {activeAsset.items.filter((i) => i.required).length} 个必填
          </span>
        </div>

        {/* Check items */}
        {activeAsset.items.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">暂无检查项，请在下方添加</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeAsset.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                assetId={activeAsset.id}
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
        <div className="mt-4 flex items-center gap-2">
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
