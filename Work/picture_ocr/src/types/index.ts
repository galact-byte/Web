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
  data: string; // Base64
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
