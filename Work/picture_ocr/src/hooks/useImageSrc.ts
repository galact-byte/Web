/**
 * 图片显示 hook：屏蔽「内联字节」与「独立 store 引用」两种形态的差异。
 * 组件只管拿 src，未就绪时返回 undefined（渲染占位，不显示破图）。
 */
import { useEffect, useState } from 'react';
import type { ImageData } from '../types';
import { loadImageSrc, peekImageSrc } from '../utils/imageCache';

export function useImageSrc(projectId: string, image: ImageData | null | undefined): string | undefined {
  const imageId = image?.id ?? '';
  const inlineData = image?.data;
  const [src, setSrc] = useState<string | undefined>(
    () => inlineData ?? (imageId ? peekImageSrc(projectId, imageId) : undefined)
  );

  useEffect(() => {
    if (!image) {
      setSrc(undefined);
      return;
    }
    if (typeof inlineData === 'string' && inlineData.length > 0) {
      setSrc(inlineData);
      return;
    }
    const cached = peekImageSrc(projectId, image.id);
    if (cached !== undefined) {
      setSrc(cached);
      return;
    }
    let alive = true;
    setSrc(undefined);
    void loadImageSrc(projectId, image)
      .then((data) => {
        if (alive) setSrc(data ?? undefined);
      })
      .catch(() => {
        // 单张图读失败不该炸整个界面：保持占位，存储自检会把缺失的图对账出来。
        if (alive) setSrc(undefined);
      });
    return () => {
      alive = false;
    };
    // image 对象每次渲染可能是新引用，因此依赖具体的 id 与内联字节而不是对象本身。
  }, [projectId, imageId, inlineData]);

  return src;
}
