<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header"><div class="logo"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div><span class="logo-text">完结单平台</span></div>
      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg><span>仪表盘</span></router-link>
        <router-link to="/projects" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span>项目管理</span></router-link>
        <router-link to="/workload" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg><span>工作量统计</span></router-link>
        <router-link to="/export" class="nav-item active"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>导出完结单</span></router-link>
        <router-link v-if="userStore.isManager" to="/users" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg><span>用户管理</span></router-link>
      </nav>
      <div class="sidebar-footer"><div class="user-info"><div class="avatar">{{ userStore.user?.display_name?.charAt(0) || 'U' }}</div><div class="user-details"><div class="user-name">{{ userStore.user?.display_name }}</div><div class="user-role">{{ userStore.isManager ? '经理' : '员工' }}</div></div></div><div class="footer-actions"><button class="btn-theme" @click="toggleTheme" :title="isDark ? '切换浅色主题' : '切换深色主题'"><svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg><svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button><button class="btn-logout" @click="handleLogout"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></button></div></div>
    </aside>

    <main class="main-content">
      <header class="page-header">
        <div><h1>导出完结单</h1><p class="text-muted">选择项目导出 Excel 格式的季度完结单</p></div>
      </header>

      <!-- 导出配置 -->
      <section class="card export-config">
        <h2>导出配置</h2>
        <div class="config-grid">
          <div class="input-group">
            <label>年份</label>
            <select v-model="exportConfig.year" class="select">
              <option v-for="y in years" :key="y" :value="y">{{ y }}年</option>
            </select>
          </div>
          <div class="input-group">
            <label>季度</label>
            <select v-model="exportConfig.quarter" class="select">
              <option :value="1">第一季度</option>
              <option :value="2">第二季度</option>
              <option :value="3">第三季度</option>
              <option :value="4">第四季度</option>
            </select>
          </div>
          <div class="input-group">
            <label>部门</label>
            <input v-model="exportConfig.department" class="input" placeholder="软测部" />
          </div>
        </div>
      </section>

      <!-- 项目选择 -->
      <section class="card">
        <div class="section-header">
          <h2>选择项目</h2>
          <div class="select-actions">
            <button class="btn btn-ghost btn-sm" @click="selectAll">全选</button>
            <button class="btn btn-ghost btn-sm" @click="deselectAll">取消全选</button>
            <span class="select-count">已选择 {{ selectedProjects.length }} 个项目</span>
          </div>
        </div>

        <div v-if="loading" class="loading-container"><div class="loading-spinner"></div></div>

        <div v-else-if="projects.length === 0" class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <h3>暂无项目</h3>
        </div>

        <div v-else class="projects-list">
          <label v-for="project in projects" :key="project.id" class="project-select-item" :class="{ selected: selectedProjects.includes(project.id) }">
            <div class="checkbox" :class="{ checked: selectedProjects.includes(project.id) }" @click.stop="toggleProject(project.id)">
              <svg v-if="selectedProjects.includes(project.id)" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div class="project-info">
              <div class="project-main">
                <span class="project-code">{{ project.project_code }}</span>
                <span class="project-name">{{ project.project_name }}</span>
              </div>
              <div class="project-meta">
                <span class="badge badge-primary">{{ getCategoryShort(project.business_category) }}</span>
                <span>{{ project.client_name || '/' }}</span>
                <span>{{ project.systems_count }} 个系统</span>
              </div>
            </div>
          </label>
        </div>
      </section>

      <!-- 导出按钮 -->
      <div class="export-actions">
        <button class="btn btn-primary btn-lg" @click="exportExcel" :disabled="selectedProjects.length === 0 || exporting">
          <svg v-if="!exporting" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          {{ exporting ? '导出中...' : '导出 Excel' }}
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectsApi, exportsApi } from '../api'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const exporting = ref(false)
const projects = ref([])
const selectedProjects = ref([])
const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')

const currentYear = new Date().getFullYear()
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

const exportConfig = reactive({
  year: currentYear,
  quarter: currentQuarter,
  department: '软测部'
})

const categoryMap = { '等保测评': '等保', '密码评估': '密评', '风险评估': '风评', '安全评估': '安评', '数据评估': '数评', '软件测试': '软测', '安全服务': '安服', '其他': '其他' }
function getCategoryShort(cat) { return categoryMap[cat] || cat }

function handleLogout() { userStore.logout(); router.push('/login') }
function toggleTheme() { isDark.value = !isDark.value; const t = isDark.value ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t) }

function toggleProject(id) {
  const idx = selectedProjects.value.indexOf(id)
  if (idx >= 0) selectedProjects.value.splice(idx, 1)
  else selectedProjects.value.push(id)
}

function selectAll() { selectedProjects.value = projects.value.map(p => p.id) }
function deselectAll() { selectedProjects.value = [] }

async function exportExcel() {
  exporting.value = true
  try {
    const response = await exportsApi.excel({
      project_ids: selectedProjects.value,
      year: exportConfig.year,
      quarter: exportConfig.quarter,
      department: exportConfig.department
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `${exportConfig.year}年第${exportConfig.quarter}季度项目完结单.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (err) { console.error(err); alert('导出失败') }
  finally { exporting.value = false }
}

async function fetchProjects() {
  loading.value = true
  try {
    const response = await projectsApi.getAll()
    projects.value = response.data
  } catch (err) { console.error(err) }
  finally { loading.value = false }
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
.avatar { width: 36px; height: 36px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; }
.user-name { font-weight: 500; font-size: 0.9rem; }
.user-role { font-size: 0.75rem; color: var(--text-muted); }
.footer-actions { display: flex; align-items: center; gap: 0.25rem; }
.btn-theme, .btn-logout { padding: 0.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); }
.btn-theme:hover { background: rgba(99, 102, 241, 0.15); color: var(--accent-primary); }
.btn-logout:hover { background: var(--error-bg); color: var(--error); }

.main-content { flex: 1; margin-left: 260px; padding: 2rem; }
.page-header { margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }

.loading-container { display: flex; justify-content: center; padding: 3rem; }

.export-config { margin-bottom: 1.5rem; }
.export-config h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; }
.config-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }

.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.section-header h2 { font-size: 1.1rem; font-weight: 600; margin: 0; }
.select-actions { display: flex; align-items: center; gap: 0.75rem; }
.select-count { color: var(--text-muted); font-size: 0.9rem; }

.projects-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; overflow-y: auto; }
.project-select-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.project-select-item:hover { border-color: var(--border-color-hover); }
.project-select-item.selected { border-color: var(--accent-primary); background: rgba(99, 102, 241, 0.1); }
.project-info { flex: 1; }
.project-main { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
.project-code { font-family: monospace; color: var(--text-muted); font-size: 0.85rem; }
.project-name { font-weight: 500; }
.project-meta { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-secondary); }

.export-actions { margin-top: 2rem; display: flex; justify-content: center; }
</style>
