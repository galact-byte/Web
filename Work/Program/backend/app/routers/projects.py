"""
项目路由
"""
import re
from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload


from app.database import get_db
from app.models import User, Project, System, ProjectAssignment, ProjectStatus, UserRole, AssignmentStatus
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse,
    AssignRequest, ContributionUpdate, AssignmentUpdate, ContributionCreate, AssignmentResponse
)
from app.services.auth import get_current_user, get_current_manager

router = APIRouter(prefix="/api/projects", tags=["项目"])


# ============ 贡献率解析工具 ============

# 匹配 "姓名XX%" 格式
# 支持: 张三85%、张三 85%、张三：85%、张三:85%、张三（85%）
# 也支持中间有工作描述: 张三：报告撰写（10%）、张三，代码审计，50%
# 姓名限制为2-4个汉字，后面必须跟非汉字字符（作为姓名边界）
_CONTRIBUTION_PATTERN = re.compile(
    r'([\u4e00-\u9fa5]{2,4})(?=[^\u4e00-\u9fa5]).*?(\d+(?:\.\d+)?)\s*%'
)


def parse_contribution(text: str) -> list[dict]:
    """解析贡献率文本，返回 [{name, percentage}]"""
    if not text:
        return []
    results = []
    for m in _CONTRIBUTION_PATTERN.finditer(text):
        name = m.group(1).strip()
        pct = float(m.group(2))
        results.append({"name": name, "percentage": pct})
    return results


def get_quarter(d: date) -> tuple[int, int]:
    """返回 (year, quarter)"""
    return d.year, (d.month - 1) // 3 + 1


