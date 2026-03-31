/**
 * RSA 加密工具 —— 使用浏览器原生 Web Crypto API
 * 用于将密码在发送前加密，防止 F12 Network 面板暴露明文
 */

let _publicKeyCache = null

/**
 * 获取并缓存 RSA 公钥
 */
export async function fetchPublicKey(apiInstance) {
  if (_publicKeyCache) return _publicKeyCache

  const response = await apiInstance.get('/api/auth/public-key')
  const pem = response.data.public_key

  // 解析 PEM → ArrayBuffer → CryptoKey
  const pemBody = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '')
  const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  _publicKeyCache = await crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )

  return _publicKeyCache
}

/**
 * 用 RSA 公钥加密密码
 * @param {string} password - 明文密码
 * @param {CryptoKey} publicKey - RSA 公钥（由 fetchPublicKey 返回）
 * @returns {Promise<string>} Base64 编码的密文
 */
export async function encryptPassword(password, publicKey) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    data
  )

  // ArrayBuffer → Base64
  const bytes = new Uint8Array(encrypted)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * 清除公钥缓存（用于后端重启后公钥变更的场景）
 */
export function clearPublicKeyCache() {
  _publicKeyCache = null
}
