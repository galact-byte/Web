<template>
  <AppLayout>
    <header class="page-header">
      <div class="header-left">
        <h1>{{ typeName }}</h1>
        <span class="record-count" v-if="total > 0">共 {{ total }} 条记录</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" @click="handleScrape" :disabled="scraping" v-if="userStore.isManager">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          {{ scraping ? '爬取中...' : '手动爬取' }}
        </button>
        <div v-if="userStore.isManager" class="schedule-controls">
          <template v-if="!scheduleEnabled">
            <select v-model="scheduleInterval" class="input input-sm schedule-select">
              <option :value="10">10分钟</option>
              <option :value="30">30分钟</option>
              <option :value="60">1小时</option>
              <option :value="120">2小时</option>
              <option :value="360">6小时</option>
              <option :value="720">12小时</option>
              <option :value="1440">24小时</option>
            </select>
            <button class="btn btn-sm btn-secondary" @click="startSchedule">开启定时</button>
          </template>
          <template v-else>
            <span class="schedule-status">定时爬取中（{{ formatInterval(scheduleInterval) }}）</span>
            <button class="btn btn-sm btn-warning" @click="stopSchedule">关闭定时</button>
          </template>
        </div>
        <button v-if="userStore.isManager" class="btn btn-sm btn-secondary" @click="handleBackfill">回填联系人</button>
        <button class="btn btn-secondary" @click="handleExport" :disabled="total === 0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          导出 Excel
        </button>
        <div class="search-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input v-model="searchText" placeholder="搜索系统/客户/项目/经理..." @keyup.enter="fetchRecords(true)" />
        </div>
        <div class="col-toggle-wrap">
          <button class="btn btn-ghost" @click="showColToggle = !showColToggle" title="列显隐">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>
          </button>
          <div v-show="showColToggle" class="col-toggle-dropdown">
            <label v-for="col in ALL_COLUMNS" :key="col.key" class="col-toggle-item">
              <input type="checkbox" :checked="visibleCols.has(col.key)" @change="toggleCol(col.key)" />
              {{ col.label }}
            </label>
          </div>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="records.length === 0 && !searchText" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
      <h3>暂无数据</h3>
      <p>点击「手动爬取」从项目管理系统获取{{ typeName }}数据</p>
    </div>

    <!-- No search results -->
    <div v-else-if="records.length === 0 && searchText" class="empty-state">
      <h3>未找到匹配记录</h3>
      <p>尝试调整搜索关键词</p>
    </div>

    <!-- Data table -->
    <div v-else>
      <!-- 顶部同步滚动条 -->
      <div class="top-scrollbar" ref="topScrollbar" @scroll="syncScroll('top')">
        <div class="top-scrollbar-inner" :style="{ width: tableScrollWidth + 'px' }"></div>
      </div>
      <div class="table-wrapper" ref="tableWrapper" @scroll="syncScroll('table')">
        <table ref="dataTable">
          <thead>
            <tr>
              <th v-for="col in shownColumns" :key="col.key">{{ col.label }}</th>
              <th v-if="userStore.isManager" class="th-action">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records" :key="r.id">
              <td v-for="col in shownColumns" :key="col.key" :class="col.cls" :title="col.cls === 'cell-name' ? r[col.key] : undefined">
                <template v-if="col.key === 'project_status'">
                  <span class="badge" :class="statusClass(r.project_status)">{{ r.project_status || '-' }}</span>
                </template>
                <template v-else-if="col.key === 'is_finished'">
                  <span class="badge" :class="finishClass(r.is_finished)">{{ r.is_finished || '-' }}</span>
                </template>
                <template v-else>{{ r[col.key] }}</template>
              </td>
              <td v-if="userStore.isManager" class="td-action">
                <span v-if="r.distributed" class="badge badge-distributed">已分发</span>
                <button v-else-if="!isFinishedRecord(r)" class="btn btn-sm btn-distribute" @click="openDistribute(r)">分发</button>
                <span v-else class="text-muted">{{ r.project_status || '-' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    <!-- Pagination -->
      <div class="pagination" v-if="totalPages > 1">
        <button class="btn btn-ghost" :disabled="currentPage === 1" @click="goPage(currentPage - 1)">上一页</button>
        <button v-for="p in visiblePages" :key="p" class="page-btn" :class="{ active: p === currentPage, ellipsis: p === '...' }" :disabled="p === '...'" @click="p !== '...' && goPage(p)">{{ p }}</button>
        <button class="btn btn-ghost" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)">下一页</button>
        <span class="page-jump">
          <input type="number" v-model.number="jumpPage" min="1" :max="totalPages" @keyup.enter="doJump" />
          <button class="btn btn-ghost" @click="doJump">跳转</button>
        </span>
      </div>
    </div>

    <!-- Scrape logs -->
    <div class="logs-section" v-if="logs.length > 0">
      <button class="logs-toggle" @click="showLogs = !showLogs">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="12 8 12 12 14 14"></polyline><circle cx="12" cy="12" r="10"></circle></svg>
        最近爬取记录 ({{ logs.length }})
        <svg class="chevron" :class="{ open: showLogs }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div v-show="showLogs" class="logs-list">
        <div v-for="log in logs" :key="log.id" class="log-item" :class="log.status">
          <span class="log-status">{{ log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : '运行中' }}</span>
          <span class="log-count">{{ log.total_records }} 条</span>
          <span class="log-duration" v-if="log.duration_seconds">{{ log.duration_seconds }}s</span>
          <span class="log-time">{{ formatTime(log.started_at) }}</span>
          <span class="log-error" v-if="log.error_message" :title="log.error_message">{{ log.error_message.slice(0, 60) }}</span>
        </div>
      </div>
    </div>

    <!-- 分发弹窗 -->
    <div v-if="showDistributeModal" class="modal-overlay" @click.self="showDistributeModal = false">
      <div class="modal-content">
        <h3>分发项目</h3>
        <div class="modal-info">
          <p><strong>系统名称：</strong>{{ distributeRecord?.system_name || '-' }}</p>
          <p><strong>项目名称：</strong>{{ distributeRecord?.project_name || '-' }}</p>
          <p><strong>客户名称：</strong>{{ distributeRecord?.customer_name || '-' }}</p>
        </div>
        <div class="modal-field">
          <label>选择分发员工：</label>
          <div class="employee-list">
            <label v-for="emp in employees" :key="emp.id" class="employee-item">
              <input type="checkbox" :value="emp.id" v-model="selectedEmployees" />
              <span>{{ emp.display_name }}</span>
              <span class="emp-dept" v-if="emp.department">{{ emp.department }}</span>
            </label>
            <p v-if="employees.length === 0" class="no-employees">暂无可分配员工</p>
          </div>
        </div>
        <div class="modal-field">
          <label>分发备注：</label>
          <textarea v-model="distributeRemark" class="input distribute-remark" rows="3" placeholder="描述项目紧急度、注意事项等（可选）"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showDistributeModal = false">取消</button>
          <button class="btn btn-primary" @click="handleDistribute" :disabled="selectedEmployees.length === 0 || distributing">
            {{ distributing ? '分发中...' : '确认分发' }}
          </button>
        </div>
      </div>
    </div>
    <Toast :message="toastMsg" :type="toastType" @done="toastMsg = ''" />
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import Toast from '../components/Toast.vue'
import { useUserStore } from '../stores/user'
import { progressApi, usersApi } from '../api/index'

const route = useRoute()
const userStore = useUserStore()

const PROJECT_TYPES = {
  dengbao: '等保测评',
  password: '密码评估',
  security: '安全评估',
  risk: '风险评估',
  testing: '软件测试',
  service: '安全服务',
  comprehensive: '综合服务',
}

const projectType = computed(() => route.params.type || 'dengbao')
const typeName = computed(() => PROJECT_TYPES[projectType.value] || projectType.value)

const ALL_COLUMNS = [
  { key: 'system_id', label: '系统编号', cls: 'cell-mono' },
  { key: 'system_name', label: '系统名称', cls: 'cell-name' },
  { key: 'customer_name', label: '客户单位名称' },
  { key: 'system_level', label: '系统级别' },
  { key: 'system_tag', label: '系统标签' },
  { key: 'business_type', label: '业务类型' },
  { key: 'project_name', label: '项目名称', cls: 'cell-name' },
  { key: 'project_code', label: '项目编号' },
  { key: 'project_location', label: '项目地点' },
  { key: 'init_status', label: '立项状态' },
  { key: 'project_manager', label: '项目经理' },
  { key: 'pm_department', label: '项目部门' },
  { key: 'sale_contact', label: '销售负责人' },
  { key: 'required_start_date', label: '要求进场时间' },
  { key: 'required_end_date', label: '要求完结时间' },
  { key: 'actual_start_date', label: '实施开始日期' },
  { key: 'actual_end_date', label: '实施结束日期' },
  { key: 'project_status', label: '项目状态' },
  { key: 'is_finished', label: '是否完结' },
  { key: 'plan_printed', label: '方案打印' },
  { key: 'report_printed', label: '报告打印' },
  { key: 'register_status', label: '备案状态' },
  { key: 'contract_status', label: '合同状态' },
  { key: 'remark', label: '备注' },
  { key: 'contact_name', label: '客户联系人' },
  { key: 'contact_phone', label: '联系电话' },
]

const DEFAULT_VISIBLE = ['system_id', 'system_name', 'customer_name', 'system_level', 'project_name', 'project_location', 'project_manager', 'sale_contact', 'project_status', 'plan_printed', 'report_printed', 'register_status', 'contract_status', 'remark', 'contact_name', 'contact_phone']
const visibleCols = ref(new Set(DEFAULT_VISIBLE))
const showColToggle = ref(false)

const shownColumns = computed(() => ALL_COLUMNS.filter(c => visibleCols.value.has(c.key)))

function toggleCol(key) {
  const s = new Set(visibleCols.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  visibleCols.value = s
}

const loading = ref(true)
const scraping = ref(false)
const records = ref([])
const total = ref(0)

// toast 通知
const toastMsg = ref('')
const toastType = ref('success')
function showToast(msg, type = 'success') {
  toastMsg.value = ''
  nextTick(() => { toastMsg.value = msg; toastType.value = type })
}
const currentPage = ref(1)
const pageSize = 50
const searchText = ref('')
const logs = ref([])
const showLogs = ref(false)

// 定时爬取
const scheduleEnabled = ref(false)
const scheduleInterval = ref(60)

// 分发相关
const employees = ref([])
const showDistributeModal = ref(false)

// 顶部同步滚动条
const topScrollbar = ref(null)
const tableWrapper = ref(null)
const dataTable = ref(null)
const tableScrollWidth = ref(0)
let scrollingSrc = null

function syncScroll(source) {
  if (scrollingSrc && scrollingSrc !== source) return
  scrollingSrc = source
  const from = source === 'top' ? topScrollbar.value : tableWrapper.value
  const to = source === 'top' ? tableWrapper.value : topScrollbar.value
  if (from && to) to.scrollLeft = from.scrollLeft
  requestAnimationFrame(() => { scrollingSrc = null })
}

function updateScrollWidth() {
  if (dataTable.value) {
    tableScrollWidth.value = dataTable.value.scrollWidth
  }
}
const distributeRecord = ref(null)
const selectedEmployees = ref([])
const distributing = ref(false)
const distributeRemark = ref('')

const totalPages = computed(() => Math.ceil(total.value / pageSize))
const jumpPage = ref(1)

const visiblePages = computed(() => {
  const t = totalPages.value
  const c = currentPage.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const pages = []
  pages.push(1)
  if (c > 3) pages.push('...')
  for (let i = Math.max(2, c - 1); i <= Math.min(t - 1, c + 1); i++) pages.push(i)
  if (c < t - 2) pages.push('...')
  pages.push(t)
  return pages
})

function doJump() {
  const p = jumpPage.value
  if (p >= 1 && p <= totalPages.value) goPage(p)
}

function statusClass(val) {
  if (!val) return 'badge-default'
  if (val.includes('完成') || val.includes('完结')) return 'badge-success'
  if (val.includes('进行') || val.includes('实施')) return 'badge-primary'
  return 'badge-default'
}

function finishClass(val) {
  if (!val) return 'badge-default'
  if (val === '是' || val.includes('已完结')) return 'badge-success'
  return 'badge-warning'
}

function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN')
}

// 定时爬取操作
async function fetchScheduleStatus() {
  try {
    const res = await progressApi.getScheduleStatus()
    scheduleEnabled.value = res.data.enabled
    scheduleInterval.value = res.data.interval_minutes || 60
  } catch (err) { /* 非致命 */ }
}

async function startSchedule() {
  try {
    await progressApi.startSchedule(scheduleInterval.value)
    scheduleEnabled.value = true
  } catch (err) { showToast(err.response?.data?.detail || '开启失败', 'error') }
}

async function stopSchedule() {
  try {
    await progressApi.stopSchedule()
    scheduleEnabled.value = false
  } catch (err) { showToast(err.response?.data?.detail || '关闭失败', 'error') }
}

function formatInterval(minutes) {
  if (minutes >= 1440) return `${minutes / 1440}天`
  if (minutes >= 60) return `${minutes / 60}小时`
  return `${minutes}分钟`
}

async function handleBackfill() {
  try {
    const res = await progressApi.backfillContacts()
    showToast(res.data.message)
  } catch (err) { showToast(err.response?.data?.detail || '回填失败', 'error') }
}

async function fetchRecords(resetPage = false) {
  if (resetPage) currentPage.value = 1
  loading.value = true
  try {
    const res = await progressApi.getRecords(projectType.value, {
      offset: (currentPage.value - 1) * pageSize,
      limit: pageSize,
      search: searchText.value || undefined,
    })
    records.value = res.data.items
    total.value = res.data.total
    nextTick(updateScrollWidth)
  } catch (err) {
    console.error('获取记录失败:', err)
  } finally {
    loading.value = false
  }
}

async function fetchLogs() {
  try {
    const res = await progressApi.getLogs(projectType.value)
    logs.value = res.data
  } catch (err) {
    console.error('获取日志失败:', err)
  }
}

async function handleScrape() {
  if (!confirm(`确定要爬取${typeName.value}数据吗？这可能需要几秒钟。`)) return
  scraping.value = true
  try {
    const res = await progressApi.scrape(projectType.value)
    const count = res.data.total_records
    showToast(`爬取完成，共获取 ${count} 条记录`)
    await fetchRecords(true)
    await fetchLogs()
  } catch (err) {
    showToast(err.response?.data?.detail || '爬取失败，请检查爬虫配置', 'error')
  } finally {
    scraping.value = false
  }
}

async function handleExport() {
  try {
    const res = await progressApi.exportExcel(projectType.value, {
      search: searchText.value || undefined,
    })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${typeName.value}_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    showToast(err.response?.data?.detail || '导出失败', 'error')
  }
}

function goPage(page) {
  currentPage.value = page
  jumpPage.value = page
  fetchRecords()
}

// 分发功能
async function fetchEmployees() {
  try {
    const res = await usersApi.getEmployees()
    employees.value = res.data
  } catch (err) {
    console.error('获取员工列表失败:', err)
  }
}

function openDistribute(record) {
  distributeRecord.value = record
  selectedEmployees.value = []
  distributeRemark.value = ''
  showDistributeModal.value = true
}

function isFinishedRecord(r) {
  const s = r.project_status || ''
  const remark = r.remark || ''
  // 备注含"注销"不可分发
  if (remark.includes('注销')) return true
  // 只有"未开始"才可能分发
  if (s && s !== '未开始') return true
  // 方案和报告都已打印，说明实际已完成
  if ((r.plan_printed || '').includes('已打印') && (r.report_printed || '').includes('已打印')) return true
  return false
}

async function handleDistribute() {
  if (selectedEmployees.value.length === 0) return
  distributing.value = true
  try {
    await progressApi.distribute(distributeRecord.value.id, {
      assignee_ids: selectedEmployees.value,
      remark: distributeRemark.value || null,
    })
    showDistributeModal.value = false
    fetchRecords()  // 刷新分发状态
  } catch (err) {
    showToast(err.response?.data?.detail || '分发失败', 'error')
  } finally {
    distributing.value = false
  }
}

// 路由切换时重新加载数据
watch(projectType, () => {
  searchText.value = ''
  currentPage.value = 1
  fetchRecords()
  fetchLogs()
})

onMounted(() => {
  fetchRecords()
  fetchLogs()
  if (userStore.isManager) {
    fetchEmployees()
    fetchScheduleStatus()
  }
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-primary);
  padding: 1rem 0;
}
.header-left {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}
.header-left h1 { margin: 0; font-size: 1.5rem; }
.record-count { font-size: 0.85rem; color: var(--text-muted); }
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.schedule-controls { display: flex; align-items: center; gap: 0.4rem; margin-left: 0.5rem; padding-left: 0.75rem; border-left: 1px solid var(--border-color); }
.schedule-select { width: 90px; padding: 0.25rem 0.4rem; font-size: 0.8rem; }
.schedule-status { font-size: 0.8rem; color: var(--accent-primary); white-space: nowrap; }

.search-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bg-secondary, var(--bg-tertiary));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 0.4rem 0.75rem;
}
.search-box svg { color: var(--text-muted); flex-shrink: 0; }
.search-box input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.85rem;
  color: var(--text-primary);
  width: 180px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent-primary); color: white; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-secondary {
  background: transparent;
  border-color: var(--border-color);
  color: var(--text-secondary);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  padding: 0.4rem 0.75rem;
  border: none;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: var(--text-muted);
}
.empty-state svg { margin-bottom: 1rem; opacity: 0.4; }
.empty-state h3 { margin: 0 0 0.5rem; color: var(--text-secondary); }
.empty-state p { margin: 0; font-size: 0.9rem; }
.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}
@keyframes spin { to { transform: rotate(360deg); } }

