# Backend Database Guidelines

## Current state

There is no backend database, ORM, migration system, or server-side query layer in this repository.

Evidence:
- `package.json` has no database, ORM, migration, or server framework dependencies.
- Project persistence is browser-local IndexedDB in `src/utils/db.ts`.
- The persisted shape is `ProjectDocument` from `src/types/index.ts`.

## Frontend persistence facts

Although there is no backend database, future agents should know the current browser persistence contract:

- Database name: `evidence-collector-db`.
- Version: `1`.
- Object store: `project` with key path `id`.
- Current project key: `current`.
- Index: `updatedAt`.
- Access helpers: `saveProject`, `loadProject`, and `clearProject` in `src/utils/db.ts`.

## Migration guidance

There are no migrations today. If IndexedDB schema changes, update `DB_VERSION` and handle `request.onupgradeneeded` in `src/utils/db.ts` without losing existing `ProjectDocument` data.

## Anti-patterns

- Do not add server database assumptions to frontend tasks.
- Do not introduce an ORM for the current browser-only persistence.
- Do not store unrelated app state in IndexedDB outside the existing project document without updating type and migration guidance.
