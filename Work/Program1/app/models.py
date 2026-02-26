from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from .db import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    credit_code = Column(String(18), nullable=False, unique=True, index=True)
    legal_representative = Column(String(100), nullable=False)
    address = Column(String(255), nullable=False)
    office_phone = Column(String(32), nullable=True)
    mobile_phone = Column(String(32), nullable=False)
    email = Column(String(120), nullable=False)
    industry = Column(String(100), nullable=False, index=True)
    organization_type = Column(String(100), nullable=False)
    cybersecurity_dept = Column(String(120), nullable=True)
    cybersecurity_owner_name = Column(String(100), nullable=True)
    cybersecurity_owner_title = Column(String(100), nullable=True)
    cybersecurity_owner_phone = Column(String(32), nullable=True)
    cybersecurity_owner_email = Column(String(120), nullable=True)
    data_security_dept = Column(String(120), nullable=True)
    data_security_owner_name = Column(String(100), nullable=True)
    data_security_owner_title = Column(String(100), nullable=True)
    data_security_owner_phone = Column(String(32), nullable=True)
    data_security_owner_email = Column(String(120), nullable=True)
    supervising_department = Column(String(120), nullable=True)
    filing_region = Column(String(120), nullable=False, index=True)
    involves_state_secret = Column(Boolean, default=False, nullable=False)
    is_cii = Column(Boolean, default=False, nullable=False)
    remark = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=False, default="system", index=True)
    archived = Column(Boolean, default=False, nullable=False, index=True)
    locked = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True, index=True)
    deleted_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    systems = relationship("SystemInfo", back_populates="organization")


class OrganizationHistory(Base):
    __tablename__ = "organization_histories"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    changed_by = Column(String(100), nullable=False)
    change_type = Column(String(32), nullable=False)
    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    changed_at = Column(DateTime, server_default=func.now(), nullable=False)


class SystemInfo(Base):
    __tablename__ = "systems"
    __table_args__ = (UniqueConstraint("system_code", name="uq_system_code"),)

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    system_name = Column(String(200), nullable=False, index=True)
    system_code = Column(String(64), nullable=False, index=True)
    proposed_level = Column(Integer, nullable=False, index=True)
    business_description = Column(Text, nullable=True)
    system_type = Column(String(120), nullable=True)
    deployment_mode = Column(String(64), nullable=True, index=True)
    go_live_date = Column(Date, nullable=True)
    boundary = Column(Text, nullable=True)
    subsystems = Column(Text, nullable=True)
    service_object = Column(String(120), nullable=True)
    service_scope = Column(String(255), nullable=True)
    network_topology = Column(String(255), nullable=True)
    data_name = Column(String(120), nullable=True)
    data_level = Column(String(120), nullable=True)
    data_category = Column(String(120), nullable=True)
    data_security_dept = Column(String(120), nullable=True)
    data_security_owner = Column(String(100), nullable=True)
    contains_personal_info = Column(Boolean, default=False, nullable=False)
    data_total = Column(Float, nullable=True)
    monthly_growth = Column(Float, nullable=True)
    data_source = Column(Text, nullable=True)
    data_flow = Column(Text, nullable=True)
    data_interaction = Column(Text, nullable=True)
    storage_location = Column(String(255), nullable=True)
    level_basis = Column(Text, nullable=True)
    impact_scope = Column(Text, nullable=True)
    level_reason = Column(Text, nullable=True)
    needs_expert_review = Column(Boolean, default=False, nullable=False)
    expert_review_info = Column(Text, nullable=True)
    ops_unit = Column(String(120), nullable=True)
    ops_personnel = Column(String(255), nullable=True)
    created_by = Column(String(100), nullable=False, default="system", index=True)
    archived = Column(Boolean, default=False, nullable=False, index=True)
    locked = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime, nullable=True, index=True)
    deleted_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="systems")


class SystemHistory(Base):
    __tablename__ = "system_histories"

    id = Column(Integer, primary_key=True)
    system_id = Column(Integer, ForeignKey("systems.id"), nullable=False, index=True)
    changed_by = Column(String(100), nullable=False)
    change_type = Column(String(32), nullable=False)
    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    changed_at = Column(DateTime, server_default=func.now(), nullable=False)


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True)
    entity_type = Column(String(32), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(400), nullable=False)
    file_ext = Column(String(16), nullable=False)
    file_size = Column(Integer, nullable=False)
    uploaded_by = Column(String(100), nullable=False, default="system")
    uploaded_at = Column(DateTime, server_default=func.now(), nullable=False)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    system_id = Column(Integer, ForeignKey("systems.id"), nullable=False, index=True)
    report_type = Column(String(32), nullable=False, index=True)
    version_no = Column(Integer, nullable=False, default=1)
    title = Column(String(255), nullable=False)
    status = Column(String(32), nullable=False, default="draft", index=True)
    content = Column(JSON, nullable=False)
    generated_by = Column(String(100), nullable=False, default="system")
    generated_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    reviewer = Column(String(100), nullable=False)
    action = Column(String(32), nullable=False)
    comment = Column(Text, nullable=True)
    position = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class WorkflowConfig(Base):
    __tablename__ = "workflow_configs"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    steps_json = Column(JSON, nullable=False)
    updated_by = Column(String(100), nullable=False, default="admin")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(Integer, primary_key=True)
    system_id = Column(Integer, ForeignKey("systems.id"), nullable=False, unique=True, index=True)
    current_step_index = Column(Integer, nullable=False, default=0)
    status = Column(String(32), nullable=False, default="in_progress", index=True)
    due_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class WorkflowAction(Base):
    __tablename__ = "workflow_actions"

    id = Column(Integer, primary_key=True)
    instance_id = Column(Integer, ForeignKey("workflow_instances.id"), nullable=False, index=True)
    step_name = Column(String(120), nullable=False)
    actor = Column(String(100), nullable=False)
    action = Column(String(32), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False, index=True)
    keywords = Column(String(255), nullable=True)
    city = Column(String(120), nullable=True, index=True)
    district = Column(String(120), nullable=True, index=True)
    doc_type = Column(String(120), nullable=False, index=True)
    protection_level = Column(String(32), nullable=True, index=True)
    version_no = Column(Integer, nullable=False, default=1)
    status = Column(String(32), nullable=False, default="enabled", index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(400), nullable=False)
    file_size = Column(Integer, nullable=False)
    uploaded_by = Column(String(100), nullable=False, default="admin")
    uploaded_at = Column(DateTime, server_default=func.now(), nullable=False)


class KnowledgeDownloadLog(Base):
    __tablename__ = "knowledge_download_logs"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("knowledge_documents.id"), nullable=False, index=True)
    download_by = Column(String(100), nullable=False)
    downloaded_at = Column(DateTime, server_default=func.now(), nullable=False)
