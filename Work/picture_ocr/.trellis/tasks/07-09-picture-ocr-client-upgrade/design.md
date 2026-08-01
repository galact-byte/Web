# Design: Picture OCR multi-project client upgrade

## Overview

This task keeps the app as a browser-first React/Vite frontend while adding:

1. Multi-project persistence and a project-list shell.
2. Project-level metadata fields required by the report filename and list display.
3. Import/export operations at the project-list level.
4. Better asset editing, paste targeting, and default management material.
5. Internal workspace visual polish guided by the supplied reference screenshot.
6. A Windows desktop client build using a thin Electron shell.

The implementation should preserve existing data-package compatibility and keep all browser side effects inside utilities/providers, not reducers.

## Key decisions

### D1. Desktop client technology

Use **Electron + electron-builder** for the first Windows desktop client.

Reasons:

- Lowest-risk path for a Vite/React app that already runs fully in the browser.
- GitHub Actions can build Windows artifacts with `windows-latest` and `electron-builder`.
- No Rust toolchain requirement for contributors or CI, unlike Tauri.
- Existing IndexedDB, JSZip, docx, drag/drop, and browser APIs continue to run in Chromium.

Initial desktop scope:

- Windows x64 exe/installer or portable executable.
- No auto-update.
- No native file-system data migration; app data remains in Electron Chromium storage.
- Keep existing Release ZIP + BAT flow as a fallback unless it becomes hard to maintain.

Security baseline:

- `nodeIntegration: false`.
- `contextIsolation: true`.
- Load built `dist/index.html` via `BrowserWindow.loadFile` or a minimal safe local protocol.
- No preload API unless future native filesystem integration requires it.

### D2. Multi-project IndexedDB model

Upgrade from one fixed document (`project/current`) to a project collection.

Types:

```ts
interface ProjectMeta {
  projectCode: string;     // optional UI field
  projectName: string;     // optional UI field
  unitName: string;
  systemName: string;
  reportDate: string;      // optional ISO date string, can be ''
}

interface ProjectDocument {
  id: string;
  meta: ProjectMeta;
  categories: Category[];
  assets: Asset[];
  createdAt: number;
  updatedAt: number;
}

interface ProjectSummary {
  id: string;
  meta: ProjectMeta;
  assetCount: number;
  updatedAt: number;
  createdAt: number;
}
```

IndexedDB:

- Keep database name `evidence-collector-db`.
- Increase DB version.
- Add `projects` object store keyed by `id`, indexed by `updatedAt`.
- Keep legacy `project` store during migration for backwards compatibility.
- On first project-list load, if `projects` is empty and legacy `project/current` exists, copy it into `projects` with id `legacy-current` or the original `current` id, adding missing metadata/default fields.

Project DB utilities should expose:

- `listProjects(): Promise<ProjectSummary[]>`
- `loadProject(projectId: string): Promise<ProjectDocument | null>`
- `saveProject(doc: ProjectDocument): Promise<void>`
- `deleteProject(projectId: string): Promise<void>`
- `createProjectDocument(overrides?: Partial<ProjectMeta>): ProjectDocument`

### D3. App shell and provider boundaries

`src/App.tsx` becomes a shell that can render either:

- `ProjectList` when no project is open.
- Existing evidence workspace under `AppProvider` when a project is open.

`AppProvider` should accept `projectId` and lifecycle callbacks rather than hard-coding `current`:

```tsx
<AppProvider projectId={openProjectId} onProjectSaved={refreshProjectList}>
  <Workspace onBackToProjects={...} />
</AppProvider>
```

The reducer still owns only the currently opened project document. The project list should not dispatch asset/item actions; it calls DB/import/export utilities directly and refreshes summaries.

### D4. Project list UI

Add `src/components/ProjectList.tsx`.

List behavior:

- Top bar: title, search input, new project button.
- Search filters by project code, project name, unit name, system name.
- Rows show project code, project name fallback, unit name, system name, updated time, asset count.
- Row actions: `打开`, `导出数据包`, `导入数据包`, `删除`.
- Delete uses `window.confirm` with project display name.
- No copy/duplicate action in first version.

Import behavior:

- Each row has one `导入数据包` button.
- The existing import dialog can be reused/adapted: user selects ZIP and chooses `覆盖导入` or `合并导入` inside the dialog.
- Import target is the row's project id.
- Overwrite import replaces that project's meta/categories/assets but keeps target project id and createdAt.
- Merge import keeps target metadata and merges categories/assets.

Export behavior:

- Row `导出数据包` loads the full document and exports it.
- Project workspace toolbar no longer contains ZIP import/export buttons.

### D5. Project metadata UI

Update `ProjectInfoDialog` fields:

- 项目编号 — optional (`projectCode`).
- 项目名称 — optional (`projectName`).
- 单位名称 — required by business use but not hard-blocking save unless user asks for validation.
- 系统名称 — required for good filename; if empty, filename uses fallback.
- 日期 — optional (`reportDate`, `''` allowed).

