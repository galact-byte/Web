# Backend Quality Guidelines

## Current state

Backend quality gates are not applicable because the repository has no backend package.

Evidence:
- `package.json` contains Vite frontend scripts only.
- `src/` contains React components, context, browser utilities, and TypeScript types.
- There are no backend tests, route handlers, controllers, services, migrations, or server entry points.

## What to run instead

For this project, use the frontend build gate:

```bash
npm run build
```

This command type-checks the TypeScript frontend and builds the Vite app.

## Review focus for backend-like changes

If a change touches persistence or export logic, review it as frontend/browser integration work:

- IndexedDB changes: `src/utils/db.ts` and `src/context/AppContext.tsx`.
- ZIP import/export changes: `src/utils/exportImport.ts`.
- DOCX export changes: `src/utils/wordExport.ts`.
- Domain type changes: `src/types/index.ts` and reducer updates in `src/context/appReducer.ts`.

## Anti-patterns

- Do not add backend-only tooling, lint scripts, or test requirements that have no code to run against.
- Do not describe server code review standards as if they already exist.
- Do not modify product source just to satisfy backend spec templates.
