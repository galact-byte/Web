import type { ProjectDocument } from '../types';
import type { LanCollectorSnapshot, LanCollectorSystem } from './lanBridge';
import { listProjects, loadProject } from './db';

/** 纯函数：把一个系统文档映射为组快照中的系统条目（仅结构与张数，不含图片 data）。 */
export function mapDocumentToSystemSnapshot(doc: ProjectDocument): LanCollectorSystem {
  return {
    projectId: doc.id,
    title: doc.meta.systemName.trim() || doc.meta.projectName.trim() || '未命名采集系统',
    categories: doc.categories.map((category) => ({ id: category.id, name: category.name })),
    assets: doc.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      categoryId: asset.categoryId,
      items: asset.items.map((item) => ({
        id: item.id,
        label: item.label,
        required: item.required,
        imageCount: item.images.length,
      })),
    })),
  };
}

/** 纯函数：由项目组信息与系统条目组装组快照展示名。 */
function resolveGroupTitle(groupTitle: string | null | undefined, systems: LanCollectorSystem[]): string {
  const trimmed = groupTitle?.trim();
  if (trimmed) return trimmed;
  if (systems.length === 1) return systems[0].title;
  return '未命名项目组';
}

export interface BuildGroupSnapshotOptions {
  groupId: string | null;
  groupTitle?: string | null;
  /** 显式指定组内系统 id（例如从项目列表启动时）；提供时优先使用，以兼容未分组单系统。 */
  systemIds?: string[] | null;
  /** 当前打开系统的实时快照，用于覆盖 db 版本，避免自动保存去抖导致的滞后。 */
  openSystemOverride?: LanCollectorSystem | null;
}

/**
 * 从 IndexedDB 读取项目组下全部系统，组装组快照。
 * 当前打开系统若提供实时覆盖，则以覆盖为准。
 */
export async function buildGroupSnapshot(options: BuildGroupSnapshotOptions): Promise<LanCollectorSnapshot> {
  const { groupId, groupTitle, systemIds, openSystemOverride } = options;
  let memberIds: string[];
  if (systemIds && systemIds.length > 0) {
    memberIds = systemIds;
  } else {
    const summaries = await listProjects();
    memberIds = summaries
      .filter((summary) => (groupId ? summary.groupId === groupId : summary.id === openSystemOverride?.projectId))
      .map((summary) => summary.id);
  }

  // groupId 为空（独立系统）时，至少纳入覆盖系统自身。
  const idsToLoad = memberIds.length > 0
    ? memberIds
    : openSystemOverride
      ? [openSystemOverride.projectId]
      : [];

  const docs = await Promise.all(idsToLoad.map((id) => loadProject(id)));
  const systems: LanCollectorSystem[] = docs
    .filter((doc): doc is ProjectDocument => Boolean(doc))
    .map((doc) =>
      openSystemOverride && openSystemOverride.projectId === doc.id
        ? openSystemOverride
        : mapDocumentToSystemSnapshot(doc)
    );

  // 覆盖系统尚未落库（新建未保存）时，保证它出现在快照中。
  if (openSystemOverride && !systems.some((system) => system.projectId === openSystemOverride.projectId)) {
    systems.unshift(openSystemOverride);
  }

  return {
    groupId,
    groupTitle: resolveGroupTitle(groupTitle, systems),
    systems,
  };
}
