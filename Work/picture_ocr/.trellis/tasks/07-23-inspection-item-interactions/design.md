# 技术设计：检查项交互与安全排序

## 目标边界

本次改动仅覆盖桌面工作台资产检查项列表：手动新增检查项的默认值与插入位置、现有必填状态开关，以及显式进入的检查项排序模式。模板管理和移动端采集界面不改动。

Web 和 Electron 共用 `src/` 中的 React 渲染逻辑；Electron 通过打包后的 `dist/` 提供相同交互。

## 架构与职责

- `src/context/appReducer.ts` 是检查项数组顺序的唯一领域状态所有者：
  - `ADD_ITEM` 创建 `required: true` 的新检查项，并插入目标资产 `items` 数组开头。
  - `REORDER_ITEMS` 接收 `assetId` 和完整 `itemIds` 顺序；仅当 ID 集合、数量和去重校验全部通过时才重建列表。
- `src/context/AppContext.tsx` 不变：reducer 变更继续经既有 500ms 防抖保存队列持久化至 IndexedDB。
- `src/components/ContentArea.tsx` 拥有排序模式以及所有未持久化的拖拽状态：拖动源、悬浮副本、`previewItemIds`、列表布局快照与自动滚动 rAF 生命周期。
- `src/components/ItemCard.tsx` 保持普通操作卡职责，并提供隔离的 `isSorting` 变体；排序时仅渲染标题、序号、占位状态及专用手柄。

## 交互与数据流

```text
用户点击“调整顺序”
  → ContentArea: 进入 isSortingItems，清除粘贴目标
  → 列表仅渲染排序卡，工具栏显示说明与“完成排序”

用户从手柄 PointerDown，移动超过 8px
  → 创建 fixed、pointer-events:none 的悬浮副本
  → 依据当前指针和各排序卡实时 rect 生成 previewItemIds
  → 列表立即按 previewItemIds 渲染，其他卡通过 FLIP 平滑让位
  → 指针在主滚动容器距顶部/底部 80px 内时，rAF 每帧最多滚动 18px，
    并在滚动后重新计算预览顺序

PointerUp
  → dispatch(REORDER_ITEMS, previewItemIds)（仅顺序实际变化时）
  → AppProvider 自动保存
PointerCancel / 退出排序 / 切换资产
  → 丢弃 previewItemIds，停止 rAF，恢复领域顺序
```

手柄使用 `onPointerDown`，在 `pointermove` 中达到 8px 阈值才开始拖拽；鼠标和触屏均由 Pointer Events 覆盖。拖拽期间监听窗口级 `pointermove`、`pointerup` 与 `pointercancel`，开始后对手柄调用 `setPointerCapture`。手柄以 `touchAction: 'none'` 隔离触控拖拽；普通模式完全不安装检查项排序 Pointer 流程。

自动滚动的所有停止路径共用清理函数：离开边缘、到达滚动边界、抬起/取消指针、退出排序、切换资产和组件卸载。

## 视觉与可访问性

- 沿用 slate/blue/red、直角/轻描边的功能型界面，不添加新依赖、渐变或装饰性面板。
- 普通模式工具栏保留新增输入框和“调整顺序”；排序模式只显示排序说明和“完成排序”。
- 悬浮副本跟随指针，源卡显示半透明虚线占位；列表元素使用 180ms FLIP 动画，`prefers-reduced-motion` 时不播放动画。
- 拖拽手柄是带中文 `aria-label` 与 `title` 的原生按钮，最小 `44×44px` 并有可见 focus ring。
- 排序模式不虚构键盘排序功能；入口、完成按钮和普通模式操作仍可由键盘使用。
- 移除无意义竖向三点；重命名和删除图标按钮具备中文 `aria-label`。

## 兼容性、失败与回滚

- `CheckItem` 与 IndexedDB 文档结构不变，已有项目数据无需迁移。
- `REORDER_ITEMS` 遇到不完整、重复或未知 ID 的 payload 返回原 state，避免陈旧 UI 损坏数据。
- 不使用 HTML5 `draggable` 管理检查项，避免与普通模式图片排序冲突。
- 回滚只需撤销本任务涉及的 reducer、两个组件、验证脚本、文档和配置；数据格式没有变化。
