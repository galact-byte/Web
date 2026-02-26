"""
项目完结单管理平台 - 后端入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth_router, users_router, projects_router, exports_router

# 创建数据库表
Base.metadata.create_all(bind=engine)

# 创建应用
app = FastAPI(
    title="项目完结单管理平台",
    description="在线项目完结单管理系统 API",
    version="1.0.0"
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有来源，生产环境请限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
