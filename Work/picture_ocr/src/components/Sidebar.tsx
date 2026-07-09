import React, { useEffect, useState } from 'react';
import { useAppState, useDispatch } from '../context/AppContext';
import { getAssetsForCategory } from '../context/appReducer';

const Sidebar: React.FC = () => {
  const { categories, assets, activeCategoryId, activeAssetId } = useAppState();
  const dispatch = useDispatch();
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [addingToCategoryId, setAddingToCategoryId] = useState<string | null>(null);
  const [newAssetName, setNewAssetName] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(activeCategoryId ? [activeCategoryId] : [])
  );

  // Ensure active category is always expanded without updating state during render.
  useEffect(() => {
    if (!activeCategoryId) return;
    setExpandedCategories((prev) => {
      if (prev.has(activeCategoryId)) return prev;
      return new Set([...prev, activeCategoryId]);
    });
  }, [activeCategoryId]);

  const toggleCategory = (catId: string) => {
    const next = new Set(expandedCategories);
    if (next.has(catId)) {
      next.delete(catId);
    } else {
      next.add(catId);
    }
    setExpandedCategories(next);
    // Also set it as the active category for content area
    dispatch({ type: 'SET_ACTIVE_CATEGORY', payload: catId });
  };

  const handleAddAsset = () => {
    if (!addingToCategoryId || !newAssetName.trim()) return;
    dispatch({
      type: 'ADD_ASSET',
      payload: { categoryId: addingToCategoryId, assetName: newAssetName.trim() },
    });
    setNewAssetName('');
    setAddingToCategoryId(null);
  };

  const handleRemoveAsset = (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除该资产吗？此操作不可撤销。')) {
      dispatch({ type: 'REMOVE_ASSET', payload: { assetId } });
    }
  };

  const handleStartRename = (assetId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingAssetId(assetId);
    setRenameValue(currentName);
  };

  const handleFinishRename = () => {
    if (renamingAssetId && renameValue.trim()) {
      dispatch({
        type: 'RENAME_ASSET',
        payload: { assetId: renamingAssetId, newName: renameValue.trim() },
      });
    }
    setRenamingAssetId(null);
    setRenameValue('');
  };

  return (
    <aside className="w-72 border-r border-gray-200 bg-gray-50 flex flex-col h-full overflow-y-auto">
      {categories.map((cat) => {
        const isActive = cat.id === activeCategoryId;
        const catAssets = getAssetsForCategory(assets, cat.id);
        const isExpanded = expandedCategories.has(cat.id);
        const isFreestyle = cat.type === 'freestyle';
        const isAdding = addingToCategoryId === cat.id;

        return (
          <div key={cat.id} className="border-b border-gray-200">
            {/* Category header */}
            <div
              className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors select-none
                ${isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
              onClick={() => toggleCategory(cat.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Expand/collapse arrow */}
                <svg
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium truncate">{cat.name}</span>
                {catAssets.length > 0 && (
                  <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
                    {catAssets.length}
                  </span>
                )}
              </div>

              {/* Add asset button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingToCategoryId(isAdding ? null : cat.id);
                  setNewAssetName('');
                }}
                className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                title={isFreestyle ? '添加材料' : '添加资产'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Expanded: show assets + add input */}
            {isExpanded && (
              <div className="bg-white">
                {/* Adding input */}
                {isAdding && (
                  <div className="px-4 py-2 border-b border-gray-100">
                    <input
                      type="text"
                      value={newAssetName}
                      onChange={(e) => setNewAssetName(e.target.value)}
                      onBlur={() => {
                        if (!newAssetName.trim()) setAddingToCategoryId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddAsset();
                        if (e.key === 'Escape') {
                          setAddingToCategoryId(null);
                          setNewAssetName('');
                        }
                      }}
                      placeholder={isFreestyle ? '材料名称（如：信息安全管理规定）' : '资产名称（如：核心交换机(192.168.1.1)）'}
                      className="w-full text-sm border border-blue-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      autoFocus
                    />
                  </div>
                )}

                {/* Asset list */}
                {catAssets.length === 0 && !isAdding && (
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-400 italic">
                      {isFreestyle ? '暂无材料，点击 + 添加' : '暂无资产，点击 + 添加'}
                    </p>
                  </div>
                )}

                {catAssets.map((asset) => (
                  <div
                    key={asset.id}
                    onClick={() => {
                      dispatch({ type: 'SET_ACTIVE_CATEGORY', payload: cat.id });
                      dispatch({ type: 'SET_ACTIVE_ASSET', payload: asset.id });
                    }}
                    className={`group flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors border-b border-gray-50
                      ${asset.id === activeAssetId
                        ? 'bg-blue-100 text-blue-800'
                        : 'text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    {renamingAssetId === asset.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleFinishRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishRename();
                          if (e.key === 'Escape') setRenamingAssetId(null);
                        }}
                        className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="flex items-center gap-2 min-w-0"
                        onDoubleClick={(e) => handleStartRename(asset.id, asset.name, e)}
                      >
                        {/* Asset type icon */}
                        <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isFreestyle ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          )}
                        </svg>
                        <span className="truncate">{asset.name}</span>
                        {/* Missing required indicator */}
                        {asset.items.filter((i) => i.required && i.images.length === 0).length > 0 && (
                          <span className="text-xs text-red-400 flex-shrink-0" title="有未完成的必填项">●</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={(e) => handleStartRename(asset.id, asset.name, e)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="重命名"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleRemoveAsset(asset.id, e)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="删除"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
};

export default Sidebar;
