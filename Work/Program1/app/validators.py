import re


CREDIT_CODE_PATTERN = re.compile(r"^[0-9A-Z]{18}$")
MOBILE_PHONE_PATTERN = re.compile(r"^1[3-9]\d{9}$")
OFFICE_PHONE_PATTERN = re.compile(r"^(?:0\d{2,3}-?)?\d{7,8}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_credit_code(value: str) -> bool:
    return bool(value and CREDIT_CODE_PATTERN.fullmatch(value.strip().upper()))


def validate_mobile_phone(value: str) -> bool:
    return bool(value and MOBILE_PHONE_PATTERN.fullmatch(value.strip()))


def validate_office_phone(value: str) -> bool:
    if not value:
        return True
    return bool(OFFICE_PHONE_PATTERN.fullmatch(value.strip()))


def validate_email(value: str) -> bool:
    return bool(value and EMAIL_PATTERN.fullmatch(value.strip()))
