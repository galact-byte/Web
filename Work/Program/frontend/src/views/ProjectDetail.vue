<template>
  <AppLayout>
    <div v-if="loading" class="loading-container"><div class="loading-spinner"></div></div>

    <template v-else-if="project">
      <header class="page-header">
        <div>
          <router-link to="/projects" class="back-link">← 返回项目列表</router-link>
          <h1>{{ project.project_name }}</h1>
          <p class="project-code">{{ project.project_code }}</p>
        </div>
        <div class="header-actions">
          <span v-if="userStore.isManager && project.status === 'assigned' && totalEmployeeCount > 0" class="submit-progress">
            {{ submittedEmployeeCount }}/{{ totalEmployeeCount }} 人已提交
          </span>
          <button v-if="userStore.isManager && project.status === 'assigned'" class="btn btn-success" @click="completeProject" :disabled="changingStatus">
            {{ changingStatus ? '处理中...' : '标记为已完成' }}
          </button>
          <button v-if="userStore.isManager && project.status === 'completed'" class="btn btn-warning" @click="reopenProject" :disabled="changingStatus">
            {{ changingStatus ? '处理中...' : '重新开启' }}
          </button>
          <router-link v-if="userStore.isManager" :to="`/projects/${project.id}/edit`" class="btn btn-secondary">编辑项目</router-link>
          <button v-if="!userStore.isManager && project.status === 'assigned' && myAssignmentExists && !mySubmitted" class="btn btn-success" @click="submitCompletion">
            提交完结申请
          </button>
          <button v-if="!userStore.isManager && project.status === 'assigned' && mySubmitted" class="btn btn-warning" @click="retractCompletion">
            撤回完结申请
          </button>
        </div>
      </header>

      <div class="detail-grid">
        <section class="card info-card">
          <h2>基本信息</h2>
          <div class="info-grid">
            <div class="info-item"><label>客户单位</label><span>{{ project.client_name || '/' }}</span></div>
            <div class="info-item"><label>项目地点</label><span>{{ project.project_location || '/' }}</span></div>
            <div class="info-item"><label>业务类别</label><span class="badge badge-primary">{{ getCategoryShort(project.business_category) }}</span></div>
            <div class="info-item"><label>合同状态</label><span>{{ project.contract_status }}</span></div>
            <div class="info-item"><label>备案情况</label><span>{{ project.filing_status }}</span></div>
            <div class="info-item"><label>业务负责人</label><span>{{ project.business_manager_name || '/' }}</span></div>
            <div class="info-item"><label>实施负责人</label><span>{{ project.implementation_manager_name || '/' }}</span></div>
            <div class="info-item"><label>项目状态</label><span class="badge" :class="getStatusClass(project.status)">{{ getStatusText(project.status) }}</span></div>
            <div class="info-item"><label>创建人</label><span>{{ project.creator_name || '/' }}</span></div>
            <div class="info-item"><label>客户联系人</label><span>{{ project.contact_name || '/' }}</span></div>
            <div class="info-item"><label>联系电话</label><span>{{ project.contact_phone || '/' }}</span></div>
          </div>
        </section>

        <section class="card">
          <h2>系统信息 ({{ project.systems?.length || 0 }})</h2>
          <div v-if="project.systems?.length > 0" class="systems-table">
            <table class="table">
              <thead><tr><th>系统编号</th><th>系统名称</th><th>系统级别</th><th>系统类型</th></tr></thead>
              <tbody>
                <tr v-for="sys in project.systems" :key="sys.id">
                  <td>{{ sys.system_code || '' }}</td><td>{{ sys.system_name }}</td><td>{{ sys.system_level }}</td><td>{{ sys.system_type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state" style="padding: 2rem;"><p class="text-muted">暂无系统信息</p></div>
        </section>

        <!-- 系统进度汇报 -->
        <section v-if="project.systems?.length > 0 && (myAssignmentExists || isProjectCreator)" class="card">
          <div class="section-header">
            <h2>系统进度{{ isProjectCreator && !myAssignmentExists ? '总览' : '汇报' }}</h2>
            <div class="progress-header-actions">
              <button v-if="myAssignmentExists && project.systems.length > 1" class="btn btn-sm btn-secondary" @click="openSyncModal">一键同步进度</button>
              <button v-if="isProjectCreator" class="btn btn-sm btn-secondary" @click="showHistoryModal = true; fetchProgressHistory()">查看汇报历史</button>
            </div>
          </div>

          <div class="progress-systems">
            <div v-for="sys in systemProgressList" :key="sys.system_id" class="progress-system-item">
              <div class="progress-system-name">{{ sys.system_name }}</div>
              <ProgressStepper
                :model-value="myAssignmentExists ? (progressForm[sys.system_id]?.phase || sys.current_phase) : sys.current_phase"
                :editable="myAssignmentExists && project.status === 'assigned'"
                @update:model-value="val => updateProgressForm(sys.system_id, val)"
              />
              <div v-if="myAssignmentExists && project.status === 'assigned'" class="progress-remark-row">
                <input
                  class="input input-sm"
                  :value="progressForm[sys.system_id]?.remark ?? ''"
                  @input="e => updateProgressRemark(sys.system_id, e.target.value)"
                  placeholder="备注说明（可选）"
                />
              </div>
              <div v-else-if="sys.latest_remark || sys.latest_reporter_name" class="progress-latest-info">
                <span class="text-muted">最近汇报：</span>
                <span v-if="sys.latest_reporter_name">{{ sys.latest_reporter_name }}</span>
                <span v-if="sys.latest_report_time" class="text-muted"> · {{ formatTime(sys.latest_report_time) }}</span>
                <span v-if="sys.latest_remark"> — {{ sys.latest_remark }}</span>
              </div>
            </div>
          </div>

          <div v-if="myAssignmentExists && project.status === 'assigned'" class="progress-submit-bar">
            <button class="btn btn-primary" @click="submitProgressReport" :disabled="submittingProgress">
              {{ submittingProgress ? '提交中...' : '提交本周汇报' }}
            </button>
          </div>
        </section>

        <section class="card">
          <div class="section-header">
            <h2>人员分配</h2>
            <button v-if="project.status !== 'completed' && myAssignmentExists && !mySubmitted" class="btn btn-sm btn-primary" @click="openAddContribution">添加贡献</button>
          </div>
          <div v-if="assignments.length > 0" class="assignments-list">
            <div v-for="a in assignments" :key="a.id" class="assignment-item">
              <div class="assignee-info">
                <div class="avatar-sm">{{ a.assignee_name?.charAt(0) || '?' }}</div>
                <div>
                  <div class="assignee-name">
                    {{ a.assignee_name }}
                  </div>
                  <div class="assignee-dept text-muted">{{ a.department || '未填写部门' }}</div>
                </div>
              </div>
              <div class="assignment-right">
                <div class="contribution-text">{{ a.contribution || '未填写贡献率' }}</div>
                <div v-if="project.status !== 'completed' && a.assignee_id === userStore.user?.id && a.status !== 'submitted'" class="assignment-actions">
                  <button class="btn btn-sm btn-secondary" @click="openEditAssignment(a)">编辑</button>
                  <button class="btn btn-sm btn-danger" @click="deleteAssignment(a)">删除</button>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding: 2rem;"><p class="text-muted">暂无分配记录</p></div>
        </section>
      </div>

      <!-- 编辑分配弹窗 -->
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal">
          <div class="modal-header"><h2>编辑贡献信息</h2><button class="btn btn-ghost" @click="showEditModal = false">✕</button></div>
          <div class="modal-body">
            <div class="input-group"><label>部门</label><input v-model="editForm.department" class="input" placeholder="输入部门名称" /></div>
            <div class="input-group"><label>人员贡献率描述</label><textarea v-model="editForm.contribution" class="textarea" rows="4" placeholder="格式：姓名：工作内容（百分比）&#10;如：张三：源代码审计、报告撰写（100%）"></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showEditModal = false">取消</button>
            <button class="btn btn-primary" @click="saveAssignment" :disabled="savingAssignment">{{ savingAssignment ? '保存中...' : '保存' }}</button>
          </div>
        </div>
      </div>

      <!-- 添加贡献弹窗 -->
      <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
        <div class="modal">
          <div class="modal-header"><h2>添加贡献</h2><button class="btn btn-ghost" @click="showAddModal = false">✕</button></div>
          <div class="modal-body">
            <div class="input-group"><label>部门</label><input v-model="addForm.department" class="input" placeholder="输入部门名称" /></div>
            <div class="input-group"><label>人员贡献率描述</label><textarea v-model="addForm.contribution" class="textarea" rows="4" placeholder="格式：姓名：工作内容（百分比）&#10;如：李四：渗透测试（100%）"></textarea></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showAddModal = false">取消</button>
            <button class="btn btn-primary" @click="submitAddContribution" :disabled="addingContribution">{{ addingContribution ? '添加中...' : '添加' }}</button>
          </div>
        </div>
      </div>

      <!-- 一键同步进度弹窗 -->
      <div v-if="showSyncModal" class="modal-overlay" @click.self="showSyncModal = false">
        <div class="modal">
          <div class="modal-header"><h2>一键同步进度</h2><button class="btn btn-ghost" @click="showSyncModal = false">✕</button></div>
          <div class="modal-body">
            <p class="sync-hint">将 {{ project.systems.length }} 个系统的进度统一设置为：</p>
            <div class="input-group">
              <label>目标阶段</label>
              <select v-model="syncForm.phase" class="input">
                <option v-for="s in phaseOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div class="input-group">
              <label>备注（可选）</label>
              <input v-model="syncForm.remark" class="input" placeholder="备注说明" />
            </div>
            <p class="text-muted" style="font-size: 0.85rem; margin-top: 0.5rem;">此操作将覆盖所有系统的当前进度</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showSyncModal = false">取消</button>
            <button class="btn btn-primary" @click="confirmSync" :disabled="syncingProgress">{{ syncingProgress ? '同步中...' : '确认同步' }}</button>
          </div>
        </div>
      </div>

      <!-- 汇报历史弹窗 -->
      <div v-if="showHistoryModal" class="modal-overlay" @click.self="showHistoryModal = false">
        <div class="modal modal-lg">
          <div class="modal-header"><h2>汇报历史</h2><button class="btn btn-ghost" @click="showHistoryModal = false">✕</button></div>
          <div class="modal-body">
            <div class="history-filter">
              <select v-model="historyFilter.systemId" class="input input-sm" @change="fetchProgressHistory">
                <option :value="null">全部系统</option>
                <option v-for="sys in project.systems" :key="sys.id" :value="sys.id">{{ sys.system_name }}</option>
              </select>
            </div>
            <div v-if="progressHistory.length > 0" class="history-list">
              <div v-for="(group, week) in groupedHistory" :key="week" class="history-week-group">
                <div class="history-week-label">{{ week }}</div>
                <div v-for="record in group" :key="record.id" class="history-record">
                  <span class="history-system-name">{{ record.system_name }}</span>
                  <span class="badge badge-sm badge-primary">{{ record.phase_label }}</span>
                  <span v-if="record.remark" class="history-remark">{{ record.remark }}</span>
                  <span class="text-muted history-meta">{{ record.reporter_name }} · {{ formatTime(record.created_at) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding: 2rem;"><p class="text-muted">暂无汇报记录</p></div>
          </div>
        </div>
      </div>

    </template>
    <Toast :message="toastMsg" :type="toastType" @done="toastMsg = ''" />
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectsApi } from '../api'
import AppLayout from '../components/AppLayout.vue'
import ProgressStepper from '../components/ProgressStepper.vue'
import Toast from '../components/Toast.vue'
import { getCategoryShort, getStatusClass, getStatusText } from '../utils/project'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const project = ref(null)
const assignments = ref([])
const changingStatus = ref(false)

// 编辑分配弹窗状态
const showEditModal = ref(false)
const editingAssignment = ref(null)
const editForm = reactive({ department: '', contribution: '' })
const savingAssignment = ref(false)

// 添加贡献弹窗状态
const showAddModal = ref(false)
const addForm = reactive({ department: '', contribution: '' })
const addingContribution = ref(false)

// toast 通知
const toastMsg = ref('')
const toastType = ref('success')
function showToast(msg, type = 'success') {
  toastMsg.value = ''
  nextTick(() => { toastMsg.value = msg; toastType.value = type })
}

// 进度汇报状态
const systemProgressList = ref([])
const progressForm = reactive({})  // { [systemId]: { phase, remark } }
const submittingProgress = ref(false)
const showSyncModal = ref(false)
const syncForm = reactive({ phase: 'not_started', remark: '' })
const syncingProgress = ref(false)
const showHistoryModal = ref(false)
const progressHistory = ref([])
const historyFilter = reactive({ systemId: null })

const phaseOptions = [
  { value: 'not_started', label: '未开始' },
  { value: 'evaluation_prep', label: '测评准备' },
  { value: 'scheme_writing', label: '方案编制' },
  { value: 'onsite_eval', label: '现场测评' },
  { value: 'report_writing', label: '报告编制' },
  { value: 'archived', label: '完结归档' },
]

const isProjectCreator = computed(() => project.value?.creator_id === userStore.user?.id)

const myAssignmentExists = computed(() => assignments.value.some(a => a.assignee_id === userStore.user?.id))
const mySubmitted = computed(() => {
  const mine = assignments.value.filter(a => a.assignee_id === userStore.user?.id)
  return mine.length > 0 && mine.every(a => a.status === 'submitted')
})

// 按员工去重统计提交进度
const totalEmployeeCount = computed(() => {
  const ids = new Set(assignments.value.map(a => a.assignee_id))
  return ids.size
})
const submittedEmployeeCount = computed(() => {
  const byEmployee = {}
  for (const a of assignments.value) {
    if (!byEmployee[a.assignee_id]) byEmployee[a.assignee_id] = { all: true }
    if (a.status !== 'submitted') byEmployee[a.assignee_id].all = false
  }
  return Object.values(byEmployee).filter(e => e.all).length
})

function openEditAssignment(a) {
  editingAssignment.value = a
  editForm.department = a.department || ''
  editForm.contribution = a.contribution || ''
  showEditModal.value = true
}

async function saveAssignment() {
  savingAssignment.value = true
  try {
    await projectsApi.updateAssignment(route.params.id, editingAssignment.value.id, editForm)
    showEditModal.value = false
    await fetchData()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '保存失败', 'error') }
  finally { savingAssignment.value = false }
}

async function deleteAssignment(a) {
  if (!confirm(`确定删除 ${a.assignee_name} 的分配记录？`)) return
  try {
    await projectsApi.deleteAssignment(route.params.id, a.id)
    await fetchData()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '删除失败', 'error') }
}

function openAddContribution() {
  addForm.department = ''
  addForm.contribution = ''
  showAddModal.value = true
}

async function submitAddContribution() {
  addingContribution.value = true
  try {
    await projectsApi.addContribution(route.params.id, addForm)
    showAddModal.value = false
    await fetchData()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '添加失败', 'error') }
  finally { addingContribution.value = false }
}

