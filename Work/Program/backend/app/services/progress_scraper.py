"""
项目进度爬虫服务
封装项目管理系统数据爬取逻辑，支持多种项目类型
"""
import json
import logging
import os
import re
import tempfile
import time
from pathlib import Path
from typing import Optional

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

# 配置文件路径（backend 根目录）
CONFIG_FILE = Path(__file__).parent.parent.parent / "progress_config.json"

# 默认配置
DEFAULT_CONFIG = {
    "base_url": "https://10.10.10.215/XYivUozEqQ.php",
    "pfx_path": "",
    "pfx_password": None,
    "username": "",
    "password": "",
    "cookie": "",
    "page_size": 50,
}

# 项目类型 → API 路径映射（路径待确认的类型会在爬取时报错提示）
PROJECT_TYPE_PATHS = {
    "dengbao": "/djcp/projectstatus/index",
    "password": "/smcp/projectstatus/index",
    "security": "/aqpg/projectstatus/index",
    "risk": "/fxpg/projectstatus/index",
    "testing": "/rjcs/projectstatus/index",
    "service": "/aqfw/projectstatus/index",
    "comprehensive": "/zhfw/projectstatus/index",
}

# 字段提取映射（从爬取的 JSON 中提取结构化数据）
FIELD_EXTRACTORS = [
    ("system_id", lambda r: r.get("system_id", "")),
    ("system_name", lambda r: r.get("hand", {}).get("systemname", "")),
    ("customer_name", lambda r: r.get("hand", {}).get("customername", "")),
    ("system_level", lambda r: r.get("hand", {}).get("systemlevel", "")),
    ("system_tag", lambda r: r.get("hand", {}).get("systemtag", "")),
    ("business_type", lambda r: r.get("hand", {}).get("businesstype", "")),
    ("project_name", lambda r: r.get("setup", {}).get("projectname", "")),
    ("project_code", lambda r: r.get("setup", {}).get("project_id", "")),
    ("project_location", lambda r: r.get("setup", {}).get("belongcity", "")),
    ("init_status", lambda r: r.get("setup", {}).get("initstatus", "")),
    ("project_manager", lambda r: r.get("hand", {}).get("projectmanager", "")),
    ("pm_department", lambda r: r.get("hand", {}).get("pmdepartment", "")),
    ("sale_contact", lambda r: r.get("setup", {}).get("salewheel", "")),
    ("required_start_date", lambda r: r.get("hand", {}).get("pstartdate", "")),
    ("required_end_date", lambda r: r.get("hand", {}).get("pfinishdate", "")),
    ("actual_start_date", lambda r: r.get("startdate", "") or ""),
    ("actual_end_date", lambda r: r.get("finishdate", "") or ""),
    ("project_status", lambda r: r.get("projectstatus_text", "")),
    ("is_finished", lambda r: r.get("isfinish_text", "")),
    ("plan_printed", lambda r: r.get("isplanprint", "")),
    ("report_printed", lambda r: r.get("isreportprint", "")),
    ("register_status", lambda r: r.get("hand", {}).get("isregister_text", "")),
    ("contract_status", lambda r: r.get("hand", {}).get("contractstatus_text", "")),
    ("remark", lambda r: r.get("remark", "") or ""),
]

# Excel 列名（与 FIELD_EXTRACTORS 一一对应）
EXCEL_COLUMNS = [
    "系统编号", "系统名称", "客户名称", "系统级别", "系统标签", "业务类型",
    "项目名称", "项目编号", "项目地点", "立项状态", "项目经理", "项目部门",
    "销售负责人", "要求进场时间", "要求完结时间", "实施开始日期", "实施结束日期",
    "项目状态", "是否完结", "方案打印", "报告打印", "备案状态", "合同状态", "备注",
]

# 数据库字段名列表
DB_FIELD_NAMES = [field for field, _ in FIELD_EXTRACTORS]


def load_config() -> dict:
    """加载爬虫配置"""
    config = DEFAULT_CONFIG.copy()
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            config.update(json.load(f))
    return config


def save_config(config: dict):
    """保存爬虫配置"""
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


