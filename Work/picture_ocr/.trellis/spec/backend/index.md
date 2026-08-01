# Backend Development Guidelines

This repository currently has no backend service. It is a pure browser-based React/Vite/TypeScript app.

## Applicability

The files in this directory intentionally document non-applicability so future agents do not invent server routes, databases, APIs, or backend logging infrastructure.

| Guide | Applicability |
|-------|---------------|
| [Directory Structure](./directory-structure.md) | No backend directories exist; do not add one unless the product architecture changes. |
| [Database Guidelines](./database-guidelines.md) | No server database or ORM; browser persistence uses IndexedDB in the frontend. |
| [Error Handling](./error-handling.md) | No API error response layer; frontend handles browser/import/export errors. |
| [Logging Guidelines](./logging-guidelines.md) | No backend logger; only browser console logging exists for internal failures. |
| [Quality Guidelines](./quality-guidelines.md) | Backend checks are not applicable; use frontend build checks. |

## Source-backed evidence

- `package.json` has only Vite scripts (`dev`, `build`, `preview`) and no server framework dependency.
- `src/utils/db.ts` uses `indexedDB`, proving persistence is browser-local.
- `src/utils/exportImport.ts` and `src/utils/wordExport.ts` run ZIP/DOCX export in the browser.
