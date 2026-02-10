/**
 * API 配置和基础请求
 */
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 - 添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期或无效
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ============ 认证 API ============
export const authApi = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me')
}

// ============ 用户 API ============
export const usersApi = {
  getAll: (role) => api.get('/api/users/', { params: { role } }),
  getEmployees: () => api.get('/api/users/employees'),
  getManagers: () => api.get('/api/users/managers'),
  create: (data) => api.post('/api/users/', data),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`)
}

// ============ 项目 API ============
export const projectsApi = {
  getAll: (status) => api.get('/api/projects/', { params: { status } }),
  get: (id) => api.get(`/api/projects/${id}`),
  create: (data) => api.post('/api/projects/', data),
  update: (id, data) => api.put(`/api/projects/${id}`, data),
  delete: (id) => api.delete(`/api/projects/${id}`),

  // 系统
  addSystem: (projectId, data) => api.post(`/api/projects/${projectId}/systems`, data),
  deleteSystem: (projectId, systemId) => api.delete(`/api/projects/${projectId}/systems/${systemId}`),

  // 分配
  assign: (projectId, data) => api.post(`/api/projects/${projectId}/assign`, data),
  getAssignments: (projectId) => api.get(`/api/projects/${projectId}/assignments`),
  updateContribution: (projectId, data) => api.put(`/api/projects/${projectId}/contribution`, data),
  getWorkloadStats: (year, quarter) => api.get('/api/projects/workload-stats', { params: { year, quarter } })
}

// ============ 导出 API ============
export const exportsApi = {
  excel: (data) => api.post('/api/exports/excel', data, { responseType: 'blob' }),
  word: (projectId) => api.post(`/api/exports/word/${projectId}`, {}, { responseType: 'blob' })
}

export default api
