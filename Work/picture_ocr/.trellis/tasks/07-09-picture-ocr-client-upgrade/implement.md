# Implementation plan: Picture OCR multi-project client upgrade

## Validation command

Run after each major milestone when possible:

```bash
npm run build
```

Desktop packaging validation after Electron setup:

```bash
npm run desktop:pack
```

If `desktop:pack` is too slow locally, at least run:

```bash
npm run build
npm run desktop:build -- --dir
```

## Milestone 1 — Domain types, defaults, normalization

1. Update `src/types/index.ts`:
   - Add `projectCode` and `systemName` to `ProjectMeta`.
   - Remove active use of `evaluator` from new metadata shape; tolerate legacy data during normalization rather than exposing it.
   - Add `createdAt` to `ProjectDocument`.
   - Add `ProjectSummary` if useful for DB/list UI.
2. Update `src/data/defaults.ts`:
   - `createDefaultMeta()` returns `projectCode`, `projectName`, `unitName`, `systemName`, `reportDate`.
   - Allow `reportDate` to be optional/empty if needed by UI.
   - Add `制度` asset under `cat-management` in `createPresetAssets`.
3. Add normalization helpers, either in `db.ts` or a small utility:
   - Fill missing metadata fields from old docs/packages.
   - Add missing `createdAt`.
   - Ensure management `制度` asset exists once.
4. Build check.

## Milestone 2 — Multi-project IndexedDB utilities

1. Upgrade `src/utils/db.ts`:
   - DB version bump.
   - Add `projects` object store and indexes.
   - Keep legacy `project` store.
2. Implement:
   - `listProjects`
   - `loadProject(projectId)`
   - `saveProject(doc)`
   - `deleteProject(projectId)`
   - `createProjectDocument`
   - legacy migration from `project/current` to `projects` if needed.
3. Keep save/load connection close behavior.
4. Build check.

## Milestone 3 — App shell and project list

1. Refactor `AppProvider` to accept `projectId`; load/save that project id instead of hard-coded `current`.
2. Refactor `App.tsx`:
   - Manage selected/open project id at top level.
   - Render project list when no project is open.
   - Render workspace when a project is open.
3. Add `src/components/ProjectList.tsx`:
   - Search input.
   - New project button.
   - Rows with open/export/import/delete actions.
   - Delete confirmation.
4. New project should open the project and prompt project info dialog.
5. Build check.

## Milestone 4 — Toolbar and metadata UI

1. Remove data-package import/export buttons from project workspace toolbar.
2. Add/keep:
   - Back to project list.
   - Project info.
   - Template management.
   - Word export.
3. Update `ProjectInfoDialog` fields:
   - 项目编号
   - 项目名称
   - 单位名称
   - 系统名称
   - 日期
4. Remove personnel/evaluator input from UI.
5. Build check.

## Milestone 5 — Import/export package behavior

1. Adapt `exportDataPackage` to accept a whole `ProjectDocument` or continue accepting meta/categories/assets but call it from the project list with the selected project.
2. Adapt import flow:
   - Project row `导入数据包` opens dialog with target project id.
   - Dialog still lets user choose overwrite vs merge.
   - Overwrite keeps target project `id` and `createdAt`; replaces meta/categories/assets from package after normalization.
   - Merge keeps target metadata; merges categories/assets.
3. Enhance merge logic:
   - Match assets by id or category + normalized name.
   - Match items by id, fromTemplateId, or normalized label.
   - Deduplicate images by id and fileName+uploadedAt; optionally by data if simple.
4. Build check.

## Milestone 6 — Asset double-click, paste target, and Word filename

1. Update `Sidebar.tsx` double-click behavior for asset/material rename.
2. Add explicit paste target behavior in the workspace:
   - Clicking an item/card edge selects it as the current paste target.
   - Selected target is visibly highlighted.
   - `Ctrl+V` routes clipboard images to that item when not editing text/dialog fields.
   - Existing per-upload-zone paste/drop/click remains intact.
3. Lightly polish internal workspace visuals toward the supplied reference screenshot:
   - stronger selected/required state,
   - compact thumbnail-sized dotted upload card instead of full-width rectangle,
   - card spacing and left-edge highlight.
4. Update `wordExport.ts` filename helper:
   - `项目名称_系统名称_测评证据.docx`.
   - Fallback project/system names.
   - Sanitize invalid Windows filename characters.
5. Build check.

## Milestone 7 — Electron desktop client

1. Add Electron dev dependencies:
   - `electron`
   - `electron-builder`
   - optionally `wait-on`/`concurrently` only if a dev desktop script is needed; avoid if not necessary.
2. Add `electron/main.cjs`:
   - secure BrowserWindow config.
   - load `dist/index.html` for packaged app.
3. Add package scripts:
   - `desktop:build` / `desktop:pack` / `desktop:dist` as appropriate.
4. Configure electron-builder for Windows output.
5. Update release workflow to build/upload desktop artifacts in addition to the web ZIP, or add a second job for Windows desktop artifacts.
6. Update README with desktop build/release instructions.
7. Validate web build and at least one desktop packaging command.

## Milestone 8 — Final verification and review

1. Run `npm run build`.
2. Run desktop packaging validation if dependencies and OS support are available.
3. Manual smoke checks in browser:
   - App starts at project list.
   - New project opens and can save project info.
   - Search filters projects.
   - Delete project confirms.
   - Asset double-click rename works.
   - Clicking a card edge sets a visible paste target and Ctrl+V pastes into that target.
   - Management `制度` appears in new projects.
   - Data package export from list works.
   - Overwrite import targets selected row.
   - Merge import merges same category + same asset name.
   - Word filename matches rule.
4. Review `git status` to ensure no generated `dist/`, local `release/`, or desktop output directories are staged unless intended.

## Risk controls

- Do not remove legacy DB store during this task.
- Keep reducer pure; no IndexedDB/JSZip/docx/Electron calls from reducer.
- Avoid broad rewrites of `ItemCard`/upload logic beyond the paste-target and visual polish scope.
- Do not introduce personnel fields after user explicitly removed them.
- Do not add auto-update to desktop client.
