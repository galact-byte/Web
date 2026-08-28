import { genId } from '../context/appReducer';
import type React from 'react';
import type { ImageData } from '../types';
import { compressImageBlob, blobToDataUrl } from './imageCompression';

export async function readImageFile(file: File): Promise<ImageData> {
  // 入库前等比压缩；小截图命中跳过条件时原样保留，不会糊字。
  const compressed = await compressImageBlob(file);
  const data = await blobToDataUrl(compressed.blob);
  return {
    id: genId(),
    fileName: file.name || `clipboard-${Date.now()}.png`,
    data,
    caption: '',
    uploadedAt: new Date().toISOString(),
  };
}

export async function readImageFiles(files: File[]): Promise<ImageData[]> {
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      console.warn(`图片过大 (${(file.size / 1024 / 1024).toFixed(1)}MB): ${file.name}`);
    }
  }
  return Promise.all(files.map(readImageFile));
}

export function getImageFilesFromClipboard(event: ClipboardEvent | React.ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];
  const imageFiles: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }
  return imageFiles;
}