async function completeProject() {
  // 按员工去重检查提交状态
  const byEmployee = {}
  for (const a of assignments.value) {
    if (!byEmployee[a.assignee_id]) byEmployee[a.assignee_id] = { name: a.assignee_name, all: true }
    if (a.status !== 'submitted') byEmployee[a.assignee_id].all = false
  }
  const notSubmittedNames = Object.values(byEmployee).filter(e => !e.all).map(e => e.name)

  if (notSubmittedNames.length > 0) {
    if (!confirm(`以下人员尚未提交完结申请：${notSubmittedNames.join('、')}\n\n确定要强制标记为已完成吗？`)) return
  } else {
    if (!confirm('所有人员已提交完结申请，确定将此项目标记为已完成？')) return
  }
  changingStatus.value = true
  try {
    await projectsApi.updateStatus(route.params.id, 'completed')
    await fetchData()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '操作失败', 'error') }
  finally { changingStatus.value = false }
}

async function submitCompletion() {
  if (!confirm('确定提交完结申请？提交后将无法编辑贡献信息，如需修改请先撤回。')) return
  try {
    await projectsApi.submitCompletion(route.params.id)
    await fetchData()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '提交失败', 'error') }
}

async function retractCompletion() {
  if (!confirm('确定撤回完结申请？撤回后可继续编辑贡献信息。')) return
  try {
    await projectsApi.retractCompletion(route.params.id)
    await fetchData()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '撤回失败', 'error') }
}

