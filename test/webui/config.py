import os
import re
import secrets


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

    # 访问密码（设置环境变量 AUTH_PASSWORD 后启用登录验证，留空则不需要登录）
    AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "")

    # MySQL 连接配置 —— 按实际情况修改
    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_PORT = int(os.environ.get("DB_PORT", 3306))
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "password")
    DB_NAME = os.environ.get("DB_NAME", "code_audit")

    # 校验 DB_NAME，防止 SQL 注入
    if not re.match(r"^[a-zA-Z0-9_]+$", DB_NAME):
        raise ValueError(f"DB_NAME 包含非法字符，仅允许字母、数字和下划线: {DB_NAME}")

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload
