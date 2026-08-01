# Backend Directory Structure

## Current state

This project has no backend directory structure. The application is a single frontend package with source under `src/` and browser-side utilities under `src/utils/`.

Evidence:
- `package.json` defines Vite scripts only: `dev`, `build`, and `preview`.
- `src/main.tsx` and `src/App.tsx` are the app entry/composition points.
- No `server/`, `api/`, `routes/`, `controllers/`, or backend package exists in the repository.

## Rule for future work

Do not create backend folders or server route conventions while working on normal tasks in this codebase. If a future requirement introduces a real backend, create a dedicated architecture task and update these backend specs from the new implementation.

## Where backend-like concerns live today

- Browser persistence: `src/utils/db.ts` (IndexedDB).
- Data package import/export: `src/utils/exportImport.ts` (JSZip + file download).
- Word report export: `src/utils/wordExport.ts` (docx + browser download).
- State transitions: `src/context/appReducer.ts`.
