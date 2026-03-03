import re


# ──────────────────────────────────────────────────────────────────────────────
# 正则表达式预编译
# ──────────────────────────────────────────────────────────────────────────────

CREDIT_CODE_PATTERN = re.compile(r"^[0-9A-Z]{18}$")
MOBILE_PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")
OFFICE_PHONE_PATTERN = re.compile(r"^(?:0\d{2,3}-?)?\d{7,8}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# 系统编号格式：字母/数字/连字符，长度 4~64
SYSTEM_CODE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_]{2,62}[A-Za-z0-9]$")

# IP 地址（IPv4）
IPV4_PATTERN = re.compile(
    r"^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$"
)

# URL 格式（http/https/ftp）
URL_PATTERN = re.compile(
    r"^(https?|ftp)://"
    r"([A-Za-z0-9\-]+\.)*[A-Za-z0-9\-]+"
    r"(:\d{1,5})?"
    r"(/[^\s]*)?"
    r"$",
    re.IGNORECASE,
)

# 占位符集合（视为空值，不做有效性校验）
PLACEHOLDER_VALUES = {"/", "／"}

# 统一社会信用代码校验码权重表（前17位，位序 0-16）
_CREDIT_CODE_CHARS = "0123456789ABCDEFGHJKLMNPQRTUWXY"
_CREDIT_CODE_WEIGHTS = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]


# ──────────────────────────────────────────────────────────────────────────────
# 通用工具
# ──────────────────────────────────────────────────────────────────────────────

def is_placeholder_value(value: str | None) -> bool:
    """判断字段值是否为占位符（如 '/' '／'），视同未填写。"""
    return bool(isinstance(value, str) and value.strip() in PLACEHOLDER_VALUES)


# ──────────────────────────────────────────────────────────────────────────────
# 统一社会信用代码校验
# ──────────────────────────────────────────────────────────────────────────────

def _calc_credit_code_checksum(code17: str) -> str:
    """计算统一社会信用代码第18位校验字符。"""
    total = 0
    for i, ch in enumerate(code17):
        pos = _CREDIT_CODE_CHARS.find(ch)
        if pos == -1:
            return ""
        total += pos * _CREDIT_CODE_WEIGHTS[i]
    remainder = total % 31
    check_index = (31 - remainder) % 31
    return _CREDIT_CODE_CHARS[check_index]


def validate_credit_code(value: str) -> bool:
    """
    校验统一社会信用代码格式及第18位校验位。

    规则：
    - 18位，仅含数字和大写字母（不含 I/O/S/V/Z）
    - 最后一位为按 GB/T 32100-2015 算法得出的校验字符
    """
    if not value:
        return False
    clean = value.strip().upper()
    if not CREDIT_CODE_PATTERN.fullmatch(clean):
        return False
    # 校验第18位校验位
    expected = _calc_credit_code_checksum(clean[:17])
    return bool(expected) and clean[17] == expected


def validate_credit_code_format_only(value: str) -> bool:
    """仅校验统一社会信用代码格式（18位字母数字），不验证校验位。"""
    if not value:
        return False
    clean = value.strip().upper()
    return bool(CREDIT_CODE_PATTERN.fullmatch(clean))


# ──────────────────────────────────────────────────────────────────────────────
# 电话号码校验
# ──────────────────────────────────────────────────────────────────────────────

def validate_mobile_phone(value: str) -> bool:
    """校验中国大陆手机号（1[3-9]xxxxxxxxx）。"""
    if not value:
        return False
    clean = value.strip()
    return bool(MOBILE_PHONE_PATTERN.fullmatch(clean))


def validate_office_phone(value: str) -> bool:
    """校验座机号码（可选区号-7到8位数字）；空值视为合法（非必填）。"""
    if not value:
        return True
    clean = value.strip()
    return bool(OFFICE_PHONE_PATTERN.fullmatch(clean))


# ──────────────────────────────────────────────────────────────────────────────
# 电子邮箱校验
# ──────────────────────────────────────────────────────────────────────────────

def validate_email(value: str) -> bool:
    """校验电子邮箱地址基本格式。"""
    if not value:
        return False
    clean = value.strip()
    return bool(EMAIL_PATTERN.fullmatch(clean))


# ──────────────────────────────────────────────────────────────────────────────
# 系统编号格式校验
# ──────────────────────────────────────────────────────────────────────────────

def validate_system_code(value: str) -> bool:
    """
    校验信息系统编号格式。

    规则：
    - 长度 4~64 个字符
    - 仅允许字母、数字、连字符（-）、下划线（_）
    - 首尾必须为字母或数字（不允许以连字符/下划线开头或结尾）
    """
    if not value:
        return False
    clean = value.strip()
    return bool(SYSTEM_CODE_PATTERN.fullmatch(clean))


# ──────────────────────────────────────────────────────────────────────────────
# IP 地址 / URL 校验（用于网络拓扑字段）
# ──────────────────────────────────────────────────────────────────────────────

def validate_ipv4(value: str) -> bool:
    """校验 IPv4 地址格式（如 192.168.1.1）。"""
    if not value:
        return False
    clean = value.strip()
    return bool(IPV4_PATTERN.fullmatch(clean))


def validate_url(value: str) -> bool:
    """
    校验 URL 格式（支持 http/https/ftp）。

    空值视为合法（网络拓扑字段非必填）。
    """
    if not value:
        return True
    clean = value.strip()
    return bool(URL_PATTERN.fullmatch(clean))


def validate_network_topology_field(value: str | None) -> bool:
    """
    校验网络拓扑相关字段：接受空值、IP 地址或 URL，
    不满足任一格式则返回 False。
    """
    if not value or is_placeholder_value(value):
        return True
    clean = value.strip()
    return validate_ipv4(clean) or validate_url(clean)
