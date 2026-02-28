"""
认证路由
"""
from collections import defaultdict
from time import time
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, ChangePasswordRequest, TokenResponse, UserResponse
from app.services.auth import (
    hash_password, verify_password, create_access_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["认证"])

# 简易登录频率限制：每个 IP 60 秒内最多 5 次尝试
_login_attempts: dict[str, list[float]] = defaultdict(list)
_MAX_ATTEMPTS = 5
_WINDOW_SECONDS = 60


def _check_rate_limit(client_ip: str):
    """检查登录频率，超限则抛出 429"""
    now = time()
    attempts = _login_attempts[client_ip]
    # 清理过期记录
    _login_attempts[client_ip] = [t for t in attempts if now - t < _WINDOW_SECONDS]
    if len(_login_attempts[client_ip]) >= _MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="登录尝试过于频繁，请稍后再试"
        )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, req: Request, db: Session = Depends(get_db)):
    """用户登录"""
    client_ip = req.client.host if req.client else "unknown"
    _check_rate_limit(client_ip)

    user = db.query(User).filter(User.username == request.username).first()

    if not user or not verify_password(request.password, user.password_hash):
        _login_attempts[client_ip].append(time())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    token = create_access_token({"sub": str(user.id)})
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            role=user.role.value,
            department=user.department,
            must_change_password=user.must_change_password,
            created_at=user.created_at
        )
    )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """修改当前用户密码（首次登录或主动修改）"""
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码长度不能少于6位"
        )

    # 非首次改密时，必须验证旧密码
    if not current_user.must_change_password:
        if not request.old_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请输入当前密码"
            )
        if not verify_password(request.old_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前密码错误"
            )

    current_user.password_hash = hash_password(request.new_password)
    current_user.must_change_password = False
    db.commit()

    return {"message": "密码修改成功"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        display_name=current_user.display_name,
        role=current_user.role.value,
        department=current_user.department,
        must_change_password=current_user.must_change_password,
        created_at=current_user.created_at
    )
