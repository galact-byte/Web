import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.database import build_database_url


class DatabaseConfigTests(unittest.TestCase):
    def test_explicit_database_url_takes_precedence(self):
        env = {
            "DATABASE_URL": "mysql+pymysql://user:pass@db:3306/project_completion",
            "POSTGRES_HOST": "postgres",
            "POSTGRES_PASSWORD": "postgres-password",
        }

        self.assertEqual(
            build_database_url(env),
            "mysql+pymysql://user:pass@db:3306/project_completion",
        )

    def test_postgres_parts_are_url_encoded(self):
        env = {
            "POSTGRES_HOST": "postgres",
            "POSTGRES_PORT": "5432",
            "POSTGRES_DB": "project_completion",
            "POSTGRES_USER": "project_user",
            "POSTGRES_PASSWORD": "p@ss:word/with#chars",
        }

        self.assertEqual(
            build_database_url(env),
            "postgresql://project_user:p%40ss%3Aword%2Fwith%23chars@postgres:5432/project_completion",
        )

    def test_sqlite_is_default_when_no_database_settings_exist(self):
        self.assertEqual(build_database_url({}), "sqlite:///./project_completion.db")


if __name__ == "__main__":
    unittest.main()
