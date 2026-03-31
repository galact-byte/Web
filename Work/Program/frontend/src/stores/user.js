/**
 * 用户状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'
import api from '../api'
import { fetchPublicKey, encryptPassword, clearPublicKeyCache } from '../utils/crypto'

function safeParseUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

/**
 * 加密密码（带自动重试：如果后端重启导致公钥变更，清除缓存后重试一次）
 */
async function encryptWithRetry(password) {
  try {
    const publicKey = await fetchPublicKey(api)
    return await encryptPassword(password, publicKey)
  } catch {
    // 公钥可能过期（后端重启），清除缓存重试
    clearPublicKeyCache()
    const publicKey = await fetchPublicKey(api)
    return await encryptPassword(password, publicKey)
  }
}

export const useUserStore = defineStore('user', () => {
  // 状态（安全解析 localStorage，防止损坏 JSON 导致白屏）
  const user = ref(safeParseUser())
  const token = ref(localStorage.getItem('token') || '')
  const loading = ref(false)
  const error = ref('')

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isManager = computed(() => user.value?.role === 'manager')
  const isEmployee = computed(() => user.value?.role === 'employee')
  const mustChangePassword = computed(() => !!user.value?.must_change_password)

  // 方法
  async function login(credentials) {
    loading.value = true
    error.value = ''
    try {
      // RSA 加密密码
      const encryptedPwd = await encryptWithRetry(credentials.password)

      const response = await authApi.login({
        username: credentials.username,
        encrypted_password: encryptedPwd
      })
      const data = response.data

      token.value = data.access_token
      user.value = data.user

      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))

      return data.user
    } catch (err) {
      error.value = err.response?.data?.detail || '登录失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function changePassword(newPassword, oldPassword) {
    loading.value = true
    error.value = ''
    try {
      // RSA 加密新密码
      const encryptedNew = await encryptWithRetry(newPassword)

      const payload = { encrypted_new_password: encryptedNew }

      // 如果提供了旧密码，也加密
      if (oldPassword) {
        payload.encrypted_old_password = await encryptWithRetry(oldPassword)
      }

      await authApi.changePassword(payload)
      // 更新本地状态
      if (user.value) {
        user.value.must_change_password = false
        localStorage.setItem('user', JSON.stringify(user.value))
      }
    } catch (err) {
      error.value = err.response?.data?.detail || '密码修改失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  async function fetchCurrentUser() {
    if (!token.value) return null
    try {
      const response = await authApi.me()
      user.value = response.data
      localStorage.setItem('user', JSON.stringify(response.data))
      return response.data
    } catch (err) {
      logout()
      return null
    }
  }

  return {
    user,
    token,
    loading,
    error,
    isLoggedIn,
    isManager,
    isEmployee,
    mustChangePassword,
    login,
    changePassword,
    logout,
    fetchCurrentUser
  }
})