@router.get("/workload-stats")
def get_workload_stats(
    year: int = Query(..., description="年份"),
    quarter: int = Query(..., ge=1, le=4, description="季度 1-4"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取季度工作量统计。
    按 approval_date（审批完成时间）归属季度。
    解析每个项目分配的 contribution 文本，汇总每个人员的总贡献率。
    """
    # 计算季度的起止日期（字符串比较，兼容 SQLite/PostgreSQL/达梦等）
    start_date = f"{year}-{(quarter - 1) * 3 + 1:02d}-01"
    if quarter == 4:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{quarter * 3 + 1:02d}-01"

    # 查询该季度内有 approval_date 的项目的所有分配
    assignments = db.query(ProjectAssignment).join(Project).options(
        selectinload(ProjectAssignment.project),
        selectinload(ProjectAssignment.assignee)
    ).filter(
        Project.approval_date.isnot(None),
        Project.approval_date != "",
        Project.approval_date >= start_date,
        Project.approval_date < end_date
    ).all()

    # 按人员汇总
    person_map: dict[str, dict] = {}  # name -> {total, projects: []}

    for a in assignments:
        entries = parse_contribution(a.contribution)
        project_name = a.project.project_name if a.project else "未知项目"
        project_code = a.project.project_code if a.project else ""

        for entry in entries:
            name = entry["name"]
            pct = entry["percentage"]
            if name not in person_map:
                person_map[name] = {"name": name, "total_contribution": 0, "projects": []}
            person_map[name]["total_contribution"] += pct
            person_map[name]["projects"].append({
                "project_name": project_name,
                "project_code": project_code,
                "contribution": pct
            })

    # 按总贡献率降序排列
    result = sorted(person_map.values(), key=lambda x: x["total_contribution"], reverse=True)

    return {
        "year": year,
        "quarter": quarter,
        "stats": result
    }


def project_to_response(project: Project, db: Session) -> ProjectResponse:
    """转换项目为响应格式"""
    return ProjectResponse(
        id=project.id,
        project_code=project.project_code,
        project_name=project.project_name,
        client_name=project.client_name,
        business_category=project.business_category,
        project_location=project.project_location,
        contract_status=project.contract_status,
        filing_status=project.filing_status,
        approval_date=project.approval_date,
        business_manager_name=project.business_manager_name,
        implementation_manager_id=project.implementation_manager_id,
        status=project.status.value,
        creator_id=project.creator_id,
        creator_name=project.creator.display_name if project.creator else None,
        implementation_manager_name=project.implementation_manager.display_name if project.implementation_manager else None,
        systems_count=len(project.systems),
        systems=[{
            "id": s.id,
            "system_code": s.system_code,
            "system_name": s.system_name,
            "system_level": s.system_level,
            "system_type": s.system_type
        } for s in project.systems],
        created_at=project.created_at
    )


def _calc_submit_progress(assignments) -> dict:
    """按员工去重计算提交进度"""
    if not assignments:
        return {"submitted_count": 0, "total_employee_count": 0}
    by_emp = {}
    for a in assignments:
        eid = a.assignee_id
        if eid not in by_emp:
            by_emp[eid] = True
        if (a.status or "pending") != "submitted":
            by_emp[eid] = False
    return {
        "submitted_count": sum(1 for v in by_emp.values() if v),
        "total_employee_count": len(by_emp)
    }


@router.get("/", response_model=List[ProjectListResponse])
def get_projects(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取项目列表"""
    # 使用 selectinload 替代 joinedload，避免笛卡尔积
    query = db.query(Project).options(
        selectinload(Project.systems),
        selectinload(Project.assignments)
    )

    # 员工只能看到分配给自己的项目（用子查询避免 join+selectinload 产生重复）
    if current_user.role.value == "employee":
        assigned_project_ids = db.query(ProjectAssignment.project_id).filter(
            ProjectAssignment.assignee_id == current_user.id
        ).subquery()
        query = query.filter(Project.id.in_(assigned_project_ids))

    if status:
        query = query.filter(Project.status == ProjectStatus(status))

    projects = query.order_by(Project.created_at.desc()).all()

    return [
        ProjectListResponse(
            id=p.id,
            project_code=p.project_code,
            project_name=p.project_name,
            client_name=p.client_name,
            business_category=p.business_category,
            project_location=p.project_location,
            contract_status=p.contract_status,
            filing_status=p.filing_status,
            approval_date=p.approval_date,
            business_manager_name=p.business_manager_name,
            implementation_manager_id=p.implementation_manager_id,
            status=p.status.value,
            systems_count=len(p.systems),
            **_calc_submit_progress(p.assignments),
            created_at=p.created_at
        )
        for p in projects
    ]


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取项目详情"""
    # 员工：合并存在性与权限检查，统一返回404，防止枚举项目ID
    if current_user.role.value == "employee":
        is_assigned = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.assignee_id == current_user.id
        ).first()
        if not is_assigned:
            raise HTTPException(status_code=404, detail="项目不存在")

    project = db.query(Project).options(
        selectinload(Project.systems),
        selectinload(Project.creator),
        selectinload(Project.implementation_manager)
    ).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    return project_to_response(project, db)


@router.post("/", response_model=ProjectResponse)
def create_project(
    request: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """创建项目（仅经理）"""
    # 检查项目编号是否重复
    existing = db.query(Project).filter(Project.project_code == request.project_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="项目编号已存在")

    project = Project(
        project_code=request.project_code,
        project_name=request.project_name,
        client_name=request.client_name,
        business_category=request.business_category,
        project_location=request.project_location,
        contract_status=request.contract_status,
        filing_status=request.filing_status,
        approval_date=request.approval_date,
        business_manager_name=request.business_manager_name,
        implementation_manager_id=request.implementation_manager_id,
        creator_id=current_user.id,
        status=ProjectStatus.draft
    )
    db.add(project)
    db.flush()

    # 添加系统
    for sys_data in request.systems:
        system = System(
            project_id=project.id,
            system_code=sys_data.system_code,
            system_name=sys_data.system_name,
            system_level=sys_data.system_level,
            system_type=sys_data.system_type
        )
        db.add(system)

    # 选择实施负责人时自动分发给该员工
    if request.implementation_manager_id:
        user = db.query(User).filter(User.id == request.implementation_manager_id).first()
        if user:
            assignment = ProjectAssignment(
                project_id=project.id,
                assignee_id=request.implementation_manager_id
            )
            db.add(assignment)
            project.status = ProjectStatus.assigned

    db.commit()
    db.refresh(project)

    return project_to_response(project, db)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    request: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """更新项目（仅经理）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 检查项目编号是否与其他项目重复
    if request.project_code != project.project_code:
        dup = db.query(Project).filter(
            Project.project_code == request.project_code,
            Project.id != project_id
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="项目编号已存在")

    # 更新基本信息
    project.project_code = request.project_code
    project.project_name = request.project_name
    project.client_name = request.client_name
    project.business_category = request.business_category
    project.project_location = request.project_location
    project.contract_status = request.contract_status
    project.filing_status = request.filing_status
    project.approval_date = request.approval_date
    project.business_manager_name = request.business_manager_name
    project.implementation_manager_id = request.implementation_manager_id

    # 更新系统：先清除关联的分配记录中的系统引用，再删除旧系统
    db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
    ).update({"department": ProjectAssignment.department}, synchronize_session="fetch")
    db.query(System).filter(System.project_id == project_id).delete()
    for sys_data in request.systems:
        system = System(
            project_id=project.id,
            system_code=sys_data.system_code,
            system_name=sys_data.system_name,
            system_level=sys_data.system_level,
            system_type=sys_data.system_type
        )
        db.add(system)

    db.commit()
    db.refresh(project)

    return project_to_response(project, db)


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """删除项目（仅经理）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    db.delete(project)
    db.commit()

    return {"message": "删除成功"}


@router.patch("/{project_id}/status")
def update_project_status(
    project_id: int,
    new_status: str = Query(..., description="目标状态: assigned / completed"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """修改项目状态（仅经理）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    if new_status not in ("assigned", "completed"):
        raise HTTPException(status_code=400, detail="无效的目标状态")

    # 状态转换校验
    valid_transitions = {
        "draft": {"assigned"},
        "assigned": {"completed"},
        "completed": {"assigned"},  # 重新开启
    }
    current = project.status.value if hasattr(project.status, 'value') else project.status
    if new_status not in valid_transitions.get(current, set()):
        raise HTTPException(
            status_code=400,
            detail=f"无法从「{current}」转换到「{new_status}」"
        )

    # 标记完成时，检查所有分配是否已提交完结（按员工去重）
    warning = None
    if new_status == "completed":
        assignments = db.query(ProjectAssignment).options(
            selectinload(ProjectAssignment.assignee)
        ).filter(ProjectAssignment.project_id == project_id).all()

        # 按员工分组，检查每个员工是否全部提交
        employee_map = {}
        for a in assignments:
            eid = a.assignee_id
            if eid not in employee_map:
                employee_map[eid] = {
                    "name": a.assignee.display_name if a.assignee else f"用户#{eid}",
                    "all_submitted": True
                }
            if (a.status or "pending") != AssignmentStatus.submitted.value:
                employee_map[eid]["all_submitted"] = False

        not_submitted = [
            info["name"] for info in employee_map.values()
            if not info["all_submitted"]
        ]
        if not_submitted:
            warning = {
                "not_submitted_names": not_submitted,
                "message": f"以下人员尚未提交完结申请：{'、'.join(not_submitted)}"
            }

    project.status = ProjectStatus(new_status)
    db.commit()

    result = {"message": "状态更新成功", "status": new_status}
    if warning:
        result["warning"] = warning
    return result


@router.post("/{project_id}/assign")
def assign_project(
    project_id: int,
    request: AssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager)
):
    """分发项目给员工（仅经理）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 验证所有 assignee_id 存在且为员工角色
    valid_users = db.query(User).filter(
        User.id.in_(request.assignee_ids),
        User.role == UserRole.employee
    ).all()
    valid_ids = {u.id for u in valid_users}
    invalid_ids = set(request.assignee_ids) - valid_ids
    if invalid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"以下用户ID无效或非员工角色: {list(invalid_ids)}"
        )

    # 添加分配
    for assignee_id in request.assignee_ids:
        # 检查是否已分配
        existing = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.assignee_id == assignee_id
        ).first()

        if not existing:
            assignment = ProjectAssignment(
                project_id=project_id,
                assignee_id=assignee_id
            )
            db.add(assignment)

    # 更新项目状态
    project.status = ProjectStatus.assigned
    db.commit()

    return {"message": "分发成功"}


@router.get("/{project_id}/assignments", response_model=List[AssignmentResponse])
def get_assignments(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取项目分配信息"""
    # 员工只能查看分配给自己的项目的分配信息
    if current_user.role.value == "employee":
        is_assigned = db.query(ProjectAssignment).filter(
            ProjectAssignment.project_id == project_id,
            ProjectAssignment.assignee_id == current_user.id
        ).first()
        if not is_assigned:
            raise HTTPException(status_code=404, detail="项目不存在")

    assignments = db.query(ProjectAssignment).options(
        selectinload(ProjectAssignment.assignee)
    ).filter(ProjectAssignment.project_id == project_id).all()

    return [
        AssignmentResponse(
            id=a.id,
            project_id=a.project_id,
            assignee_id=a.assignee_id,
            assignee_name=a.assignee.display_name if a.assignee else "未知",
            department=a.department,
            contribution=a.contribution,
            status=a.status or "pending",
            created_at=a.created_at
        )
        for a in assignments
    ]


