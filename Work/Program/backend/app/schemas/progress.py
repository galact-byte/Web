"""
项目进度 Pydantic 数据模式
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ProgressRecordResponse(BaseModel):
    id: int
    project_type: str
    batch_id: str
    system_id: Optional[str] = None
    system_name: Optional[str] = None
    customer_name: Optional[str] = None
    system_level: Optional[str] = None
    system_tag: Optional[str] = None
    business_type: Optional[str] = None
    project_name: Optional[str] = None
    project_code: Optional[str] = None
    project_location: Optional[str] = None
    init_status: Optional[str] = None
    project_manager: Optional[str] = None
    pm_department: Optional[str] = None
    sale_contact: Optional[str] = None
    required_start_date: Optional[str] = None
    required_end_date: Optional[str] = None
    actual_start_date: Optional[str] = None
    actual_end_date: Optional[str] = None
    project_status: Optional[str] = None
    is_finished: Optional[str] = None
    plan_printed: Optional[str] = None
    report_printed: Optional[str] = None
    register_status: Optional[str] = None
    contract_status: Optional[str] = None
    remark: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    scraped_at: Optional[datetime] = None
    distributed: bool = False  # 是否已分发到项目管理

    class Config:
        from_attributes = True


class ProgressListResponse(BaseModel):
    total: int
    items: List[ProgressRecordResponse]


class ProgressScrapeRequest(BaseModel):
    page_size: Optional[int] = Field(None, ge=10, le=200)


class ProgressScrapeLogResponse(BaseModel):
    id: int
    project_type: str
    status: str
    total_records: int = 0
    error_message: Optional[str] = None
    duration_seconds: Optional[float] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProgressConfigResponse(BaseModel):
    base_url: str = ""
    pfx_path: str = ""
    username: str = ""
    has_password: bool = False
    has_cookie: bool = False
    page_size: int = 50


class ProgressConfigUpdate(BaseModel):
    base_url: Optional[str] = None
    pfx_path: Optional[str] = None
    pfx_password: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    cookie: Optional[str] = None
    page_size: Optional[int] = Field(None, ge=10, le=200)


class ProgressDistributeRequest(BaseModel):
    """从爬取数据快速分发项目"""
    assignee_ids: List[int] = Field(..., min_length=1, description="分配的员工ID列表")
    remark: Optional[str] = Field(None, description="分发备注（紧急度等）")
