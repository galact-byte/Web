"""
项目完结单管理平台 - FastAPI 后端
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import auth, projects, users, exports
from app.models.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化数据库
    await init_db()
    yield


app = FastAPI(
    title="项目完结单管理平台",
    description="在线项目完结单管理系统 API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(users.router, prefix="/api/users", tags=["用户管理"])
app.include_router(projects.router, prefix="/api/projects", tags=["项目管理"])
app.include_router(exports.router, prefix="/api/exports", tags=["导出功能"])


@app.get("/")
async def root():
    return {"message": "项目完结单管理平台 API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