async function reopenProject() {
  if (!confirm('确定重新开启此项目？')) return
  changingStatus.value = true
  try {
    await projectsApi.updateStatus(route.params.id, 'assigned')
    await fetchData()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '操作失败', 'error') }
  finally { changingStatus.value = false }
}

// ============ 进度汇报 ============
function updateProgressForm(systemId, phase) {
  if (!progressForm[systemId]) progressForm[systemId] = { phase, remark: '' }
  else progressForm[systemId].phase = phase
}

function updateProgressRemark(systemId, remark) {
  if (!progressForm[systemId]) {
    const sys = systemProgressList.value.find(s => s.system_id === systemId)
    progressForm[systemId] = { phase: sys?.current_phase || 'not_started', remark }
  } else {
    progressForm[systemId].remark = remark
  }
}

async function fetchProgressOverview() {
  try {
    const res = await projectsApi.getProgressOverview(route.params.id)
    systemProgressList.value = res.data
    // 初始化表单
    for (const sys of res.data) {
      if (!progressForm[sys.system_id]) {
        progressForm[sys.system_id] = { phase: sys.current_phase, remark: '' }
      }
    }
  } catch (err) { console.error('获取进度总览失败:', err) }
}

async function submitProgressReport() {
  submittingProgress.value = true
  try {
    const reports = systemProgressList.value.map(sys => ({
      system_id: sys.system_id,
      phase: progressForm[sys.system_id]?.phase || sys.current_phase,
      remark: progressForm[sys.system_id]?.remark || null,
    }))
    await projectsApi.submitProgress(route.params.id, { reports })
    showToast('汇报提交成功')
    await fetchProgressOverview()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '提交失败', 'error') }
  finally { submittingProgress.value = false }
}

