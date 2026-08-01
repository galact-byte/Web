# Backend Error Handling

## Current state

There is no backend error-handling layer because this repository has no backend service or API response format.

Evidence:
- No server framework or route files exist.
- User-visible failures are handled in frontend code such as `src/App.tsx` and `src/utils/exportImport.ts`.

## Applicable frontend patterns

When a task touches browser-side behavior that resembles backend integration, follow the frontend conventions instead:

- Export failures in `src/App.tsx` are caught and displayed with Chinese `alert` messages using `err instanceof Error ? err.message : '未知错误'`.
- Import failures in `src/utils/exportImport.ts` return an `ImportResult` with `success: false` and a Chinese message instead of throwing to the UI.
- IndexedDB load/save failures in `src/context/AppContext.tsx` are logged with `console.error`; load failure falls back to `CLEAR_PROJECT`.
- DOCX cover decoration load failure in `src/utils/wordExport.ts` is non-fatal and logged with `console.warn`.

## Rule for future backend introduction

If a real backend is added later, define its error types, logging, and API response format from actual route/service code before using this spec for backend work.

## Anti-patterns

- Do not invent HTTP status conventions for this browser-only app.
- Do not swallow import/export or persistence errors silently.
- Do not convert frontend `ImportResult` user messages into exceptions unless the UI flow is also changed.
