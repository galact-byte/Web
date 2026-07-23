# 状态管理

> 项目使用 React `useReducer` + Context 管理已打开项目的全局可编辑状态，使用 IndexedDB 持久化；没有 Redux、Zustand、React Query 或后端服务器状态缓存。

## 状态边界

| 类型 | 位置与示例 |
| --- | --- |
| 工作台项目状态 | `src/context/appReducer.ts` 的 `AppState`（meta、categories、assets、当前选择） |
| Provider/持久化协调 | `src/context/AppContext.tsx`（加载、500ms 防抖保存、保存队列、卸载刷新） |
| 瞬时页面 UI | 各组件的 `useState`，如 `src/components/ProjectList.tsx` 的搜索、展开集、对话框和保存中状态 |
| 路由状态 | `src/App.tsx` 读取和写入 `window.location.hash` |
| 本机偏好 | `LanMobileCollector.tsx` 使用 `localStorage` 保存图片来源方式 |

## 共享项目状态

- 改动项目领域数据时定义判别联合 `AppAction` 并在 `appReducer` 内以不可变方式更新；`ADD_IMAGE`、`RENAME_ITEM`、`REORDER_IMAGES` 是现有模式。不要在组件中直接修改数组、asset 或 image 对象。
- 组件通过 `useAppState()` 读取，通过 `useDispatch()` 分发动作；需要同步落盘保证的 LAN 图片写入使用 `useAppContext().addImageAndSave()`，见 `src/App.tsx`。
- reducer 负责纯状态转换和选择修复。例如 `LOAD_PROJECT` 调用 `pickActiveSelection`，删除资产后选择同分类的第一个剩余资产。副作用、IndexedDB 和计时器不放入 reducer。

## 检查项顺序变更约定

- 检查项的创建与排序都必须通过 `appReducer`：手动 `ADD_ITEM` 创建 `required: true` 的项并插入 `items` 首位；排序分发 `{ type: 'REORDER_ITEMS', payload: { assetId, itemIds } }`。
- `REORDER_ITEMS` 的 `itemIds` 是目标资产检查项的**完整排列**，而不是只含被移动项的局部列表。reducer 必须拒绝资产不存在、长度不等、重复 ID 或未知 ID 的 payload，并原样返回 state；这可防止陈旧拖拽状态损坏或丢失已有检查项。
- 检查项排序的临时拖拽状态属于页面组件，不写进项目文档；只有放开后确认生成的新 `itemIds` 才分发领域 action。排序组件不得自行调用 IndexedDB 保存。

```ts
const itemIds = asset.items.map((item) => item.id);
// 移除源项并插入目标位置后再提交完整顺序。
dispatch({ type: 'REORDER_ITEMS', payload: { assetId: asset.id, itemIds } });
```

## 持久化流程

- `AppProvider` 先从 IndexedDB 加载项目，加载完成后才允许自动保存，防止初始默认值覆盖已存数据。
- 普通编辑经 500ms 防抖调用 `saveProject`；`saveQueueRef` 串行化保存，避免异步写入逆序。不要在组件额外复制这个防抖保存流程。
- 需要服务端/LAN 确认的图片采用 `addImageAndSave`：先基于当前 reducer 状态生成 document、等待 IndexedDB 成功保存、再 dispatch，确保移动端不会提前报告成功。

## 局部与派生状态

- 仅由一个视图使用的输入、弹窗、loading、错误消息、Set 选择状态保留在该组件中；如 `ProjectList.tsx`。
- 可由已有 state 推导的列表/当前项不重复存储，使用 `useMemo` 或 reducer helper，如 `LanMobileCollector.tsx` 的 `visibleAssets` 与 `appReducer.ts` 的 `getAssetsForCategory`。

## 避免

- 不要引入新的全局状态库或服务器状态库来包装现有 Context/IndexedDB 流程。
- 不要在 reducer 中执行 IndexedDB、fetch、随机异步操作或修改输入对象。
- 不要在数据尚未加载时写入，也不要绕过队列导致旧保存覆盖新保存。