For new projects, open the project info dialog immediately after project creation so the user is prompted to fill metadata.

Remove/stop using `evaluator` in UI. Legacy imported/saved packages may still contain `evaluator`; normalization should ignore it or tolerate it.

### D6. Defaults and management material

Add a `制度` material asset to new projects under category `cat-management`.

Preferred low-risk approach:

- Keep “管理层面” category as `freestyle` with no default check-item templates.
- Add `makeAsset('制度', 'cat-management', cats)` in `createPresetAssets`.

For legacy projects loaded from old storage or old data packages, normalize project documents so that if `cat-management` exists and no asset named `制度` exists in that category, add it. This satisfies compatibility without rewriting user data manually.

### D7. Asset double-click editing

In `Sidebar.tsx`, double-clicking the asset/material name area should call the same `handleStartRename` flow as the rename button.

Details:

- Preserve single-click selection.
- Use `onDoubleClick` on the asset row or name region.
- Stop propagation as needed so double-click does not trigger delete/other buttons.
- Preserve Enter save, Escape cancel, blur save.

### D8. Paste target behavior

Current paste support lives inside each `UploadZone`, so `Ctrl+V` only works after focusing the zone. Add an explicit current paste target inside the workspace:

- `ContentArea` owns local `pasteTargetItemId` or equivalent UI state for the active asset.
- Clicking a check-item card body/edge sets that item as the paste target.
- The target card receives a visible accent border/left rail and a short hint such as `当前粘贴目标：Ctrl+V 可直接粘贴截图`.
- `ContentArea` or `ItemCard` listens for paste events while the workspace is focused and routes image clipboard files to the selected target item.
- Existing `UploadZone` paste/drop/click behavior remains available for direct per-item uploads.
- Do not paste into a target while the user is editing text inputs, captions, or dialog fields.

This keeps global project state clean: paste target is transient UI state and should not be persisted in `AppContext`.

### D9. Internal workspace visual reference

Use `C:\Users\g1582\Desktop\stitch_interface_design_enhancement\screen.png` as a style reference, not a pixel-perfect contract.

Practical first pass:

- Improve the active/selected state of the left sidebar and current content card.
- Make check-item cards more document-like with clear header, required badge, compact dotted upload card, and image grid spacing.
- Change the upload zone from a full-width rectangle to a compact tile close to image-thumbnail size, similar to the user's second screenshot: text should emphasize `点击此处后按 Ctrl+V 粘贴` and drag upload.
- Keep Tailwind utility styling and current component structure where possible.
- External project list UI can stay functional/simple because the user plans to refine it after the core implementation.

### D10. Word filename

Change `exportWordReport` filename to:

```text
项目名称_系统名称_测评证据.docx
```

Rules:

- `projectName` fallback: `未命名项目`.
- `systemName` fallback: `未命名系统`.
- Strip or replace Windows-invalid filename characters: `< > : " / \\ | ? *` and control characters.
- Trim whitespace and collapse repeated separators.

The DOCX cover can continue using unit name/date as before unless implementation reveals a clear need to add system/project fields to document content.

### D11. Import merge identity

Current merge by asset id is insufficient when data packages are imported from separately created projects. Enhance merge identity:

Asset match order:

1. Same asset `id`.
2. Same `categoryId` and normalized asset `name`.

Check item match order inside matched assets:

1. Same item `id`.
2. Same non-null `fromTemplateId`.
3. Same normalized item `label`.

Image dedupe:

1. Same image `id`.
2. Same `fileName + uploadedAt`.
3. Optional fallback: same base64 data if cheap in current loop.

Merge should clone nested objects and never mutate caller-owned arrays.

### D12. Data package compatibility

Keep package manifest shape compatible where possible:

- Continue writing `manifest.json` with `meta` and `categories`.
- New `ProjectMeta` fields may be present; import should tolerate missing fields and fill defaults.
- Old packages missing `defaultItems` are already tolerated; preserve this.

## Files likely to change

- `src/types/index.ts`
- `src/data/defaults.ts`
- `src/utils/db.ts`
- `src/utils/exportImport.ts`
- `src/utils/wordExport.ts`
- `src/context/AppContext.tsx`
- `src/context/appReducer.ts`
- `src/App.tsx`
- `src/components/Toolbar.tsx`
- `src/components/Sidebar.tsx`
- `src/components/ProjectInfoDialog.tsx`
- `src/components/ImportDialog.tsx`
- `src/components/ContentArea.tsx`
- `src/components/ItemCard.tsx`
- `src/components/UploadZone.tsx`
- new `src/components/ProjectList.tsx`
- desktop files such as `electron/main.cjs`
- `package.json`, `package-lock.json`
- `.github/workflows/release-picture-ocr.yml`
- `README.md`

## Rollback notes

- Multi-project DB upgrade should not delete the legacy `project` store in the same release.
- If desktop packaging fails in CI, keep web build and Release ZIP working while the Electron build is fixed.
- If migration normalization creates duplicate `制度` assets, matching should be by category + trimmed exact name before adding.
