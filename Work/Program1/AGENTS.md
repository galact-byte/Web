# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains the FastAPI application: `main.py` (routes/startup), `models.py` (SQLAlchemy models), `schemas.py` (request/response schemas), `db.py` (engine/session), and `validators.py` (input checks).
- `app/services/` holds domain logic such as report generation/export.
- `app/templates/` and `app/static/` store Jinja2 pages and frontend assets.
- `tests/` contains integration-style API tests, currently centered in `tests/test_api.py`.
- Runtime/output paths include `uploads/`, `exports/`, and default SQLite file `app.db`.
- Windows launchers: `start.bat` (full mode) and `start_lite.bat` (lite mode).

## Build, Test, and Development Commands
- Create virtual environment: `python -m venv .venv`
- Install dependencies (locked preferred): `.\.venv\Scripts\python -m pip install -i https://pypi.org/simple --timeout 20 --retries 1 -r requirements.lock.txt`
- Run app locally: `.\.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8011 --reload`
- Run tests: `.\.venv\Scripts\python -m unittest discover -s tests -p "test_*.py" -v`
- One-click local boot on Windows: run `start.bat`.

## Coding Style & Naming Conventions
- Target Python 3.12+, UTF-8 files, and 4-space indentation.
- Use `snake_case` for functions/variables, `PascalCase` for classes, and concise route/query parameter names.
- Keep validation in `schemas.py`/`validators.py`; move heavy business logic into `app/services/`.
- Preserve existing module boundaries before introducing new top-level packages.

## Testing Guidelines
- Test stack uses `unittest` with FastAPI `TestClient`.
- Name files `test_*.py`; use descriptive method names like `test_01_org_system_report_flow`.
- Prefer isolated databases in tests (`sqlite:///:memory:`) and explicit auth flags through environment variables.

## Commit & Pull Request Guidelines
- Follow commit prefixes used in history: `feat:`, `fix:`, `docs:`.
- Keep each commit focused on one change set and describe behavioral impact.
- PRs should include: summary, changed paths, executed test command/results, and screenshots for template/UI updates.

## Security & Configuration Tips
- Use environment variables for behavior switches (`DATABASE_URL`, `API_AUTH_REQUIRED`, `ENABLE_API_DOCS`, `APP_LITE_MODE`, `FORCE_HTTPS`).
- Do not commit secrets, local `.env*`, runtime uploads, exports, or database artifacts.

## Sandbox Escalation Rules
- For `pip` install actions and filesystem deletion actions, request sandbox elevation only after explicit user approval.
- Before any `pip` action, print Python version, `pip` version, and interpreter path; use explicit `-i`, `--timeout`, and `--retries`.
- Run package installs sequentially (no parallel `pip install` commands), and stop if install output is stalled.
- For delete operations, scope commands to user-approved paths only and never remove lite-delivery files (`start_lite.bat`, `README_LITE.md`) unless explicitly requested.
