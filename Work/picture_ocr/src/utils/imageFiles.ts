import { genId } from '../context/appReducer';
import type React from 'react';
import type { ImageData } from '../types';

export function readImageFile(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: genId(),
        fileName: file.name || `clipboard-${Date.now()}.png`,
        data: reader.result as string,
        caption: '',
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
