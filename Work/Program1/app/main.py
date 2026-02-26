import io
import os
import uuid
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from docx import Document
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from openpyxl import Workbook, load_workbook
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from .db import get_db, init_db
from .models import (
    Attachment,
    KnowledgeDocument,
    KnowledgeDownloadLog,
    Organization,
    OrganizationHistory,
    Report,
    ReviewRecord,
    SystemHistory,
    SystemInfo,
    WorkflowAction,
    WorkflowConfig,
    WorkflowInstance,
)
from .schemas import (
    OrganizationCreate,
    OrganizationUpdate,
    ReportEdit,
    SystemCreate,
    SystemUpdate,
    WorkflowConfigUpdate,
)
from .services.reporting import export_report_docx, export_report_pdf, generate_report_payload
from .validators import (
    validate_credit_code,
    validate_email,
    validate_mobile_phone,
    validate_office_phone,
)

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
EXPORT_DIR = BASE_DIR / "exports"
MAX_ORG_ATTACHMENT = 100 * 1024 * 1024
MAX_SYS_ATTACHMENT = 200 * 1024 * 1024
MAX_KNOWLEDGE_FILE = 300 * 1024 * 1024
DEFAULT_WORKFLOW_STEPS = ["信息收集", "信息审核", "报告生成", "报告审核", "报告终稿", "归档"]
VALID_REPORT_TYPES = {"filing_form", "grading_report", "expert_review_form"}


def env_to_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "y"}


APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
ENABLE_API_DOCS = env_to_bool(os.getenv("ENABLE_API_DOCS"), False)

app = FastAPI(
    title="定级备案管理系统",
    version="1.0.0",
    docs_url="/docs" if ENABLE_API_DOCS else None,
    redoc_url="/redoc" if ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_API_DOCS else None,
)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "app" / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "app" / "templates"))
templates.env.globals["show_api_docs"] = ENABLE_API_DOCS


def ensure_dirs() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / "attachments").mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / "knowledge").mkdir(parents=True, exist_ok=True)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)


@app.on_event("startup")
def startup() -> None:
    ensure_dirs()
    init_db()


