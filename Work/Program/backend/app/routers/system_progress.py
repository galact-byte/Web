"""
系统进度汇报路由
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func

from app.database import get_db
from app.models import User, Project, System, ProjectAssignment, SystemProgressReport, PHASE_LABELS, SystemProgressPhase
from app.schemas.schemas import (
    ProgressReportBatchCreate,
    ProgressReportResponse,
    SystemProgressResponse,
    SyncProgressRequest,
)
from app.services.auth import get_current_user

router = APIRouter(
    prefix="/api/projects/{project_id}/progress",
    tags=["系统进度汇报"],
)


def _get_current_week() -> str:
    """获取当前 ISO 周号，格式 '2026-W13'"""
    now = datetime.now()
    iso = now.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def _get_phase_label(phase: str) -> str:
    """获取阶段中文标签"""
    try:
        return PHASE_LABELS.get(SystemProgressPhase(phase), phase)
    except ValueError:
        return phase


def _check_project_access(project: Project, user: User) -> None:
    """检查用户是否有权限查看该项目的进度"""
    if user.role.value == "manager" and project.creator_id == user.id:
        return
    # 检查是否为被分配员工（通过 assignments 关系）
    for assignment in project.assignments:
        if assignment.assignee_id == user.id:
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看该项目进度")


def _check_assignee(project: Project, user: User) -> None:
    """检查用户是否为该项目的被分配员工"""
    for assignment in project.assignments:
        if assignment.assignee_id == user.id:
            return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="您未被分配到该项目，无法汇报进度")


@router.get("", response_model=list[SystemProgressResponse])
async def get_progress_overview(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取项目下所有系统的当前进度总览"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    _check_project_access(project, current_user)

    systems = db.query(System).filter(System.project_id == project_id).all()
    result = []
    for sys in systems:
        # 查最新一条汇报记录
        latest = (
            db.query(SystemProgressReport)
            .filter(SystemProgressReport.system_id == sys.id)
            .order_by(SystemProgressReport.created_at.desc())
            .first()
        )
        reporter_name = None
        if latest and latest.reporter:
            reporter_name = latest.reporter.display_name

        result.append(SystemProgressResponse(
            system_id=sys.id,
            system_name=sys.system_name,
            current_phase=sys.current_phase or "not_started",
            current_phase_label=_get_phase_label(sys.current_phase or "not_started"),
            latest_remark=latest.remark if latest else None,
            latest_reporter_name=reporter_name,
            latest_report_time=latest.created_at if latest else None,
            report_count=db.query(sa_func.count(SystemProgressReport.id))
                .filter(SystemProgressReport.system_id == sys.id)
                .scalar() or 0,
        ))

    return result


@router.post("", response_model=list[ProgressReportResponse])
async def submit_progress(
    project_id: int,
    data: ProgressReportBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交/更新本周进度汇报（批量，同周覆盖更新）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    _check_assignee(project, current_user)

    current_week = _get_current_week()
    valid_phases = {p.value for p in SystemProgressPhase}
    results = []

    for report in data.reports:
        # 校验阶段值
        if report.phase not in valid_phases:
            raise HTTPException(
                status_code=400,
                detail=f"无效的进度阶段: {report.phase}",
            )

        # 校验系统属于该项目
        system = db.query(System).filter(
            System.id == report.system_id,
            System.project_id == project_id,
        ).first()
        if not system:
            raise HTTPException(
                status_code=400,
                detail=f"系统 ID {report.system_id} 不属于该项目",
            )

        # 同周覆盖更新
        existing = db.query(SystemProgressReport).filter(
            SystemProgressReport.system_id == report.system_id,
            SystemProgressReport.reporter_id == current_user.id,
            SystemProgressReport.report_week == current_week,
        ).first()

        if existing:
            existing.phase = report.phase
            existing.remark = report.remark
            existing.updated_at = datetime.now()
            record = existing
        else:
            record = SystemProgressReport(
                system_id=report.system_id,
                project_id=project_id,
                reporter_id=current_user.id,
                phase=report.phase,
                remark=report.remark,
                report_week=current_week,
            )
            db.add(record)

        # 同步更新 System.current_phase
        system.current_phase = report.phase

        db.flush()
        results.append(ProgressReportResponse(
            id=record.id,
            system_id=record.system_id,
            system_name=system.system_name,
            phase=record.phase,
            phase_label=_get_phase_label(record.phase),
            remark=record.remark,
            reporter_name=current_user.display_name,
            report_week=record.report_week,
            created_at=record.created_at,
        ))

    db.commit()
    return results


@router.get("/history", response_model=list[ProgressReportResponse])
async def get_progress_history(
    project_id: int,
    system_id: Optional[int] = Query(None, description="按系统 ID 筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """获取汇报历史记录"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    _check_project_access(project, current_user)

    query = db.query(SystemProgressReport).filter(
        SystemProgressReport.project_id == project_id
    )
    if system_id is not None:
        query = query.filter(SystemProgressReport.system_id == system_id)

    records = (
        query.order_by(SystemProgressReport.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        ProgressReportResponse(
            id=r.id,
            system_id=r.system_id,
            system_name=r.system.system_name if r.system else "",
            phase=r.phase,
            phase_label=_get_phase_label(r.phase),
            remark=r.remark,
            reporter_name=r.reporter.display_name if r.reporter else "",
            report_week=r.report_week,
            created_at=r.created_at,
        )
        for r in records
    ]


@router.post("/sync", response_model=list[ProgressReportResponse])
async def sync_progress(
    project_id: int,
    data: SyncProgressRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """一键同步所有系统为相同进度阶段"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    _check_assignee(project, current_user)

    valid_phases = {p.value for p in SystemProgressPhase}
    if data.phase not in valid_phases:
        raise HTTPException(status_code=400, detail=f"无效的进度阶段: {data.phase}")

    systems = db.query(System).filter(System.project_id == project_id).all()
    if not systems:
        raise HTTPException(status_code=400, detail="该项目没有系统")

    current_week = _get_current_week()
    results = []

    for system in systems:
        # 同周覆盖更新
        existing = db.query(SystemProgressReport).filter(
            SystemProgressReport.system_id == system.id,
            SystemProgressReport.reporter_id == current_user.id,
            SystemProgressReport.report_week == current_week,
        ).first()

        if existing:
            existing.phase = data.phase
            existing.remark = data.remark
            existing.updated_at = datetime.now()
            record = existing
        else:
            record = SystemProgressReport(
                system_id=system.id,
                project_id=project_id,
                reporter_id=current_user.id,
                phase=data.phase,
                remark=data.remark,
                report_week=current_week,
            )
            db.add(record)

        system.current_phase = data.phase
        db.flush()

        results.append(ProgressReportResponse(
            id=record.id,
            system_id=record.system_id,
            system_name=system.system_name,
            phase=record.phase,
            phase_label=_get_phase_label(record.phase),
            remark=record.remark,
            reporter_name=current_user.display_name,
            report_week=record.report_week,
            created_at=record.created_at,
        ))

    db.commit()
    return results
