/**
 * 用户状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'

function safeParseUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    localStorage.removeItem('user')
    return null
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
      const response = await authApi.login(credentials)
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

  async function changePassword(newPassword) {
    loading.value = true
    error.value = ''
    try {
      await authApi.changePassword({ new_password: newPassword })
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
