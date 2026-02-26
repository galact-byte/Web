"""
数据库模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    manager = "manager"
    employee = "employee"


class ProjectStatus(str, enum.Enum):
    draft = "draft"          # 待分发
    assigned = "assigned"    # 进行中
    completed = "completed"  # 已完成


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.employee)
    department = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    created_projects = relationship("Project", back_populates="creator", foreign_keys="Project.creator_id")
    business_projects = relationship("Project", back_populates="business_manager", foreign_keys="Project.business_manager_id")
    impl_projects = relationship("Project", back_populates="implementation_manager", foreign_keys="Project.implementation_manager_id")
    assignments = relationship("ProjectAssignment", back_populates="assignee")


class Project(Base):
    """项目表"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String(50), unique=True, index=True, nullable=False)  # 项目编号
    project_name = Column(String(200), nullable=False)  # 项目名称
    client_name = Column(String(200), nullable=True)  # 被测单位名称
    business_category = Column(String(50), nullable=False, default="等保测评")  # 业务类别
    project_location = Column(String(100), nullable=True)  # 项目地点
    contract_status = Column(String(20), default="未签订")  # 合同状态
    filing_status = Column(String(20), default="未备案")  # 定级备案状态
    approval_date = Column(String(20), nullable=True)  # 审批完成时间
    status = Column(Enum(ProjectStatus), default=ProjectStatus.draft)
    
    # 外键
    creator_id = Column(Integer, ForeignKey("users.id"))
    business_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    implementation_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    creator = relationship("User", back_populates="created_projects", foreign_keys=[creator_id])
    business_manager = relationship("User", back_populates="business_projects", foreign_keys=[business_manager_id])
    implementation_manager = relationship("User", back_populates="impl_projects", foreign_keys=[implementation_manager_id])
    systems = relationship("System", back_populates="project", cascade="all, delete-orphan")
    assignments = relationship("ProjectAssignment", back_populates="project", cascade="all, delete-orphan")


class System(Base):
    """系统表（一个项目可以有多个系统）"""
    __tablename__ = "systems"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    system_code = Column(String(50), nullable=True)  # 系统编号
    system_name = Column(String(200), nullable=False)  # 系统名称
    system_level = Column(String(20), default="第二级")  # 系统级别
    system_type = Column(String(50), default="传统系统")  # 系统类型
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 关系
    project = relationship("Project", back_populates="systems")


class ProjectAssignment(Base):
    """项目分配表"""
    __tablename__ = "project_assignments"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    department = Column(String(100), nullable=True)  # 部门
    contribution = Column(Text, nullable=True)  # 人员贡献率描述
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    project = relationship("Project", back_populates="assignments")
    assignee = relationship("User", back_populates="assignments")
