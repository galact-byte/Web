import type { ImageData, ProjectDocument } from '../types';
import { addImageToProject } from './db';

/** 手机局域网上传落库的载荷（与 appReducer 的 ADD_IMAGE payload 同构）。 */
export interface LanImageSavePayload {
  assetId: string;
  itemId: string;
  image: ImageData;
}

export interface LanImageApplyResult {
  doc: ProjectDocument;
  /** 是否真正追加了新图片；重复 image.id 时为 false。 */
  changed: boolean;
}

/**
 * 纯函数：把一张图片合并进内存中的系统文档（界面态合并用；落库由 addImageToProject 负责）。
 * 目标资产/检查项缺失时抛错；
 * 已存在同 id 图片时视为成功但不改动（changed=false）。不突变入参。
 */
export function applyLanImageToDocument(
  doc: ProjectDocument | null,
  payload: LanImageSavePayload
): LanImageApplyResult {
  if (!doc) throw new Error('目标系统已不存在，请在电脑端重新开启采集会话。');
  const asset = doc.assets.find((candidate) => candidate.id === payload.assetId);
  const item = asset?.items.find((candidate) => candidate.id === payload.itemId);
  if (!asset || !item) throw new Error('目标资产或检查项已变更，请在电脑端重新开启采集会话。');
  if (item.images.some((image) => image.id === payload.image.id)) {
    return { doc, changed: false };
  }
  const nextDoc: ProjectDocument = {
    ...doc,
    assets: doc.assets.map((currentAsset) =>
      currentAsset.id !== asset.id
        ? currentAsset
        : {
            ...currentAsset,
            items: currentAsset.items.map((currentItem) =>
              currentItem.id !== item.id
                ? currentItem
                : { ...currentItem, images: [...currentItem.images, payload.image] }
            ),
          }
    ),
    updatedAt: Date.now(),
  };
  return { doc: nextDoc, changed: true };
}

/**
 * 项目无关落库：把手机上传图片写入任意系统的 IndexedDB，
 * 与电脑端当前打开哪个系统无关。用于会话中非当前打开系统的目标。
 */
export async function saveLanImageToProject(projectId: string, payload: LanImageSavePayload): Promise<void> {
  // 字节写 images store、文档在同事务里现读现改：
  // 不再把整份内存快照覆盖回库，手机与电脑端并发添图不会互相冲掉。
  await addImageToProject(projectId, payload.assetId, payload.itemId, payload.image);
}
