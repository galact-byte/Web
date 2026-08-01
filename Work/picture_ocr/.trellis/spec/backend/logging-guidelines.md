# Backend Logging Guidelines

## Current state

There is no backend logger, log aggregation, structured logging format, or server log level policy in this repository.

Evidence:
- The app runs in the browser through Vite/React.
- `package.json` has no logging library dependency.
- Existing logging uses the browser console in frontend files.

## Existing browser logging

Use console logging sparingly for internal diagnostics that are not the primary user feedback path:

- `src/context/AppContext.tsx` uses `console.error` when IndexedDB load/save fails.
- `src/components/ItemCard.tsx` uses `console.warn` when an uploaded image is larger than 5 MB.
- `src/utils/wordExport.ts` uses `console.warn` when the optional cover decoration image cannot be loaded.

User-facing import/export outcomes should remain visible through alerts or `ImportResult.message`, not only console logs.

## Sensitive data

Screenshots and project metadata may contain assessment evidence. Do not log base64 image data, full ZIP contents, DOCX binary data, or sensitive project details to the console.

## Rule for future backend introduction

If a backend is added later, define log levels, redaction rules, request correlation, and deployment-specific logging from actual server code. Until then, backend logging guidance is not applicable.