def obj_to_dict(obj: Any, fields: list[str]) -> dict[str, Any]:
    def _normalize(value: Any) -> Any:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, dict):
            return {k: _normalize(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_normalize(i) for i in value]
        return value

    return {f: _normalize(getattr(obj, f)) for f in fields}


ORG_FIELDS = [
    "id",
    "name",
    "credit_code",
    "legal_representative",
    "address",
    "office_phone",
    "mobile_phone",
    "email",
    "industry",
    "organization_type",
    "cybersecurity_dept",
    "cybersecurity_owner_name",
    "cybersecurity_owner_title",
    "cybersecurity_owner_phone",
    "cybersecurity_owner_email",
    "data_security_dept",
    "data_security_owner_name",
    "data_security_owner_title",
    "data_security_owner_phone",
    "data_security_owner_email",
    "supervising_department",
    "filing_region",
    "involves_state_secret",
    "is_cii",
    "remark",
    "created_by",
    "archived",
    "locked",
    "deleted_at",
    "created_at",
    "updated_at",
]

SYSTEM_FIELDS = [
    "id",
    "organization_id",
    "system_name",
    "system_code",
    "proposed_level",
    "business_description",
    "system_type",
    "deployment_mode",
    "go_live_date",
    "boundary",
    "subsystems",
    "service_object",
    "service_scope",
    "network_topology",
    "data_name",
    "data_level",
    "data_category",
    "data_security_dept",
    "data_security_owner",
    "contains_personal_info",
    "data_total",
    "monthly_growth",
    "data_source",
    "data_flow",
    "data_interaction",
    "storage_location",
    "level_basis",
    "impact_scope",
    "level_reason",
    "needs_expert_review",
    "expert_review_info",
    "ops_unit",
    "ops_personnel",
    "created_by",
    "archived",
    "locked",
    "deleted_at",
    "created_at",
    "updated_at",
]


def validate_org_payload(data: dict[str, Any]) -> None:
    if not validate_credit_code(data["credit_code"]):
        raise HTTPException(status_code=400, detail="统一社会信用代码格式错误，应为18位大写字母或数字。")
    if not validate_mobile_phone(data["mobile_phone"]):
        raise HTTPException(status_code=400, detail="手机号格式错误，应为11位中国大陆手机号。")
    if not validate_office_phone(data.get("office_phone") or ""):
        raise HTTPException(status_code=400, detail="办公电话格式错误。")
    if not validate_email(data["email"]):
        raise HTTPException(status_code=400, detail="邮箱格式错误。")


def validate_org_partial(data: dict[str, Any]) -> None:
    if "mobile_phone" in data and not validate_mobile_phone(data["mobile_phone"]):
        raise HTTPException(status_code=400, detail="手机号格式错误，应为11位中国大陆手机号。")
    if "office_phone" in data and not validate_office_phone(data.get("office_phone") or ""):
        raise HTTPException(status_code=400, detail="办公电话格式错误。")
    if "email" in data and not validate_email(data["email"]):
        raise HTTPException(status_code=400, detail="邮箱格式错误。")


def record_org_history(
    db: Session,
    organization_id: int,
    changed_by: str,
    change_type: str,
    before_data: dict[str, Any] | None,
    after_data: dict[str, Any] | None,
) -> None:
    db.add(
        OrganizationHistory(
            organization_id=organization_id,
            changed_by=changed_by,
            change_type=change_type,
            before_data=before_data,
            after_data=after_data,
        )
    )


def record_system_history(
    db: Session,
    system_id: int,
    changed_by: str,
    change_type: str,
    before_data: dict[str, Any] | None,
    after_data: dict[str, Any] | None,
) -> None:
    db.add(
        SystemHistory(
            system_id=system_id,
            changed_by=changed_by,
            change_type=change_type,
            before_data=before_data,
            after_data=after_data,
        )
    )


def get_workflow_config(db: Session) -> WorkflowConfig:
    config = db.query(WorkflowConfig).filter(WorkflowConfig.name == "default").first()
    if config:
        return config
    config = WorkflowConfig(name="default", steps_json=DEFAULT_WORKFLOW_STEPS, updated_by="system")
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def get_system_or_404(db: Session, system_id: int) -> SystemInfo:
    system = db.query(SystemInfo).filter(SystemInfo.id == system_id, SystemInfo.deleted_at.is_(None)).first()
    if not system:
        raise HTTPException(status_code=404, detail="系统不存在。")
    return system


def get_org_or_404(db: Session, org_id: int) -> Organization:
    org = db.query(Organization).filter(Organization.id == org_id, Organization.deleted_at.is_(None)).first()
    if not org:
        raise HTTPException(status_code=404, detail="单位不存在。")
    return org


def generate_system_code(db: Session) -> str:
    total = db.query(func.count(SystemInfo.id)).scalar() or 0
    return f"SYS-{datetime.now():%Y%m%d}-{total + 1:04d}"


def build_report_title(report_type: str, system_name: str, version: int) -> str:
    title_map = {
        "filing_form": "定级备案表",
        "grading_report": "定级报告",
        "expert_review_form": "专家评审意见表",
    }
    return f"{title_map.get(report_type, '报告')}-{system_name}-V{version}"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def dashboard_page(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/organizations", response_class=HTMLResponse)
def organizations_page(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("organizations.html", {"request": request})


@app.get("/systems", response_class=HTMLResponse)
def systems_page(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("systems.html", {"request": request})


@app.get("/reports", response_class=HTMLResponse)
def reports_page(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("reports.html", {"request": request})


@app.get("/knowledge", response_class=HTMLResponse)
def knowledge_page(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("knowledge.html", {"request": request})


@app.post("/api/organizations")
def create_organization(payload: OrganizationCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    data = payload.model_dump()
    validate_org_payload(data)
    exists = (
        db.query(Organization)
        .filter(Organization.credit_code == data["credit_code"], Organization.deleted_at.is_(None))
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="统一社会信用代码已存在。")
    org = Organization(**data)
    db.add(org)
    db.commit()
    db.refresh(org)
    record_org_history(db, org.id, payload.created_by, "create", None, obj_to_dict(org, ORG_FIELDS))
    db.commit()
    return {"message": "创建成功", "data": obj_to_dict(org, ORG_FIELDS)}


@app.get("/api/organizations")
def list_organizations(
    name: str | None = None,
    credit_code: str | None = None,
    industry: str | None = None,
    filing_region: str | None = None,
    created_by: str | None = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    query = db.query(Organization)
    if not include_deleted:
        query = query.filter(Organization.deleted_at.is_(None))
    if name:
        query = query.filter(Organization.name.like(f"%{name}%"))
    if credit_code:
        query = query.filter(Organization.credit_code.like(f"%{credit_code}%"))
    if industry:
        query = query.filter(Organization.industry.like(f"%{industry}%"))
    if filing_region:
        query = query.filter(Organization.filing_region.like(f"%{filing_region}%"))
    if created_by:
        query = query.filter(Organization.created_by.like(f"%{created_by}%"))
    items = query.order_by(Organization.created_at.desc()).all()
    return {"total": len(items), "items": [obj_to_dict(i, ORG_FIELDS) for i in items]}


@app.get("/api/organizations/{org_id}")
def get_organization(org_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    org = get_org_or_404(db, org_id)
    return obj_to_dict(org, ORG_FIELDS)


@app.put("/api/organizations/{org_id}")
def update_organization(
    org_id: int,
    payload: OrganizationUpdate,
    actor: str = Query("system"),
    is_admin: bool = Query(False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    org = get_org_or_404(db, org_id)
    if org.archived and org.locked and not is_admin:
        raise HTTPException(status_code=403, detail="已归档单位默认不可编辑，请管理员解锁。")
    data = payload.model_dump(exclude_unset=True)
    validate_org_partial(data)
    before = obj_to_dict(org, ORG_FIELDS)
    for key, value in data.items():
        setattr(org, key, value)
    db.commit()
    db.refresh(org)
    record_org_history(db, org.id, actor, "update", before, obj_to_dict(org, ORG_FIELDS))
    db.commit()
    return {"message": "更新成功", "data": obj_to_dict(org, ORG_FIELDS)}


@app.get("/api/organizations/{org_id}/history")
def organization_history(org_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_org_or_404(db, org_id)
    rows = (
        db.query(OrganizationHistory)
        .filter(OrganizationHistory.organization_id == org_id)
        .order_by(OrganizationHistory.changed_at.desc())
        .all()
    )
    return {
        "total": len(rows),
        "items": [
            {
                "changed_by": r.changed_by,
                "change_type": r.change_type,
                "before_data": r.before_data,
                "after_data": r.after_data,
                "changed_at": r.changed_at,
            }
            for r in rows
        ],
    }


@app.post("/api/organizations/{org_id}/archive")
def archive_organization(org_id: int, actor: str = Query("system"), db: Session = Depends(get_db)) -> dict[str, Any]:
    org = get_org_or_404(db, org_id)
    before = obj_to_dict(org, ORG_FIELDS)
    org.archived = True
    org.locked = True
    db.commit()
    db.refresh(org)
    record_org_history(db, org.id, actor, "archive", before, obj_to_dict(org, ORG_FIELDS))
    db.commit()
    return {"message": "归档成功", "data": obj_to_dict(org, ORG_FIELDS)}


@app.post("/api/organizations/{org_id}/unlock")
def unlock_organization(
    org_id: int,
    actor: str = Query("admin"),
    is_admin: bool = Query(True),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    if not is_admin:
        raise HTTPException(status_code=403, detail="仅管理员可解锁。")
    org = get_org_or_404(db, org_id)
    org.locked = False
    db.commit()
    db.refresh(org)
    record_org_history(db, org.id, actor, "unlock", None, {"locked": False})
    db.commit()
    return {"message": "解锁成功", "data": obj_to_dict(org, ORG_FIELDS)}


@app.delete("/api/organizations/{org_id}")
def delete_organization(
    org_id: int,
    actor: str = Query("system"),
    is_admin: bool = Query(False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    org = get_org_or_404(db, org_id)
    if org.archived and not is_admin:
        raise HTTPException(status_code=403, detail="已归档单位不可删除，仅管理员可操作。")
    related_systems = (
        db.query(SystemInfo)
        .filter(SystemInfo.organization_id == org_id, SystemInfo.deleted_at.is_(None))
        .count()
    )
    if related_systems > 0:
        raise HTTPException(status_code=400, detail="存在关联系统，暂不可删除。")
    before = obj_to_dict(org, ORG_FIELDS)
    org.deleted_at = datetime.now()
    org.deleted_by = actor
    db.commit()
    db.refresh(org)
    record_org_history(db, org.id, actor, "delete", before, obj_to_dict(org, ORG_FIELDS))
    db.commit()
    return {"message": "已移入回收站（保留30天）。"}


@app.post("/api/organizations/{org_id}/restore")
def restore_organization(org_id: int, actor: str = Query("system"), db: Session = Depends(get_db)) -> dict[str, Any]:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="单位不存在。")
    if not org.deleted_at:
        raise HTTPException(status_code=400, detail="该单位未删除。")
    if datetime.now() - org.deleted_at > timedelta(days=30):
        raise HTTPException(status_code=400, detail="超出30天回收站恢复期。")
    org.deleted_at = None
    org.deleted_by = None
    db.commit()
    db.refresh(org)
    record_org_history(db, org.id, actor, "restore", None, obj_to_dict(org, ORG_FIELDS))
    db.commit()
    return {"message": "恢复成功", "data": obj_to_dict(org, ORG_FIELDS)}


@app.get("/api/organizations/export/excel")
def export_organizations_excel(db: Session = Depends(get_db)) -> FileResponse:
    rows = db.query(Organization).filter(Organization.deleted_at.is_(None)).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "单位信息"
    headers = [
        "单位名称",
        "统一社会信用代码",
        "单位负责人",
        "单位地址",
        "办公电话",
        "移动电话",
        "邮箱",
        "所属行业",
        "单位类型",
        "备案地区",
    ]
    ws.append(headers)
    for i in rows:
        ws.append(
            [
                i.name,
                i.credit_code,
                i.legal_representative,
                i.address,
                i.office_phone,
                i.mobile_phone,
                i.email,
                i.industry,
                i.organization_type,
                i.filing_region,
            ]
        )
    path = EXPORT_DIR / f"organizations_{datetime.now():%Y%m%d%H%M%S}.xlsx"
    wb.save(path)
    return FileResponse(path=str(path), filename=path.name)


@app.post("/api/organizations/import/excel")
async def import_organizations_excel(
    actor: str = Query("system"), file: UploadFile = File(...), db: Session = Depends(get_db)
) -> dict[str, Any]:
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="仅支持xlsx格式。")
    content = await file.read()
    wb = load_workbook(io.BytesIO(content))
    ws = wb.active
    imported = 0
    skipped: list[str] = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0]:
            continue
        data = {
            "name": str(row[0]).strip(),
            "credit_code": str(row[1]).strip().upper(),
            "legal_representative": str(row[2]).strip(),
            "address": str(row[3]).strip(),
            "office_phone": str(row[4]).strip() if row[4] else None,
            "mobile_phone": str(row[5]).strip(),
            "email": str(row[6]).strip(),
            "industry": str(row[7]).strip(),
            "organization_type": str(row[8]).strip(),
            "filing_region": str(row[9]).strip(),
            "created_by": actor,
        }
        try:
            validate_org_payload(data)
            exists = (
                db.query(Organization)
                .filter(Organization.credit_code == data["credit_code"], Organization.deleted_at.is_(None))
                .first()
            )
            if exists:
                skipped.append(f"第{idx}行：统一社会信用代码重复")
                continue
            org = Organization(**data)
            db.add(org)
            db.flush()
            record_org_history(db, org.id, actor, "import", None, obj_to_dict(org, ORG_FIELDS))
            imported += 1
        except Exception as exc:
            skipped.append(f"第{idx}行：{exc}")
    db.commit()
    return {"message": "导入完成", "imported": imported, "skipped": skipped}


@app.get("/api/organizations/{org_id}/export/word")
def export_organization_word(org_id: int, db: Session = Depends(get_db)) -> FileResponse:
    org = get_org_or_404(db, org_id)
    path = EXPORT_DIR / f"organization_{org.id}_{datetime.now():%Y%m%d%H%M%S}.docx"
    doc = Document()
    doc.add_heading("单位基础信息", level=1)
    for key, value in [
        ("单位名称", org.name),
        ("统一社会信用代码", org.credit_code),
        ("单位负责人", org.legal_representative),
        ("单位地址", org.address),
        ("办公电话", org.office_phone or ""),
        ("移动电话", org.mobile_phone),
        ("邮箱", org.email),
        ("所属行业", org.industry),
        ("单位类型", org.organization_type),
        ("备案地区", org.filing_region),
    ]:
        doc.add_paragraph(f"{key}: {value}")
    doc.save(path)
    return FileResponse(path=str(path), filename=path.name)


@app.post("/api/systems")
def create_system(payload: SystemCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    org = get_org_or_404(db, payload.organization_id)
    if org.archived and org.locked:
        raise HTTPException(status_code=403, detail="单位已归档锁定，不可新增系统。")
    data = payload.model_dump()
    data["system_code"] = generate_system_code(db)
    system = SystemInfo(**data)
    db.add(system)
    db.flush()
    record_system_history(db, system.id, payload.created_by, "create", None, obj_to_dict(system, SYSTEM_FIELDS))
    instance = WorkflowInstance(system_id=system.id, current_step_index=0, status="in_progress")
    db.add(instance)
    db.commit()
    db.refresh(system)
    return {"message": "创建成功", "data": obj_to_dict(system, SYSTEM_FIELDS)}


@app.get("/api/systems")
def list_systems(
    system_name: str | None = None,
    system_code: str | None = None,
    organization_name: str | None = None,
    proposed_level: int | None = None,
    deployment_mode: str | None = None,
    created_by: str | None = None,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    query = db.query(SystemInfo, Organization.name.label("organization_name")).join(
        Organization, Organization.id == SystemInfo.organization_id
    )
    if not include_deleted:
        query = query.filter(SystemInfo.deleted_at.is_(None))
    if system_name:
        query = query.filter(SystemInfo.system_name.like(f"%{system_name}%"))
    if system_code:
        query = query.filter(SystemInfo.system_code.like(f"%{system_code}%"))
    if organization_name:
        query = query.filter(Organization.name.like(f"%{organization_name}%"))
    if proposed_level:
        query = query.filter(SystemInfo.proposed_level == proposed_level)
    if deployment_mode:
        query = query.filter(SystemInfo.deployment_mode.like(f"%{deployment_mode}%"))
    if created_by:
        query = query.filter(SystemInfo.created_by.like(f"%{created_by}%"))
    rows = query.order_by(SystemInfo.created_at.desc()).all()
    items = []
    for system, org_name in rows:
        data = obj_to_dict(system, SYSTEM_FIELDS)
        data["organization_name"] = org_name
        items.append(data)
    return {"total": len(items), "items": items}


@app.get("/api/systems/{system_id}")
def get_system(system_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    system = get_system_or_404(db, system_id)
    data = obj_to_dict(system, SYSTEM_FIELDS)
    data["organization_name"] = system.organization.name if system.organization else ""
    return data


@app.put("/api/systems/{system_id}")
def update_system(
    system_id: int,
    payload: SystemUpdate,
    actor: str = Query("system"),
    is_admin: bool = Query(False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    system = get_system_or_404(db, system_id)
    if system.archived and system.locked and not is_admin:
        raise HTTPException(status_code=403, detail="已归档系统默认不可编辑。")
    data = payload.model_dump(exclude_unset=True)
    before = obj_to_dict(system, SYSTEM_FIELDS)
    for key, value in data.items():
        setattr(system, key, value)
    db.commit()
    db.refresh(system)
    record_system_history(db, system.id, actor, "update", before, obj_to_dict(system, SYSTEM_FIELDS))
    db.commit()
    return {"message": "更新成功", "data": obj_to_dict(system, SYSTEM_FIELDS)}


@app.get("/api/systems/{system_id}/history")
def system_history(system_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_system_or_404(db, system_id)
    rows = db.query(SystemHistory).filter(SystemHistory.system_id == system_id).order_by(SystemHistory.changed_at.desc()).all()
    return {
        "total": len(rows),
        "items": [
            {
                "changed_by": r.changed_by,
                "change_type": r.change_type,
                "before_data": r.before_data,
                "after_data": r.after_data,
                "changed_at": r.changed_at,
            }
            for r in rows
        ],
    }


@app.post("/api/systems/{system_id}/copy")
def copy_system(system_id: int, actor: str = Query("system"), db: Session = Depends(get_db)) -> dict[str, Any]:
    source = get_system_or_404(db, system_id)
    data = obj_to_dict(source, SYSTEM_FIELDS)
    for key in ["id", "system_code", "created_at", "updated_at", "deleted_at"]:
        data.pop(key, None)
    data["system_name"] = f"{source.system_name}-副本"
    data["system_code"] = generate_system_code(db)
    data["archived"] = False
    data["locked"] = False
    data["deleted_by"] = None
    data["created_by"] = actor
    copied = SystemInfo(**data)
    db.add(copied)
    db.flush()
    record_system_history(db, copied.id, actor, "copy", None, obj_to_dict(copied, SYSTEM_FIELDS))
    db.add(WorkflowInstance(system_id=copied.id, current_step_index=0, status="in_progress"))
    db.commit()
    db.refresh(copied)
    return {"message": "复制成功", "data": obj_to_dict(copied, SYSTEM_FIELDS)}


@app.post("/api/systems/{system_id}/archive")
def archive_system(system_id: int, actor: str = Query("system"), db: Session = Depends(get_db)) -> dict[str, Any]:
    system = get_system_or_404(db, system_id)
    before = obj_to_dict(system, SYSTEM_FIELDS)
    system.archived = True
    system.locked = True
    db.commit()
    db.refresh(system)
    record_system_history(db, system.id, actor, "archive", before, obj_to_dict(system, SYSTEM_FIELDS))
    db.commit()
    return {"message": "归档成功", "data": obj_to_dict(system, SYSTEM_FIELDS)}


@app.delete("/api/systems/{system_id}")
def delete_system(
    system_id: int,
    actor: str = Query("system"),
    is_admin: bool = Query(False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    system = get_system_or_404(db, system_id)
    if system.archived and not is_admin:
        raise HTTPException(status_code=403, detail="已归档系统不可删除，仅管理员可操作。")
    approved_reports = db.query(Report).filter(Report.system_id == system_id, Report.status == "approved").count()
    if approved_reports > 0 and not is_admin:
        raise HTTPException(status_code=400, detail="存在已审核通过报告，不可删除。")
    before = obj_to_dict(system, SYSTEM_FIELDS)
    system.deleted_at = datetime.now()
    system.deleted_by = actor
    db.commit()
    db.refresh(system)
    record_system_history(db, system.id, actor, "delete", before, obj_to_dict(system, SYSTEM_FIELDS))
    db.commit()
    return {"message": "已移入回收站（保留30天）。"}


@app.post("/api/systems/{system_id}/restore")
def restore_system(system_id: int, actor: str = Query("system"), db: Session = Depends(get_db)) -> dict[str, Any]:
    system = db.query(SystemInfo).filter(SystemInfo.id == system_id).first()
    if not system:
        raise HTTPException(status_code=404, detail="系统不存在。")
    if not system.deleted_at:
        raise HTTPException(status_code=400, detail="该系统未删除。")
    if datetime.now() - system.deleted_at > timedelta(days=30):
        raise HTTPException(status_code=400, detail="超出30天回收站恢复期。")
    system.deleted_at = None
    system.deleted_by = None
    db.commit()
    db.refresh(system)
    record_system_history(db, system.id, actor, "restore", None, obj_to_dict(system, SYSTEM_FIELDS))
    db.commit()
    return {"message": "恢复成功", "data": obj_to_dict(system, SYSTEM_FIELDS)}


@app.get("/api/systems/export/excel")
def export_systems_excel(db: Session = Depends(get_db)) -> FileResponse:
    rows = db.query(SystemInfo).filter(SystemInfo.deleted_at.is_(None)).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "系统信息"
    headers = ["系统名称", "系统编号", "单位ID", "拟定等级", "部署方式", "系统类型", "上线时间", "录入人"]
    ws.append(headers)
    for i in rows:
        ws.append(
            [
                i.system_name,
                i.system_code,
                i.organization_id,
                i.proposed_level,
                i.deployment_mode,
                i.system_type,
                i.go_live_date.isoformat() if i.go_live_date else "",
                i.created_by,
            ]
        )
    path = EXPORT_DIR / f"systems_{datetime.now():%Y%m%d%H%M%S}.xlsx"
    wb.save(path)
    return FileResponse(path=str(path), filename=path.name)


@app.post("/api/systems/import/excel")
async def import_systems_excel(
    actor: str = Query("system"), file: UploadFile = File(...), db: Session = Depends(get_db)
) -> dict[str, Any]:
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="仅支持xlsx格式。")
    content = await file.read()
    wb = load_workbook(io.BytesIO(content))
    ws = wb.active
    imported = 0
    skipped: list[str] = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0]:
            continue
        try:
            org_id = int(row[2])
            org = get_org_or_404(db, org_id)
            if org.archived and org.locked:
                skipped.append(f"第{idx}行：单位已归档锁定")
                continue
            sys = SystemInfo(
                organization_id=org_id,
                system_name=str(row[0]).strip(),
                system_code=generate_system_code(db),
                proposed_level=int(row[3]),
                deployment_mode=str(row[4]).strip() if row[4] else None,
                system_type=str(row[5]).strip() if row[5] else None,
                go_live_date=date.fromisoformat(str(row[6])) if row[6] else None,
                created_by=actor,
            )
            db.add(sys)
            db.flush()
            db.add(WorkflowInstance(system_id=sys.id, current_step_index=0, status="in_progress"))
            record_system_history(db, sys.id, actor, "import", None, obj_to_dict(sys, SYSTEM_FIELDS))
            imported += 1
        except Exception as exc:
            skipped.append(f"第{idx}行：{exc}")
    db.commit()
    return {"message": "导入完成", "imported": imported, "skipped": skipped}


@app.get("/api/systems/{system_id}/export/word")
def export_system_word(system_id: int, db: Session = Depends(get_db)) -> FileResponse:
    system = get_system_or_404(db, system_id)
    path = EXPORT_DIR / f"system_{system.id}_{datetime.now():%Y%m%d%H%M%S}.docx"
    doc = Document()
    doc.add_heading("系统基础信息", level=1)
    for key, value in [
        ("系统名称", system.system_name),
        ("系统编号", system.system_code),
        ("拟定等级", system.proposed_level),
        ("业务描述", system.business_description or ""),
        ("部署方式", system.deployment_mode or ""),
        ("系统类型", system.system_type or ""),
        ("上线时间", system.go_live_date.isoformat() if system.go_live_date else ""),
        ("定级依据", system.level_basis or ""),
        ("定级理由", system.level_reason or ""),
    ]:
        doc.add_paragraph(f"{key}: {value}")
    doc.save(path)
    return FileResponse(path=str(path), filename=path.name)


@app.post("/api/attachments/{entity_type}/{entity_id}")
async def upload_attachment(
    entity_type: str,
    entity_id: int,
    actor: str = Query("system"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    entity_type = entity_type.lower()
    if entity_type not in {"organization", "system"}:
        raise HTTPException(status_code=400, detail="entity_type 仅支持 organization/system。")
    if entity_type == "organization":
        get_org_or_404(db, entity_id)
        allowed = {"jpg", "jpeg", "png", "pdf"}
        limit = MAX_ORG_ATTACHMENT
    else:
        get_system_or_404(db, entity_id)
        allowed = {"jpg", "jpeg", "png", "pdf", "vsd", "vsdx"}
        limit = MAX_SYS_ATTACHMENT
    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"不支持的附件格式: {ext}")
    content = await file.read()
    if len(content) > limit:
        raise HTTPException(status_code=400, detail=f"文件大小超过限制({limit // 1024 // 1024}MB)。")
    safe_name = Path(file.filename).name
    save_name = f"{uuid.uuid4().hex}_{safe_name}"
    target_dir = UPLOAD_DIR / "attachments" / entity_type
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / save_name
    target_path.write_bytes(content)
    row = Attachment(
        entity_type=entity_type,
        entity_id=entity_id,
        file_name=safe_name,
        file_path=str(target_path),
        file_ext=ext,
        file_size=len(content),
        uploaded_by=actor,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"message": "上传成功", "data": {"id": row.id, "file_name": row.file_name, "file_size": row.file_size}}


@app.get("/api/attachments/{entity_type}/{entity_id}")
def list_attachments(entity_type: str, entity_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    rows = (
        db.query(Attachment)
        .filter(Attachment.entity_type == entity_type.lower(), Attachment.entity_id == entity_id)
        .order_by(Attachment.uploaded_at.desc())
        .all()
    )
    return {
        "total": len(rows),
        "items": [
            {
                "id": r.id,
                "file_name": r.file_name,
                "file_ext": r.file_ext,
                "file_size": r.file_size,
                "uploaded_by": r.uploaded_by,
                "uploaded_at": r.uploaded_at,
            }
            for r in rows
        ],
    }


@app.get("/api/attachments/{attachment_id}/download")
def download_attachment(attachment_id: int, db: Session = Depends(get_db)) -> FileResponse:
    row = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="附件不存在。")
    return FileResponse(path=row.file_path, filename=row.file_name)


@app.delete("/api/attachments/{attachment_id}")
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    row = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="附件不存在。")
    path = Path(row.file_path)
    if path.exists():
        path.unlink()
    db.delete(row)
    db.commit()
    return {"message": "附件已删除。"}


@app.post("/api/reports/generate")
def generate_report(
    system_id: int = Query(...),
    report_type: str = Query("grading_report"),
    actor: str = Query("system"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    report_type = report_type.lower()
    if report_type not in VALID_REPORT_TYPES:
        raise HTTPException(status_code=400, detail="report_type 无效。")
    system = get_system_or_404(db, system_id)
    org = get_org_or_404(db, system.organization_id)
    max_version = (
        db.query(func.max(Report.version_no))
        .filter(Report.system_id == system_id, Report.report_type == report_type)
        .scalar()
        or 0
    )
    version = max_version + 1
    content = generate_report_payload(report_type, org, system)
    report = Report(
        organization_id=org.id,
        system_id=system.id,
        report_type=report_type,
        version_no=version,
        title=build_report_title(report_type, system.system_name, version),
        status="draft",
        content=content,
        generated_by=actor,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "message": "报告生成成功",
        "data": {
            "id": report.id,
            "title": report.title,
            "report_type": report.report_type,
            "version_no": report.version_no,
            "status": report.status,
            "content": report.content,
        },
    }


@app.get("/api/reports")
def list_reports(
    system_id: int | None = None,
    report_type: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    query = db.query(Report)
    if system_id:
        query = query.filter(Report.system_id == system_id)
    if report_type:
        query = query.filter(Report.report_type == report_type)
    if status:
        query = query.filter(Report.status == status)
    items = query.order_by(Report.generated_at.desc()).all()
    return {
        "total": len(items),
        "items": [
            {
                "id": r.id,
                "title": r.title,
                "report_type": r.report_type,
                "version_no": r.version_no,
                "status": r.status,
                "generated_by": r.generated_by,
                "generated_at": r.generated_at,
            }
            for r in items
        ],
    }


@app.get("/api/reports/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在。")
    return {
        "id": report.id,
        "title": report.title,
        "report_type": report.report_type,
        "version_no": report.version_no,
        "status": report.status,
        "content": report.content,
        "generated_by": report.generated_by,
        "generated_at": report.generated_at,
    }


@app.put("/api/reports/{report_id}")
def edit_report(
    report_id: int,
    payload: ReportEdit,
    actor: str = Query("system"),
    is_admin: bool = Query(False),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在。")
    if report.status in {"submitted", "approved"} and not is_admin:
        raise HTTPException(status_code=403, detail="当前状态不可编辑。")
    report.content = payload.content
    if payload.title:
        report.title = payload.title
    db.commit()
    db.refresh(report)
    db.add(
        ReviewRecord(
            report_id=report.id,
            reviewer=actor,
            action="edit",
            comment="编辑报告内容",
        )
    )
    db.commit()
    return {"message": "保存成功", "data": {"id": report.id, "status": report.status}}


@app.post("/api/reports/{report_id}/submit")
def submit_report(
    report_id: int,
    actor: str = Query("system"),
    reviewer: str = Query("reviewer"),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在。")
    if report.status not in {"draft", "rejected"}:
        raise HTTPException(status_code=400, detail="当前状态不可提交。")
    report.status = "submitted"
    db.add(
        ReviewRecord(
            report_id=report.id,
            reviewer=actor,
            action="submit",
            comment=f"提交审核给 {reviewer}",
        )
    )
    db.commit()
    return {"message": "提交成功", "status": report.status}


@app.post("/api/reports/{report_id}/review")
def review_report(
    report_id: int,
    actor: str = Query("reviewer"),
    action: str = Query(...),
    comment: str = Query(""),
    position: str = Query(""),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在。")
    if report.status != "submitted":
        raise HTTPException(status_code=400, detail="仅已提交报告可审核。")
    action = action.lower()
    if action not in {"approve", "reject"}:
        raise HTTPException(status_code=400, detail="action 仅支持 approve/reject。")
    report.status = "approved" if action == "approve" else "rejected"
    db.add(
        ReviewRecord(
            report_id=report.id,
            reviewer=actor,
            action=action,
            comment=comment,
            position=position,
        )
    )
    db.commit()
    return {"message": "审核完成", "status": report.status}


@app.get("/api/reports/{report_id}/reviews")
def report_reviews(report_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    rows = db.query(ReviewRecord).filter(ReviewRecord.report_id == report_id).order_by(ReviewRecord.created_at.asc()).all()
    return {
        "total": len(rows),
        "items": [
            {
                "reviewer": r.reviewer,
                "action": r.action,
                "comment": r.comment,
                "position": r.position,
                "created_at": r.created_at,
            }
            for r in rows
        ],
    }


@app.get("/api/reports/{report_id}/versions")
def list_report_versions(report_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在。")
    rows = (
        db.query(Report)
        .filter(Report.system_id == report.system_id, Report.report_type == report.report_type)
        .order_by(Report.version_no.desc())
        .all()
    )
    return {
        "total": len(rows),
        "items": [{"id": r.id, "version_no": r.version_no, "title": r.title, "status": r.status} for r in rows],
    }


@app.post("/api/reports/{report_id}/restore/{target_id}")
def restore_report_version(
    report_id: int, target_id: int, actor: str = Query("system"), db: Session = Depends(get_db)
) -> dict[str, Any]:
    current = db.query(Report).filter(Report.id == report_id).first()
    target = db.query(Report).filter(Report.id == target_id).first()
    if not current or not target:
        raise HTTPException(status_code=404, detail="报告不存在。")
    if current.system_id != target.system_id or current.report_type != target.report_type:
        raise HTTPException(status_code=400, detail="仅可恢复同系统同类型报告。")
    max_version = (
        db.query(func.max(Report.version_no))
        .filter(Report.system_id == current.system_id, Report.report_type == current.report_type)
        .scalar()
        or 0
    )
    new_report = Report(
        organization_id=current.organization_id,
        system_id=current.system_id,
        report_type=current.report_type,
        version_no=max_version + 1,
        title=f"{current.title}-恢复V{max_version + 1}",
        status="draft",
        content=target.content,
        generated_by=actor,
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return {"message": "恢复成功", "new_report_id": new_report.id, "version_no": new_report.version_no}


@app.get("/api/reports/{report_id}/export/word")
def export_report_word(report_id: int, db: Session = Depends(get_db)) -> FileResponse:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在。")
    path = EXPORT_DIR / f"report_{report.id}_{datetime.now():%Y%m%d%H%M%S}.docx"
    export_report_docx(report.title, report.content, path)
    return FileResponse(path=str(path), filename=path.name)


@app.get("/api/reports/{report_id}/export/pdf")
def export_report_pdf_file(report_id: int, db: Session = Depends(get_db)) -> FileResponse:
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在。")
    path = EXPORT_DIR / f"report_{report.id}_{datetime.now():%Y%m%d%H%M%S}.pdf"
    export_report_pdf(report.title, report.content, path)
    return FileResponse(path=str(path), filename=path.name)


@app.get("/api/workflow/config")
def get_workflow(db: Session = Depends(get_db)) -> dict[str, Any]:
    config = get_workflow_config(db)
    return {"name": config.name, "steps": config.steps_json, "updated_by": config.updated_by, "updated_at": config.updated_at}


@app.put("/api/workflow/config")
def update_workflow(payload: WorkflowConfigUpdate, db: Session = Depends(get_db)) -> dict[str, Any]:
    if not payload.steps:
        raise HTTPException(status_code=400, detail="流程步骤不能为空。")
    config = get_workflow_config(db)
    config.steps_json = payload.steps
    config.updated_by = payload.updated_by
    db.commit()
    db.refresh(config)
    return {"message": "流程配置更新成功", "steps": config.steps_json}


@app.get("/api/workflow/instances/{system_id}")
def workflow_instance(system_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    get_system_or_404(db, system_id)
    config = get_workflow_config(db)
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.system_id == system_id).first()
    if not instance:
        instance = WorkflowInstance(system_id=system_id, current_step_index=0, status="in_progress")
        db.add(instance)
        db.commit()
        db.refresh(instance)
    step_name = ""
    if 0 <= instance.current_step_index < len(config.steps_json):
        step_name = config.steps_json[instance.current_step_index]
    logs = (
        db.query(WorkflowAction)
        .filter(WorkflowAction.instance_id == instance.id)
        .order_by(WorkflowAction.created_at.desc())
        .all()
    )
    return {
        "system_id": system_id,
        "status": instance.status,
        "current_step_index": instance.current_step_index,
        "current_step_name": step_name,
        "steps": config.steps_json,
        "logs": [
            {
                "step_name": l.step_name,
                "actor": l.actor,
                "action": l.action,
                "comment": l.comment,
                "created_at": l.created_at,
            }
            for l in logs
        ],
    }


@app.post("/api/workflow/instances/{system_id}/advance")
def workflow_advance(
    system_id: int,
    actor: str = Query("system"),
    action: str = Query("complete"),
    comment: str = Query(""),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    get_system_or_404(db, system_id)
    config = get_workflow_config(db)
    instance = db.query(WorkflowInstance).filter(WorkflowInstance.system_id == system_id).first()
    if not instance:
        instance = WorkflowInstance(system_id=system_id, current_step_index=0, status="in_progress")
        db.add(instance)
        db.flush()
    steps = config.steps_json
    if not steps:
        raise HTTPException(status_code=400, detail="流程步骤为空。")
    current_idx = instance.current_step_index
    current_name = steps[current_idx] if current_idx < len(steps) else "已完成"
    action = action.lower()
    if action in {"complete", "approve"}:
        if current_idx + 1 >= len(steps):
            instance.status = "completed"
        else:
            instance.current_step_index = current_idx + 1
            instance.status = "in_progress"
    elif action in {"reject", "abnormal"}:
        instance.status = "abnormal"
    elif action == "reset":
        instance.current_step_index = 0
        instance.status = "in_progress"
    else:
        raise HTTPException(status_code=400, detail="action 仅支持 complete/approve/reject/abnormal/reset。")
    db.add(
        WorkflowAction(
            instance_id=instance.id,
            step_name=current_name,
            actor=actor,
            action=action,
            comment=comment,
        )
    )
    db.commit()
    db.refresh(instance)
    return {
        "message": "流程已更新",
        "status": instance.status,
        "current_step_index": instance.current_step_index,
        "current_step_name": steps[instance.current_step_index]
        if instance.current_step_index < len(steps)
        else "已完成",
    }


@app.get("/api/dashboard/summary")
def dashboard_summary(
    start_date: date | None = None,
    end_date: date | None = None,
    industry: str | None = None,
    city: str | None = None,
    level: int | None = None,
    evaluator: str | None = None,
    project_status: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    org_q = db.query(Organization).filter(Organization.deleted_at.is_(None))
    if start_date:
        org_q = org_q.filter(Organization.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        org_q = org_q.filter(Organization.created_at <= datetime.combine(end_date, datetime.max.time()))
    if industry:
        org_q = org_q.filter(Organization.industry == industry)
    if city:
        org_q = org_q.filter(Organization.filing_region.like(f"%{city}%"))
    if evaluator:
        org_q = org_q.filter(Organization.created_by.like(f"%{evaluator}%"))

    sys_q = db.query(SystemInfo).join(Organization, Organization.id == SystemInfo.organization_id).filter(
        SystemInfo.deleted_at.is_(None), Organization.deleted_at.is_(None)
    )
    if industry:
        sys_q = sys_q.filter(Organization.industry == industry)
    if city:
        sys_q = sys_q.filter(Organization.filing_region.like(f"%{city}%"))
    if level:
        sys_q = sys_q.filter(SystemInfo.proposed_level == level)
    if evaluator:
        sys_q = sys_q.filter(SystemInfo.created_by.like(f"%{evaluator}%"))

    if project_status:
        sys_q = sys_q.join(WorkflowInstance, WorkflowInstance.system_id == SystemInfo.id).filter(
            WorkflowInstance.status == project_status
        )

    region_stats = (
        org_q.with_entities(Organization.filing_region, func.count(Organization.id)).group_by(Organization.filing_region).all()
    )
    industry_stats = (
        org_q.with_entities(Organization.industry, func.count(Organization.id)).group_by(Organization.industry).all()
    )
    level_stats = sys_q.with_entities(SystemInfo.proposed_level, func.count(SystemInfo.id)).group_by(SystemInfo.proposed_level).all()
    pending_reports = db.query(Report).filter(Report.status == "submitted").count()
    in_progress_projects = db.query(WorkflowInstance).filter(WorkflowInstance.status == "in_progress").count()
    return {
        "totals": {
            "organization_count": org_q.count(),
            "system_count": sys_q.count(),
            "archived_organization_count": org_q.filter(Organization.archived.is_(True)).count(),
            "archived_system_count": db.query(SystemInfo).filter(SystemInfo.archived.is_(True), SystemInfo.deleted_at.is_(None)).count(),
            "pending_review_reports": pending_reports,
            "in_progress_projects": in_progress_projects,
        },
        "region_distribution": [{"name": k or "未填写", "value": v} for k, v in region_stats],
        "industry_distribution": [{"name": k or "未填写", "value": v} for k, v in industry_stats],
        "level_distribution": [{"name": f"{k}级", "value": v} for k, v in level_stats],
    }


@app.post("/api/knowledge/upload")
async def upload_knowledge(
    title: str = Form(...),
    doc_type: str = Form(...),
    actor: str = Form("admin"),
    city: str = Form(""),
    district: str = Form(""),
    keywords: str = Form(""),
    protection_level: str = Form(""),
    version_no: int = Form(1),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    content = await file.read()
    if len(content) > MAX_KNOWLEDGE_FILE:
        raise HTTPException(status_code=400, detail="文件过大。")
    safe_name = Path(file.filename).name
    save_name = f"{uuid.uuid4().hex}_{safe_name}"
    path = UPLOAD_DIR / "knowledge" / save_name
    path.write_bytes(content)
    row = KnowledgeDocument(
        title=title,
        keywords=keywords,
        city=city,
        district=district,
        doc_type=doc_type,
        protection_level=protection_level,
        version_no=version_no,
        status="enabled",
        file_name=safe_name,
        file_path=str(path),
        file_size=len(content),
        uploaded_by=actor,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"message": "上传成功", "data": {"id": row.id, "title": row.title}}


@app.get("/api/knowledge")
def list_knowledge(
    keyword: str | None = None,
    city: str | None = None,
    doc_type: str | None = None,
    protection_level: str | None = None,
    enabled_only: bool = True,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    q = db.query(KnowledgeDocument)
    if enabled_only:
        q = q.filter(KnowledgeDocument.status == "enabled")
    if keyword:
        q = q.filter(
            or_(
                KnowledgeDocument.title.like(f"%{keyword}%"),
                KnowledgeDocument.keywords.like(f"%{keyword}%"),
            )
        )
    if city:
        q = q.filter(KnowledgeDocument.city.like(f"%{city}%"))
    if doc_type:
        q = q.filter(KnowledgeDocument.doc_type.like(f"%{doc_type}%"))
    if protection_level:
        q = q.filter(KnowledgeDocument.protection_level.like(f"%{protection_level}%"))
    rows = q.order_by(KnowledgeDocument.uploaded_at.desc()).all()
    return {
        "total": len(rows),
        "items": [
            {
                "id": r.id,
                "title": r.title,
                "doc_type": r.doc_type,
                "city": r.city,
                "district": r.district,
                "protection_level": r.protection_level,
                "version_no": r.version_no,
                "status": r.status,
                "file_name": r.file_name,
                "uploaded_by": r.uploaded_by,
                "uploaded_at": r.uploaded_at,
            }
            for r in rows
        ],
    }


@app.post("/api/knowledge/{doc_id}/toggle")
def toggle_knowledge(doc_id: int, enabled: bool = Query(True), db: Session = Depends(get_db)) -> dict[str, Any]:
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在。")
    doc.status = "enabled" if enabled else "disabled"
    db.commit()
    return {"message": "状态更新成功", "status": doc.status}


@app.get("/api/knowledge/{doc_id}/download")
def download_knowledge(doc_id: int, actor: str = Query("system"), db: Session = Depends(get_db)) -> FileResponse:
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在。")
    if doc.status != "enabled":
        raise HTTPException(status_code=403, detail="文档已下架。")
    db.add(KnowledgeDownloadLog(document_id=doc.id, download_by=actor))
    db.commit()
    return FileResponse(path=doc.file_path, filename=doc.file_name)


@app.post("/api/knowledge/batch-download")
def batch_download_knowledge(
    doc_ids: list[int],
    actor: str = Query("system"),
    db: Session = Depends(get_db),
) -> FileResponse:
    if not doc_ids:
        raise HTTPException(status_code=400, detail="doc_ids 不能为空。")
    rows = db.query(KnowledgeDocument).filter(KnowledgeDocument.id.in_(doc_ids)).all()
    if not rows:
        raise HTTPException(status_code=404, detail="未找到文档。")
    zip_path = EXPORT_DIR / f"knowledge_batch_{datetime.now():%Y%m%d%H%M%S}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc in rows:
            src = Path(doc.file_path)
            if src.exists():
                zf.write(src, arcname=doc.file_name)
                db.add(KnowledgeDownloadLog(document_id=doc.id, download_by=actor))
    db.commit()
    return FileResponse(path=str(zip_path), filename=zip_path.name)


@app.delete("/api/knowledge/{doc_id}")
def delete_knowledge(doc_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在。")
    path = Path(doc.file_path)
    if path.exists():
        path.unlink()
    db.delete(doc)
    db.commit()
    return {"message": "文档已删除。"}
