# 组件规范

> 组件以函数组件实现，Props 使用同文件接口显式描述；样式主要直接通过 Tailwind utility class 编写。

## 组件形态与 Props

- 使用具名 Props 接口和 `React.FC<Props>`。例如 `src/components/project-list/ProjectTableRow.tsx` 的 `ProjectTableRowProps`，以及 `src/components/ConfirmDialog.tsx` 的 `ConfirmDialogProps`。
- 回调 Props 表示用户意图并由父层完成状态更新或副作用，例如 `onOpen`、`onDelete`、`onConfirm`，不要把父级状态写入细节隐藏在展示组件中。
- 复杂页面可以保留局部 UI 状态；需要跨工作台共享或持久化的项目数据通过 `useAppState()`、`useDispatch()`、`useAppContext()` 获取，参见 `src/components/ContentArea.tsx` 和 `src/App.tsx`。
- 对仅由当前模块使用的辅助行组件可与父组件同文件定义；`src/components/TemplateDialog.tsx` 中的 `TemplateItemRow` 是现有示例。可独立使用的项目列表单元则拆到 `components/project-list/`。

## 文件内组织

通常按以下顺序：React/类型/本地模块导入、Props 或本地类型、组件及其 handlers、JSX、默认导出。需要性能稳定引用或 effect 依赖时使用 `useCallback`/`useMemo`，如 `src/App.tsx` 的 LAN 快照和导出 handlers；不要为简单 JSX 常量机械包裹 memo。

## 样式

- 直接在 `className` 使用 Tailwind 类，沿用现有的 slate/blue/red 色彩、边框、直角卡片和响应式断点写法。`src/components/project-list/ProjectTableRow.tsx` 和 `src/components/LanMobileCollector.tsx` 是代表例子。
- 全局基础字体与 `.text-sm`/`.text-xs` 文字大小覆写只位于 `src/index.css`；除非确属全局基础规则，不要新增组件专属全局 CSS。
- 重复的项目列表网格类抽到 `src/components/project-list/projectListUi.ts`，而不是复制到表头和表格行。

## 可访问性与交互

- 对话框容器使用 `role="dialog"` 和 `aria-modal="true"`；有可见标题时以 `aria-labelledby` 关联它，参见 `src/components/LanCollectorDialog.tsx`。无独立标题的图片预览 `src/components/ImageViewer.tsx` 目前只有 `role`/`aria-modal`，新增或重构时不要将其误作完整命名范例。
- 状态通知使用 `role="status"` 或 `aria-live`，见 `LanCollectorDialog.tsx` 和 `PwaReadinessCard.tsx`。
- 新增仅有图标或关闭符号的按钮必须有中文 `aria-label`，输入错误状态通过 `aria-invalid` 暴露，见 `src/components/project-list/NewProjectDialog.tsx`。历史 `ImageViewer.tsx` 的图标按钮仅有 `title`，不应复制；应在后续触及该组件时补齐。
- 使用语义化 `button`、`label`、`input`；移动端及对话框中的按钮通常写明 `type="button"`，参见 `src/components/LanMobileCollector.tsx` 和 `LanCollectorDialog.tsx`。项目列表及早期组件存在省略该属性的历史写法；新增表单内按钮应显式写明，且保留禁用状态。

## 避免

- 不要将网络请求、IndexedDB 保存、导入导出协议直接揉进纯展示组件；应经 Context 或 `utils/` 边界调用。
- 不要用不可访问的普通 `div` 代替按钮/对话框，也不要遗漏加载、禁用或错误反馈。
- 不要在多个组件复制相同的布局常量或状态变更逻辑。
