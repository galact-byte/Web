import React, { useState, useEffect } from 'react';
import type { Category, CheckItemTemplate } from '../types';
import { genId } from '../context/appReducer';
import { useConfirmDialog } from './ConfirmDialog';

interface TemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSaveTemplates: (categoryId: string, items: CheckItemTemplate[]) => void;
}

const TemplateDialog: React.FC<TemplateDialogProps> = ({
  isOpen,
  onClose,
  categories,
  onSaveTemplates,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>(
    categories[0]?.id || ''
  );
  const [items, setItems] = useState<CheckItemTemplate[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const { confirm, dialog } = useConfirmDialog();

  // Load current category's template items
  useEffect(() => {
    const cat = categories.find((c) => c.id === selectedCatId);
    if (cat) {
      setItems(cat.defaultItems.map((item) => ({ ...item })));
    }
  }, [selectedCatId, categories]);

  if (!isOpen) return null;

  const selectedCat = categories.find((c) => c.id === selectedCatId);
  if (!selectedCat) return null;

  const handleAddItem = () => {
    if (!newLabel.trim()) return;
    const newItem: CheckItemTemplate = {
      id: genId(),
      label: newLabel.trim(),
      required: true,
    };
    setItems([...items, newItem]);
    setNewLabel('');
  };

  const handleRemoveItem = async (itemId: string) => {
    const item = items.find((currentItem) => currentItem.id === itemId);
    const confirmed = await confirm({
      title: '删除默认检查项',
      message: `确定要删除“${item?.label || '该默认检查项'}”吗？\n\n修改保存后会影响后续新建资产。`,
      confirmText: '删除默认项',
      tone: 'danger',
    });
    if (confirmed) {
      setItems(items.filter((currentItem) => currentItem.id !== itemId));
    }
  };

  const handleRenameItem = (itemId: string, newLabel: string) => {
    if (!newLabel.trim()) return;
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, label: newLabel.trim() } : item
      )
    );
  };

  const handleToggleRequired = (itemId: string) => {
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, required: !item.required } : item
      )
    );
  };

  const handleSave = () => {
    onSaveTemplates(selectedCatId, items);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">模板管理</h2>
          <p className="text-sm text-gray-500 mt-1">
            编辑各分类的默认检查项模板。修改仅影响后续新建的资产，已有资产不受影响。
          </p>
        </div>

        {/* Category selector */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {categories
              .filter((c) => c.type === 'checklist')
              .map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedCatId === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-600 mb-3 font-medium">
            {selectedCat.name} - 默认检查项（{items.length} 项）
          </p>

          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              暂无默认检查项，请在下方添加
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <TemplateItemRow
                  key={item.id}
                  item={item}
                  onRename={handleRenameItem}
                  onRemove={handleRemoveItem}
                  onToggleRequired={handleToggleRequired}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add new */}
        <div className="px-6 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddItem();
              }}
              placeholder="添加默认检查项..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleAddItem}
              disabled={!newLabel.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              添加
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-3 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            保存模板
          </button>
        </div>
      </div>
      {dialog}
    </div>
  );
};

// ---- Single template item row ----
interface TemplateItemRowProps {
  item: CheckItemTemplate;
  onRename: (itemId: string, newLabel: string) => void;
  onRemove: (itemId: string) => void;
  onToggleRequired: (itemId: string) => void;
}

const TemplateItemRow: React.FC<TemplateItemRowProps> = ({
  item,
  onRename,
  onRemove,
  onToggleRequired,
}) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.label);

  const handleFinishEdit = () => {
    if (editValue.trim() && editValue.trim() !== item.label) {
      onRename(item.id, editValue.trim());
    }
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group hover:bg-gray-100 transition-colors">
      <span className="text-gray-500 text-xs w-6 text-right flex-shrink-0">
        {item.required ? (
          <span className="text-red-400" title="必填">*</span>
        ) : (
          <span className="text-gray-300" title="选填">-</span>
        )}
      </span>

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
          className="flex-1 text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm text-gray-700">{item.label}</span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onToggleRequired(item.id)}
          className={`px-2 py-0.5 text-xs rounded ${
            item.required
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
          }`}
        >
          {item.required ? '必填' : '选填'}
        </button>
        <button
          onClick={() => {
            setEditValue(item.label);
            setEditing(true);
          }}
          className="p-1 text-gray-400 hover:text-blue-600"
          title="重命名"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1 text-gray-400 hover:text-red-600"
          title="删除"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TemplateDialog;
