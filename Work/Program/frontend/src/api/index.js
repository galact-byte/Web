/**
 * API 配置和基础请求
 */
import axios from 'axios'
import router from '../router'

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
      router.push('/login')
    }
    return Promise.reject(error)
  }
)

// ============ 认证 API ============
export const authApi = {
  login: (data) => api.post('/api/auth/login', data),
  changePassword: (data) => api.post('/api/auth/change-password', data),
  me: () => api.get('/api/auth/me')
}

// ============ 用户 API ============
export const usersApi = {
  getAll: (role) => api.get('/api/users/', { params: { role } }),
  getEmployees: () => api.get('/api/users/employees'),
  getManagers: () => api.get('/api/users/managers'),
  create: (data) => api.post('/api/users/', data),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`),
  resetPassword: (id) => api.post(`/api/users/${id}/reset-password`)
}

// ============ 项目 API ============
export const projectsApi = {
  getAll: (status) => api.get('/api/projects/', { params: { status } }),
  get: (id) => api.get(`/api/projects/${id}`),
  create: (data) => api.post('/api/projects/', data),
  update: (id, data) => api.put(`/api/projects/${id}`, data),
  delete: (id) => api.delete(`/api/projects/${id}`),
  updateStatus: (id, status) => api.patch(`/api/projects/${id}/status`, null, { params: { new_status: status } }),

  // 分配
  assign: (projectId, data) => api.post(`/api/projects/${projectId}/assign`, data),
  getAssignments: (projectId) => api.get(`/api/projects/${projectId}/assignments`),
  updateContribution: (projectId, data) => api.put(`/api/projects/${projectId}/contribution`, data),
  updateAssignment: (projectId, assignmentId, data) => api.put(`/api/projects/${projectId}/assignments/${assignmentId}`, data),
  deleteAssignment: (projectId, assignmentId) => api.delete(`/api/projects/${projectId}/assignments/${assignmentId}`),
  addContribution: (projectId, data) => api.post(`/api/projects/${projectId}/contributions`, data),
  submitCompletion: (projectId) => api.patch(`/api/projects/${projectId}/submit-completion`),
  retractCompletion: (projectId) => api.patch(`/api/projects/${projectId}/retract-completion`),
  getWorkloadStats: (year, quarter) => api.get('/api/projects/workload-stats', { params: { year, quarter } })
}

// ============ 导出 API ============
export const exportsApi = {
  excel: (data) => api.post('/api/exports/excel', data, { responseType: 'blob' }),
  word: (projectId) => api.post(`/api/exports/word/${projectId}`, {}, { responseType: 'blob' })
}

// ============ 备份恢复 API ============
export const backupApi = {
  exportJson: () => api.post('/api/backup/export', {}, { responseType: 'blob' }),
  downloadDb: () => api.get('/api/backup/download-db', { responseType: 'blob' }),
  importJson: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/api/backup/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }
}

export default api
