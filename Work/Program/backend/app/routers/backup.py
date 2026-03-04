"""
数据库备份与恢复路由
"""
import io
import json
import shutil
import os
import logging
from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db, DATABASE_URL
from app.models import User, Project, System, ProjectAssignment, UserRole, ProjectStatus
from app.services.auth import get_current_manager, hash_password

router = APIRouter(prefix="/api/backup", tags=["备份恢复"])
logger = logging.getLogger(__name__)

IS_DEV = os.getenv("ENV", "dev").lower() == "dev"

# 序列重置白名单
_ALLOWED_TABLES = ("users", "projects", "systems", "project_assignments")


def _serialize_value(v):
    """将值序列化为 JSON 兼容格式"""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (UserRole, ProjectStatus)):
        return v.value
    return v


def _row_to_dict(row, columns):
    """将 ORM 对象转为字典"""
    return {col: _serialize_value(getattr(row, col)) for col in columns}


@router.post("/export")
def export_backup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """导出数据库为 JSON 备份文件（仅经理）"""
    # 导出所有表数据（不导出 password_hash，防止敏感信息泄露）
    user_cols = [
        "id", "username", "display_name",
        "role", "department", "must_change_password", "created_at"
    ]
    project_cols = [
        "id", "project_code", "project_name", "client_name",
        "business_category", "project_location", "contract_status",
        "filing_status", "approval_date", "status",
        "creator_id", "business_manager_name", "implementation_manager_id",
        "created_at"
    ]
    system_cols = [
        "id", "project_id", "system_code", "system_name",
        "system_level", "system_type"
    ]
    assignment_cols = [
        "id", "project_id", "assignee_id",
        "department", "contribution", "status", "created_at"
    ]

    backup_data = {
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "exported_by": current_user.display_name,
        "tables": {
            "users": [_row_to_dict(u, user_cols) for u in db.query(User).all()],
            "projects": [_row_to_dict(p, project_cols) for p in db.query(Project).all()],
            "systems": [_row_to_dict(s, system_cols) for s in db.query(System).all()],
            "project_assignments": [
                _row_to_dict(a, assignment_cols)
                for a in db.query(ProjectAssignment).all()
            ],
        }
    }

    content = json.dumps(backup_data, ensure_ascii=False, indent=2)
    output = io.BytesIO(content.encode("utf-8"))
    output.seek(0)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{timestamp}.json"

    return StreamingResponse(
        output,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"}
    )