.table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
.top-scrollbar {
  overflow-x: auto;
  overflow-y: hidden;
  height: 12px;
  margin-bottom: -1px;
}
.top-scrollbar-inner {
  height: 1px;
}
table {
  min-width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  white-space: nowrap;
}
thead { background: var(--bg-tertiary); }
th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}
td {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}
.cell-mono { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; }
.cell-name { max-width: 300px; overflow: hidden; text-overflow: ellipsis; }

.col-toggle-wrap { position: relative; }
.col-toggle-dropdown {
  position: absolute;
  right: 0; top: 100%;
  margin-top: 4px;
  background: var(--bg-card, var(--bg-primary));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 0.5rem 0;
  z-index: 20;
  min-width: 160px;
  max-height: 400px;
  overflow-y: auto;
}
.col-toggle-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.82rem;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
}
.col-toggle-item:hover { background: var(--bg-tertiary); }
.col-toggle-item input[type="checkbox"] {
  accent-color: var(--accent-primary);
}
tbody tr:hover { background: var(--bg-tertiary); }

.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}
.badge-success { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.badge-primary { background: var(--accent-glow); color: var(--accent-primary); }
.badge-warning { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
.badge-default { background: var(--bg-tertiary); color: var(--text-secondary); }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 0;
  width: 100%;
  max-width: 100vw;
  box-sizing: border-box;
}
.page-info { font-size: 0.85rem; color: var(--text-muted); }

.page-btn {
  min-width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.page-btn:hover:not(:disabled) { border-color: var(--accent-primary); color: var(--accent-primary); }
.page-btn.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
.page-btn.ellipsis { border: none; cursor: default; }
.page-btn.ellipsis:hover { color: var(--text-secondary); }

.page-jump {
  display: flex; align-items: center; gap: 0.25rem; margin-left: 0.5rem;
}
.page-jump input {
  width: 50px; height: 32px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  color: var(--text-primary);
  text-align: center;
  font-size: 0.82rem;
  outline: none;
}
.page-jump input:focus { border-color: var(--accent-primary); }

.logs-section {
  margin-top: 2rem;
  border-top: 1px solid var(--border-color);
  padding-top: 1rem;
}
.logs-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0.5rem 0;
}
.logs-toggle:hover { color: var(--text-primary); }
.chevron { transition: transform 0.2s ease; }
.chevron.open { transform: rotate(180deg); }

.logs-list { padding: 0.5rem 0; }
.log-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm, 4px);
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.log-item:hover { background: var(--bg-tertiary); }
.log-item.success .log-status { color: #10b981; }
.log-item.failed .log-status { color: #ef4444; }
.log-item.running .log-status { color: var(--accent-primary); }
.log-status { font-weight: 600; min-width: 40px; }
.log-count { min-width: 50px; }
.log-time { color: var(--text-muted); }
.log-error { color: #ef4444; font-size: 0.75rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }

@media (max-width: 768px) {
  .header-actions { width: 100%; }
  .search-box input { width: 120px; }
}

/* 操作列 */
.th-action, .td-action {
  position: sticky;
  right: 0;
  background: var(--bg-primary);
  z-index: 2;
  text-align: center;
  min-width: 70px;
}
thead .th-action { background: var(--bg-tertiary); }
tbody tr:hover .td-action { background: var(--bg-tertiary); }
.btn-sm {
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
}
.btn-distribute {
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
}
.btn-distribute:hover { opacity: 0.85; }
.badge-distributed { background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.78rem; padding: 0.2rem 0.5rem; border-radius: 4px; }
.distribute-remark { width: 100%; resize: vertical; font-size: 0.85rem; }
.distribute-error { color: #ef4444; font-size: 0.85rem; margin-bottom: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(239, 68, 68, 0.1); border-radius: 4px; }
.text-muted { font-size: 0.78rem; color: var(--text-muted); }

/* 分发弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-content {
  background: var(--bg-card, var(--bg-primary));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md, 8px);
  padding: 1.5rem;
  width: 420px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}
.modal-content h3 {
  margin: 0 0 1rem;
  font-size: 1.1rem;
}
.modal-info {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm, 4px);
  font-size: 0.85rem;
}
.modal-info p {
  margin: 0.25rem 0;
  color: var(--text-secondary);
}
.modal-field {
  margin-bottom: 1rem;
}
.modal-field label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}
.employee-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm, 4px);
  padding: 0.25rem 0;
}
.employee-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 400;
}
.employee-item:hover { background: var(--bg-tertiary); }
.employee-item input[type="checkbox"] { accent-color: var(--accent-primary); }
.emp-dept {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: auto;
}
.no-employees {
  text-align: center;
  color: var(--text-muted);
  padding: 1rem;
  font-size: 0.85rem;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
