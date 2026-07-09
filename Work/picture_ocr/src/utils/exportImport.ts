import JSZip from 'jszip';
import type {
  ProjectMeta,
  Category,
  Asset,
  ImageData,
  ExportPackage,
  AssetExport,
} from '../types';

// ==================== Export ====================

function buildExportAssets(
  categoryId: string,
  assets: Asset[]
): AssetExport[] {
  return assets
    .filter((a) => a.categoryId === categoryId)
    .map((a) => ({
      id: a.id,
      name: a.name,
      items: a.items.map((item) => ({
        id: item.id,
        label: item.label,
        required: item.required,
        fromTemplateId: item.fromTemplateId,
        images: item.images.map((img) => ({
          id: img.id,
          path: `images/${img.fileName}`,
          caption: img.caption,
          uploadedAt: img.uploadedAt,
        })),
      })),
    }));
}

export async function exportDataPackage(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[]
): Promise<void> {
  const zip = new JSZip();
  const imageFolder = zip.folder('images');

  // Build manifest
  const exportPackage: ExportPackage = {
    meta,
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      type: cat.type,
      order: cat.order,
      defaultItems: cat.defaultItems.map((item) => ({ ...item })),
      assets: buildExportAssets(cat.id, assets),
    })),
  };

  // Collect image files
  const imageWritePromises: Promise<void>[] = [];
  const imageNameSet = new Set<string>();

  for (const asset of assets) {
    for (const item of asset.items) {
      for (const img of item.images) {
        // Make sure filename is unique
        let fileName = img.fileName;
        if (imageNameSet.has(fileName)) {
          const ext = fileName.split('.').pop() || 'png';
          fileName = `${img.id}.${ext}`;
        }
        imageNameSet.add(fileName);

        // Update the path in the manifest data
        const catExport = exportPackage.categories.find(
          (c) => c.id === asset.categoryId
        );
        const assetExport = catExport?.assets.find((a) => a.id === asset.id);
        const itemExport = assetExport?.items.find((i) => i.id === item.id);
        const ref = itemExport?.images.find((r) => r.id === img.id);
        if (ref) {
          ref.path = `images/${fileName}`;
        }

        // Convert base64 to blob and add to zip
        const promise = base64ToBlob(img.data).then((blob) => {
          imageFolder?.file(fileName, blob);
        });
        imageWritePromises.push(promise);
      }
    }
  }

  await Promise.all(imageWritePromises);

  // Add manifest
  zip.file('manifest.json', JSON.stringify(exportPackage, null, 2));

  // Generate zip and download
  const content = await zip.generateAsync({ type: 'blob' });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `测评证据_${meta.unitName || '未命名'}_${dateStr}.zip`;

  downloadBlob(content, filename);
}

// ==================== Import ====================

export interface ImportResult {
  success: boolean;
  message: string;
  data?: {
    meta: ProjectMeta;
    categories: Category[];
    assets: Asset[];
  };
}

