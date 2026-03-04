<template>
  <AppLayout>
    <header class="page-header">
      <div>
        <h1>仪表盘</h1>
        <p class="text-muted">欢迎回来，{{ userStore.user?.display_name }}</p>
      </div>
      <div class="header-actions" v-if="userStore.isManager">
        <router-link to="/projects/create" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          新建项目
        </router-link>
      </div>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(99, 102, 241, 0.2); color: var(--accent-primary);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">{{ userStore.isManager ? '全部项目' : '我的项目' }}</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--warning-bg); color: var(--warning);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.draft }}</div>
          <div class="stat-label">待分发</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--info-bg); color: var(--info);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.assigned }}</div>
          <div class="stat-label">进行中</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon" style="background: var(--success-bg); color: var(--success);">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.completed }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
    </div>

    <!-- 完结申请通知（仅经理可见） -->
    <div v-if="userStore.isManager && pendingSubmissions.length > 0" class="notice-section">
      <div class="notice-card">
        <div class="notice-header">
          <div class="notice-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </div>
          <h3>完结申请待确认（{{ pendingSubmissions.length }}）</h3>
        </div>
        <div class="notice-list">
          <router-link v-for="p in pendingSubmissions" :key="p.id" :to="`/projects/${p.id}`" class="notice-item">
            <div class="notice-project">
              <span class="notice-name">{{ p.project_name }}</span>
              <code>{{ p.project_code }}</code>
            </div>
            <div class="notice-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: (p.submitted_count / p.total_employee_count * 100) + '%' }"></div>
              </div>
              <span class="progress-text" :class="{ 'all-done': p.submitted_count === p.total_employee_count }">
                {{ p.submitted_count }}/{{ p.total_employee_count }} 人已提交
              </span>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- 最近项目 -->
    <div class="recent-section">
      <div class="section-header">
        <h2>最近项目</h2>
        <router-link to="/projects" class="btn btn-ghost btn-sm">
          查看全部
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </router-link>
      </div>

      <div v-if="loading" class="loading-container"><div class="loading-spinner"></div></div>

      <div v-else-if="recentProjects.length === 0" class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        <h3>暂无项目</h3>
        <p>{{ userStore.isManager ? '点击上方按钮创建第一个项目' : '等待经理分配项目给您' }}</p>
      </div>

      <div v-else class="projects-grid">
        <router-link v-for="project in recentProjects" :key="project.id" :to="`/projects/${project.id}`" class="project-card">
          <div class="project-header">
            <span class="project-code">{{ project.project_code }}</span>
            <span class="badge" :class="getStatusClass(project.status)">{{ getStatusText(project.status) }}</span>
          </div>
          <h3 class="project-name">{{ project.project_name }}</h3>
          <div class="project-info">
            <span>{{ project.client_name || '未填写' }}</span>
            <span>·</span>
            <span>{{ project.project_location || '未填写' }}</span>
          </div>
          <div class="project-footer">
            <span class="badge badge-primary">{{ getCategoryShort(project.business_category) }}</span>
            <span class="systems-count" v-if="project.systems_count > 0">{{ project.systems_count }} 个系统</span>
          </div>
        </router-link>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { projectsApi } from '../api'
import AppLayout from '../components/AppLayout.vue'
import { getCategoryShort, getStatusClass, getStatusText } from '../utils/project'

const userStore = useUserStore()

const loading = ref(true)
const allProjects = ref([])
const recentProjects = ref([])
const stats = reactive({ total: 0, draft: 0, assigned: 0, completed: 0 })

// 有员工提交完结申请的进行中项目（仅经理用）
const pendingSubmissions = computed(() =>
  allProjects.value.filter(p => p.status === 'assigned' && p.submitted_count > 0)
)

async function fetchData() {
  loading.value = true
  try {
    const response = await projectsApi.getAll()
    const projects = response.data
    allProjects.value = projects
    recentProjects.value = projects.slice(0, 6)
    stats.total = projects.length
    stats.draft = projects.filter(p => p.status === 'draft').length
    stats.assigned = projects.filter(p => p.status === 'assigned').length
    stats.completed = projects.filter(p => p.status === 'completed').length
  } catch (err) { console.error('Failed to fetch projects:', err) }
  finally { loading.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }

.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; margin-bottom: 2rem; }
.stat-card { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; display: flex; align-items: center; gap: 1rem; transition: all var(--transition-normal); }
.stat-card:hover { border-color: var(--border-color-hover); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.stat-icon { width: 48px; height: 48px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; }
.stat-value { font-size: 1.75rem; font-weight: 700; }
.stat-label { color: var(--text-muted); font-size: 0.875rem; }

.recent-section { background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: 1.5rem; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.section-header h2 { font-size: 1.25rem; font-weight: 600; }
.loading-container { display: flex; justify-content: center; padding: 3rem; }

.projects-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.project-card { background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; transition: all var(--transition-normal); text-decoration: none; color: inherit; }
.project-card:hover { border-color: var(--accent-primary); box-shadow: 0 0 20px var(--accent-glow); transform: translateY(-2px); }
.project-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
.project-code { font-size: 0.8rem; color: var(--text-muted); font-family: monospace; }
.project-name { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.project-info { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
.project-footer { display: flex; align-items: center; justify-content: space-between; }
.systems-count { font-size: 0.8rem; color: var(--text-muted); }

@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .projects-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .stats-grid, .projects-grid { grid-template-columns: 1fr; }
}

.notice-section { margin-bottom: 2rem; }
.notice-card { background: var(--bg-card); border: 1px solid #f59e0b; border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; }
.notice-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
.notice-header h3 { font-size: 1rem; font-weight: 600; color: #f59e0b; }
.notice-icon { color: #f59e0b; display: flex; }
.notice-list { display: flex; flex-direction: column; gap: 0.6rem; }
.notice-item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); text-decoration: none; color: inherit; transition: all var(--transition-normal); }
.notice-item:hover { border-color: var(--accent-primary); box-shadow: 0 0 12px var(--accent-glow); transform: translateX(4px); }
.notice-project { display: flex; align-items: center; gap: 0.75rem; }
.notice-name { font-weight: 500; }
.notice-progress { display: flex; align-items: center; gap: 0.75rem; }
.progress-bar { width: 80px; height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden; border: 1px solid var(--border-color); }
.progress-fill { height: 100%; background: #f59e0b; border-radius: 3px; transition: width 0.3s; }
.progress-text { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }
.progress-text.all-done { color: #10b981; font-weight: 500; }
</style>
