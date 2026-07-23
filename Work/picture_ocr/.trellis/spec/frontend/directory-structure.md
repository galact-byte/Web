# 前端目录结构

> 本项目是单一 React + Vite + TypeScript 应用；按运行职责组织，而非按独立 npm 包组织。

## 实际布局

```text
src/
├── App.tsx                 # Hash 路由、运行形态分流和应用装配
├── main.tsx                # React 根节点和 PWA 初始化（见 `src/main.tsx`）
├── components/             # 桌面、移动端和对话框组件
│   └── project-list/       # 项目列表专属子组件与 UI 常量
├── context/                # 全局项目状态、reducer 与持久化协调
├── data/                   # 内置分类和资产默认数据
├── types/                  # 跨层领域模型和导出包模型
├── utils/                  # IndexedDB、导入导出、图片、LAN、PWA、Word 等边界逻辑
├── assets/                 # 由 Vite 打包的资源（当前为 `src/assets/cover-decoration.png`）
└── index.css               # Tailwind 指令与全局文字样式（见 `src/index.css`）
```

仓库根目录的 `electron/` 为桌面主进程与 preload，`scripts/` 为构建或可执行验证脚本；它们不是 React 组件目录。

## 放置规则

- 新的屏幕级分流、hash 解析和 `AppProvider` 装配留在 `src/App.tsx`。例如其分别渲染 `ProjectList`、`MobileCollector` 和 `LanMobileCollector`。
- 可复用的视图片段放在 `src/components/`；仅服务于项目列表的拆分文件放在 `src/components/project-list/`，如 `ProjectTableRow.tsx`、`ProjectListHeader.tsx` 与 `projectListUi.ts`。
- 共享的项目状态动作放在 `src/context/appReducer.ts`；Provider、IndexedDB 加载及防抖保存放在 `src/context/AppContext.tsx`。不要在多个组件各自实现相同的项目保存流程。
- 跨组件和跨工具层的领域类型集中于 `src/types/index.ts`。边界处理、浏览器 API 和数据转换放到对应的 `src/utils/` 文件，而非塞进渲染组件。
- 内置初始模板维护在 `src/data/defaults.ts`，不要在组件内复制分类或检查项常量。

## 命名和导入

- React 组件文件及导出组件使用 PascalCase，例如 `LanCollectorDialog.tsx` 和 `ProjectTableRow.tsx`；非组件模块使用 camelCase，例如 `appReducer.ts`、`imageFiles.ts`。
- Props 接口以组件名加 `Props` 命名；仅内部使用的状态和辅助类型可在同文件定义，例如 `ProjectTableRowProps` 与 `DialogState`。
- 领域模型从 `../types` 以 `import type` 导入；运行时逻辑使用相对路径导入。本项目未配置路径别名。

## 参考实现

- `src/App.tsx`：顶层路由/装配与屏幕级状态。
- `src/context/AppContext.tsx`、`src/context/appReducer.ts`：状态与持久化职责分开。
- `src/components/ProjectList.tsx` 与 `src/components/project-list/`：复杂页面按本地子目录拆分。

## 避免

- 不要新增没有实际复用关系的 `hooks/`、`services/` 或 feature 根目录；当前项目没有这类目录约定。
- 不要把 Electron 主进程或 Node 功能放进 `src/`，也不要让 React 组件直接操作 IndexedDB、ZIP 或 Word 生成实现。