@router.get("/download-db")
def download_db(
    current_user: User = Depends(get_current_manager)
):
    """下载 SQLite 数据库文件（仅 SQLite 模式，仅经理）"""
    if not DATABASE_URL.startswith("sqlite"):
        raise HTTPException(status_code=400, detail="仅 SQLite 数据库支持直接下载")

    # 从 DATABASE_URL 提取文件路径并解析为绝对路径
    db_path = DATABASE_URL.replace("sqlite:///", "")
    db_path = os.path.abspath(db_path)
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="数据库文件不存在")

    # 创建临时副本避免锁冲突
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_{timestamp}.db"
    backup_path = db_path + f".backup_{timestamp}"

    try:
        shutil.copy2(db_path, backup_path)
        return FileResponse(
            path=backup_path,
            filename=backup_filename,
            media_type="application/octet-stream",
            background=_cleanup_file(backup_path)
        )
    except Exception as e:
        # 清理失败的备份文件
        if os.path.exists(backup_path):
            os.remove(backup_path)
        logger.error(f"数据库备份失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="备份失败，请联系管理员")


def _cleanup_file(path: str):
    """后台任务：响应发送后删除临时文件"""
    from starlette.background import BackgroundTask
    return BackgroundTask(os.remove, path)


@router.post("/import")
async def import_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """从 JSON 备份文件恢复数据库（仅经理）

    警告：此操作会清空现有数据并用备份数据替换！
    """
    # 验证文件类型
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="仅支持 .json 格式的备份文件")
    if file.content_type and file.content_type not in ("application/json", "text/plain", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="文件类型不正确，仅支持 JSON 文件")

    # 限制文件大小（50MB）
    MAX_SIZE = 50 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="备份文件过大，最大支持 50MB")

    try:
        backup_data = json.loads(content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="无效的 JSON 文件")

    # 验证备份格式
    if "tables" not in backup_data or "version" not in backup_data:
        raise HTTPException(status_code=400, detail="无效的备份文件格式")

    tables = backup_data["tables"]
    required_tables = ["users", "projects", "systems", "project_assignments"]
    for t in required_tables:
        if t not in tables:
            raise HTTPException(status_code=400, detail=f"备份文件缺少 {t} 表数据")

    # 验证备份中至少有一个经理用户（防止恢复后无法登录）
    has_manager = any(
        u.get("role") == "manager" for u in tables["users"]
    )
    if not has_manager:
        raise HTTPException(status_code=400, detail="备份数据中没有经理角色用户，恢复后将无法管理系统")

    try:
        # 按依赖顺序清空（先删子表再删父表）
        db.query(ProjectAssignment).delete()
        db.query(System).delete()
        db.query(Project).delete()
        db.query(User).delete()
        db.flush()

        # 恢复用户（安全：始终重置密码，强制改密，不信任备份中的 password_hash）
        default_hash = hash_password("123456")
        for u in tables["users"]:
            user = User(
                id=u["id"],
                username=u["username"],
                password_hash=default_hash,
                display_name=u["display_name"],
                role=UserRole(u["role"]),
                department=u.get("department", ""),
                must_change_password=True,
            )
            db.add(user)
        db.flush()

        # 恢复项目（验证 creator_id 有效性）
        valid_user_ids = {u["id"] for u in tables["users"]}
        for p in tables["projects"]:
            creator_id = p.get("creator_id")
            if creator_id and creator_id not in valid_user_ids:
                creator_id = None
            bm_name = p.get("business_manager_name")
            im_id = p.get("implementation_manager_id")
            if im_id and im_id not in valid_user_ids:
                im_id = None

            project = Project(
                id=p["id"],
                project_code=p["project_code"],
                project_name=p["project_name"],
                client_name=p.get("client_name", ""),
                business_category=p.get("business_category", "等保测评"),
                project_location=p.get("project_location", ""),
                contract_status=p.get("contract_status", "未签订"),
                filing_status=p.get("filing_status", "未备案"),
                approval_date=p.get("approval_date"),
                status=ProjectStatus(p.get("status", "draft")),
                creator_id=creator_id,
                business_manager_name=bm_name,
                implementation_manager_id=im_id,
            )
            db.add(project)
        db.flush()

        # 恢复系统
        valid_project_ids = {p["id"] for p in tables["projects"]}
        for s in tables["systems"]:
            if s["project_id"] not in valid_project_ids:
                continue
            system = System(
                id=s["id"],
                project_id=s["project_id"],
                system_code=s.get("system_code", ""),
                system_name=s["system_name"],
                system_level=s.get("system_level", "第二级"),
                system_type=s.get("system_type", "传统系统"),
            )
            db.add(system)
        db.flush()

        # 恢复分配
        for a in tables["project_assignments"]:
            if a["project_id"] not in valid_project_ids:
                continue
            if a["assignee_id"] not in valid_user_ids:
                continue
            assignment = ProjectAssignment(
                id=a["id"],
                project_id=a["project_id"],
                assignee_id=a["assignee_id"],
                department=a.get("department", ""),
                contribution=a.get("contribution", ""),
                status=a.get("status", "pending"),
            )
            db.add(assignment)

        db.commit()

        # 重置自增序列，防止后续插入主键冲突
        _reset_sequences(db, tables)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"数据库恢复失败: {e}", exc_info=True)
        detail = f"数据恢复失败: {str(e)}" if IS_DEV else "数据恢复失败，请联系管理员"
        raise HTTPException(status_code=500, detail=detail)

    return {
        "message": "数据恢复成功（所有用户密码已重置为 123456，请通知用户修改）",
        "stats": {
            "users": len(tables["users"]),
            "projects": len(tables["projects"]),
            "systems": len(tables["systems"]),
            "assignments": len(tables["project_assignments"]),
        }
    }


def _reset_sequences(db: Session, tables: dict):
    """重置自增序列"""
    table_records = [
        ("users", tables["users"]),
        ("projects", tables["projects"]),
        ("systems", tables["systems"]),
        ("project_assignments", tables["project_assignments"]),
    ]

    try:
        if DATABASE_URL.startswith("sqlite"):
            for table_name, records in table_records:
                if table_name not in _ALLOWED_TABLES:
                    continue
                if records:
                    max_id = max(r["id"] for r in records)
                    db.execute(
                        text("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (:name, :seq)"),
                        {"name": table_name, "seq": max_id}
                    )
            db.commit()
        else:
            # PostgreSQL: 使用参数化查询重置 sequence
            for table_name, records in table_records:
                if table_name not in _ALLOWED_TABLES:
                    continue
                if records:
                    max_id = max(r["id"] for r in records)
                    db.execute(
                        text(f"SELECT setval(pg_get_serial_sequence(:tname, 'id'), :max_id)"),
                        {"tname": table_name, "max_id": max_id}
                    )
            db.commit()
    except Exception as e:
        logger.warning(f"重置自增序列失败（不影响已恢复的数据）: {e}")
        db.rollback()
