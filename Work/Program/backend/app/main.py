"""
项目完结单管理平台 - 后端入口
"""
import os
import logging
import secrets
from contextlib import contextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import engine, Base, SessionLocal
from app.routers import auth_router, users_router, projects_router, exports_router, backup_router
from app.models import User, UserRole
from app.services.auth import hash_password

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


# 种子数据：首次启动时创建默认管理员账户
def _seed_admin():
    try:
        db = SessionLocal()
        try:
            if db.query(User).count() == 0:
                initial_password = "admin123" if IS_DEV else secrets.token_urlsafe(12)
                admin = User(
                    username="admin",
                    password_hash=hash_password(initial_password),
                    display_name="系统管理员",
                    role=UserRole.manager,
                    department="管理部",
                    must_change_password=True,
                )
                db.add(admin)
                db.commit()
                if IS_DEV:
                    logger.info("已创建默认管理员账户: admin（开发模式，请及时修改密码）")
                else:
                    # 生产环境使用 print 输出一次性密码，不写入持久日志
                    print(f"[初始化] 管理员账户已创建，初始密码: {initial_password}（请立即登录并修改）")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"初始化管理员账户失败（数据库可能尚未就绪）: {e}")


# 创建应用 —— 生产环境禁用 Swagger 文档，防止 API 信息泄露
app = FastAPI(
    title="项目完结单管理平台",
    description="在线项目完结单管理系统 API",
    version="1.0.0",
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


@app.on_event("startup")
def on_startup():
    """启动时初始化数据库表和种子数据"""
    Base.metadata.create_all(bind=engine)
    _seed_admin()


@app.get("/")
async def root():
    """根路径"""
    return {"status": "ok"}


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}