@router.put("/{project_id}/contribution")
def update_contribution(
    project_id: int,
    request: ContributionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新贡献率（员工）"""
    # 检查项目状态，已完成的项目不允许修改贡献率
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.status == ProjectStatus.completed:
        raise HTTPException(status_code=400, detail="项目已完成，无法修改贡献率")

    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.assignee_id == current_user.id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="未找到分配记录")

    # 已提交完结的分配禁止编辑
    if assignment.status == AssignmentStatus.submitted.value:
        raise HTTPException(status_code=400, detail="已提交完结申请，请先撤回后再编辑")

    if request.department is not None:
        assignment.department = request.department
    if request.contribution is not None:
        assignment.contribution = request.contribution

    db.commit()

    return {"message": "更新成功"}


@router.put("/{project_id}/assignments/{assignment_id}")
def update_assignment(
    project_id: int,
    assignment_id: int,
    request: AssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """编辑指定分配的部门和贡献率（员工只能编辑自己的分配）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.status == ProjectStatus.completed:
        raise HTTPException(status_code=400, detail="项目已完成，无法修改")

    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.id == assignment_id,
        ProjectAssignment.project_id == project_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="未找到分配记录")

    # 只能编辑自己的分配
    if assignment.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己的贡献信息")

    # 已提交完结的分配禁止编辑
    if assignment.status == AssignmentStatus.submitted.value:
        raise HTTPException(status_code=400, detail="已提交完结申请，请先撤回后再编辑")

    if request.department is not None:
        assignment.department = request.department
    if request.contribution is not None:
        assignment.contribution = request.contribution

    db.commit()
    return {"message": "更新成功"}


