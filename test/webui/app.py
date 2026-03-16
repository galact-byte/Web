import html
import re
import threading

import markdown
import pymysql
from flask import Flask, jsonify, render_template, request

from config import Config
from export import export_html, export_json, export_markdown, export_docx, export_xlsx, parse_vulnerabilities
from llm import LLMClient
from models import Audit, Setting, db


def ensure_database():
    """如果数据库不存在则自动创建。"""
    try:
        conn = pymysql.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
        )
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{Config.DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
        conn.close()
    except Exception as e:
        print(f"[警告] 无法自动创建数据库: {e}")


def create_app() -> Flask:
    ensure_database()

    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        try:
            db.create_all()
            # 迁移已有表：将 Text 升级为 LONGTEXT
            with db.engine.connect() as conn:
                conn.execute(db.text("ALTER TABLE audits MODIFY code_content LONGTEXT NOT NULL"))
                conn.execute(db.text("ALTER TABLE audits MODIFY result LONGTEXT"))
                conn.commit()
        except Exception as e:
            print(f"[警告] 数据库初始化: {e}")
            print("[警告] 请确认 MySQL 已启动且 config.py 配置正确")

    # -- 工具函数 ---------------------------------------------------------------

    def get_setting(key: str, default: str = "") -> str:
        s = Setting.query.filter_by(key=key).first()
        return s.value if s else default

    def set_setting(key: str, value: str):
        s = Setting.query.filter_by(key=key).first()
        if s:
            s.value = value
        else:
            db.session.add(Setting(key=key, value=value))
        db.session.commit()

    def build_client() -> LLMClient:
        provider = get_setting("provider", "openai")
        base_url = get_setting("base_url", "https://api.openai.com/v1") if provider != "anthropic" else ""
        max_workers = int(get_setting("max_workers", "3"))
        return LLMClient(
            provider=provider,
            api_key=get_setting("api_key"),
            base_url=base_url,
            model=get_setting("model", "gpt-4"),
            max_workers=max_workers,
        )

    def extract_severity(text: str) -> str:
        """从审计结果的总体评估段落中提取风险等级。"""
        section = text[:500]
        # 优先匹配明确的等级声明（如"整体安全等级（高风险）"）
        level_match = re.search(r"安全等级[：:\s]*[（(]?\s*(安全|低风险|中风险|高风险|严重)\s*[）)]?", section)
        if level_match:
            level = level_match.group(1)
            return {"严重": "critical", "高风险": "high", "中风险": "medium", "低风险": "low", "安全": "info"}.get(level, "info")
        # 回退：按关键词匹配，排除否定表述
        if re.search(r"严重", section) and not re.search(r"(没有|无|不是|非)严重", section):
            return "critical"
        if re.search(r"高风险|高危", section):
            return "high"
        if re.search(r"中风险|中危", section):
            return "medium"
        if re.search(r"低风险|低危", section):
            return "low"
        return "info"

    # -- 页面路由 ---------------------------------------------------------------

    @app.route("/")
    def dashboard():
        status_filter = request.args.get("status", "")
        query = Audit.query.order_by(Audit.created_at.desc())
        if status_filter in ("pending", "running", "completed", "failed"):
            query = query.filter_by(status=status_filter)
        audits = query.all()
        return render_template("dashboard.html", audits=audits, current_filter=status_filter)

    @app.route("/audit/new")
    def new_audit():
        has_key = bool(get_setting("api_key"))
        return render_template("audit.html", has_key=has_key)

    @app.route("/audit/<int:audit_id>")
    def view_audit(audit_id):
        audit = Audit.query.get_or_404(audit_id)
        result_html = ""
        if audit.result:
            result_html = markdown.markdown(
                audit.result, extensions=["fenced_code", "tables", "nl2br"]
            )
        return render_template("report.html", audit=audit, result_html=result_html)

    @app.route("/audit/<int:audit_id>/analysis")
    def analysis_page(audit_id):
        audit = Audit.query.get_or_404(audit_id)
        if audit.status != "completed":
            return render_template("report.html", audit=audit, result_html="")
        return render_template("analysis.html", audit=audit)

    @app.route("/api/audit/<int:audit_id>/analysis")
    def analysis_data(audit_id):
        audit = Audit.query.get_or_404(audit_id)
        # 按文件标记拆分源码
        files = []
        parts = re.split(r"// ===== (.+?) =====\n", audit.code_content)
        if len(parts) >= 3:
            for i in range(1, len(parts), 2):
                if i + 1 < len(parts):
                    path = parts[i].strip()
                    content = parts[i + 1].rstrip("\n")
                    files.append({"path": path, "content": content, "lines": content.count("\n") + 1})
        if not files:
            files.append({"path": "source", "content": audit.code_content, "lines": audit.code_content.count("\n") + 1})
        # 解析漏洞
        vulns = parse_vulnerabilities(audit.result or "")
        for i, v in enumerate(vulns, 1):
            v["id"] = i
        return jsonify({"files": files, "vulnerabilities": vulns})

    @app.route("/settings")
    def settings_page():
        return render_template(
            "settings.html",
            provider=get_setting("provider", "openai"),
            api_key=get_setting("api_key", ""),
            base_url=get_setting("base_url", "https://api.openai.com/v1"),
            model=get_setting("model", "gpt-4"),
            chunk_size=get_setting("chunk_size", "300"),
            max_workers=get_setting("max_workers", "3"),
        )

    # -- API 路由 ---------------------------------------------------------------

    @app.route("/api/audit", methods=["POST"])
    def create_audit():
        data = request.json or {}
        code = (data.get("code") or "").strip()
        if not code:
            return jsonify({"error": "代码内容不能为空"}), 400
        if not get_setting("api_key"):
            return jsonify({"error": "请先在设置中配置 API 密钥"}), 400

        audit = Audit(
            title=data.get("title") or "未命名审计",
            code_content=code,
            language=data.get("language", "auto"),
            model_used=get_setting("model", "gpt-4"),
            status="running",
        )
        try:
            db.session.add(audit)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": f"保存失败: {e}"}), 500

        threading.Thread(
            target=_run_audit,
            args=(app, audit.id),
            daemon=True,
        ).start()
        return jsonify({"id": audit.id, "status": "running"})

    def _run_audit(app_ctx, audit_id):
        with app_ctx.app_context():
            audit = Audit.query.get(audit_id)
            if not audit:
                return
            try:
                client = build_client()
                chunk_size = int(get_setting("chunk_size", "300")) * 1024

                def on_progress(current, total, merging=False):
                    if merging:
                        audit.result = f"[进度] 正在汇总 {total} 个批次的审计结果..."
                    elif total == 1:
                        audit.result = "[进度] 正在审计..."
                    else:
                        audit.result = f"[进度] 已完成 {current}/{total} 批（{client.max_workers} 路并发）"
                    try:
                        db.session.commit()
                    except Exception:
                        db.session.rollback()

                result = client.audit_code(audit.code_content, audit.language, on_progress=on_progress, chunk_size=chunk_size)
                audit.result = result
                audit.status = "completed"
                audit.severity = extract_severity(result)
            except Exception as e:
                db.session.rollback()
                audit = Audit.query.get(audit_id)
                if not audit:
                    return
                audit.result = f"审计失败: {e}"
                audit.status = "failed"
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()

    @app.route("/api/audit/<int:audit_id>/status")
    def audit_status(audit_id):
        audit = Audit.query.get_or_404(audit_id)
        progress = ""
        progress_current = 0
        progress_total = 0
        if audit.status == "running" and audit.result and audit.result.startswith("[进度]"):
            progress = audit.result[5:]
            # 解析 "已完成 X/Y 批" 或 "正在汇总"
            m = re.search(r"(\d+)/(\d+)", audit.result)
            if m:
                progress_current = int(m.group(1))
                progress_total = int(m.group(2))
            if "汇总" in audit.result:
                progress_current = progress_total  # 汇总阶段视为 100%
        return jsonify({
            "id": audit.id, "status": audit.status, "severity": audit.severity,
            "progress": progress, "progress_current": progress_current, "progress_total": progress_total,
        })

    @app.route("/api/audit/<int:audit_id>", methods=["DELETE"])
    def delete_audit(audit_id):
        audit = Audit.query.get_or_404(audit_id)
        db.session.delete(audit)
        db.session.commit()
        return jsonify({"ok": True})

    @app.route("/api/audit/<int:audit_id>/export")
    def export_audit(audit_id):
        audit = Audit.query.get_or_404(audit_id)
        fmt = request.args.get("format", "markdown")

        if fmt == "html":
            return export_html(audit), 200, {
                "Content-Type": "text/html; charset=utf-8",
                "Content-Disposition": f"attachment; filename=audit_{audit.id}.html",
            }
        if fmt == "json":
            return export_json(audit), 200, {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": f"attachment; filename=audit_{audit.id}.json",
            }
        if fmt == "docx":
            return export_docx(audit), 200, {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": f"attachment; filename=audit_{audit.id}.docx",
            }
        if fmt == "xlsx":
            return export_xlsx(audit), 200, {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": f"attachment; filename=audit_{audit.id}.xlsx",
            }
        # 默认 markdown
        return export_markdown(audit), 200, {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": f"attachment; filename=audit_{audit.id}.md",
        }

    @app.route("/api/settings", methods=["POST"])
    def save_settings():
        data = request.json or {}
        for key in ("provider", "api_key", "base_url", "model", "chunk_size", "max_workers"):
            if key in data:
                set_setting(key, data[key])
        return jsonify({"ok": True})

    @app.route("/api/settings/test", methods=["POST"])
    def test_settings():
        """用极短请求验证 API 连通性。"""
        try:
            client = build_client()
            reply = client.test_connection()
            return jsonify({"ok": True, "reply": reply[:200]})
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
