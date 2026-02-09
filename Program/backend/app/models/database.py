"""
数据库配置和连接
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# 数据库 URL - 支持环境变量切换
# 开发环境: SQLite
# 生产环境: PostgreSQL (设置 DATABASE_URL 环境变量)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./database.db"
)

# 如果是 PostgreSQL，需要替换驱动
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# 创建异步引擎
if "sqlite" in DATABASE_URL:
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_async_engine(DATABASE_URL, echo=False)

# 创建异步会话
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


class Base(DeclarativeBase):
    """数据模型基类"""
    pass


async def init_db():
    """初始化数据库表"""
    from app.models import user, project  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """获取数据库会话"""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
