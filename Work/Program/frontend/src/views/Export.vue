<template>
  <AppLayout>
    <header class="page-header">
      <div><h1>导出完结单</h1><p class="text-muted">选择项目导出 Excel 格式的季度完结单</p></div>
    </header>

    <!-- 导出配置 -->
    <section class="card export-config">
      <h2>导出配置</h2>
      <div class="config-grid">
        <div class="input-group">
          <label>年份</label>
          <select v-model="exportConfig.year" class="select"><option v-for="y in years" :key="y" :value="y">{{ y }}年</option></select>
        </div>
        <div class="input-group">
          <label>季度</label>
          <select v-model="exportConfig.quarter" class="select">
            <option :value="1">第一季度</option><option :value="2">第二季度</option><option :value="3">第三季度</option><option :value="4">第四季度</option>
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
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { projectsApi, exportsApi } from '../api'
import AppLayout from '../components/AppLayout.vue'
import { getCategoryShort } from '../utils/project'

const userStore = useUserStore()

const loading = ref(true)
const exporting = ref(false)
const projects = ref([])
const selectedProjects = ref([])

const currentYear = new Date().getFullYear()
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3)
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

const exportConfig = reactive({
  year: currentYear,
  quarter: currentQuarter,
  department: userStore.user?.department || '软测部'
})

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
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => window.URL.revokeObjectURL(url), 100)
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
.page-header { margin-bottom: 2rem; }
.page-header h1 { font-family: 'DM Serif Display', serif; font-size: 1.5rem; font-weight: 400; margin-bottom: 0.25rem; }
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
.project-select-item.selected { border-color: var(--accent-primary); background: var(--accent-glow); }
.project-info { flex: 1; }
.project-main { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
.project-code { font-family: monospace; color: var(--text-muted); font-size: 0.85rem; }
.project-name { font-weight: 500; }
.project-meta { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-secondary); }

.export-actions { margin-top: 2rem; display: flex; justify-content: center; }
</style>
