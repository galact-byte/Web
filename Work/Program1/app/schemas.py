from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────────────────────────────────────
# Organization（单位）
# ──────────────────────────────────────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str
    credit_code: str
    legal_representative: str
    address: str
    office_phone: str | None = None
    mobile_phone: str
    email: str
    industry: str
    organization_type: str
    cybersecurity_dept: str | None = None
    cybersecurity_owner_name: str | None = None
    cybersecurity_owner_title: str | None = None
    cybersecurity_owner_phone: str | None = None
    cybersecurity_owner_email: str | None = None
    data_security_dept: str | None = None
    data_security_owner_name: str | None = None
    data_security_owner_title: str | None = None
    data_security_owner_phone: str | None = None
    data_security_owner_email: str | None = None
    supervising_department: str | None = None
    filing_region: str
    involves_state_secret: bool = False
    is_cii: bool = False
    remark: str | None = None
    created_by: str = "system"


class OrganizationUpdate(BaseModel):
    name: str | None = None
    credit_code: str | None = None
    legal_representative: str | None = None
    address: str | None = None
    office_phone: str | None = None
    mobile_phone: str | None = None
    email: str | None = None
    industry: str | None = None
    organization_type: str | None = None
    cybersecurity_dept: str | None = None
    cybersecurity_owner_name: str | None = None
    cybersecurity_owner_title: str | None = None
    cybersecurity_owner_phone: str | None = None
    cybersecurity_owner_email: str | None = None
    data_security_dept: str | None = None
    data_security_owner_name: str | None = None
    data_security_owner_title: str | None = None
    data_security_owner_phone: str | None = None
    data_security_owner_email: str | None = None
    supervising_department: str | None = None
    filing_region: str | None = None
    involves_state_secret: bool | None = None
    is_cii: bool | None = None
    remark: str | None = None


class OrganizationResponse(BaseModel):
    """单位信息响应模型，支持从 ORM 对象直接构造。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    credit_code: str
    legal_representative: str
    address: str
    office_phone: str | None = None
    mobile_phone: str
    email: str
    industry: str
    organization_type: str
    cybersecurity_dept: str | None = None
    cybersecurity_owner_name: str | None = None
    cybersecurity_owner_title: str | None = None
    cybersecurity_owner_phone: str | None = None
    cybersecurity_owner_email: str | None = None
    data_security_dept: str | None = None
    data_security_owner_name: str | None = None
    data_security_owner_title: str | None = None
    data_security_owner_phone: str | None = None
    data_security_owner_email: str | None = None
    supervising_department: str | None = None
    filing_region: str
    involves_state_secret: bool
    is_cii: bool
    remark: str | None = None
    created_by: str
    archived: bool
    locked: bool
    created_at: datetime
    updated_at: datetime


# ──────────────────────────────────────────────────────────────────────────────
# SystemInfo（信息系统）
# ──────────────────────────────────────────────────────────────────────────────

class SystemCreate(BaseModel):
    organization_id: int
    system_name: str
    proposed_level: int = Field(ge=1, le=5)
    business_description: str | None = None
    system_type: str | None = None
    deployment_mode: str | None = None
    go_live_date: date | None = None
    boundary: str | None = None
    subsystems: str | None = None
    service_object: str | None = None
    service_scope: str | None = None
    network_topology: str | None = None
    data_name: str | None = None
    data_level: str | None = None
    data_category: str | None = None
    data_security_dept: str | None = None
    data_security_owner: str | None = None
    contains_personal_info: bool = False
    data_total: float | None = None
    monthly_growth: float | None = None
    data_source: str | None = None
    data_flow: str | None = None
    data_interaction: str | None = None
    storage_location: str | None = None
    level_basis: str | None = None
    impact_scope: str | None = None
    level_reason: str | None = None
    needs_expert_review: bool = False
    expert_review_info: str | None = None
    ops_unit: str | None = None
    ops_personnel: str | None = None
    created_by: str = "system"


class SystemUpdate(BaseModel):
    system_name: str | None = None
    proposed_level: int | None = Field(default=None, ge=1, le=5)
    business_description: str | None = None
    system_type: str | None = None
    deployment_mode: str | None = None
    go_live_date: date | None = None
    boundary: str | None = None
    subsystems: str | None = None
    service_object: str | None = None
    service_scope: str | None = None
    network_topology: str | None = None
    data_name: str | None = None
    data_level: str | None = None
    data_category: str | None = None
    data_security_dept: str | None = None
    data_security_owner: str | None = None
    contains_personal_info: bool | None = None
    data_total: float | None = None
    monthly_growth: float | None = None
    data_source: str | None = None
    data_flow: str | None = None
    data_interaction: str | None = None
    storage_location: str | None = None
    level_basis: str | None = None
    impact_scope: str | None = None
    level_reason: str | None = None
    needs_expert_review: bool | None = None
    expert_review_info: str | None = None
    ops_unit: str | None = None
    ops_personnel: str | None = None


class SystemInfoResponse(BaseModel):
    """信息系统响应模型，支持从 ORM 对象直接构造。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    system_name: str
    system_code: str
    proposed_level: int
    business_description: str | None = None
    system_type: str | None = None
    deployment_mode: str | None = None
    go_live_date: date | None = None
    boundary: str | None = None
    subsystems: str | None = None
    service_object: str | None = None
    service_scope: str | None = None
    network_topology: str | None = None
    data_name: str | None = None
    data_level: str | None = None
    data_category: str | None = None
    data_security_dept: str | None = None
    data_security_owner: str | None = None
    contains_personal_info: bool
    data_total: float | None = None
    monthly_growth: float | None = None
    data_source: str | None = None
    data_flow: str | None = None
    data_interaction: str | None = None
    storage_location: str | None = None
    level_basis: str | None = None
    impact_scope: str | None = None
    level_reason: str | None = None
    needs_expert_review: bool
    expert_review_info: str | None = None
    ops_unit: str | None = None
    ops_personnel: str | None = None
    created_by: str
    archived: bool
    locked: bool
    created_at: datetime
    updated_at: datetime


# ──────────────────────────────────────────────────────────────────────────────
# Report（报告）
# ──────────────────────────────────────────────────────────────────────────────

class ReportEdit(BaseModel):
    title: str | None = None
    content: dict[str, Any]


class ReportResponse(BaseModel):
    """报告响应模型，支持从 ORM 对象直接构造。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    system_id: int
    report_type: str
    version_no: int
    title: str
    status: str
    content: dict[str, Any]
    generated_by: str
    generated_at: datetime
    updated_at: datetime


# ──────────────────────────────────────────────────────────────────────────────
# WorkflowConfig（审批流配置）
# ──────────────────────────────────────────────────────────────────────────────

class WorkflowConfigUpdate(BaseModel):
    steps: list[str]
    updated_by: str = "admin"


class WorkflowConfigResponse(BaseModel):
    """审批流配置响应模型，支持从 ORM 对象直接构造。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    steps_json: list[str]
    updated_by: str
    updated_at: datetime
