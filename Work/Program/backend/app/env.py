"""
环境变量加载
"""
from pathlib import Path

from dotenv import load_dotenv

_BASE_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BASE_DIR / ".env"

# 不覆盖系统环境变量，允许部署平台注入配置优先
load_dotenv(_ENV_FILE, override=False)
