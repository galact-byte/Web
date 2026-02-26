"""
项目相关的 Pydantic 模式
"""
from datetime import datetime, date
from pydantic import BaseModel, Field
from typing import Optional, List
from app.models.project import (
    ContractStatus, BusinessCategory, FilingStatus, ProjectStatus, SystemLevel
)


# 系统模式
class SystemBase(BaseModel):
    system_code: Optional[str] = ""
    system_name: str = Field(..., min_length=1)
    system_level: SystemLevel = SystemLevel.NA
    system_type: str = "/"


class SystemCreate(SystemBase):
    pass


class SystemResponse(SystemBase):
    id: int
    project_id: int

    class Config:
        from_attributes = True


# 项目分配模式
class AssignmentBase(BaseModel):
    system_id: Optional[int] = None
    assignee_id: int
    department: Optional[str] = ""
    contribution: Optional[str] = ""


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    department: Optional[str] = None
    contribution: Optional[str] = None


class AssignmentResponse(AssignmentBase):
    id: int
    project_id: int
    assigned_at: datetime
    completed_at: Optional[datetime] = None
    assignee_name: Optional[str] = None

    class Config:
        from_attributes = True


# 项目模式
class ProjectBase(BaseModel):
    project_code: str = Field(..., pattern=r"^QZXGC-\d+$|^QZX\d+-\d+$")
    project_name: str = Field(..., min_length=1)
    contract_status: ContractStatus = ContractStatus.UNSIGNED
    client_name: Optional[str] = ""
    business_category: BusinessCategory
    project_location: Optional[str] = ""
    business_manager_id: Optional[int] = None
    filing_status: FilingStatus = FilingStatus.UNFILED
    implementation_manager_id: Optional[int] = None
    approval_date: Optional[date] = None


class ProjectCreate(ProjectBase):
    systems: List[SystemCreate] = []


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    contract_status: Optional[ContractStatus] = None
    client_name: Optional[str] = None
    business_category: Optional[BusinessCategory] = None
    project_location: Optional[str] = None
    business_manager_id: Optional[int] = None
    filing_status: Optional[FilingStatus] = None
    implementation_manager_id: Optional[int] = None
    approval_date: Optional[date] = None
    status: Optional[ProjectStatus] = None


class ProjectResponse(ProjectBase):
    id: int
    created_by: int
    created_at: datetime
    status: ProjectStatus
    systems: List[SystemResponse] = []
    creator_name: Optional[str] = None
    business_manager_name: Optional[str] = None
    implementation_manager_name: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    id: int
    project_code: str
    project_name: str
    client_name: str
    business_category: BusinessCategory
    project_location: str
    status: ProjectStatus
    created_at: datetime
    systems_count: int = 0

    class Config:
        from_attributes = True


# 项目分发模式
class ProjectAssignRequest(BaseModel):
    assignee_ids: List[int]
    system_ids: Optional[List[int]] = None  # 可选，分配到具体系统


# 导出模式
class ExportRequest(BaseModel):
    project_ids: List[int]
    year: int
    quarter: int  # 1-4
    department: str = "软测部"
