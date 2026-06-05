from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


class StaticRegressionTests(unittest.TestCase):
    def test_launcher_revalidates_existing_backend_dependency_marker(self):
        source = read("launcher.py")

        marker_branch = source[source.index("def install_backend_deps") : source.index("def install_frontend_deps")]

        self.assertIn("_backend_deps_ok", marker_branch)
        self.assertIn("import dotenv", source)
        self.assertIn("sys.executable", source)

    def test_launcher_rejects_unsupported_python_versions(self):
        source = read("launcher.py")

        self.assertIn("BACKEND_VENV_DIR", source)
        self.assertIn("_conda_python_commands", source)
        self.assertIn("_find_supported_python", source)
        self.assertIn("_ensure_backend_python", source)
        self.assertIn('"conda"', source)
        self.assertIn('"--json"', source)
        self.assertIn("--clear", source)
        self.assertIn("后端虚拟环境创建后版本仍不受支持", source)
        self.assertIn("SUPPORTED_PYTHON_MIN", source)
        self.assertIn("SUPPORTED_PYTHON_MAX", source)
        self.assertIn("SUPPORTED_NODE_MIN", source)
        self.assertIn("SUPPORTED_NODE_ALT_MIN", source)
        self.assertIn("(3, 10)", source)
        self.assertIn("(3, 12)", source)
        self.assertIn("(20, 19)", source)
        self.assertIn("(22, 12)", source)

    def test_shell_launcher_rejects_unsupported_python_versions(self):
        source = read("start.sh")

        self.assertIn("VENV_DIR=", source)
        self.assertIn("find_supported_python", source)
        self.assertIn("BACKEND_PYTHON=", source)
        self.assertIn("--clear", source)
        self.assertIn("后端虚拟环境创建后版本仍不受支持", source)
        self.assertIn("PY_MIN_MAJOR=3", source)
        self.assertIn("PY_MIN_MINOR=10", source)
        self.assertIn("PY_MAX_MINOR=12", source)
        self.assertIn("NODE_MIN_MAJOR=20", source)
        self.assertIn("NODE_MIN_MINOR=19", source)
        self.assertIn("NODE_ALT_MIN_MAJOR=22", source)
        self.assertIn("NODE_ALT_MIN_MINOR=12", source)

    def test_windows_batch_launcher_stays_ascii_and_defers_errors_to_python(self):
        source = read("start.bat")

        self.assertTrue(all(ord(ch) < 128 for ch in source))
        self.assertNotIn("Python 3.9+", source)
        self.assertNotIn("PROJECT_PYTHON=", source)
        self.assertNotIn("Anaconda3", source)
        self.assertIn('python "%~dp0launcher.py"', source)

    def test_launcher_revalidates_existing_frontend_node_modules(self):
        source = read("launcher.py")

        marker_branch = source[source.index("def install_frontend_deps") : source.index("def start_backend")]

        self.assertIn("_frontend_deps_ok", marker_branch)
        self.assertIn("npm", marker_branch)
        self.assertIn("runtime-core", source)

    def test_backup_exports_current_project_and_progress_fields(self):
        source = read("backend/app/routers/backup.py")

        for required in (
            "priority",
            "remark",
            "contact_name",
            "contact_phone",
            "completed_at",
            "archive_status",
            "current_phase",
            "system_progress_reports",
            "progress_records",
        ):
            self.assertIn(required, source)

    def test_project_update_does_not_bulk_delete_systems(self):
        source = read("backend/app/routers/projects.py")

        self.assertNotIn("db.query(System).filter(System.project_id == project_id).delete()", source)

    def test_scheduled_scraper_start_does_not_deadlock_on_stop(self):
        source = read("backend/app/services/scrape_scheduler.py")
        init_branch = source[source.index("def __init__") : source.index("@property")]

        self.assertIn("threading.RLock()", init_branch)

    def test_docker_compose_requires_secrets_and_persists_data(self):
        source = read("docker-compose.yml")

        self.assertIn("${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}", source)
        self.assertIn("${SECRET_KEY:?SECRET_KEY is required}", source)
        self.assertIn("POSTGRES_HOST: postgres", source)
        self.assertNotIn("DATABASE_URL: postgresql://", source)
        self.assertIn("postgres_data:/var/lib/postgresql/data", source)
        self.assertIn("backend_data:/app/data", source)
        self.assertIn("PROGRESS_CONFIG_FILE: /app/data/progress_config.json", source)
        self.assertIn("PYTHON_IMAGE:", source)
        self.assertIn("NODE_IMAGE:", source)
        self.assertIn("NGINX_IMAGE:", source)
        self.assertIn("${HTTP_PORT:-80}:80", source)

    def test_production_env_template_is_deployable_without_hardcoded_local_paths(self):
        source = read(".env.production.example")

        for required in (
            "PYTHON_IMAGE=python:3.12-slim",
            "NODE_IMAGE=node:22-alpine",
            "NGINX_IMAGE=nginx:alpine",
            "POSTGRES_IMAGE=postgres:16-alpine",
            "POSTGRES_PASSWORD=change-this-database-password",
            "SECRET_KEY=change-this-secret-key",
            "DEFAULT_ADMIN_PASSWORD=change-this-admin-password",
        ):
            self.assertIn(required, source)

        self.assertNotIn("D:\\", source)
        self.assertNotIn("Anaconda3", source)

    def test_deploy_script_checks_docker_compose_and_secret_placeholders(self):
        source = read("deploy.sh")

        self.assertIn("docker compose version", source)
        self.assertIn(".env.production.example", source)
        self.assertIn('grep -q "change-this"', source)
        self.assertIn('docker compose --env-file "$ENV_FILE" up -d --build', source)
        self.assertIn('docker compose --env-file "$ENV_FILE" ps', source)

    def test_nginx_serves_spa_and_proxies_api(self):
        source = read("deploy/nginx.conf")

        self.assertIn("try_files $uri $uri/ /index.html;", source)
        self.assertIn("proxy_pass http://backend:8000/api/;", source)
        self.assertIn("client_max_body_size 50m;", source)

    def test_gitignore_keeps_production_template_but_ignores_real_deploy_config(self):
        source = read(".gitignore")

        self.assertIn(".env.*", source)
        self.assertIn("!.env.production.example", source)
        self.assertIn("docker-compose.override.yml", source)
        self.assertIn("frontend/.vite-check-build-*/", source)


if __name__ == "__main__":
    unittest.main()
