import json
from pathlib import Path
from typing import Any

from docx import Document

try:
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.pdfgen import canvas

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
    doc.add_heading(title, level=1)
    for section in content.get("章节", []):
        section_title = section.get("名称", "")
        doc.add_heading(section_title, level=2)
        section_content = section.get("内容", {})
        if isinstance(section_content, dict):
            for key, value in section_content.items():
                doc.add_paragraph(f"{key}: {value}")
        else:
            doc.add_paragraph(str(section_content))
    doc.save(output_path)


def export_report_pdf(title: str, content: dict[str, Any], output_path: Path) -> None:
    if HAS_REPORTLAB:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        c = canvas.Canvas(str(output_path))
        c.setFont("STSong-Light", 14)
        y = 800
        c.drawString(60, y, title)
        y -= 30
        c.setFont("STSong-Light", 11)
        for line in _iter_report_lines(content):
            if y < 50:
                c.showPage()
                c.setFont("STSong-Light", 11)
                y = 800
            c.drawString(60, y, line[:1000])
            y -= 18
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
