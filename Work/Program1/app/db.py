import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool


def _build_engine(db_url: str):
    connect_args = {}
    engine_kwargs = {}
    if db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if ":memory:" in db_url or db_url.rstrip("/") == "sqlite:":
            engine_kwargs["poolclass"] = StaticPool
    return create_engine(db_url, pool_pre_ping=True, future=True, connect_args=connect_args, **engine_kwargs)


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
engine = _build_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