class ProgressScraper:
    """项目进度爬虫"""

    def __init__(self, project_type: str, config: Optional[dict] = None):
        if project_type not in PROJECT_TYPE_PATHS:
            raise ValueError(f"不支持的项目类型: {project_type}")
        self.project_type = project_type
        self.api_path = PROJECT_TYPE_PATHS[project_type]
        self.config = config or load_config()
        self.session: Optional[requests.Session] = None
        self._cert_path: Optional[str] = None
        self._key_path: Optional[str] = None

    def _setup_cert(self):
        """从 PFX 提取 PEM 证书和私钥"""
        from cryptography.hazmat.primitives.serialization import (
            pkcs12, Encoding, PrivateFormat, NoEncryption
        )

        pfx_path = self.config["pfx_path"]
        if not pfx_path or not os.path.exists(pfx_path):
            raise FileNotFoundError(f"PFX 证书文件不存在: {pfx_path}")

        pfx_password = self.config.get("pfx_password")
        with open(pfx_path, "rb") as f:
            pfx_data = f.read()

        private_key, certificate, ca_certs = pkcs12.load_key_and_certificates(
            pfx_data, pfx_password.encode() if pfx_password else None
        )

        cert_file = tempfile.NamedTemporaryFile(suffix=".pem", delete=False, mode="wb")
        key_file = tempfile.NamedTemporaryFile(suffix=".pem", delete=False, mode="wb")

        cert_file.write(certificate.public_bytes(Encoding.PEM))
        if ca_certs:
            for ca in ca_certs:
                cert_file.write(ca.public_bytes(Encoding.PEM))
        cert_file.close()

        key_file.write(
            private_key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
        )
        key_file.close()

        self._cert_path = cert_file.name
        self._key_path = key_file.name

    def create_session(self):
        """创建带客户端证书的 HTTP Session"""
        self._setup_cert()
        self.session = requests.Session()
        self.session.verify = False
        self.session.cert = (self._cert_path, self._key_path)
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/146.0.0.0 Safari/537.36"
            ),
        })
        cookie = self.config.get("cookie", "")
        if cookie:
            self.session.cookies.set("PHPSESSID", cookie)

    def check_session(self) -> bool:
        """检查当前 session 是否有效（使用等保路径作为通用检测）"""
        # PHPSESSID 是全局的，用等保路径检查即可判断是否已登录
        check_path = PROJECT_TYPE_PATHS.get("dengbao", self.api_path)
        url = f"{self.config['base_url']}{check_path}"
        params = {"offset": "0", "limit": "1", "filter": "{}", "op": "{}"}
        headers = {"X-Requested-With": "XMLHttpRequest"}
        try:
            resp = self.session.get(url, headers=headers, params=params, timeout=10)
            data = resp.json()
            return "total" in data
        except Exception:
            return False

    def auto_login(self, max_retries: int = 5) -> bool:
        """自动登录（OCR 验证码识别）"""
        try:
            import ddddocr
        except ImportError:
            raise RuntimeError(
                "自动登录需要 ddddocr 库，请执行: pip install ddddocr"
            )

        ocr = ddddocr.DdddOcr(show_ad=False)
        base_url = self.config["base_url"]
        login_url = f"{base_url}/index/login"
        captcha_base = base_url.rsplit("/", 1)[0]
        captcha_url = f"{captcha_base}/index.php?s=/captcha"

        for attempt in range(1, max_retries + 1):
            resp = self.session.get(login_url, timeout=15)
            token_match = re.search(r'name="__token__"\s+value="([^"]+)"', resp.text)
            token = token_match.group(1) if token_match else ""

            resp = self.session.get(captcha_url, timeout=10)
            captcha_text = ocr.classification(resp.content)
            logger.info("登录尝试 %d/%d，验证码: %s", attempt, max_retries, captcha_text)

            login_data = {
                "__token__": token,
                "username": self.config["username"],
                "password": self.config["password"],
                "captcha": captcha_text,
                "keeplogin": "1",
            }
            resp = self.session.post(login_url, data=login_data, timeout=15)

            try:
                result = resp.json()
                if result.get("code") == 1:
                    self._save_cookie()
                    return True
            except ValueError:
                if "登录成功" in resp.text or resp.status_code == 302:
                    self._save_cookie()
                    return True

            time.sleep(0.5)

        # 所有重试都失败后，检查是否实际已处于登录状态
        # （已登录时访问登录页会返回非预期的 HTML，导致误判为失败）
        if self.check_session():
            logger.info("检测到已登录状态")
            self._save_cookie()
            return True

        return False

    def _save_cookie(self):
        """登录成功后保存 Cookie"""
        phpsessid = self.session.cookies.get("PHPSESSID")
        if phpsessid:
            self.config["cookie"] = phpsessid
            save_config(self.config)

    def _fetch_page(self, offset: int, limit: int) -> dict:
        """获取一页数据"""
        url = f"{self.config['base_url']}{self.api_path}"
        params = {
            "addtabs": "1",
            "sort": "id",
            "order": "desc",
            "offset": str(offset),
            "limit": str(limit),
            "filter": "{}",
            "op": "{}",
        }
        headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        }
        resp = self.session.get(url, headers=headers, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if "code" in data and data.get("msg") == "请登录后操作":
            raise RuntimeError("Session 已过期，请重新登录或更新 Cookie")

        return data

    def fetch_all(self, page_size: Optional[int] = None) -> list[dict]:
        """分页获取全部数据"""
        limit = page_size or self.config.get("page_size", 50)
        first_page = self._fetch_page(0, limit)
        total = first_page.get("total", 0)
        rows = first_page.get("rows", [])

        offset = limit
        while offset < total:
            time.sleep(0.3)
            data = self._fetch_page(offset, limit)
            rows.extend(data.get("rows", []))
            offset += limit

        return rows

    @staticmethod
    def extract_record(raw: dict) -> dict:
        """从原始 JSON 提取结构化字段"""
        return {field: extractor(raw) for field, extractor in FIELD_EXTRACTORS}

    def run(self, page_size: Optional[int] = None) -> list[dict]:
        """完整爬取流程：建立连接 → 鉴权 → 获取数据"""
        self.create_session()

        cookie = self.config.get("cookie", "")
        if cookie and self.check_session():
            logger.info("已有 Session 有效")
        else:
            logger.info("尝试自动登录...")
            if not self.auto_login():
                raise RuntimeError("自动登录失败，请检查配置或手动更新 Cookie")

        raw_rows = self.fetch_all(page_size)
        return [self.extract_record(row) for row in raw_rows]

    def cleanup(self):
        """清理临时证书文件"""
        for f in (self._cert_path, self._key_path):
            if f:
                try:
                    os.unlink(f)
                except OSError:
                    pass
