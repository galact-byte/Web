"""
RSA 非对称加密工具 —— 用于登录密码的安全传输

前端使用公钥加密密码 → 后端使用私钥解密
"""
import os
import base64
import logging

from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization, hashes

logger = logging.getLogger(__name__)

# ---------- 密钥生成 / 加载 ----------

def _generate_rsa_keypair():
    """生成 2048 位 RSA 密钥对"""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    logger.info("[RSA] 已自动生成 RSA-2048 密钥对（每次启动更换）")
    return private_key


def _load_private_key_from_env():
    """
    尝试从环境变量加载 RSA 私钥：
    - RSA_PRIVATE_KEY_FILE: 文件路径
    - RSA_PRIVATE_KEY: PEM 字符串（换行用 \\n 表示）
    """
    # 方式一：从文件加载
    key_file = os.getenv("RSA_PRIVATE_KEY_FILE", "").strip()
    if key_file:
        try:
            with open(key_file, "rb") as f:
                private_key = serialization.load_pem_private_key(f.read(), password=None)
            logger.info(f"[RSA] 已从文件加载私钥: {key_file}")
            return private_key
        except Exception as e:
            raise RuntimeError(f"[RSA] 无法加载私钥文件 {key_file}: {e}")

    # 方式二：从环境变量加载 PEM 字符串
    key_pem = os.getenv("RSA_PRIVATE_KEY", "").strip()
    if key_pem:
        try:
            # 环境变量中换行可能被转义
            key_pem = key_pem.replace("\\n", "\n")
            private_key = serialization.load_pem_private_key(
                key_pem.encode(), password=None
            )
            logger.info("[RSA] 已从环境变量加载私钥")
            return private_key
        except Exception as e:
            raise RuntimeError(f"[RSA] 无法解析环境变量中的私钥: {e}")

    return None


def _init_rsa():
    """初始化 RSA 密钥对"""
    private_key = _load_private_key_from_env()
    if private_key is None:
        private_key = _generate_rsa_keypair()

    public_key = private_key.public_key()

    # 导出公钥 PEM（供前端使用）
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    return private_key, public_pem


# 模块级初始化（应用启动时执行一次）
_private_key, _public_key_pem = _init_rsa()


# ---------- 公开 API ----------

def get_public_key_pem() -> str:
    """获取 RSA 公钥（PEM 格式字符串）"""
    return _public_key_pem


def decrypt_password(ciphertext_b64: str) -> str:
    """
    用 RSA 私钥解密前端加密的密码

    参数:
        ciphertext_b64: Base64 编码的密文

    返回:
        解密后的明文密码
    """
    try:
        ciphertext = base64.b64decode(ciphertext_b64)
        plaintext = _private_key.decrypt(
            ciphertext,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ),
        )
        return plaintext.decode("utf-8")
    except Exception as e:
        raise ValueError(f"密码解密失败: {e}")
