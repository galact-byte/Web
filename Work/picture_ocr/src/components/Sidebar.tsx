import React, { useEffect, useState } from 'react';
import { useAppState, useDispatch } from '../context/AppContext';
import { getAssetsForCategory } from '../context/appReducer';
import { useConfirmDialog } from './ConfirmDialog';

function renderCategoryIcon(categoryId: string): React.ReactNode {
  const commonProps = { strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 2 };
  if (categoryId === 'cat-physical') {
    return <path {...commonProps} d="M4 6h16v10H4zM8 20h8M10 16v4m4-4v4M8 10h.01M12 10h.01" />;
  }
  if (categoryId === 'cat-network') {
    return <path {...commonProps} d="M12 5v4m-6 8h12M6 17a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4zm-6-8a2 2 0 100-4 2 2 0 000 4zm0 0v4" />;
  }
  if (categoryId === 'cat-security') {
    return <path {...commonProps} d="M12 3l7 4v5c0 4.2-2.9 7.2-7 9-4.1-1.8-7-4.8-7-9V7l7-4zM9.5 12l1.8 1.8 3.7-4" />;
  }
  if (categoryId === 'cat-host') {
    return <path {...commonProps} d="M7 3h10a2 2 0 012 2v14H5V5a2 2 0 012-2zm2 4h6M9 11h6M8 19v2m8-2v2" />;
  }
  if (categoryId === 'cat-system-mgmt') {
    return <path {...commonProps} d="M12 8a4 4 0 100 8 4 4 0 000-8zm8 4h2M2 12h2m14.1-6.1l1.4-1.4M4.5 19.5l1.4-1.4m0-12.2L4.5 4.5m15 15l-1.4-1.4" />;
  }
  if (categoryId === 'cat-app') {
    return <path {...commonProps} d="M4 5h16v14H4zM4 9h16M8 13h3m-3 3h8" />;
  }
  if (categoryId === 'cat-management') {
    return <path {...commonProps} d="M8 4h8l2 2v14H6V6l2-2zm1 8h6m-6 4h6m-4-8h2" />;
  }
  return <path {...commonProps} d="M4 6h16v12H4zM8 10h8m-8 4h5" />;
}

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
  const { confirm, dialog } = useConfirmDialog();

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

  const handleRemoveAsset = async (assetId: string, assetName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: '删除资产',
      message: `确定要删除“${assetName}”吗？\n\n该资产下的检查项和截图也会被删除，此操作不可撤销。`,
      confirmText: '删除资产',
      tone: 'danger',
    });
    if (confirmed) {
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
    <aside className="w-72 border-r border-slate-800 bg-slate-900 flex flex-col h-full overflow-y-auto text-slate-300 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-800 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center border border-cyan-400/50 bg-cyan-500/10 text-cyan-300">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h9M4 12h7M4 17h9" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 6l3 3 3-5M17 15l2 2 4-6" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white">Evidence Pro</p>
          <p className="text-xs text-slate-500">证据分类导航</p>
        </div>
      </div>
      <div className="flex items-center justify-between px-6 py-4 text-xs font-semibold text-slate-500">
        <span>分类导航</span>
        <span className="text-lg leading-none text-slate-600">+</span>
      </div>
      {categories.map((cat) => {
        const isActive = cat.id === activeCategoryId;
        const catAssets = getAssetsForCategory(assets, cat.id);
        const isExpanded = expandedCategories.has(cat.id);
        const isFreestyle = cat.type === 'freestyle';
        const isAdding = addingToCategoryId === cat.id;

        return (
          <div key={cat.id} className="border-b border-slate-800">
            {/* Category header */}
            <div
              className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors select-none
                ${isActive
                  ? 'bg-slate-800 text-white border-r-2 border-blue-400'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                }`}
              onClick={() => toggleCategory(cat.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  className={`h-4 w-4 flex-shrink-0 text-blue-400 transition-transform ${isExpanded ? 'scale-110' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {renderCategoryIcon(cat.id)}
                </svg>
                <span className="font-medium truncate">{cat.name}</span>
                {catAssets.length > 0 && (
                  <span className="text-xs text-slate-300 bg-slate-800 rounded-[2px] px-2 py-0.5">
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
                className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-blue-300 transition-colors flex-shrink-0"
                title={isFreestyle ? '添加材料' : '添加资产'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Expanded: show assets + add input */}
            {isExpanded && (
              <div className="bg-slate-950/40 py-1">
                {/* Adding input */}
                {isAdding && (
                  <div className="border-b border-slate-800 py-2 pl-10 pr-3">
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
                      className="w-full text-sm border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 rounded-[2px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                )}

                {/* Asset list */}
                {catAssets.length === 0 && !isAdding && (
                  <div className="py-3 pl-10 pr-3">
                    <p className="text-sm text-slate-500 italic">
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
                    className={`group relative ml-8 mr-3 my-1 flex cursor-pointer items-center justify-between border-l px-3 py-2 text-sm transition-colors before:absolute before:-left-px before:top-1/2 before:h-px before:w-3
                      ${asset.id === activeAssetId
                        ? 'border-blue-400 bg-slate-800 text-white before:bg-blue-400'
                        : 'border-slate-700 text-slate-400 before:bg-slate-700 hover:bg-slate-800/60 hover:text-slate-100'
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
                        className="flex-1 text-sm border border-slate-700 bg-slate-950 text-slate-100 rounded-[2px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="flex items-center gap-2 min-w-0"
                        onDoubleClick={(e) => handleStartRename(asset.id, asset.name, e)}
                      >
                        <svg className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isFreestyle ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8l2 2v14H6V6l2-2zm1 8h6m-6 4h6" />
                          ) : (
                            renderCategoryIcon(cat.id)
                          )}
                        </svg>
                        <span className="truncate font-medium">{asset.name}</span>
                        {/* Missing required indicator */}
                        {asset.items.filter((i) => i.required && i.images.length === 0).length > 0 && (
                          <span className="text-xs text-red-400 flex-shrink-0" title="有未完成的必填项">●</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={(e) => handleStartRename(asset.id, asset.name, e)}
                        className="p-1 text-slate-500 hover:text-blue-300"
                        title="重命名"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleRemoveAsset(asset.id, asset.name, e)}
                        className="p-1 text-slate-500 hover:text-red-400"
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
      {dialog}
    </aside>
  );
};

export default Sidebar;
