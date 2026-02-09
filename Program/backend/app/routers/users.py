"""
用户路由
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.schemas import UserCreate, UserUpdate, UserResponse
from app.services.auth import hash_password, get_current_user, get_current_manager

router = APIRouter(prefix="/api/users", tags=["用户"])


@router.get("/", response_model=List[UserResponse])
async def get_users(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取用户列表"""
    query = db.query(User)
    if role:
        query = query.filter(User.role == UserRole(role))
    users = query.all()
    return [
        UserResponse(
            id=u.id,
            username=u.username,
            display_name=u.display_name,
            role=u.role.value,
            department=u.department,
            created_at=u.created_at
        )
        for u in users
    ]


@router.get("/employees", response_model=List[UserResponse])
async def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取员工列表"""
    users = db.query(User).filter(User.role == UserRole.employee).all()
    return [
        UserResponse(
            id=u.id,
            username=u.username,
            display_name=u.display_name,
            role=u.role.value,
            department=u.department,
            created_at=u.created_at
        )
        for u in users
    ]


@router.get("/managers", response_model=List[UserResponse])
async def get_managers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取经理列表"""
    users = db.query(User).filter(User.role == UserRole.manager).all()
    return [
        UserResponse(
            id=u.id,
            username=u.username,
            display_name=u.display_name,
            role=u.role.value,
            department=u.department,
            created_at=u.created_at
        )
        for u in users
    ]


@router.post("/", response_model=UserResponse)
async def create_user(
    request: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """创建用户（仅经理）"""
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    user = User(
        username=request.username,
        password_hash=hash_password(request.password),
        display_name=request.display_name,
        role=UserRole(request.role),
        department=request.department
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role.value,
        department=user.department,
        created_at=user.created_at
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    request: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """更新用户（仅经理）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    if request.display_name:
        user.display_name = request.display_name
    if request.role:
        user.role = UserRole(request.role)
    if request.department is not None:
        user.department = request.department
    
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role.value,
        department=user.department,
        created_at=user.created_at
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """删除用户（仅经理）"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    db.delete(user)
    db.commit()
    
    return {"message": "删除成功"}
