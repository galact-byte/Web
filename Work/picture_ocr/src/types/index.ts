/** 项目元数据 */
export interface ProjectMeta {
  projectCode: string;
  projectName: string;
  unitName: string;
  systemName: string;
  reportDate: string; // ISO date string, can be empty
}

/** 检查项模板（分类级默认项） */
export interface CheckItemTemplate {
  id: string;
  label: string;
  required: boolean;
}

/** 分类定义 */
export interface Category {
  id: string;
  name: string;
  type: 'checklist' | 'freestyle';
  order: number;
  defaultItems: CheckItemTemplate[];
}

/** 单张图片数据 */
export interface ImageData {
  id: string;
  fileName: string;
  /**
   * Base64 字节。v5 起图片字节改存独立的 images store，文档里只留引用，因此这里为可选：
   * - 已迁移：undefined，需经 resolveImageData(projectId, image) 取字节
   * - 未迁移：仍为内联 Base64（老项目）
   */
  data?: string;
  caption: string;
  uploadedAt: string; // ISO timestamp
}

/** 检查项实例 */
export interface CheckItem {
  id: string;
  label: string;
  required: boolean;
  fromTemplateId: string | null;
  images: ImageData[];
}

/** 资产 */
export interface Asset {
  id: string;
  name: string;
  categoryId: string;
  items: CheckItem[];
}

/**
 * 系统归档标记：图片字节已写入用户选择目录的归档文件并删除本地副本，文档与引用保留。
 * 存在即视为整体只读，需先恢复。所有 normalize/摘要派生必须透传，否则下次保存会抹掉标记。
 */
export interface ArchiveInfo {
  archivedAt: number;
  /** 归档文件名（不含目录）。 */
  fileName: string;
  /** 保存位置显示名：Web 为目录名，桌面为完整路径。 */
  locationLabel: string;
  imageCount: number;
  /** 归档图片原始字节合计。 */
  imageBytes: number;
  /** 归档清单 SHA-256（hex），恢复时比对。 */
  fingerprint: string;
}

/** IndexedDB 存储的完整项目文档 */
export interface ProjectDocument {
  id: string;
  /** 所属项目组；旧项目没有该字段时为 null，仍作为独立系统正常使用。 */
  groupId: string | null;
  meta: ProjectMeta;
  categories: Category[];
  assets: Asset[];
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  /** 已归档时存在；旧数据与未归档为 null/undefined。 */
  archive?: ArchiveInfo | null;
}

/** 项目组（母项目）元数据。系统名称及证据数据保存在各系统子项目中。 */
export interface ProjectGroup {
  id: string;
  projectCode: string;
  projectName: string;
  unitName: string;
  reportDate: string;
  createdAt: number;
  updatedAt: number;
}

/** 项目列表中的系统子项目摘要 */
export interface ProjectSummary {
  id: string;
  groupId: string | null;
  meta: ProjectMeta;
  assetCount: number;
  createdAt: number;
  updatedAt: number;
  archive?: ArchiveInfo | null;
}

/** 外层列表使用的项目组及其系统子项目。 */
export interface ProjectGroupSummary {
  id: string;
  group: ProjectGroup | null;
  systems: ProjectSummary[];
}

/** 导出包的 manifest 中的分类 */
export interface CategoryExport {
  id: string;
  name: string;
  type: 'checklist' | 'freestyle';
  order: number;
  defaultItems?: CheckItemTemplate[];
  assets: AssetExport[];
}

/** 导出包的 manifest 中的资产 */
export interface AssetExport {
  id: string;
  name: string;
  items: CheckItemExport[];
}

/** 导出包的 manifest 中的检查项 */
export interface CheckItemExport {
  id: string;
  label: string;
  required: boolean;
  fromTemplateId: string | null;
  images: ImageRef[];
}

/** 导出包的 manifest 中的图片引用 */
export interface ImageRef {
  id: string;
  path: string; // relative path like "images/img-xxx.png"
  caption: string;
  uploadedAt: string;
}

/** 导出包结构 */
export interface ExportPackage {
  meta: ProjectMeta;
  categories: CategoryExport[];
}
