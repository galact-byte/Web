import io
import json
import logging
import re
from pathlib import Path
from typing import Any

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt

try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.pdfgen import canvas
    from reportlab.lib.pdfencrypt import StandardEncryption

    HAS_REPORTLAB = True
except Exception:
    HAS_REPORTLAB = False

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# 数据完整性检查
# ──────────────────────────────────────────────────────────────────────────────

class ReportDataError(ValueError):
    """报告数据不完整或不合法时抛出的异常。"""


def _require_attr(obj: Any, attr: str, label: str) -> str:
    """从对象中取属性值；若为空则抛出 ReportDataError。"""
    value = getattr(obj, attr, None)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ReportDataError(f"报告生成失败：{label}（{attr}）为空，请先补全数据。")
    return str(value).strip()


def check_report_data_integrity(org: Any, system: Any) -> None:
    """
    检查生成报告所需的关键字段完整性。

    必填字段：
    - 单位：name、credit_code、filing_region、industry、legal_representative
    - 系统：system_name、system_code、proposed_level
    """
    _require_attr(org, "name", "单位名称")
    _require_attr(org, "credit_code", "统一社会信用代码")
    _require_attr(org, "filing_region", "备案地区")
    _require_attr(org, "industry", "所属行业")
    _require_attr(org, "legal_representative", "法定代表人")
    _require_attr(system, "system_name", "系统名称")
    _require_attr(system, "system_code", "系统编号")

    level = getattr(system, "proposed_level", None)
    if level is None:
        raise ReportDataError("报告生成失败：拟定等级（proposed_level）为空，请先补全数据。")
    try:
        level_int = int(level)
    except (TypeError, ValueError):
        raise ReportDataError(f"报告生成失败：拟定等级值 '{level}' 不合法，应为 1-5 的整数。")
    if not (1 <= level_int <= 5):
        raise ReportDataError(f"报告生成失败：拟定等级值 {level_int} 超出范围（1-5）。")


# ──────────────────────────────────────────────────────────────────────────────
# 报告 payload 生成
# ──────────────────────────────────────────────────────────────────────────────

def generate_report_payload(report_type: str, org: Any, system: Any) -> dict[str, Any]:
    """
    根据报告类型生成结构化 payload 字典。

    在生成前会执行数据完整性检查，字段缺失时抛出 ReportDataError。
    """
    check_report_data_integrity(org, system)

    base = {
        "单位名称": org.name,
        "统一社会信用代码": org.credit_code,
        "系统名称": system.system_name,
        "系统编号": system.system_code,
        "拟定等级": f"{system.proposed_level}级",
        "备案地区": org.filing_region,
        "所属行业": org.industry,
        "部署方式": system.deployment_mode or "",
        "定级依据": system.level_basis or "依据《网络安全等级保护定级指南》及业务影响范围综合判定。",
        "定级理由": system.level_reason or "根据业务重要性、服务对象规模、数据敏感程度综合确定。",
    }
    if report_type == "filing_form":
        return {
            "标题": "网络安全等级保护定级备案表",
            "章节": [
                {"名称": "基础信息", "内容": base},
                {
                    "名称": "备案意见",
                    "内容": {"测评师意见": "", "主管审核意见": ""},
                },
            ],
        }
    if report_type == "expert_review_form":
        return {
            "标题": "专家评审意见表",
            "章节": [
                {"名称": "系统信息", "内容": base},
                {
                    "名称": "专家意见",
                    "内容": {"专家结论": "", "签字": "", "日期": ""},
                },
            ],
        }
    return {
        "标题": "网络安全等级保护定级报告",
        "章节": [
            {"名称": "责任主体", "内容": {"单位": org.name, "负责人": org.legal_representative}},
            {"名称": "定级对象构成", "内容": {"系统": system.system_name, "边界": system.boundary or ""}},
            {
                "名称": "承载业务与数据",
                "内容": {
                    "业务描述": system.business_description or "",
                    "数据类别": system.data_category or "",
                    "数据级别": system.data_level or "",
                },
            },
            {"名称": "安全责任", "内容": {"网络安全责任部门": org.cybersecurity_dept or ""}},
            {
                "名称": "等级确定过程",
                "内容": {
                    "影响范围": system.impact_scope or "",
                    "定级依据": base["定级依据"],
                    "定级理由": base["定级理由"],
                    "结论": f"建议定级为第{system.proposed_level}级",
                },
            },
        ],
    }


