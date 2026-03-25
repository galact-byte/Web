"""
Pydantic 数据模式
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ============ 用户 ============
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    display_name: str = Field(..., min_length=1, max_length=100)
    role: str = "employee"
    department: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None


class UserResponse(UserBase):
    id: int
    created_at: Optional[datetime] = None
    must_change_password: bool = False

    class Config:
        from_attributes = True


# ============ 认证 ============
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128)
    old_password: Optional[str] = None  # 首次改密可不填，主动改密必填


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============ 系统 ============
class SystemBase(BaseModel):
    system_code: Optional[str] = None
    system_name: str = Field(..., min_length=1)
    system_level: str = "第二级"
    system_type: str = "传统系统"
    archive_status: str = "否"


class SystemCreate(SystemBase):
    pass


class SystemResponse(SystemBase):
    id: int
    current_phase: Optional[str] = "not_started"

    class Config:
        from_attributes = True


# ============ 项目 ============
class ProjectBase(BaseModel):
    project_code: str = Field(..., min_length=1)
    project_name: str = Field(..., min_length=1)
    client_name: Optional[str] = None
    business_category: str = "等保测评"
    project_location: Optional[str] = None
    contract_status: str = "未签订"
    filing_status: str = "未备案"
    priority: str = "/"
    business_manager_name: Optional[str] = None
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
    submitted_count: int = 0       # 已提交完结的员工数
    total_employee_count: int = 0   # 总分配员工数
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ 分配 ============
class AssignRequest(BaseModel):
    assignee_ids: List[int] = Field(..., min_length=1)


class ContributionUpdate(BaseModel):
    department: Optional[str] = None
    contribution: Optional[str] = None


class AssignmentUpdate(BaseModel):
    department: Optional[str] = None
    contribution: Optional[str] = None


class ContributionCreate(BaseModel):
    department: Optional[str] = None
    contribution: Optional[str] = None


class AssignmentResponse(BaseModel):
    id: int
    project_id: int
    assignee_id: int
    assignee_name: str
    department: Optional[str] = None
    contribution: Optional[str] = None
    status: str = "pending"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ 导出 ============
class ExcelExportRequest(BaseModel):
    project_ids: List[int] = Field(..., min_length=1)
    year: int
    quarter: int = Field(..., ge=1, le=4)
    department: str = "软测部"


class WordExportRequest(BaseModel):
    project_ids: List[int] = Field(..., min_length=1)


# ============ 进度汇报 ============
class ProgressReportCreate(BaseModel):
    """单个系统的进度汇报"""
    system_id: int
    phase: str  # SystemProgressPhase 枚举值
    remark: Optional[str] = None


class ProgressReportBatchCreate(BaseModel):
    """批量进度汇报（一个项目下多个系统一次提交）"""
    reports: List[ProgressReportCreate] = Field(..., min_length=1)


class ProgressReportResponse(BaseModel):
    """进度汇报记录响应"""
    id: int
    system_id: int
    system_name: str = ""
    phase: str
    phase_label: str = ""
    remark: Optional[str] = None
    reporter_name: str = ""
    report_week: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SystemProgressResponse(BaseModel):
    """单个系统的当前进度摘要"""
    system_id: int
    system_name: str
    current_phase: str
    current_phase_label: str = ""
    latest_remark: Optional[str] = None
    latest_reporter_name: Optional[str] = None
    latest_report_time: Optional[datetime] = None
    report_count: int = 0


class SyncProgressRequest(BaseModel):
    """一键同步所有系统进度"""
    phase: str
    remark: Optional[str] = None