@router.delete("/{project_id}/assignments/{assignment_id}")
def delete_assignment(
    project_id: int,
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除自己的贡献记录"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.status == ProjectStatus.completed:
        raise HTTPException(status_code=400, detail="项目已完成，无法删除")

    assignment = db.query(ProjectAssignment).filter(
        ProjectAssignment.id == assignment_id,
        ProjectAssignment.project_id == project_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="未找到分配记录")

    # 只能删除自己的记录
    if assignment.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的贡献记录")

    # 已提交完结的分配禁止删除
    if assignment.status == AssignmentStatus.submitted.value:
        raise HTTPException(status_code=400, detail="已提交完结申请，请先撤回后再删除")

    db.delete(assignment)
    db.commit()
    return {"message": "删除成功"}


@router.post("/{project_id}/contributions")
def add_contribution(
    project_id: int,
    request: ContributionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """添加贡献记录（员工只能为自己添加，且必须已被分配到此项目）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.status == ProjectStatus.completed:
        raise HTTPException(status_code=400, detail="项目已完成，无法添加贡献")

    # 必须已被分配到此项目
    my_assignments = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.assignee_id == current_user.id
    ).all()
    if not my_assignments:
        raise HTTPException(status_code=403, detail="您未被分配到此项目")

    # 如果已提交完结，禁止添加新贡献
    if any((a.status or "pending") == AssignmentStatus.submitted.value for a in my_assignments):
        raise HTTPException(status_code=400, detail="已提交完结申请，请先撤回后再添加贡献")

    assignment = ProjectAssignment(
        project_id=project_id,
        assignee_id=current_user.id,
        department=request.department,
        contribution=request.contribution
    )
    db.add(assignment)
    db.commit()

    return {"message": "添加成功"}


@router.patch("/{project_id}/submit-completion")
def submit_completion(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """员工提交完结申请（批量锁定自己在该项目的所有分配记录）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.status == ProjectStatus.completed:
        raise HTTPException(status_code=400, detail="项目已完成，无法操作")

    my_assignments = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.assignee_id == current_user.id
    ).all()
    if not my_assignments:
        raise HTTPException(status_code=404, detail="您未被分配到此项目")

    already_submitted = all(
        (a.status or "pending") == AssignmentStatus.submitted.value
        for a in my_assignments
    )
    if already_submitted:
        raise HTTPException(status_code=400, detail="已经提交过完结申请")

    for a in my_assignments:
        a.status = AssignmentStatus.submitted.value
    db.commit()
    return {"message": "完结申请已提交"}


@router.patch("/{project_id}/retract-completion")
def retract_completion(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """员工撤回完结申请（批量解锁自己在该项目的所有分配记录）"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    if project.status == ProjectStatus.completed:
        raise HTTPException(status_code=400, detail="项目已完成，无法操作")

    my_assignments = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id,
        ProjectAssignment.assignee_id == current_user.id
    ).all()
    if not my_assignments:
        raise HTTPException(status_code=404, detail="您未被分配到此项目")

    any_submitted = any(
        (a.status or "pending") == AssignmentStatus.submitted.value
        for a in my_assignments
    )
    if not any_submitted:
        raise HTTPException(status_code=400, detail="当前状态无法撤回")

    for a in my_assignments:
        a.status = AssignmentStatus.pending.value
    db.commit()
    return {"message": "完结申请已撤回"}
