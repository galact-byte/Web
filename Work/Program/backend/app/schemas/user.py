"""
用户相关的 Pydantic 模式
"""
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional
from app.models.user import UserRole


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    department: Optional[str] = ""


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.EMPLOYEE


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[UserRole] = None


class UserResponse(UserBase):
    id: int
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: int  # user id
    role: str
    exp: datetime
