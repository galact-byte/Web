# 测评证据采集工具 — Technical Design

## Architecture Overview

纯前端单页面应用（SPA），所有逻辑在浏览器中完成，无需后端服务。

```
┌─────────────────────────────────────────────────┐
│                  Vite + React                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────┐│
│  │  UI 层   │  │ 状态管理层 │  │  持久化层      ││
│  │ (组件)   │  │ (Context) │  │ (IndexedDB)   ││
│  ├──────────┤  ├──────────┤  ├────────────────┤│
│  │AppLayout │  │AppContext│  │db (idb-util)  ││
│  │Sidebar   │  │提供hooks│  │CRUD操作       ││
│  │AssetPanel│  │useProject│  │图片存储       ││
│  │ItemCard  │  │useAssets │  │导入/导出      ││
│  │ImageViewer│  │useExport │  │(JSZip)       ││
│  └──────────┘  └──────────┘  └────────────────┘│
│                                      │           │
│                              ┌───────┴───────┐  │
│                              │  Word 生成     │  │
│                              │  (docx lib)   │  │
│                              └───────────────┘  │
└─────────────────────────────────────────────────┘
```

## Data Model

### 核心类型定义 (TypeScript)

```typescript
// ===== 元数据 =====
interface ProjectMeta {
  projectName: string;     // 项目名称
  unitName: string;        // 被测单位名称
  evaluator: string;       // 测评人员
  reportDate: string;      // 报告日期（ISO date string）
}

// ===== 分类 =====
interface Category {
  id: string;              // 唯一标识（如 "cat-network"）
  name: string;            // 显示名称
  type: 'checklist' | 'freestyle';  // checklist=标准, freestyle=管理层面
  order: number;           // 排序
  defaultItems: CheckItemTemplate[]; // 默认检查项模板
}

// ===== 检查项模板（分类级默认项） =====
interface CheckItemTemplate {
  id: string;              // 模板 ID
  label: string;           // 显示文字
  required: boolean;       // 是否必填
}

// ===== 资产 =====
interface Asset {
  id: string;              // 唯一标识
  name: string;            // 资产名称（如"核心交换机(192.168.1.1)"）
  categoryId: string;      // 所属分类
  items: CheckItem[];      // 该资产下的检查项
}

// ===== 检查项实例 =====
interface CheckItem {
  id: string;              // 唯一标识
  label: string;           // 显示文字
  required: boolean;       // 是否必填
  fromTemplateId: string | null; // 继承自哪个模板项
  images: ImageData[];
}

// ===== 图片 =====
interface ImageData {
  id: string;
  fileName: string;       // 文件名（如 "img-xxx.png"）
  data: string;           // Base64 编码的图片数据
  caption: string;        // 备注文字
  uploadedAt: string;     // ISO timestamp
}

// ===== 导出/导入结构 =====
interface ExportPackage {
  meta: ProjectMeta;
  categories: CategoryExport[];
}

interface CategoryExport {
  id: string;
  name: string;
  type: 'checklist' | 'freestyle';
  order: number;
  assets: AssetExport[];
}

interface AssetExport {
  id: string;
  name: string;
  items: CheckItemExport[];
}

interface CheckItemExport {
  id: string;
  label: string;
  required: boolean;
  fromTemplateId: string | null;
  images: ImageRef[];   // 图片引用路径，实际文件放在 images/ 目录
}

interface ImageRef {
  id: string;
  path: string;          // 相对路径如 "images/img-xxx.png"
  caption: string;
  uploadedAt: string;
}
```

### IndexedDB Schema

数据库名：`evidence-collector-db`，使用单个 object store 存储完整项目状态。

```
ObjectStore: "project"
  keyPath: "id"
  indexes:
    - "updatedAt" (number, for merge conflict resolution)

Document 结构 = {
  id: "current",
  meta: ProjectMeta,
  categories: Category[], // 含所有资产和检查项
  updatedAt: number,      // 时间戳
}
```

优势：单个文档读取即可获得完整状态，适合数据量不大的工具场景（总数据通常 <50MB）。每次操作后自动保存。

## Component Tree

