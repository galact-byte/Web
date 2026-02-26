from datetime import date
from typing import Any

from pydantic import BaseModel, Field


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


class ReportEdit(BaseModel):
    title: str | None = None
    content: dict[str, Any]


class WorkflowConfigUpdate(BaseModel):
    steps: list[str]
    updated_by: str = "admin"
