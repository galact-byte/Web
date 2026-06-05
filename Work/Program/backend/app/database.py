"""
数据库配置
"""
import app.env  # noqa: F401  确保优先加载 backend/.env

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from urllib.parse import quote


def build_database_url(env=os.environ):
    """Build the SQLAlchemy database URL from explicit or split env vars."""
    explicit_url = env.get("DATABASE_URL")
    if explicit_url:
        return explicit_url

    postgres_host = env.get("POSTGRES_HOST")
    if postgres_host:
        user = quote(env.get("POSTGRES_USER", "project_user"), safe="")
        password = quote(env.get("POSTGRES_PASSWORD", ""), safe="")
        host = env.get("POSTGRES_HOST", "postgres")
        port = env.get("POSTGRES_PORT", "5432")
        database = quote(env.get("POSTGRES_DB", "project_completion"), safe="")
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"

    return "sqlite:///./project_completion.db"


# 数据库 URL - 开发环境使用 SQLite，生产环境使用 PostgreSQL
DATABASE_URL = build_database_url()

# SQLite 需要特殊处理
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