function openSyncModal() {
  syncForm.phase = 'not_started'
  syncForm.remark = ''
  showSyncModal.value = true
}

async function confirmSync() {
  if (!confirm(`确定将所有系统的进度同步为"${phaseOptions.find(p => p.value === syncForm.phase)?.label}"？`)) return
  syncingProgress.value = true
  try {
    await projectsApi.syncProgress(route.params.id, syncForm)
    showSyncModal.value = false
    showToast('进度同步成功')
    // 更新本地表单
    for (const sys of systemProgressList.value) {
      progressForm[sys.system_id] = { phase: syncForm.phase, remark: syncForm.remark || '' }
    }
    await fetchProgressOverview()
  } catch (err) { console.error(err); showToast(err.response?.data?.detail || '同步失败', 'error') }
  finally { syncingProgress.value = false }
}

async function fetchProgressHistory() {
  try {
    const params = {}
    if (historyFilter.systemId) params.system_id = historyFilter.systemId
    const res = await projectsApi.getProgressHistory(route.params.id, params)
    progressHistory.value = res.data
  } catch (err) { console.error('获取汇报历史失败:', err) }
}

const groupedHistory = computed(() => {
  const groups = {}
  for (const record of progressHistory.value) {
    const week = record.report_week
    if (!groups[week]) groups[week] = []
    groups[week].push(record)
  }
  return groups
})

