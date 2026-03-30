"""
慎微项目管理平台 - 后端入口
"""
import app.env  # noqa: F401  确保优先加载 backend/.env

import os
import logging
import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import engine, Base, SessionLocal
from app.routers import auth_router, users_router, projects_router, exports_router, backup_router, progress_router, system_progress_router
from app.models import User, UserRole
from app.services.auth import hash_password
from sqlalchemy import inspect as sa_inspect, text as sa_text
from sqlalchemy.exc import OperationalError

logger = logging.getLogger(__name__)

# 环境判断：ENV=dev 为开发模式，其他值（如 prod）为生产模式
IS_DEV = os.getenv("ENV", "dev").lower() == "dev"


# ---- 安全响应头中间件 ----
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if not IS_DEV:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


def _migrate_db():
    """兼容旧数据库：检测并添加缺失的列"""
    try:
        inspector = sa_inspect(engine)
        if inspector.has_table("project_assignments"):
            columns = [c["name"] for c in inspector.get_columns("project_assignments")]
            if "status" not in columns:
                with engine.connect() as conn:
                    conn.execute(
                        sa_text(
                            "ALTER TABLE project_assignments ADD COLUMN status VARCHAR(20) DEFAULT 'pending' NOT NULL"
                        )
                    )
                    conn.commit()
                logger.info("已为 project_assignments 表添加 status 列")
        if inspector.has_table("projects"):
            columns = [c["name"] for c in inspector.get_columns("projects")]
            if "completed_at" not in columns:
                with engine.connect() as conn:
                    conn.execute(
                        sa_text("ALTER TABLE projects ADD COLUMN completed_at DATETIME")
                    )
                    # 回填已完成项目：用 updated_at 或 created_at 作为完成时间
                    conn.execute(
                        sa_text(
                            "UPDATE projects SET completed_at = COALESCE(updated_at, created_at) "
                            "WHERE status = 'completed' AND completed_at IS NULL"
                        )
                    )
                    conn.commit()
                logger.info("已为 projects 表添加 completed_at 列并回填已完成项目")
        if inspector.has_table("projects"):
            columns = [c["name"] for c in inspector.get_columns("projects")]
            if "priority" not in columns:
                with engine.connect() as conn:
                    conn.execute(
                        sa_text("ALTER TABLE projects ADD COLUMN priority VARCHAR(10) DEFAULT '/'")
                    )
                    conn.commit()
                logger.info("已为 projects 表添加 priority 列")
        if inspector.has_table("systems"):
            columns = [c["name"] for c in inspector.get_columns("systems")]
            if "archive_status" not in columns:
                with engine.connect() as conn:
                    conn.execute(
                        sa_text("ALTER TABLE systems ADD COLUMN archive_status VARCHAR(10) DEFAULT '否'")
                    )
                    conn.commit()
                logger.info("已为 systems 表添加 archive_status 列")
            if "current_phase" not in columns:
                with engine.connect() as conn:
                    conn.execute(
                        sa_text("ALTER TABLE systems ADD COLUMN current_phase VARCHAR(20) DEFAULT 'not_started'")
                    )
                    conn.commit()
                logger.info("已为 systems 表添加 current_phase 列")
        if inspector.has_table("projects"):
            columns = [c["name"] for c in inspector.get_columns("projects")]
            if "remark" not in columns:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE projects ADD COLUMN remark TEXT"))
                    conn.commit()
                logger.info("已为 projects 表添加 remark 列")
            if "contact_name" not in columns:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE projects ADD COLUMN contact_name VARCHAR(100)"))
                    conn.commit()
                logger.info("已为 projects 表添加 contact_name 列")
            if "contact_phone" not in columns:
                with engine.connect() as conn:
                    conn.execute(sa_text("ALTER TABLE projects ADD COLUMN contact_phone VARCHAR(50)"))
                    conn.commit()
                logger.info("已为 projects 表添加 contact_phone 列")
        if inspector.has_table("progress_records"):
            columns = [c["name"] for c in inspector.get_columns("progress_records")]
            with engine.connect() as conn:
                if "contact_name" not in columns:
                    conn.execute(sa_text("ALTER TABLE progress_records ADD COLUMN contact_name VARCHAR(100)"))
                    logger.info("已为 progress_records 表添加 contact_name 列")
                if "contact_phone" not in columns:
                    conn.execute(sa_text("ALTER TABLE progress_records ADD COLUMN contact_phone VARCHAR(50)"))
                    logger.info("已为 progress_records 表添加 contact_phone 列")
                if "contact_name" not in columns or "contact_phone" not in columns:
                    conn.commit()
    except OperationalError as e:
        logger.warning(f"数据库迁移检查失败（非致命）: {e}")
    except Exception as e:
        logger.error(f"数据库迁移异常: {e}", exc_info=True)


# 种子数据：首次启动时创建默认管理员账户
def _seed_admin():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            # 优先从环境变量读取密码，开发模式兜底 admin123，生产模式兜底随机密码
            env_password = (os.getenv("DEFAULT_ADMIN_PASSWORD") or "").strip()
            if env_password:
                initial_password = env_password
                password_source = "环境变量"
            elif IS_DEV:
                initial_password = "admin123"
                password_source = "开发默认"
            else:
                initial_password = secrets.token_urlsafe(12)
                password_source = "随机生成"

            admin = User(
                username="admin",
                password_hash=hash_password(initial_password),
                display_name="系统管理员",
                role=UserRole.manager,
                department="软测部",
                must_change_password=True,
            )
            db.add(admin)
            db.commit()

            if IS_DEV:
                logger.info("已创建默认管理员账户: admin（开发模式，请及时修改密码）")
            else:
                msg = f"[初始化] 管理员账户已创建（密码来源: {password_source}），请立即登录并修改密码"
                if password_source == "环境变量":
                    # 环境变量指定的密码，用户已知，不需要输出明文
                    logger.info(msg)
                    print(msg)
                else:
                    # 随机生成的密码，必须输出明文且写入日志，防止丢失
                    full_msg = f"{msg}，初始密码: {initial_password}"
                    logger.warning(full_msg)
                    print(full_msg)
    except Exception as e:
        if not IS_DEV:
            raise RuntimeError(f"初始化管理员账户失败: {e}")
        logger.warning(f"初始化管理员账户失败（数据库可能尚未就绪）: {e}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化数据库表和种子数据"""
    Base.metadata.create_all(bind=engine)
    _migrate_db()
    _seed_admin()
    # 恢复定时爬取
    try:
        from app.services.scrape_scheduler import scheduler
        scheduler.restore_from_config()
    except Exception as e:
        logger.warning(f"恢复定时爬取失败（非致命）: {e}")
    yield


# 创建应用 —— 生产环境禁用 Swagger 文档，防止 API 信息泄露
app = FastAPI(
    title="慎微项目管理平台",
    description="慎微 · 项目管理系统 API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if IS_DEV else None,
    redoc_url="/redoc" if IS_DEV else None,
    openapi_url="/openapi.json" if IS_DEV else None,
)

# CORS 配置 —— 通过环境变量指定允许的来源，多个来源用逗号分隔
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

# 安全响应头
app.add_middleware(SecurityHeadersMiddleware)

# 注册路由
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(exports_router)
app.include_router(backup_router)
app.include_router(progress_router)
app.include_router(system_progress_router)


@app.get("/")
async def root():
    """根路径"""
    return {"status": "ok"}


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}