# ──────────────────────────────────────────────────────────────────────────────
# 内部工具函数
# ──────────────────────────────────────────────────────────────────────────────

def _iter_report_lines(content: dict[str, Any]) -> list[str]:
    lines: list[str] = [str(content.get("标题", ""))]
    for section in content.get("章节", []):
        title = section.get("名称", "")
        if title:
            lines.append(f"[{title}]")
        section_content = section.get("内容", {})
        if isinstance(section_content, dict):
            for k, v in section_content.items():
                lines.append(f"{k}: {v}")
        else:
            lines.append(str(section_content))
        lines.append("")
    return lines


def _replace_paragraph_text(paragraph: Any, value: str) -> None:
    """将整段文字替换为 value，同时保留第一个 run 的格式。"""
    if not paragraph.runs:
        paragraph.text = value
        return
    paragraph.runs[0].text = value
    for run in paragraph.runs[1:]:
        run.text = ""


# ──────────────────────────────────────────────────────────────────────────────
# Word 导出（无模板）
# ──────────────────────────────────────────────────────────────────────────────

def export_report_docx(title: str, content: dict[str, Any], output_path: Path) -> None:
    """
    生成不依赖官方模板的 Word 报告文件。

    参数：
        title: 报告标题
        content: 报告内容 dict，包含 '章节' 列表
        output_path: 输出文件路径（Path 对象）
    """
    if not title or not title.strip():
        raise ValueError("export_report_docx: title 不能为空。")
    if not isinstance(content, dict):
        raise TypeError("export_report_docx: content 必须为 dict 类型。")

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = Document()

    # 设置正文字体为宋体 12pt
    normal_style = doc.styles["Normal"]
    normal_style.font.name = "宋体"
    try:
        normal_style._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    except AttributeError:
        # 部分环境下 rPr 可能为 None，容错处理
        logger.warning("无法设置正文东亚字体，跳过。")
    normal_style.font.size = Pt(12)

    # 添加页脚页码："第 {PAGE} 页"
    footer = doc.sections[0].footer
    p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    p.alignment = 2  # 右对齐
    p.add_run("第 ")
    run = p.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_end)
    p.add_run(" 页")

    doc.add_heading(title, level=1)
    for section in content.get("章节", []):
        section_title = section.get("名称", "")
        if section_title:
            doc.add_heading(section_title, level=2)
        section_content = section.get("内容", {})
        if isinstance(section_content, dict):
            for key, value in section_content.items():
                para = doc.add_paragraph(f"{key}: {value}")
                para.paragraph_format.line_spacing = 1.5
        else:
            para = doc.add_paragraph(str(section_content))
            para.paragraph_format.line_spacing = 1.5

    doc.save(output_path)
    logger.info("Word 报告已生成：%s", output_path)


# ──────────────────────────────────────────────────────────────────────────────
# 官方模板脱敏处理
# ──────────────────────────────────────────────────────────────────────────────

OFFICIAL_TEMPLATE_TEXT_REPLACEMENTS = {
    "山西晋深交易有限公司": "【单位名称】",
    "山西省省属企业采购与供应链信息管理系统": "【系统名称】",
    "张宇阳": "【联系人】",
    "李沛林": "【负责人】",
    "郭丽娟": "【负责人】",
    "孔庆花、马丽娜、郭煜": "【专家组成员】",
    "党委副书记、副董事长": "【职务】",
    "信息技术部": "【责任部门】",
}


