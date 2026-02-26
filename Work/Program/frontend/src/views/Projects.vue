<template>
  <div class="layout">
    <!-- 侧边栏复用 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
        </div>
        <span class="logo-text">完结单平台</span>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>仪表盘</span>
        </router-link>
        <router-link to="/projects" class="nav-item active">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>项目管理</span>
        </router-link>
        <router-link to="/export" class="nav-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>导出完结单</span>
        </router-link>
        <router-link v-if="userStore.isManager" to="/users" class="nav-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>用户管理</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="avatar">{{ userStore.user?.display_name?.charAt(0) || 'U' }}</div>
          <div class="user-details">
            <div class="user-name">{{ userStore.user?.display_name }}</div>
            <div class="user-role">{{ userStore.isManager ? '经理' : '员工' }}</div>
          </div>
        </div>
        <button class="btn-logout" @click="handleLogout" title="退出登录">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </aside>

    <!-- 主内容 -->
    <main class="main-content">
      <header class="page-header">
        <div>
          <h1>项目管理</h1>
          <p class="text-muted">管理所有项目和系统信息</p>
        </div>
        <div class="header-actions">
          <div class="filter-group">
            <select v-model="statusFilter" class="select" style="width: 140px;">
              <option value="">全部状态</option>
              <option value="draft">待分发</option>
              <option value="assigned">进行中</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          <router-link v-if="userStore.isManager" to="/projects/create" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            新建项目
          </router-link>
        </div>
      </header>

      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
      </div>

      <div v-else-if="filteredProjects.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3>暂无项目</h3>
        <p>{{ userStore.isManager ? '点击右上角按钮创建第一个项目' : '等待经理分配项目' }}</p>
      </div>

      <div v-else class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>项目编号</th>
              <th>项目名称</th>
              <th>客户单位</th>
              <th>业务类别</th>
              <th>项目地点</th>
              <th>系统数</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in filteredProjects" :key="project.id">
              <td><code>{{ project.project_code }}</code></td>
              <td>
                <router-link :to="`/projects/${project.id}`" class="project-link">
                  {{ project.project_name }}
                </router-link>
              </td>
              <td>{{ project.client_name || '/' }}</td>
              <td><span class="badge badge-primary">{{ getCategoryShort(project.business_category) }}</span></td>
              <td>{{ project.project_location || '/' }}</td>
              <td>{{ project.systems_count }}</td>
              <td>
                <span class="badge" :class="getStatusClass(project.status)">
                  {{ getStatusText(project.status) }}
                </span>
              </td>
              <td>
                <div class="action-btns">
                  <router-link :to="`/projects/${project.id}`" class="btn btn-ghost btn-sm" title="查看">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </router-link>
                  <router-link v-if="userStore.isManager" :to="`/projects/${project.id}/edit`" class="btn btn-ghost btn-sm" title="编辑">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </router-link>
                  <button v-if="userStore.isManager" class="btn btn-ghost btn-sm" @click="confirmDelete(project)" title="删除">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 删除确认模态框 -->
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
        <div class="modal">
          <div class="modal-header">
            <h2>确认删除</h2>
            <button class="btn btn-ghost" @click="showDeleteModal = false">✕</button>
          </div>
          <div class="modal-body">
            <p>确定要删除项目 <strong>{{ projectToDelete?.project_name }}</strong> 吗？</p>
            <p class="text-muted mt-1">此操作不可撤销，相关的系统和分配记录也将被删除。</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showDeleteModal = false">取消</button>
            <button class="btn btn-danger" @click="deleteProject" :disabled="deleting">
              {{ deleting ? '删除中...' : '确认删除' }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectsApi } from '../api'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const projects = ref([])
const statusFilter = ref('')
const showDeleteModal = ref(false)
const projectToDelete = ref(null)
const deleting = ref(false)

const categoryMap = {
  '等保测评': '等保', '密码评估': '密评', '风险评估': '风评',
  '安全评估': '安评', '数据评估': '数评', '软件测试': '软测',
  '安全服务': '安服', '其他': '其他'
}

const filteredProjects = computed(() => {
  if (!statusFilter.value) return projects.value
  return projects.value.filter(p => p.status === statusFilter.value)
})

function getCategoryShort(category) {
  return categoryMap[category] || category
}

function getStatusClass(status) {
  return { draft: 'badge-warning', assigned: 'badge-info', completed: 'badge-success' }[status] || 'badge-info'
}

function getStatusText(status) {
  return { draft: '待分发', assigned: '进行中', completed: '已完成' }[status] || status
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

function confirmDelete(project) {
  projectToDelete.value = project
  showDeleteModal.value = true
}

async function deleteProject() {
  if (!projectToDelete.value) return
  deleting.value = true
  try {
    await projectsApi.delete(projectToDelete.value.id)
    projects.value = projects.value.filter(p => p.id !== projectToDelete.value.id)
    showDeleteModal.value = false
  } catch (err) {
    console.error('Delete failed:', err)
  } finally {
    deleting.value = false
  }
}

async function fetchProjects() {
  loading.value = true
  try {
    const response = await projectsApi.getAll()
    projects.value = response.data
  } catch (err) {
    console.error('Fetch failed:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchProjects)
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 260px; background: var(--bg-secondary); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
.sidebar-header { display: flex; align-items: center; gap: 0.75rem; padding: 1.5rem; border-bottom: 1px solid var(--border-color); }
.logo { width: 40px; height: 40px; background: var(--accent-gradient); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; color: white; }
.logo-text { font-size: 1.1rem; font-weight: 600; }
.sidebar-nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
.nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; color: var(--text-secondary); border-radius: var(--radius-md); transition: all var(--transition-fast); text-decoration: none; }
.nav-item:hover { background: var(--bg-tertiary); color: var(--text-primary); }
.nav-item.active { background: rgba(99, 102, 241, 0.15); color: var(--accent-primary); }
.sidebar-footer { padding: 1rem; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; }
.user-info { display: flex; align-items: center; gap: 0.75rem; }
.avatar { width: 36px; height: 36px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.9rem; }
.user-name { font-weight: 500; font-size: 0.9rem; }
.user-role { font-size: 0.75rem; color: var(--text-muted); }
.btn-logout { padding: 0.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); transition: all var(--transition-fast); }
.btn-logout:hover { background: var(--error-bg); color: var(--error); }

.main-content { flex: 1; margin-left: 260px; padding: 2rem; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }
.header-actions { display: flex; gap: 1rem; align-items: center; }
.filter-group { display: flex; gap: 0.5rem; }

.loading-container { display: flex; justify-content: center; padding: 4rem; }
.project-link { color: var(--accent-primary); font-weight: 500; }
.project-link:hover { text-decoration: underline; }
.action-btns { display: flex; gap: 0.25rem; }

code { background: var(--bg-tertiary); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
</style>
