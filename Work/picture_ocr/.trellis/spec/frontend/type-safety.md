# TypeScript 类型安全

> `tsconfig.json` 开启 `strict`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch` 与 `isolatedModules`。应用类型使用 TypeScript interface/type 和浏览器 DOM 类型，不使用运行时 schema 库。

## 类型归属

- 跨 Context、组件、导入导出和持久化共享的领域模型集中在 `src/types/index.ts`，包括 `ProjectDocument`、`Asset`、`CheckItem`、`ImageData`、`ExportPackage` 等。
- 某个模块自己的 Props、表单状态和协议细节放在靠近使用点的文件。例如 `src/components/project-list/ProjectGroupDialog.tsx` 的 `FormValues`，`src/utils/lanBridge.ts` 的 LAN 接口，`src/utils/wordExport.ts` 的 `ValidationMissing`。
- 只用于类型检查的引用必须写 `import type`，例如 `src/App.tsx`、`src/components/project-list/ProjectTableRow.tsx` 与 `src/utils/imageFiles.ts`。

## 建模模式

- 状态操作用可判别联合表达，`src/context/appReducer.ts` 的 `AppAction` 以字符串 `type` 和准确 payload 组成；新增动作必须同步补全 reducer 分支。
- 从已有联合精确取得 payload 时使用 `Extract`，如 `AppContext.tsx` 的 `addImageAndSave` 参数，而非复制容易漂移的 payload 接口。
- 有效性缩窄通过标准 TypeScript 模式实现：`error instanceof Error`、可选链与空值合并、类型谓词 `.filter((img): img is ImageData => !!img)`；后者见 `appReducer.ts` 的图片重排。
- Electron preload 注入的全局窗口接口声明在 `src/vite-env.d.ts`；`src/utils/lanBridge.ts` 再将其收敛为组件使用的 `LanBridge` 类型，组件不直接对 `window` 或 bridge 使用 `any`/匿名断言。

## 运行时边界

- TypeScript 不验证文件、IndexedDB、fetch 或导入包。边界函数必须在运行时检查：`src/utils/evidencePackage.ts` 的 `validateEvidenceEnvelope` 校验加密包，`src/components/LanMobileCollector.tsx` 检查 HTTP 状态、图片 MIME 和 10MB 限制。
- `response.json()` 等外部 JSON 目前会在确认 HTTP 状态后收窄为局部协议类型（如 `src/components/LanMobileCollector.tsx` 的 `LanCollectorSnapshot`）；解析失败和非成功响应保留安全回退消息。新增外部协议应先做运行时字段校验，不要仅复制该现有断言。

## 避免

- 不要为新代码使用 `any`、宽泛 `as` 或非空断言来绕过严格检查。现有受控例外包括 React 根节点的 `document.getElementById('root')!`（`src/main.tsx`）、已校验加密信封后的内部转换（`src/utils/evidencePackage.ts`）及 IndexedDB API 返回值（`src/utils/db.ts`）；新增例外应紧邻运行时检查或平台 API 边界。
- 不要复制已存在的领域接口；先从 `src/types/index.ts` 或相关 util 导入。
- 不要将编译期类型当成导入文件、网络响应或浏览器能力的运行时校验。
