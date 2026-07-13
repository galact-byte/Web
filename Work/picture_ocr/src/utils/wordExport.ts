import type { Asset, Category, ProjectMeta } from '../types';

// ==================== Validation ====================

export interface ValidationMissing {
  categoryName: string;
  assetName: string;
  itemLabel: string;
}

export function validateRequired(
  categories: Category[],
  assets: Asset[]
): ValidationMissing[] {
  const missing: ValidationMissing[] = [];
  for (const asset of assets) {
    const categoryName = categories.find((category) => category.id === asset.categoryId)?.name || '未知分类';
    for (const item of asset.items) {
      if (item.required && item.images.length === 0) {
        missing.push({ categoryName, assetName: asset.name, itemLabel: item.label });
      }
    }
  }
  return missing;
}

function sanitizeFileNamePart(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .replace(/_+/g, '_');
  if (!cleaned) return fallback;
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned) ? `${cleaned}_项目` : cleaned;
}

export function buildReportFileName(meta: ProjectMeta): string {
  const projectName = sanitizeFileNamePart(meta.projectName, '未命名项目');
  const systemName = sanitizeFileNamePart(meta.systemName, '未命名系统');
  return `${projectName}_${systemName}_测评证据.docx`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * DOCX 生成器和封面图片仅在用户确认导出时才加载，避免拖慢 Electron 首屏。
 * 动态模块仍在同一浏览器上下文中运行，因此 file:// Electron 打包模式保持可用。
 */
export async function exportWordReport(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[]
): Promise<void> {
  let createWordReportBlob: (typeof import('./wordDocument'))['createWordReportBlob'];
  try {
    ({ createWordReportBlob } = await import('./wordDocument'));
  } catch {
    throw new Error('无法加载 Word 导出组件，请确认应用文件完整后重试。');
  }
  const blob = await createWordReportBlob(meta, categories, assets);
  downloadBlob(blob, buildReportFileName(meta));
}
