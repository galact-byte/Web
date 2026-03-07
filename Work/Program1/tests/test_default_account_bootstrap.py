import importlib
import os
import unittest
from datetime import datetime
from unittest.mock import patch


def reload_modules():
    import app.db as db_module
    import app.main as main_module
    import app.models as models_module

    importlib.reload(db_module)
    importlib.reload(models_module)
    importlib.reload(main_module)
    return db_module, main_module, models_module


class DefaultAccountBootstrapTests(unittest.TestCase):
    def setUp(self):
        os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
        os.environ['API_AUTH_REQUIRED'] = '0'
        os.environ.pop('DEFAULT_ADMIN_PASSWORD', None)
        os.environ.pop('DEFAULT_TESTER_PASSWORD', None)
        os.environ.pop('DEFAULT_LEADER_PASSWORD', None)

    def test_bootstrap_accounts_use_documented_default_passwords(self):
        with patch('pathlib.Path.write_text', return_value=0):
            db_module, main_module, models_module = reload_modules()
            db_module.init_db()
            main_module.ensure_user_account_schema()
            main_module.ensure_default_accounts()

        db = db_module.SessionLocal()
        try:
            expectations = {
                'admin': 'admin123',
                'tester': 'tester123',
                'leader': 'leader123',
            }
            for username, password in expectations.items():
                user = db.query(models_module.UserAccount).filter(models_module.UserAccount.username == username).first()
                self.assertIsNotNone(user, f'{username} 未初始化')
                ok, _ = main_module.verify_password(password, user.password_hash)
                self.assertTrue(ok, f'{username} 默认密码未与文档保持一致')
        finally:
            db.close()

    def test_untouched_bootstrap_accounts_are_realigned_to_documented_passwords(self):
        with patch('pathlib.Path.write_text', return_value=0):
            db_module, main_module, models_module = reload_modules()
            db_module.init_db()
            main_module.ensure_user_account_schema()

            db = db_module.SessionLocal()
            try:
                db.add(
                    models_module.UserAccount(
                        username='admin',
                        password_hash=main_module.hash_password('random-admin-password'),
                        role='admin',
                        enabled=True,
                        must_change_password=True,
                    )
                )
                db.add(
                    models_module.UserAccount(
                        username='tester',
                        password_hash=main_module.hash_password('random-tester-password'),
                        role='evaluator',
                        enabled=True,
                        must_change_password=True,
                    )
                )
                db.add(
                    models_module.UserAccount(
                        username='leader',
                        password_hash=main_module.hash_password('random-leader-password'),
                        role='reviewer',
                        enabled=True,
                        must_change_password=True,
                    )
                )
                db.commit()
            finally:
                db.close()

            main_module.ensure_default_accounts()

        db = db_module.SessionLocal()
        try:
            expectations = {
                'admin': 'admin123',
                'tester': 'tester123',
                'leader': 'leader123',
            }
            for username, password in expectations.items():
                user = db.query(models_module.UserAccount).filter(models_module.UserAccount.username == username).first()
                ok, _ = main_module.verify_password(password, user.password_hash)
                self.assertTrue(ok, f'{username} 未被兼容修复为文档默认密码')
        finally:
            db.close()

    def test_bootstrap_accounts_still_realign_after_first_login_before_password_change(self):
        with patch('pathlib.Path.write_text', return_value=0):
            db_module, main_module, models_module = reload_modules()
            db_module.init_db()
            main_module.ensure_user_account_schema()

            db = db_module.SessionLocal()
            try:
                now = datetime.now()
                db.add(
                    models_module.UserAccount(
                        username='admin',
                        password_hash=main_module.hash_password('random-admin-password'),
                        role='admin',
                        enabled=True,
                        must_change_password=True,
                        last_login_at=now,
                        password_updated_at=now,
                    )
                )
                db.commit()
            finally:
                db.close()

            main_module.ensure_default_accounts()

        db = db_module.SessionLocal()
        try:
            user = db.query(models_module.UserAccount).filter(models_module.UserAccount.username == 'admin').first()
            ok, _ = main_module.verify_password('admin123', user.password_hash)
            self.assertTrue(ok, '首次登录后但未改密的默认管理员账号未被兼容修复')
        finally:
            db.close()


if __name__ == '__main__':
    unittest.main()