def _normalize_text_for_replace(text: str) -> str:
    result = text
    for old, new in OFFICIAL_TEMPLATE_TEXT_REPLACEMENTS.items():
        result = result.replace(old, new)
    result = re.sub(r"\b[0-9A-Z]{18}\b", "【统一社会信用代码】", result)
    result = re.sub(r"\b1[3-9]\d{9}\b", "【联系电话】", result)
    result = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "【邮箱】", result)
    result = re.sub(r"\b\d{17}[0-9Xx]\b", "【证件号】", result)
    result = re.sub(r"\b\d{4}年\d{1,2}月\d{1,2}日\b", "____年__月__日", result)
    result = re.sub(r"https?://[^\s，。；;]+", "【访问地址】", result)
    return result


def sanitize_template_docx_content(content: bytes) -> bytes:
    """对 Word 模板文件进行脱敏处理，替换敏感文本为占位符。"""
    if not content:
        raise ValueError("sanitize_template_docx_content: content 不能为空。")

    doc = Document(io.BytesIO(content))
    for p in doc.paragraphs:
        raw = p.text or ""
        cleaned = _normalize_text_for_replace(raw)
        if cleaned != raw:
            _replace_paragraph_text(p, cleaned)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    raw = p.text or ""
                    cleaned = _normalize_text_for_replace(raw)
                    if cleaned != raw:
                        _replace_paragraph_text(p, cleaned)
    bio = io.BytesIO()
    doc.save(bio)
    return bio.getvalue()


# ──────────────────────────────────────────────────────────────────────────────
# Word 导出（基于官方模板填充）
# ──────────────────────────────────────────────────────────────────────────────

def _replace_tokens(text: str, field_map: dict[str, str]) -> str:
    """将文本中的 {{key}} 和 【key】 占位符替换为对应值。"""
    result = text
    for k, v in field_map.items():
        if not k:
            continue
        result = result.replace(f"{{{{{k}}}}}", v)
        result = result.replace(f"【{k}】", v)
    return result


def _fill_row_by_label(row: Any, field_map: dict[str, str]) -> None:
    """
    按表格行中的标签列填充相邻值列。

    规则：找到包含 field_map key 的单元格，将其右侧相邻单元格设置为对应值。
    """
    cells = list(row.cells)
    labels = [c.text.strip().replace("\n", " ") for c in cells]
    for idx, label in enumerate(labels):
        if not label:
            continue
        for key, value in field_map.items():
            if not value:
                continue
            if key in label and idx + 1 < len(cells):
                cells[idx + 1].text = value


def export_report_docx_with_template(
    template_path: Path,
    field_map: dict[str, Any],
    output_path: Path,
) -> None:
    """
    基于 Word 模板填充字段并导出报告。

    参数：
        template_path: 模板文件路径（.docx）
        field_map: 字段映射 {占位符名称: 填充值}
        output_path: 输出文件路径

    说明：
        支持 {{key}} 和 【key】 两种占位符格式，同时支持按标签列填充表格。
        None 值的字段不参与替换，避免写入字面量 "None"。
    """
    template_path = Path(template_path)
    if not template_path.exists():
        raise FileNotFoundError(f"模板文件不存在：{template_path}")
    if not template_path.suffix.lower() == ".docx":
        raise ValueError(f"模板文件必须为 .docx 格式，当前：{template_path.suffix}")

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = Document(str(template_path))

    # 过滤掉 None 值，防止写入字符串 "None"
    normalized_map: dict[str, str] = {
        str(k).strip(): str(v)
        for k, v in (field_map or {}).items()
        if str(k).strip() and v is not None
    }

    # 替换正文段落
    for p in doc.paragraphs:
        raw = p.text or ""
        replaced = _replace_tokens(raw, normalized_map)
        if replaced != raw:
            _replace_paragraph_text(p, replaced)

    # 替换表格内容（先按标签填充，再做 token 替换）
    for table in doc.tables:
        for row in table.rows:
            _fill_row_by_label(row, normalized_map)
            for cell in row.cells:
                for p in cell.paragraphs:
                    raw = p.text or ""
                    replaced = _replace_tokens(raw, normalized_map)
                    if replaced != raw:
                        _replace_paragraph_text(p, replaced)

    doc.save(output_path)
    logger.info("模板 Word 报告已生成：%s", output_path)


