# 测评证据采集工具 — Implementation Plan

## 开发策略

采用**增量开发**方式，每个里程碑产出可直接运行验证的版本。由于用户已确认全部需求，直接按 V0.1→V0.5 顺序实现。

## 里程碑

### V0.1 — 基础框架 + 数据结构 + 本地存储
**目标**：项目骨架搭建，分类/资产/检查项 CRUD，IndexedDB 持久化，界面基本可用

#### 步骤
1. **项目初始化**
   - [x] `npm create vite@latest` 创建 React + TypeScript 项目
   - [x] 安装 Tailwind CSS
   - [x] 配置 vite.config（支持 base64 图片等）
   - [x] 清理默认模板代码

2. **数据结构与类型定义**
   - [x] 在 `src/types/` 中定义所有 TypeScript 类型
   - [x] 定义默认分类和检查项模板数据（从 Word 模板提取的 8 个分类）

3. **IndexedDB 工具层**
   - [x] 封装 `src/utils/db.ts`：openDB、saveProject、loadProject 方法
   - [x] 使用单个 document 存储完整项目状态

4. **状态管理（Context + Reducer）**
   - [x] 创建 `AppContext` 和 `appReducer`
   - [x] 实现 Action：SET_META, ADD_ASSET, REMOVE_ASSET, RENAME_ASSET, ADD_ITEM, REMOVE_ITEM, RENAME_ITEM, TOGGLE_REQUIRED
   - [x] 自动保存到 IndexedDB（debounced）

5. **UI 骨架（两栏布局）**
   - [x] `AppLayout` 组件：左侧栏 + 右侧内容区
   - [x] `Sidebar` 组件：分类标签切换 + 资产折叠列表
   - [x] `ContentArea` 组件：当前资产的检查项卡片列表

6. **项目信息编辑**
   - [x] `ProjectInfoDialog`：编辑项目名称/单位/测评人员/日期

**验证方法**：
- [x] `npm run dev` 启动，页面正常渲染
- [x] 切换分类、添加/删除/重命名资产
- [x] 添加/删除/重命名检查项
- [x] 刷新页面后数据仍然存在（IndexedDB）
- [x] 编辑项目信息并确认保存

---

### V0.2 — 图片上传与管理
**目标**：实现粘贴/拖拽/点击上传，缩略图/预览/删除/备注

#### 步骤
1. **UploadZone 组件**
   - [x] 支持 Ctrl+V 粘贴（Clipboard API）
   - [x] 支持拖拽上传（Drag & Drop API）
   - [x] 支持点击文件选择
   - [x] 显示占位提示文字

2. **ImageThumbnail 组件**
   - [x] 图片缩略图展示（Base64 -> img）
   - [x] 鼠标悬浮显示放大预览和删除图标

3. **ImageViewer 组件**
   - [x] 点击缩略图放大预览（模态弹窗）
   - [x] 支持键盘左右切换多张图片

4. **多图管理**
   - [x] 每个检查项支持不限量多图
   - [x] 图片拖动排序（可选，如时间允许）
   - [x] 每张图片添加/编辑备注文字

5. **Context Action 扩展**
   - [x] ADD_IMAGE, REMOVE_IMAGE, UPDATE_IMAGE_CAPTION, REORDER_IMAGES

**验证方法**：
- [x] 打开剪贴板截图，Ctrl+V 粘贴上传
- [x] 拖拽图片文件到上传区
- [x] 点击上传区选择文件
- [x] 查看缩略图显示
- [x] 悬浮查看操作按钮
- [x] 点开放大预览
- [x] 添加/编辑/删除备注
- [x] 刷新后图片保留

---

### V0.3 — 导入导出数据包
**目标**：JSZip 打包/解包，覆盖/合并导入模式

#### 步骤
1. **安装 JSZip**
   - [x] `npm install jszip`

2. **导出数据包**
   - [x] 从 Context 提取完整项目数据
   - [x] 构建 manifest.json（图片按路径引用）
   - [x] 图片从 Base64 转为 blob 写入 zip
   - [x] 浏览器下载 .zip 文件

3. **导入数据包**
   - [x] 用户选择 .zip 文件
   - [x] JSZip 解包
   - [x] 解析 manifest.json
   - [x] 提取 images/ 目录中的图片文件
   - [x] 还原到 IndexedDB

4. **导入模式选择**
   - [x] 覆盖导入：完全替换当前数据
   - [x] 合并导入：按资产 id 去重，较新时间戳优先
   - [x] 导入前备份当前状态（支持撤销）

**验证方法**：
- [x] 导出 .zip 文件，检查内部结构是否正确
- [x] 手动解压查看 manifest.json 内容
- [x] 在新浏览器/无痕窗口导入，数据完整还原
- [x] 测试覆盖导入：导入后旧数据全被替换
- [x] 测试合并导入：部分重叠数据正确处理

---

### V0.4 — Word 报告生成
**目标**：一键导出符合模板格式的 .docx 报告

#### 步骤
1. **安装 `docx` 库**
   - [x] `npm install docx`
   - [x] `npm install file-saver`（或直接用 download 方法）

2. **Word 文档构建**
   - [x] 封面页：标题"测评证据截图要求"、版本 V1.0、单位名称、日期
   - [x] 一级标题 = 分类名称（Heading1）
   - [x] 二级标题 = 资产名称（Heading2）
   - [x] 每个检查项：表格行（左列文字 + 右列图片）
   - [x] 多图排列：内嵌 2 列表格，每行 2 张图
   - [x] 图片嵌入：使用 Media.addImage
   - [x] 管理层面特殊处理：自由材料列表样式

3. **导出逻辑集成**
   - [x] 集成必填校验（扫描所有必填项的 images 数组）
   - [x] 校验通过 → 直接导出
   - [x] 校验不通过 → 弹窗提示缺失详情，用户选"继续"或"返回"

4. **样式还原**
   - [x] 还原 Word 模板的字体、字号、间距风格
   - [x] 表格边框样式
   - [x] 图片大小控制（适应 Word 页面宽度）

**验证方法**：
- [x] 导出的 .docx 文件能在 Word 中正常打开
- [x] 封面上显示正确的项目信息
- [x] 一级/二级标题正确展示
- [x] 检查项表格格式正确
- [x] 多图按 2 张一行排列
- [x] 必填项缺失时弹窗提示

---

### V0.5 — 打磨完善
**目标**：模板管理页面、UI 细节还原、错误处理增强

#### 步骤
1. **模板管理页面**
   - [x] 新增"模板管理"弹窗/页面
   - [x] 每个分类的默认检查项 CRUD
   - [x] 修改后影响后续新建的资产

2. **UI 打磨**
   - [x] 加载状态（IndexedDB 恢复期间显示 loading）
   - [x] 空状态提示（暂无资产/暂无检查项）
   - [x] 错误提示（导入格式错误等）
   - [x] 操作确认（删除资产/检查项时确认弹窗）
   - [x] 响应式适配（在不同窗口大小下合理显示）

3. **Edge Cases**
   - [x] 导入不合法 zip 文件的错误处理
   - [x] IndexedDB 容量限制提示（浏览器通常是 50MB~无限）
   - [x] 大图片压缩提示
   - [x] Word 导出时图片过多/过大的处理

4. **Trellis 收尾**
   - [x] 质量检查（lint/typecheck）
   - [x] Spec 更新
   - [x] Git 提交

**验证方法**：
- [x] 模板管理 CRUD 正常
- [x] 修改模板后新建资产自动反映新模板
- [x] 已有资产不受模板修改影响
- [x] 各种边界情况弹窗正常
- [x] `npm run build` 成功产出静态文件
