import re


CREDIT_CODE_PATTERN = re.compile(r"^[0-9A-Z]{18}$")
MOBILE_PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")
OFFICE_PHONE_PATTERN = re.compile(r"^(?:0\d{2,3}-?)?\d{7,8}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PLACEHOLDER_VALUES = {"/", "／"}


def is_placeholder_value(value: str | None) -> bool:
    return bool(isinstance(value, str) and value.strip() in PLACEHOLDER_VALUES)


def validate_credit_code(value: str) -> bool:
    if not value:
        return False
    clean = value.strip().upper()
    return bool(CREDIT_CODE_PATTERN.fullmatch(clean))


def validate_mobile_phone(value: str) -> bool:
    if not value:
        return False
    clean = value.strip()
    return bool(MOBILE_PHONE_PATTERN.fullmatch(clean))


def validate_office_phone(value: str) -> bool:
    if not value:
        return True
    clean = value.strip()
    return bool(OFFICE_PHONE_PATTERN.fullmatch(clean))


def validate_email(value: str) -> bool:
    if not value:
        return False
    clean = value.strip()
    return bool(EMAIL_PATTERN.fullmatch(clean))
