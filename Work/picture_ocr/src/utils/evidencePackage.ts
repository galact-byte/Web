const ENVELOPE_TYPE = 'picture-ocr.evidence';
const ENVELOPE_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

interface EvidenceEnvelope {
  type: typeof ENVELOPE_TYPE;
  version: typeof ENVELOPE_VERSION;
  algorithm: 'AES-GCM';
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  iv: string;
  ciphertext: string;
}

function getWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error('当前浏览器不支持 Web Crypto，无法安全处理加密采集包。请使用较新的 iOS、Android、HarmonyOS 或桌面浏览器，并通过 HTTPS 或 localhost 打开页面。');
  }
  return globalThis.crypto;
}

function requirePassword(password: string): void {
  if (!password) throw new Error('请输入加密采集包密码。');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

async function deriveKey(webCrypto: Crypto, password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const passwordKey = await webCrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return webCrypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** 用于导入边界的纯格式校验；不接触密码、密钥或浏览器存储。 */
export function validateEvidenceEnvelope(value: unknown): string | null {
  if (!value || typeof value !== 'object') return '加密采集包格式无效。';
  const envelope = value as Partial<EvidenceEnvelope>;
  if (envelope.type !== ENVELOPE_TYPE || envelope.version !== ENVELOPE_VERSION) return '不支持的加密采集包版本。';
  if (envelope.algorithm !== 'AES-GCM' || !envelope.kdf || envelope.kdf.name !== 'PBKDF2' || envelope.kdf.hash !== 'SHA-256') return '加密采集包算法信息无效。';
  // v1 的 KDF 参数是协议常量。拒绝异常高迭代次数，避免恶意文件借解密入口消耗设备资源。
  if (envelope.kdf.iterations !== PBKDF2_ITERATIONS) return '加密采集包 KDF 参数无效。';
  if (typeof envelope.kdf.salt !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') return '加密采集包缺少必要数据。';
  const salt = base64ToBytes(envelope.kdf.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  if (!salt || salt.length !== SALT_LENGTH || !iv || iv.length !== IV_LENGTH || !ciphertext || ciphertext.length === 0) return '加密采集包编码无效。';
  return null;
}

export async function encryptEvidenceBlob(source: Blob, password: string): Promise<Blob> {
  requirePassword(password);
  const webCrypto = getWebCrypto();
  const salt = webCrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = webCrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(webCrypto, password, salt, PBKDF2_ITERATIONS);
  const plaintext = await source.arrayBuffer();
  const ciphertext = await webCrypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext);
  const envelope: EvidenceEnvelope = {
    type: ENVELOPE_TYPE,
    version: ENVELOPE_VERSION,
    algorithm: 'AES-GCM',
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt) },
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return new Blob([JSON.stringify(envelope)], { type: 'application/vnd.picture-ocr.evidence+json' });
}

export async function decryptEvidenceBlob(source: Blob, password: string): Promise<Blob> {
  requirePassword(password);
  const webCrypto = getWebCrypto();
  let parsed: unknown;
  try {
    parsed = JSON.parse(await source.text());
  } catch {
    throw new Error('加密采集包文件无效或已损坏。');
  }
  const validationError = validateEvidenceEnvelope(parsed);
  if (validationError) throw new Error(validationError);
  const envelope = parsed as EvidenceEnvelope;
  const salt = base64ToBytes(envelope.kdf.salt)!;
  const iv = base64ToBytes(envelope.iv)!;
  const ciphertext = base64ToBytes(envelope.ciphertext)!;
  try {
    const key = await deriveKey(webCrypto, password, salt, envelope.kdf.iterations);
    const plaintext = await webCrypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(ciphertext));
    return new Blob([plaintext], { type: 'application/zip' });
  } catch {
    // GCM 认证失败时不区分错误密码与篡改，避免泄露额外信息。
    throw new Error('解密失败：密码不正确或文件已损坏。');
  }
}

export function isEvidencePackageFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.evidence');
}
