"""
项目进度数据模型
- 存储从内部项目管理系统爬取的项目进度数据
- 支持多种项目类型：等保测评、密码评估、安全评估等
"""
import enum

from sqlalchemy import Column, Integer, String, Text, DateTime, Float
from sqlalchemy.sql import func

from app.database import Base


class ProjectType(str, enum.Enum):
    dengbao = "dengbao"
    password = "password"
    security = "security"
    risk = "risk"
    testing = "testing"
    service = "service"
    comprehensive = "comprehensive"


# 项目类型显示名称
PROJECT_TYPE_NAMES = {
    "dengbao": "等保测评",
    "password": "密码评估",
    "security": "安全评估",
    "risk": "风险评估",
    "testing": "软件测试",
    "service": "安全服务",
    "comprehensive": "综合服务",
}


class ProgressRecord(Base):
    """项目进度爬取记录"""
    __tablename__ = "progress_records"

    id = Column(Integer, primary_key=True, index=True)
    project_type = Column(String(30), index=True, nullable=False)
    batch_id = Column(String(50), index=True, nullable=False)

    # 24 个业务字段
    system_id = Column(String(100), nullable=True)        # 系统编号
    system_name = Column(String(200), nullable=True)      # 系统名称
    customer_name = Column(String(200), nullable=True)    # 客户名称
    system_level = Column(String(50), nullable=True)      # 系统级别
    system_tag = Column(String(100), nullable=True)       # 系统标签
    business_type = Column(String(100), nullable=True)    # 业务类型
    project_name = Column(String(200), nullable=True)     # 项目名称
    project_code = Column(String(100), nullable=True)     # 项目编号
    project_location = Column(String(200), nullable=True) # 项目地点
    init_status = Column(String(50), nullable=True)       # 立项状态
    project_manager = Column(String(100), nullable=True)  # 项目经理
    pm_department = Column(String(100), nullable=True)    # 项目部门
    sale_contact = Column(String(100), nullable=True)     # 销售负责人
    required_start_date = Column(String(50), nullable=True)   # 要求进场时间
    required_end_date = Column(String(50), nullable=True)     # 要求完结时间
    actual_start_date = Column(String(50), nullable=True)     # 实施开始日期
    actual_end_date = Column(String(50), nullable=True)       # 实施结束日期
    project_status = Column(String(50), nullable=True)    # 项目状态
    is_finished = Column(String(20), nullable=True)       # 是否完结
    plan_printed = Column(String(20), nullable=True)      # 方案打印
    report_printed = Column(String(20), nullable=True)    # 报告打印
    register_status = Column(String(50), nullable=True)   # 备案状态
    contract_status = Column(String(50), nullable=True)   # 合同状态
    remark = Column(Text, nullable=True)                  # 备注

    scraped_at = Column(DateTime(timezone=True), server_default=func.now())


class ProgressScrapeLog(Base):
    """爬取日志"""
    __tablename__ = "progress_scrape_logs"

    id = Column(Integer, primary_key=True, index=True)
    project_type = Column(String(30), index=True, nullable=False)
    status = Column(String(20), default="running")  # running / success / failed
    total_records = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)
