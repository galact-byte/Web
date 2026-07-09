/** 项目元数据 */
export interface ProjectMeta {
  projectName: string;
  unitName: string;
  evaluator: string;
  reportDate: string; // ISO date string
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
  meta: ProjectMeta;
  categories: Category[];
  assets: Asset[];
  updatedAt: number; // timestamp
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