# ──────────────────────────────────────────────────────────────────────────────
# PDF 导出
# ──────────────────────────────────────────────────────────────────────────────

def export_report_pdf(title: str, content: dict[str, Any], output_path: Path, password: str | None = None) -> None:
    """
    生成 PDF 报告文件。

    优先使用 reportlab（支持中文和加密）；若 reportlab 不可用，
    则降级输出仅含 ASCII 内容的最小合规 PDF。

    参数：
        title: 报告标题
        content: 报告内容 dict
        output_path: 输出文件路径
        password: 可选 PDF 加密密码（仅 reportlab 可用时生效）
    """
    if not title or not title.strip():
        raise ValueError("export_report_pdf: title 不能为空。")
    if not isinstance(content, dict):
        raise TypeError("export_report_pdf: content 必须为 dict 类型。")

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if HAS_REPORTLAB:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        encrypt = None
        if password:
            encrypt = StandardEncryption(
                userPassword=password,
                ownerPassword=password,
                canPrint=1,
                canModify=0,
                canCopy=0,
            )
        c = canvas.Canvas(str(output_path), encrypt=encrypt)
        page_no = 1

        def draw_page_footer() -> None:
            c.setFont("STSong-Light", 9)
            c.drawString(520, 20, f"第{page_no}页")

        c.setFont("STSong-Light", 14)
        y = 800
        c.drawString(60, y, title)
        y -= 30
        c.setFont("STSong-Light", 11)
        for line in _iter_report_lines(content):
            if y < 50:
                draw_page_footer()
                c.showPage()
                page_no += 1
                c.setFont("STSong-Light", 11)
                y = 800
            # 截断过长行，防止单行溢出页面
            c.drawString(60, y, line[:120])
            y -= 18
        draw_page_footer()
        c.save()
        logger.info("PDF 报告已生成（reportlab）：%s", output_path)
        return

    # reportlab 不可用时的降级输出（仅 ASCII 内容）
    logger.warning("reportlab 不可用，降级生成最小 PDF，中文内容将被忽略。")
    lines = [title] + _iter_report_lines(content)
    ascii_lines = [line.encode("ascii", errors="ignore").decode("ascii") or " " for line in lines[:35]]
    stream_parts = ["BT", "/F1 12 Tf", "50 800 Td"]
    for idx, line in enumerate(ascii_lines):
        escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream_parts.append(f"({escaped}) Tj" if idx == 0 else f"T* ({escaped}) Tj")
    stream_parts.append("ET")
    stream = "\n".join(stream_parts).encode("latin-1", errors="ignore")

    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
        b"4 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" + stream + b"\nendstream endobj\n",
        b"5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    ]
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    offsets: list[int] = []
    body = b""
    current = len(header)
    for obj in objects:
        offsets.append(current)
        body += obj
        current += len(obj)
    xref_pos = len(header) + len(body)
    xref = [b"xref\n0 6\n0000000000 65535 f \n"]
    for off in offsets:
        xref.append(f"{off:010d} 00000 n \n".encode("ascii"))
    trailer = b"trailer << /Root 1 0 R /Size 6 >>\nstartxref\n" + str(xref_pos).encode("ascii") + b"\n%%EOF\n"
    output_path.write_bytes(header + body + b"".join(xref) + trailer)
    logger.info("PDF 报告已生成（降级模式）：%s", output_path)


# ──────────────────────────────────────────────────────────────────────────────
# JSON 工具
# ──────────────────────────────────────────────────────────────────────────────

def dump_json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)
