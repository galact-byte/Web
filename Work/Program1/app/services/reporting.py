import io
import json
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


def generate_report_payload(report_type: str, org: Any, system: Any) -> dict[str, Any]:
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


def export_report_docx(title: str, content: dict[str, Any], output_path: Path) -> None:
    doc = Document()
    normal_style = doc.styles["Normal"]
    normal_style.font.name = "宋体"
    normal_style._element.rPr.rFonts.set(qn("w:eastAsia"), "宋体")
    normal_style.font.size = Pt(12)

    # Footer page number field: "第 {PAGE} 页"
    footer = doc.sections[0].footer
    p = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
    p.alignment = 2
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


def _replace_paragraph_text(paragraph: Any, value: str) -> None:
    if not paragraph.runs:
        paragraph.text = value
        return
    paragraph.runs[0].text = value
    for run in paragraph.runs[1:]:
        run.text = ""


def sanitize_template_docx_content(content: bytes) -> bytes:
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


def _replace_tokens(text: str, field_map: dict[str, str]) -> str:
    result = text
    for k, v in field_map.items():
        if not k:
            continue
        result = result.replace(f"{{{{{k}}}}}", v)
        result = result.replace(f"【{k}】", v)
    return result


def _fill_row_by_label(row: Any, field_map: dict[str, str]) -> None:
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
    doc = Document(str(template_path))
    normalized_map = {str(k).strip(): str(v) for k, v in (field_map or {}).items() if str(k).strip() and v is not None}
    for p in doc.paragraphs:
        raw = p.text or ""
        replaced = _replace_tokens(raw, normalized_map)
        if replaced != raw:
            _replace_paragraph_text(p, replaced)
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


def export_report_pdf(title: str, content: dict[str, Any], output_path: Path, password: str | None = None) -> None:
    if HAS_REPORTLAB:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        encrypt = None
        if password:
            encrypt = StandardEncryption(userPassword=password, ownerPassword=password, canPrint=1, canModify=0, canCopy=0)
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
            c.drawString(60, y, line[:1000])
            y -= 18
        draw_page_footer()
        c.save()
        return

    # reportlab 不可用时的最小降级输出。
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


def dump_json(data: dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)
