"""
项目完结单管理平台 - 后端入口
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, SessionLocal
from app.routers import auth_router, users_router, projects_router, exports_router
from app.models import User, UserRole
from app.services.auth import hash_password

# 环境判断：ENV=dev 为开发模式，其他值（如 prod）为生产模式
IS_DEV = os.getenv("ENV", "dev").lower() == "dev"

# 创建数据库表
Base.metadata.create_all(bind=engine)

# 种子数据：首次启动时创建默认管理员账户
def _seed_admin():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            admin = User(
                username="admin",
                password_hash=hash_password("admin123"),
                display_name="系统管理员",
                role=UserRole.manager,
                department="管理部",
                must_change_password=True,
            )
            db.add(admin)
            db.commit()
            print("[初始化] 已创建默认管理员账户: admin / admin123")
    finally:
        db.close()

_seed_admin()

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

# 注册路由
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(projects_router)
app.include_router(exports_router)


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "项目完结单管理平台 API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}
