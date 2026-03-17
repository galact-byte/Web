import os
import re
import secrets

# 加载 .env 文件（不依赖第三方库）
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    with open(_env_path, encoding="utf-8") as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line or _line.startswith("#") or "=" not in _line:
                continue
            _key, _, _val = _line.partition("=")
            _key, _val = _key.strip(), _val.strip()
            # 仅在环境变量未设置时写入，避免覆盖系统级配置
            if _key and _key not in os.environ:
                os.environ[_key] = _val


def _ensure_secret_key() -> str:
    """确保 SECRET_KEY 存在且持久化。首次为空时自动生成并写回 .env 文件。"""
    key = os.environ.get("SECRET_KEY", "").strip()
    if key:
        return key
    # 生成随机密钥
    key = secrets.token_hex(32)
    # 尝试写回 .env 持久化
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    try:
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                content = f.read()
            # 替换 SECRET_KEY= 空值行
            if re.search(r"^SECRET_KEY=\s*$", content, re.MULTILINE):
                content = re.sub(r"^SECRET_KEY=\s*$", f"SECRET_KEY={key}", content, count=1, flags=re.MULTILINE)
            else:
                content += f"\nSECRET_KEY={key}\n"
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(content)
        else:
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(f"SECRET_KEY={key}\n")
        os.environ["SECRET_KEY"] = key
    except OSError:
        pass  # 写入失败时退化为内存中的随机值
    return key


class Config:
    SECRET_KEY = _ensure_secret_key()

    # 访问密码（设置环境变量 AUTH_PASSWORD 后启用登录验证，留空则不需要登录）
    AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "")

    # MySQL 连接配置
    DB_HOST = os.environ.get("DB_HOST", "localhost")
    DB_PORT = int(os.environ.get("DB_PORT", 3306))
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
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
