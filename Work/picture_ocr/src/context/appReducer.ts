import type { ProjectDocument, ProjectMeta, Category, Asset, CheckItem, ImageData, CheckItemTemplate } from '../types';
import defaultCategories, { createDefaultMeta, createPresetAssets } from '../data/defaults';

// ---- Helper ----
let idCounter = Date.now();
export function genId(): string {
  return `id-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---- State type ----
export interface AppState {
  loaded: boolean;
  meta: ProjectMeta;
  categories: Category[];
  assets: Asset[];
  activeCategoryId: string | null;
  activeAssetId: string | null;
}

// ---- Action types ----
export type AppAction =
  | { type: 'LOAD_PROJECT'; payload: ProjectDocument }
  | { type: 'CLEAR_PROJECT' }
  | { type: 'SET_META'; payload: ProjectMeta }
  | { type: 'ADD_ASSET'; payload: { categoryId: string; assetName: string } }
  | { type: 'REMOVE_ASSET'; payload: { assetId: string } }
  | { type: 'RENAME_ASSET'; payload: { assetId: string; newName: string } }
  | { type: 'SET_ACTIVE_CATEGORY'; payload: string }
  | { type: 'SET_ACTIVE_ASSET'; payload: string | null }
  | { type: 'ADD_ITEM'; payload: { assetId: string; label: string } }
  | { type: 'REMOVE_ITEM'; payload: { assetId: string; itemId: string } }
  | { type: 'RENAME_ITEM'; payload: { assetId: string; itemId: string; newLabel: string } }
  | { type: 'SET_TEMPLATES'; payload: { categoryId: string; items: CheckItemTemplate[] } }
  | { type: 'TOGGLE_REQUIRED'; payload: { assetId: string; itemId: string } }
  | { type: 'ADD_IMAGE'; payload: { assetId: string; itemId: string; image: ImageData } }
  | { type: 'REMOVE_IMAGE'; payload: { assetId: string; itemId: string; imageId: string } }
  | { type: 'UPDATE_IMAGE_CAPTION'; payload: { assetId: string; itemId: string; imageId: string; caption: string } }
  | { type: 'REORDER_IMAGES'; payload: { assetId: string; itemId: string; imageIds: string[] } };

// ---- Reducer ----
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_PROJECT': {
      const doc = action.payload;
      const nextAssets = doc.assets ?? [];
      const activeSelection = pickActiveSelection(
        doc.categories,
        nextAssets,
        state.activeCategoryId,
        state.activeAssetId
      );

      return {
        ...state,
        loaded: true,
        meta: doc.meta,
        categories: doc.categories,
        assets: nextAssets,
        activeCategoryId: activeSelection.categoryId,
        activeAssetId: activeSelection.assetId,
      };
    }

    case 'CLEAR_PROJECT': {
      const newCats = cloneCategories(defaultCategories);
      const newAssets = createPresetAssets(newCats);
      return {
        ...state,
        loaded: true,
        meta: createDefaultMeta(),
        categories: newCats,
        assets: newAssets,
        activeCategoryId: null,
        activeAssetId: null,
      };
    }

    case 'SET_META': {
      return { ...state, meta: action.payload };
    }

    case 'SET_ACTIVE_CATEGORY': {
      const categoryId = action.payload;
      const assets = state.assets.filter((a) => a.categoryId === categoryId);
      const firstAssetId = assets.length > 0 ? assets[0].id : null;
      return {
        ...state,
        activeCategoryId: categoryId,
        activeAssetId: firstAssetId,
      };
    }

    case 'SET_TEMPLATES': {
      const { categoryId: catId, items } = action.payload;
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === catId ? { ...c, defaultItems: items } : c
        ),
      };
    }

    case 'SET_ACTIVE_ASSET': {
      return { ...state, activeAssetId: action.payload };
    }

    case 'ADD_ASSET': {
      const { categoryId, assetName } = action.payload;
      const cat = state.categories.find((c) => c.id === categoryId);
      if (!cat) return state;
      const newAsset: Asset = {
        id: genId(),
        name: assetName,
        categoryId,
        items: cat.defaultItems.map((tpl) => ({
          id: genId(),
          label: tpl.label,
          required: tpl.required,
          fromTemplateId: tpl.id,
          images: [],
        })),
      };
      return {
        ...state,
        assets: [...state.assets, newAsset],
        activeAssetId: newAsset.id,
      };
    }

    case 'REMOVE_ASSET': {
      const { assetId } = action.payload;
      const remaining = state.assets.filter((a) => a.id !== assetId);
      let nextActive = state.activeAssetId;
      if (assetId === state.activeAssetId) {
        const catAssets = remaining.filter(
          (a) => a.categoryId === state.activeCategoryId
        );
        nextActive = catAssets.length > 0 ? catAssets[0].id : null;
      }
      return { ...state, assets: remaining, activeAssetId: nextActive };
    }

    case 'RENAME_ASSET': {
      const { assetId, newName } = action.payload;
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === assetId ? { ...a, name: newName } : a
        ),
      };
    }

    case 'ADD_ITEM': {
      const { assetId, label } = action.payload;
      const newItem: CheckItem = {
        id: genId(),
        label,
        required: false,
        fromTemplateId: null,
        images: [],
      };
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === assetId ? { ...a, items: [...a.items, newItem] } : a
        ),
      };
    }

    case 'REMOVE_ITEM': {
      const { assetId, itemId } = action.payload;
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === assetId
            ? { ...a, items: a.items.filter((item) => item.id !== itemId) }
            : a
        ),
      };
    }

    case 'RENAME_ITEM': {
      const { assetId, itemId, newLabel } = action.payload;
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === assetId
            ? {
                ...a,
                items: a.items.map((item) =>
                  item.id === itemId ? { ...item, label: newLabel } : item
                ),
              }
            : a
        ),
      };
    }

    case 'TOGGLE_REQUIRED': {
      const { assetId, itemId } = action.payload;
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === assetId
            ? {
                ...a,
                items: a.items.map((item) =>
                  item.id === itemId ? { ...item, required: !item.required } : item
                ),
              }
            : a
        ),
      };
    }

    case 'ADD_IMAGE': {
      const { assetId: ai, itemId: ii, image } = action.payload;
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === ai
            ? {
                ...a,
                items: a.items.map((item) =>
                  item.id === ii
                    ? { ...item, images: [...item.images, image] }
                    : item
                ),
              }
            : a
        ),
      };
    }

    case 'REMOVE_IMAGE': {
      const { assetId: ai2, itemId: ii2, imageId } = action.payload;
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === ai2
            ? {
                ...a,
                items: a.items.map((item) =>
                  item.id === ii2
                    ? { ...item, images: item.images.filter((img) => img.id !== imageId) }
                    : item
                ),
              }
            : a
        ),
      };
    }

    case 'UPDATE_IMAGE_CAPTION': {
      const { assetId: ai3, itemId: ii3, imageId: imgId3, caption } = action.payload;
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === ai3
            ? {
                ...a,
                items: a.items.map((item) =>
                  item.id === ii3
                    ? {
                        ...item,
                        images: item.images.map((img) =>
                          img.id === imgId3 ? { ...img, caption } : img
                        ),
                      }
                    : item
                ),
              }
            : a
        ),
      };
    }

    case 'REORDER_IMAGES': {
      const { assetId: ai4, itemId: ii4, imageIds } = action.payload;
      return {
        ...state,
        assets: state.assets.map((a) =>
          a.id === ai4
            ? {
                ...a,
                items: a.items.map((item) => {
                  if (item.id !== ii4) return item;
                  const imgMap = new Map(item.images.map((img) => [img.id, img]));
                  const reordered = imageIds
                    .map((id) => imgMap.get(id))
                    .filter((img): img is ImageData => !!img);
                  return { ...item, images: reordered };
                }),
              }
            : a
        ),
      };
    }

    default:
      return state;
  }
}

// ---- Helpers ----
function cloneCategories(cats: Category[]): Category[] {
  return cats.map((c) => ({
    ...c,
    defaultItems: c.defaultItems.map((d) => ({ ...d })),
  }));
}

function pickActiveSelection(
  categories: Category[],
  assets: Asset[],
  currentCategoryId: string | null,
  currentAssetId: string | null
): { categoryId: string | null; assetId: string | null } {
  const currentAsset = assets.find((asset) => asset.id === currentAssetId);
  if (currentAsset) {
    return { categoryId: currentAsset.categoryId, assetId: currentAsset.id };
  }

  if (currentCategoryId && categories.some((category) => category.id === currentCategoryId)) {
    const firstAssetInCurrentCategory = assets.find((asset) => asset.categoryId === currentCategoryId);
    return { categoryId: currentCategoryId, assetId: firstAssetInCurrentCategory?.id ?? null };
  }

  const orderedCategories = [...categories].sort((a, b) => a.order - b.order);
  for (const category of orderedCategories) {
    const firstAsset = assets.find((asset) => asset.categoryId === category.id);
    if (firstAsset) {
      return { categoryId: category.id, assetId: firstAsset.id };
    }
  }

  return { categoryId: orderedCategories[0]?.id ?? null, assetId: null };
}

export function getAssetsForCategory(assets: Asset[], categoryId: string): Asset[] {
  return assets.filter((a) => a.categoryId === categoryId);
}

export function getAssetById(assets: Asset[], assetId: string): Asset | undefined {
  return assets.find((a) => a.id === assetId);
}

// ---- Initial state ----
export function createInitialState(): AppState {
  return {
    loaded: false,
    meta: createDefaultMeta(),
    categories: cloneCategories(defaultCategories),
    assets: [],
    activeCategoryId: null,
    activeAssetId: null,
  };
}
