"""
Pydantic 数据模式
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ============ 用户 ============
class UserBase(BaseModel):
    username: str
    display_name: str
    role: str = "employee"
    department: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None


class UserResponse(UserBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ 认证 ============
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str
    role: str = "employee"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============ 系统 ============
class SystemBase(BaseModel):
    system_code: Optional[str] = None
    system_name: str
    system_level: str = "第二级"
    system_type: str = "传统系统"


class SystemCreate(SystemBase):
    pass


class SystemResponse(SystemBase):
    id: int

    class Config:
        from_attributes = True


# ============ 项目 ============
class ProjectBase(BaseModel):
    project_code: str
    project_name: str
    client_name: Optional[str] = None
    business_category: str = "等保测评"
    project_location: Optional[str] = None
    contract_status: str = "未签订"
    filing_status: str = "未备案"
    approval_date: Optional[str] = None
    business_manager_id: Optional[int] = None
    implementation_manager_id: Optional[int] = None


class ProjectCreate(ProjectBase):
    systems: List[SystemCreate] = []


class ProjectUpdate(ProjectBase):
    systems: List[SystemCreate] = []


class ProjectResponse(ProjectBase):
    id: int
    status: str
    creator_id: Optional[int] = None
    creator_name: Optional[str] = None
    business_manager_name: Optional[str] = None
    implementation_manager_name: Optional[str] = None
    systems_count: int = 0
    systems: List[SystemResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProjectListResponse(ProjectBase):
    id: int
    status: str
    systems_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ 分配 ============
class AssignRequest(BaseModel):
    assignee_ids: List[int]


class ContributionUpdate(BaseModel):
    department: Optional[str] = None
    contribution: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: int
    project_id: int
    assignee_id: int
    assignee_name: str
    department: Optional[str] = None
    contribution: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ 导出 ============
class ExcelExportRequest(BaseModel):
    project_ids: List[int]
    year: int
    quarter: int
    department: str = "软测部"
