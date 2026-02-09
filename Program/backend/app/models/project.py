"""
项目和系统数据模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Date, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from .database import Base


class ContractStatus(str, enum.Enum):
    """合同状态"""
    SIGNED = "已签订"
    UNSIGNED = "未签订"


class BusinessCategory(str, enum.Enum):
    """业务类别"""
    DENGBAO = "等保测评"
    MIPING = "密码评估"
    FENGPING = "风险评估"
    ANPING = "安全评估"
    SHUPING = "数据评估"
    RUANCE = "软件测试"
    ANFU = "安全服务"
    QITA = "其他"


class FilingStatus(str, enum.Enum):
    """定级备案状态"""
    FILED = "已备案"
    UNFILED = "未备案"


class ProjectStatus(str, enum.Enum):
    """项目状态"""
    DRAFT = "draft"
    ASSIGNED = "assigned"
    COMPLETED = "completed"


class SystemLevel(str, enum.Enum):
    """系统级别"""
    LEVEL_1 = "第一级"
    LEVEL_2 = "第二级"
    LEVEL_3 = "第三级"
    LEVEL_4 = "第四级"
    LEVEL_5 = "第五级"
    NA = "/"


class Project(Base):
    """项目表"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String(50), unique=True, index=True, nullable=False)  # 项目编号 QZXGC-xxxxx
    project_name = Column(String(255), nullable=False)  # 项目名称
    contract_status = Column(SQLEnum(ContractStatus), default=ContractStatus.UNSIGNED)  # 合同状态
    client_name = Column(String(255), default="")  # 被测单位名称
    business_category = Column(SQLEnum(BusinessCategory), nullable=False)  # 业务类别
    project_location = Column(String(100), default="")  # 项目地点
    business_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 业务负责人
    filing_status = Column(SQLEnum(FilingStatus), default=FilingStatus.UNFILED)  # 定级备案状态
    implementation_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 实施负责人
    approval_date = Column(Date, nullable=True)  # 审批完成时间
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # 创建人
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.DRAFT)

    # 关系
    creator = relationship("User", back_populates="created_projects", foreign_keys=[created_by])
    business_manager = relationship("User", back_populates="managed_projects", foreign_keys=[business_manager_id])
    implementation_manager = relationship("User", back_populates="implemented_projects", foreign_keys=[implementation_manager_id])
    systems = relationship("System", back_populates="project", cascade="all, delete-orphan")
    assignments = relationship("ProjectAssignment", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(id={self.id}, code='{self.project_code}')>"


class System(Base):
    """系统表 - 一个项目可以有多个系统"""
    __tablename__ = "systems"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    system_code = Column(String(50), default="")  # 系统编号
    system_name = Column(String(255), nullable=False)  # 系统名称
    system_level = Column(SQLEnum(SystemLevel), default=SystemLevel.NA)  # 系统级别
    system_type = Column(String(100), default="/")  # 系统类型

    # 关系
    project = relationship("Project", back_populates="systems")
    assignments = relationship("ProjectAssignment", back_populates="system")

    def __repr__(self):
        return f"<System(id={self.id}, name='{self.system_name}')>"


class ProjectAssignment(Base):
    """项目分配表"""
    __tablename__ = "project_assignments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    system_id = Column(Integer, ForeignKey("systems.id"), nullable=True)  # 可选，分配到具体系统
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 被分配人
    department = Column(String(100), default="")  # 部门（员工填写）
    contribution = Column(Text, default="")  # 人员贡献率描述
    assigned_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # 关系
    project = relationship("Project", back_populates="assignments")
    system = relationship("System", back_populates="assignments")
    assignee = relationship("User", back_populates="assignments")

    def __repr__(self):
        return f"<ProjectAssignment(project_id={self.project_id}, assignee_id={self.assignee_id})>"
