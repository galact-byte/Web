"""
项目进度路由
- 支持多种项目类型的数据爬取、查询、导出
"""
import io
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.progress import ProgressRecord, ProgressScrapeLog, PROJECT_TYPE_NAMES
from app.schemas.progress import (
    ProgressRecordResponse,
    ProgressListResponse,
    ProgressScrapeRequest,
    ProgressScrapeLogResponse,
    ProgressConfigResponse,
    ProgressConfigUpdate,
)
from app.services.progress_scraper import (
    ProgressScraper,
    load_config,
    save_config,
    EXCEL_COLUMNS,
    DB_FIELD_NAMES,
)
from app.services.auth import get_current_user, get_current_manager

router = APIRouter(prefix="/api/progress", tags=["项目进度"])


def _validate_project_type(project_type: str) -> str:
    """校验项目类型参数"""
    if project_type not in PROJECT_TYPE_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的项目类型: {project_type}，"
                   f"可选: {', '.join(PROJECT_TYPE_NAMES.keys())}",
        )
    return project_type


@router.post("/{project_type}/scrape", response_model=ProgressScrapeLogResponse)
def scrape(
    project_type: str,
    request: Optional[ProgressScrapeRequest] = Body(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_manager),
):
    """触发数据爬取（需要经理权限）"""
    _validate_project_type(project_type)
    type_name = PROJECT_TYPE_NAMES[project_type]

    log = ProgressScrapeLog(project_type=project_type, status="running")
    db.add(log)
    db.commit()
    db.refresh(log)

    start_time = time.time()
    scraper = ProgressScraper(project_type)

    try:
        page_size = request.page_size if request else None
        records = scraper.run(page_size)

        batch_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 增量同步：新增追加、变更更新、已删除移除
        existing = {
            r.system_id: r
            for r in db.query(ProgressRecord).filter(
                ProgressRecord.project_type == project_type
            ).all()
        }
        new_ids = set()

        for rec_data in records:
            sid = rec_data.get("system_id", "")
            new_ids.add(sid)

            if sid and sid in existing:
                # 更新已有记录
                for key, value in rec_data.items():
                    setattr(existing[sid], key, value)
                existing[sid].batch_id = batch_id
            else:
                # 新增记录
                record = ProgressRecord(
                    project_type=project_type,
                    batch_id=batch_id,
                    **rec_data,
                )
                db.add(record)

        # 删除远端已不存在的记录
        for sid, record in existing.items():
            if sid not in new_ids:
                db.delete(record)

        log.status = "success"
        log.total_records = len(records)
        log.duration_seconds = round(time.time() - start_time, 2)
        log.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(log)
        return log

    except Exception as e:
        log.status = "failed"
        log.error_message = str(e)
        log.duration_seconds = round(time.time() - start_time, 2)
        log.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{type_name}爬取失败: {e}",
        )
    finally:
        scraper.cleanup()


@router.get("/{project_type}/records", response_model=ProgressListResponse)
def get_records(
    project_type: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """查询项目进度记录（分页、搜索）"""
    _validate_project_type(project_type)

    query = db.query(ProgressRecord).filter(
        ProgressRecord.project_type == project_type
    )

    if batch_id:
        query = query.filter(ProgressRecord.batch_id == batch_id)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (ProgressRecord.system_name.ilike(pattern))
            | (ProgressRecord.customer_name.ilike(pattern))
            | (ProgressRecord.project_name.ilike(pattern))
            | (ProgressRecord.project_manager.ilike(pattern))
            | (ProgressRecord.system_id.ilike(pattern))
        )

    total = query.count()
    items = query.order_by(desc(ProgressRecord.system_id)).offset(offset).limit(limit).all()
    return ProgressListResponse(total=total, items=items)


@router.get("/{project_type}/records/export")
def export_records(
    project_type: str,
    batch_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """导出项目进度数据为 Excel"""
    _validate_project_type(project_type)
    type_name = PROJECT_TYPE_NAMES[project_type]

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    query = db.query(ProgressRecord).filter(
        ProgressRecord.project_type == project_type
    )
    if batch_id:
        query = query.filter(ProgressRecord.batch_id == batch_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (ProgressRecord.system_name.ilike(pattern))
            | (ProgressRecord.customer_name.ilike(pattern))
            | (ProgressRecord.project_name.ilike(pattern))
            | (ProgressRecord.project_manager.ilike(pattern))
        )

    records = query.order_by(desc(ProgressRecord.id)).all()
    if not records:
        raise HTTPException(status_code=404, detail="没有可导出的数据")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = type_name

    header_font = Font(name="微软雅黑", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )
    data_font = Font(name="微软雅黑", size=10)
    data_align = Alignment(vertical="center", wrap_text=True)

    for col_idx, col_name in enumerate(EXCEL_COLUMNS, 1):
        cell = ws.cell(row=1, column=col_idx, value=col_name)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    for row_idx, record in enumerate(records, 2):
        for col_idx, field in enumerate(DB_FIELD_NAMES, 1):
            value = getattr(record, field, "") or ""
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = data_font
            cell.alignment = data_align
            cell.border = thin_border

    for col_idx, col_name in enumerate(EXCEL_COLUMNS, 1):
        max_len = len(col_name)
        for row_idx in range(2, min(len(records) + 2, 52)):
            val = str(ws.cell(row=row_idx, column=col_idx).value or "")
            max_len = max(max_len, len(val))
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = min(max_len + 4, 40)

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{type_name}_{timestamp}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


@router.get("/{project_type}/logs", response_model=list[ProgressScrapeLogResponse])
def get_logs(
    project_type: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """获取爬取日志"""
    _validate_project_type(project_type)
    logs = (
        db.query(ProgressScrapeLog)
        .filter(ProgressScrapeLog.project_type == project_type)
        .order_by(desc(ProgressScrapeLog.id))
        .limit(limit)
        .all()
    )
    return logs


@router.get("/config", response_model=ProgressConfigResponse)
def get_config(current_user=Depends(get_current_manager)):
    """获取爬虫配置（敏感字段脱敏）"""
    config = load_config()
    return ProgressConfigResponse(
        base_url=config.get("base_url", ""),
        pfx_path=config.get("pfx_path", ""),
        username=config.get("username", ""),
        has_password=bool(config.get("password")),
        has_cookie=bool(config.get("cookie")),
        page_size=config.get("page_size", 50),
    )


@router.put("/config", response_model=ProgressConfigResponse)
def update_config(
    update: ProgressConfigUpdate,
    current_user=Depends(get_current_manager),
):
    """更新爬虫配置（需要经理权限）"""
    config = load_config()
    update_data = update.model_dump(exclude_none=True)
    config.update(update_data)
    save_config(config)

    return ProgressConfigResponse(
        base_url=config.get("base_url", ""),
        pfx_path=config.get("pfx_path", ""),
        username=config.get("username", ""),
        has_password=bool(config.get("password")),
        has_cookie=bool(config.get("cookie")),
        page_size=config.get("page_size", 50),
    )
