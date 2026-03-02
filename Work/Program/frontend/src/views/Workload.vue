<template>
  <AppLayout>
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

    <div v-if="loading" class="loading-container"><div class="loading-spinner"></div></div>

    <div v-else-if="stats.length === 0" class="empty-state card">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
      <h3>暂无数据</h3>
      <p>该季度暂无已归档的项目工作量记录</p>
    </div>

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
                    <div class="contribution-bar" :style="{ width: Math.min(person.total_contribution, MAX_BAR_CONTRIBUTION) / MAX_BAR_CONTRIBUTION * 100 + '%' }"></div>
                    <span class="contribution-value">{{ person.total_contribution }}%</span>
                  </div>
                </td>
                <td class="text-center">{{ person.projects.length }}</td>
                <td class="text-center">
                  <button class="btn btn-ghost btn-sm" @click="toggleExpand(person.name)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :style="{ transform: expandedPerson === person.name ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </button>
                </td>
              </tr>
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
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { projectsApi } from '../api'
import AppLayout from '../components/AppLayout.vue'

// 进度条最大贡献率（用于计算条形宽度比例）
const MAX_BAR_CONTRIBUTION = 300

const now = new Date()
const currentYear = now.getFullYear()
const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)

const selectedYear = ref(currentYear)
const selectedQuarter = ref(currentQuarter)
const loading = ref(false)
const stats = ref([])
const expandedPerson = ref(null)

const yearOptions = []
for (let y = currentYear - 2; y <= currentYear + 1; y++) yearOptions.push(y)

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
  } finally { loading.value = false }
}

onMounted(fetchStats)
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }
.loading-container { display: flex; justify-content: center; padding: 4rem; }

.filter-bar { display: flex; gap: 1.5rem; align-items: flex-end; margin-bottom: 1.5rem; }
.filter-group { display: flex; flex-direction: column; gap: 0.5rem; }
.filter-group label { font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); }
.filter-group .select { min-width: 160px; }

.stats-section .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.stats-section .section-header h2 { font-size: 1.15rem; font-weight: 600; }

.person-info { display: flex; align-items: center; gap: 0.75rem; }
.avatar-sm { width: 32px; height: 32px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 600; flex-shrink: 0; }
.person-name { font-weight: 500; }

.contribution-bar-wrapper { display: flex; align-items: center; gap: 0.75rem; }
.contribution-bar { height: 8px; background: var(--accent-gradient); border-radius: 4px; min-width: 4px; transition: width 0.5s ease; }
.contribution-value { font-weight: 600; font-size: 0.95rem; white-space: nowrap; }

.person-row { cursor: pointer; }
.person-row.expanded td { border-bottom-color: transparent; }
.detail-row td { padding: 0 !important; }
.detail-content { padding: 0.5rem 1rem 1rem 4.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
.detail-item { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 0.75rem; background: var(--bg-tertiary); border-radius: var(--radius-sm); font-size: 0.9rem; }
.detail-code { font-family: monospace; font-size: 0.8rem; color: var(--text-muted); min-width: 140px; }
.detail-name { flex: 1; }
.detail-pct { flex-shrink: 0; }

@media (max-width: 768px) { .filter-bar { flex-direction: column; } }
</style>