function formatTime(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function fetchData() {
  loading.value = true
  try {
    const [projRes, assRes] = await Promise.all([
      projectsApi.get(route.params.id),
      projectsApi.getAssignments(route.params.id)
    ])
    project.value = projRes.data
    assignments.value = assRes.data
    // 项目有系统时获取进度总览
    if (projRes.data.systems?.length > 0) {
      await fetchProgressOverview()
    }
  } catch (err) { console.error(err) }
  finally { loading.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.page-header h1 { font-family: 'DM Serif Display', serif; font-size: 1.5rem; font-weight: 400; margin-bottom: 0.25rem; }
.back-link { color: var(--text-secondary); font-size: 0.9rem; display: inline-block; margin-bottom: 0.5rem; }
.back-link:hover { color: var(--accent-primary); }
.project-code { color: var(--text-muted); font-family: monospace; }
.header-actions { display: flex; gap: 0.75rem; }
.loading-container { display: flex; justify-content: center; padding: 4rem; }

.detail-grid { display: flex; flex-direction: column; gap: 1.5rem; }
.card h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); }
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.info-item { display: flex; flex-direction: column; gap: 0.25rem; }
.info-item label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; }
.info-item span { font-size: 0.95rem; }
.systems-table { overflow-x: auto; }

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); }
.section-header h2 { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }

