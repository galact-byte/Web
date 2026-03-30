"""
认证服务
"""
import app.env  # noqa: F401  确保优先加载 backend/.env

import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User

# ---- 安全配置 ----
# SECRET_KEY 必须通过环境变量设置，生产环境禁止使用默认值
_DEV_DEFAULT_KEY = "dev-only-secret-key-do-not-use-in-production"
SECRET_KEY = os.getenv("SECRET_KEY", "")

if not SECRET_KEY:
    if os.getenv("ENV", "dev").lower() == "dev":
        SECRET_KEY = _DEV_DEFAULT_KEY
        print("[警告] SECRET_KEY 未设置，使用开发环境默认密钥（生产环境请务必设置 SECRET_KEY）")
    else:
        raise RuntimeError(
            "[安全错误] 生产环境必须通过环境变量设置 SECRET_KEY！"
            "请在 .env 文件或系统环境变量中设置一个强随机密钥。"
        )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))  # 默认1天

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """哈希密码"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建 JWT Token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """解码 Token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user_raw(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """从 Token 获取用户（不检查改密标志，仅供 /me 和 /change-password 使用）"""
    token = credentials.credentials
    payload = decode_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期"
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效"
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )

    return user


async def get_current_user(
    current_user: User = Depends(get_current_user_raw)
) -> User:
    """获取当前登录用户（强制改密检查）"""
    if current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="请先修改密码"
        )
    return current_user


async def get_current_manager(current_user: User = Depends(get_current_user)) -> User:
    """验证当前用户是经理"""
    if current_user.role.value != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要经理权限"
        )
    return current_user
