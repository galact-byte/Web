"""
用户数据模型
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum

from .database import Base


class UserRole(str, enum.Enum):
    """用户角色"""
    MANAGER = "manager"
    EMPLOYEE = "employee"


class User(Base):
    """用户表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(100), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.EMPLOYEE, nullable=False)
    department = Column(String(100), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关系
    created_projects = relationship("Project", back_populates="creator", foreign_keys="Project.created_by")
    managed_projects = relationship("Project", back_populates="business_manager", foreign_keys="Project.business_manager_id")
    implemented_projects = relationship("Project", back_populates="implementation_manager", foreign_keys="Project.implementation_manager_id")
    assignments = relationship("ProjectAssignment", back_populates="assignee")

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role={self.role})>"