.assignments-list { display: flex; flex-direction: column; gap: 1rem; }
.assignment-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); }
.assignee-info { display: flex; align-items: center; gap: 0.75rem; }
.avatar-sm { width: 32px; height: 32px; background: var(--accent-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 600; }
.assignee-name { font-weight: 500; }
.assignee-dept { font-size: 0.85rem; }
.assignment-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; flex: 1; }
.contribution-text { font-size: 0.9rem; color: var(--text-secondary); text-align: right; white-space: pre-wrap; }
.assignment-actions { display: flex; gap: 0.5rem; }
.btn-sm { padding: 0.25rem 0.6rem; font-size: 0.8rem; }
.btn-danger { background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500; }
.btn-danger:hover { background: #dc2626; }
.contribution-card { max-width: 600px; }
.contribution-form { display: flex; flex-direction: column; gap: 1rem; }
.employee-list { display: flex; flex-direction: column; gap: 0.75rem; max-height: 300px; overflow-y: auto; }
.btn-success { background: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500; }
.btn-success:hover { background: #059669; }
.btn-success:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-warning { background: #f59e0b; color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500; }
.btn-warning:hover { background: #d97706; }
.btn-warning:disabled { opacity: 0.5; cursor: not-allowed; }
.badge-sm { font-size: 0.7rem; padding: 0.15rem 0.4rem; margin-left: 0.4rem; vertical-align: middle; }
.submit-progress { font-size: 0.85rem; font-weight: 400; color: var(--text-secondary); }

/* 进度汇报样式 */
.progress-header-actions { display: flex; gap: 0.5rem; }
.progress-systems { display: flex; flex-direction: column; gap: 1.5rem; }
.progress-system-item { padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); }
.progress-system-name { font-weight: 600; font-size: 0.95rem; margin-bottom: 0.75rem; }
.progress-remark-row { margin-top: 0.75rem; }
.progress-remark-row .input { width: 100%; }
.input-sm { padding: 0.35rem 0.6rem; font-size: 0.85rem; }
.progress-latest-info { margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary); }
.progress-submit-bar { margin-top: 1rem; display: flex; justify-content: flex-end; }
.sync-hint { font-size: 0.95rem; margin-bottom: 0.75rem; }

/* 汇报历史弹窗 */
.modal-lg { max-width: 700px; width: 90%; }
.history-filter { margin-bottom: 1rem; }
.history-filter .input { max-width: 200px; }
.history-list { display: flex; flex-direction: column; gap: 1rem; max-height: 400px; overflow-y: auto; }
.history-week-group { }
.history-week-label { font-weight: 600; font-size: 0.9rem; color: var(--accent-primary); margin-bottom: 0.5rem; padding-bottom: 0.25rem; border-bottom: 1px solid var(--border-color); }
.history-record { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0; font-size: 0.85rem; flex-wrap: wrap; }
.history-system-name { font-weight: 500; min-width: 80px; }
.history-remark { color: var(--text-secondary); }
.history-meta { font-size: 0.8rem; margin-left: auto; }
.badge-sm { font-size: 0.7rem; padding: 0.15rem 0.4rem; }
</style>