```
<App>
  <AppProvider>                    ← 全局状态 Context
    <Toolbar>                      ← 顶部工具栏
      <ProjectInfoDialog />        ← 项目信息编辑弹窗
      <ImportButton />             ← 导入按钮
      <ExportDataButton />         ← 导出数据包
      <ExportWordButton />         ← 导出 Word 报告
    </Toolbar>
    <MainLayout>                   ← 两栏布局
      <Sidebar>                    ← 左侧栏
        <CategoryTabs />           ← 分类切换（含"其他"）
        <AssetList>                ← 资产列表
          <AssetItem />            ← 单个资产（可折叠）
          <AddAssetButton />       ← 添加资产
        </AssetList>
      </Sidebar>
      <ContentArea>                ← 右侧内容区
        <AssetPanel>               ← 当前资产的检查项面板
          <ItemCard>               ← 单个检查项卡片
            <UploadZone />         ← 粘贴/拖拽/点击上传区
            <ImageThumbnail />     ← 缩略图（悬浮操作条）
            <ImageViewer />        ← 放大预览弹窗
            <CheckItemActions />   ← 自定义/删除检查项
          </ItemCard>
          <AddItemButton />        ← 添加自定义检查项
        </AssetPanel>
      </ContentArea>
    </MainLayout>
    <ValidationDialog />           ← 导出校验提示弹窗
  </AppProvider>
</App>
```

## Key Design Decisions

### 1. 纯 Context API 而非 Redux/Zustand
当前项目状态结构相对简单（树状），Context + useReducer 足够应对。如果未来复杂度增加可迁至 Zustand。

### 2. 图片存储策略
- **界面展示**：图片以 Base64 存入 IndexedDB，读取后直接展示
- **导出数据包**：JSZip 打包时，图片从 Base64 转为 blob 写入 zip 的 images/ 目录，manifest.json 中仅存引用路径
- **导入数据包**：从 zip 解出 manifest.json + images/，写入 IndexedDB
- **优势**：纯前端无需文件服务器，所有数据本地化

### 3. Word 生成使用 `docx` npm 包
- `docx` 包支持浏览器端 Packer.toBlob()，可直接下载 .docx 文件
- 图片通过 `docx.Media.addImage` 以 base64 嵌入
- 表格使用 `docx.Table` 构建，每个检查项一行
- 多图排列：每个检查项单元格内使用 2 列的内嵌表格，每行 2 张图

### 4. 必填校验机制
- 模板默认检查项自动为必填（required: true）
- 用户自定义添加的检查项默认可选（required: false），可手动切换
- 导出 Word 前扫描所有必填项的 images 数组，空则收集到警告列表
- 弹窗展示缺失详情，用户可选择"继续导出"或"返回补充"

### 5. 管理层面（freestyle 类型）
- 与标准分类同一组件处理，但 type='freestyle' 时隐藏"默认检查项模板"
- Asset 的 name 为材料名称（如"信息安全管理规定"）
- 每个 Asset 下的 items 自由添加（无模板预设）

### 6. "其他"分类
- 与标准分类行为一致，有默认检查项模板（初始为空列表）
- 用户可自行添加检查项模板或直接在资产中添加检查项

## Data Flow

```
用户操作 → React 组件 → Context dispatch → Reducer 更新状态
    ↓
自动保存 (debounced) → IndexedDB.put()
    ↓
页面刷新 → useEffect 启动时从 IndexedDB.get() 恢复状态
    ↓
导出数据包: 从 Context 读取 → 构建 manifest.json → JSZip 打包 → 触发下载
导出 Word: 从 Context 读取 → docx 构建 Document → Packer.toBlob() → 触发下载
导入数据包: 用户选择 .zip 文件 → JSZip 解包 → 解析 manifest → 合并/覆盖 → 写入 IndexedDB
```

## Compatibility Notes

- 最低支持：Chrome 80+, Firefox 80+, Edge 80+（使用较新的 API）
- 依赖 Clipboard API（粘贴），需 HTTPS 或 localhost 环境
- File API 和 Drag & Drop API 在所有现代浏览器中支持良好
- IndexedDB 在所有现代浏览器中支持
- `docx` 库（v8+）在浏览器中支持良好

## Rollback / Safety

- 每次状态变更自动保存到 IndexedDB，未显式导出时也不会丢数据
- IndexedDB 数据可手动清除（浏览器开发者工具）
- 导入前自动备份当前状态到内存，用户可在导入后撤销（undo）
- 导入数据包不影响浏览器自动保存的草稿（草稿和导入包是两条数据流）
