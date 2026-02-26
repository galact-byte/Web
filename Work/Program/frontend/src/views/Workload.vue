<template>
  <div class="layout">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <span class="logo-text">完结单平台</span>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          <span>仪表盘</span>
        </router-link>
        <router-link to="/projects" class="nav-item" :class="{ active: $route.path.startsWith('/projects') }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span>项目管理</span>
        </router-link>
        <router-link to="/workload" class="nav-item active">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
          <span>工作量统计</span>
        </router-link>
        <router-link to="/export" class="nav-item" :class="{ active: $route.path === '/export' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>导出完结单</span>
        </router-link>
        <router-link v-if="userStore.isManager" to="/users" class="nav-item" :class="{ active: $route.path === '/users' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
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
        <div class="footer-actions">
          <button class="btn-theme" @click="toggleTheme" :title="isDark ? '切换浅色主题' : '切换深色主题'">
            <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>
          <button class="btn-logout" @click="handleLogout" title="退出登录">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <header class="page-header">
        <div>
          <h1>工作量统计</h1>
          <p class="text-muted">按季度统计各人员的贡献率汇总</p>
        </div>
      </header>

      <!-- 筛选栏 -->
      <div class="filter-bar card">
        <div class="filter-group">
          <label>年份</label>
          <select v-model="selectedYear" class="select" @change="fetchStats">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }} 年</option>
          </select>
        </div>
        <div class="filter-group">
          <label>季度</label>
          <select v-model="selectedQuarter" class="select" @change="fetchStats">
            <option :value="1">第一季度 (1-3月)</option>
            <option :value="2">第二季度 (4-6月)</option>
            <option :value="3">第三季度 (7-9月)</option>
            <option :value="4">第四季度 (10-12月)</option>
          </select>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-container">
        <div class="loading-spinner"></div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="stats.length === 0" class="empty-state card">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path>
        </svg>
        <h3>暂无数据</h3>
        <p>该季度暂无已归档的项目工作量记录</p>
      </div>

      <!-- 统计表格 -->
      <div v-else class="stats-section card">
        <div class="section-header">
          <h2>{{ selectedYear }} 年第 {{ selectedQuarter }} 季度 — 人员工作量</h2>
          <span class="badge badge-primary">共 {{ stats.length }} 人</span>
        </div>

        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th style="width: 60px;">序号</th>
                <th>姓名</th>
                <th style="width: 140px;">总贡献率</th>
                <th style="width: 100px;">参与项目数</th>
                <th style="width: 80px;">详情</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(person, idx) in stats" :key="person.name">
                <tr class="person-row" :class="{ expanded: expandedPerson === person.name }">
                  <td class="text-center">{{ idx + 1 }}</td>
                  <td>
                    <div class="person-info">
                      <div class="avatar-sm">{{ person.name.charAt(0) }}</div>
                      <span class="person-name">{{ person.name }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="contribution-bar-wrapper">
                      <div class="contribution-bar" :style="{ width: Math.min(person.total_contribution, 300) / 3 + '%' }"></div>
                      <span class="contribution-value">{{ person.total_contribution }}%</span>
                    </div>
                  </td>
                  <td class="text-center">{{ person.projects.length }}</td>
                  <td class="text-center">
                    <button class="btn btn-ghost btn-sm" @click="toggleExpand(person.name)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :style="{ transform: expandedPerson === person.name ? 'rotate(180deg)' : '' , transition: 'transform 0.2s' }">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                  </td>
                </tr>
                <!-- 展开的项目明细 -->
                <tr v-if="expandedPerson === person.name" class="detail-row">
                  <td colspan="5">
                    <div class="detail-content">
                      <div v-for="proj in person.projects" :key="proj.project_code" class="detail-item">
                        <span class="detail-code">{{ proj.project_code }}</span>
                        <span class="detail-name">{{ proj.project_name }}</span>
                        <span class="detail-pct badge badge-info">{{ proj.contribution }}%</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectsApi } from '../api'

const router = useRouter()
const userStore = useUserStore()

const now = new Date()
const currentYear = now.getFullYear()
const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)

const selectedYear = ref(currentYear)
const selectedQuarter = ref(currentQuarter)
const loading = ref(false)
const stats = ref([])
const expandedPerson = ref(null)

// 生成年份选项：当前年份 前后各2年
const yearOptions = []
for (let y = currentYear - 2; y <= currentYear + 1; y++) {
  yearOptions.push(y)
}

const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')

function toggleTheme() {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

function toggleExpand(name) {
  expandedPerson.value = expandedPerson.value === name ? null : name
}

async function fetchStats() {
  loading.value = true
  try {
    const res = await projectsApi.getWorkloadStats(selectedYear.value, selectedQuarter.value)
    stats.value = res.data.stats || []
  } catch (err) {
    console.error('Failed to fetch workload stats:', err)
    stats.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }

/* 侧边栏 - 复用 Dashboard 样式 */
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
.footer-actions { display: flex; align-items: center; gap: 0.25rem; }
.btn-theme,
.btn-logout { padding: 0.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); transition: all var(--transition-fast); }
.btn-theme:hover { background: rgba(99, 102, 241, 0.15); color: var(--accent-primary); }
.btn-logout:hover { background: var(--error-bg); color: var(--error); }

/* 主内容 */
.main-content { flex: 1; margin-left: 260px; padding: 2rem; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }

.loading-container { display: flex; justify-content: center; padding: 4rem; }

/* 筛选栏 */
.filter-bar { display: flex; gap: 1.5rem; align-items: flex-end; margin-bottom: 1.5rem; }
.filter-group { display: flex; flex-direction: column; gap: 0.5rem; }
.filter-group label { font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); }
.filter-group .select { min-width: 160px; }

/* 统计区域 */
.stats-section .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.stats-section .section-header h2 { font-size: 1.15rem; font-weight: 600; }

/* 人员信息 */
.person-info { display: flex; align-items: center; gap: 0.75rem; }
.avatar-sm { width: 32px; height: 32px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 600; flex-shrink: 0; }
.person-name { font-weight: 500; }

/* 贡献率进度条 */
.contribution-bar-wrapper { display: flex; align-items: center; gap: 0.75rem; }
.contribution-bar { height: 8px; background: var(--accent-gradient); border-radius: 4px; min-width: 4px; transition: width 0.5s ease; }
.contribution-value { font-weight: 600; font-size: 0.95rem; white-space: nowrap; }

/* 展开行 */
.person-row { cursor: pointer; }
.person-row.expanded td { border-bottom-color: transparent; }
.detail-row td { padding: 0 !important; }
.detail-content { padding: 0.5rem 1rem 1rem 4.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
.detail-item { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 0.75rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); font-size: 0.9rem; }
.detail-code { font-family: monospace; font-size: 0.8rem; color: var(--text-muted); min-width: 140px; }
.detail-name { flex: 1; }
.detail-pct { flex-shrink: 0; }

/* 响应式 */
@media (max-width: 768px) {
  .sidebar { width: 100%; height: auto; position: relative; }
  .main-content { margin-left: 0; }
  .filter-bar { flex-direction: column; }
}
</style>