export async function importDataPackage(
  file: File,
  mode: 'overwrite' | 'merge',
  existingAssets: Asset[],
  existingCategories: Category[],
  existingMeta: ProjectMeta
): Promise<ImportResult> {
  try {
    const zip = await JSZip.loadAsync(file);

    // Parse manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return { success: false, message: '无效的数据包：缺少 manifest.json' };
    }

    const manifestText = await manifestFile.async('string');
    let exportPkg: ExportPackage;
    try {
      exportPkg = JSON.parse(manifestText);
    } catch {
      return { success: false, message: '无效的数据包：manifest.json 解析失败' };
    }

    // Extract categories, preserving the difference between a new package with
    // an intentionally empty template and a legacy package that lacks the
    // defaultItems field entirely.
    const newCategories: Category[] = exportPkg.categories.map((cat) => {
      const fallbackCategory = existingCategories.find((existing) => existing.id === cat.id);
      const defaultItems = cat.defaultItems !== undefined
        ? cat.defaultItems
        : fallbackCategory?.defaultItems ?? [];

      return {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        order: cat.order,
        defaultItems: defaultItems.map((item) => ({ ...item })),
      };
    });

    // Extract images from zip and build assets
    const newAssets: Asset[] = [];

    for (const catExport of exportPkg.categories) {
      for (const assetExport of catExport.assets) {
        const items = await Promise.all(
          assetExport.items.map(async (itemExport) => {
            const images: ImageData[] = [];
            for (const ref of itemExport.images) {
              const imageFile = zip.file(ref.path);
              if (imageFile) {
                const blob = await imageFile.async('blob');
                const dataUrl = await blobToBase64(blob);
                images.push({
                  id: ref.id,
                  fileName: ref.path.split('/').pop() || 'image.png',
                  data: dataUrl,
                  caption: ref.caption,
                  uploadedAt: ref.uploadedAt,
                });
              }
            }
            return {
              id: itemExport.id,
              label: itemExport.label,
              required: itemExport.required,
              fromTemplateId: itemExport.fromTemplateId,
              images,
            };
          })
        );

        newAssets.push({
          id: assetExport.id,
          name: assetExport.name,
          categoryId: catExport.id,
          items,
        });
      }
    }

    if (mode === 'overwrite') {
      return {
        success: true,
        message: `导入成功：${newCategories.length} 个分类，${newAssets.length} 个资产`,
        data: {
          meta: exportPkg.meta,
          categories: newCategories,
          assets: newAssets,
        },
      };
    }

    // Merge mode: import assets by id without overwriting current project
    // metadata or templates. Existing items keep their local label/required
    // settings; imported screenshots are unioned by image id so old packages do
    // not accidentally delete newer local screenshots.
    if (mode === 'merge') {
      const mergedAssets = mergeAssets(existingAssets, newAssets);
      const mergedCategories = mergeCategories(existingCategories, newCategories);

      return {
        success: true,
        message: `合并导入成功：共 ${mergedAssets.length} 个资产`,
        data: {
          meta: existingMeta,
          categories: mergedCategories,
          assets: mergedAssets,
        },
      };
    }

    return { success: false, message: '未知的导入模式' };
  } catch (err) {
    return {
      success: false,
      message: `导入失败：${err instanceof Error ? err.message : '未知错误'}`,
    };
  }
}

// ==================== Helpers ====================

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function base64ToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((r) => r.blob());
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function mergeCategories(
  existingCategories: Category[],
  importedCategories: Category[]
): Category[] {
  const merged = existingCategories.map((cat) => ({
    ...cat,
    defaultItems: cat.defaultItems.map((item) => ({ ...item })),
  }));

  for (const importedCategory of importedCategories) {
    if (!merged.some((cat) => cat.id === importedCategory.id)) {
      merged.push({
        ...importedCategory,
        defaultItems: importedCategory.defaultItems.map((item) => ({ ...item })),
      });
    }
  }

  return merged.sort((a, b) => a.order - b.order);
}

function mergeAssets(existingAssets: Asset[], importedAssets: Asset[]): Asset[] {
  const merged = existingAssets.map(cloneAsset);

  for (const importedAsset of importedAssets) {
    const existingAsset = merged.find((asset) => asset.id === importedAsset.id);
    if (!existingAsset) {
      merged.push(cloneAsset(importedAsset));
      continue;
    }

    for (const importedItem of importedAsset.items) {
      const existingItem = existingAsset.items.find((item) => item.id === importedItem.id);
      if (!existingItem) {
        existingAsset.items.push({
          ...importedItem,
          images: importedItem.images.map((image) => ({ ...image })),
        });
        continue;
      }

      const imageIds = new Set(existingItem.images.map((image) => image.id));
      for (const importedImage of importedItem.images) {
        if (!imageIds.has(importedImage.id)) {
          existingItem.images.push({ ...importedImage });
        }
      }
    }
  }

  return merged;
}

function cloneAsset(asset: Asset): Asset {
  return {
    ...asset,
    items: asset.items.map((item) => ({
      ...item,
      images: item.images.map((image) => ({ ...image })),
    })),
  };
}
