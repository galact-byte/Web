/**
 * 用户状态管理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'

export const useUserStore = defineStore('user', () => {
  // 状态
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const token = ref(localStorage.getItem('token') || '')
  const loading = ref(false)
  const error = ref('')

  // 计算属性
  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isManager = computed(() => user.value?.role === 'manager')
  const isEmployee = computed(() => user.value?.role === 'employee')

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

  async function register(userData) {
    loading.value = true
    error.value = ''
    try {
      const response = await authApi.register(userData)
      const data = response.data
      
      token.value = data.access_token
      user.value = data.user
      
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      return data.user
    } catch (err) {
      error.value = err.response?.data?.detail || '注册失败'
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
    login,
    register,
    logout,
    fetchCurrentUser
  }
})
