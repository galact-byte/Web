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
          <button v-if="userStore.isManager && project.status === 'draft'" class="btn btn-primary" @click="showAssignModal = true">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            分发项目
          </button>
          <router-link v-if="userStore.isManager" :to="`/projects/${project.id}/edit`" class="btn btn-secondary">编辑项目</router-link>
          <button class="btn btn-secondary" @click="exportWord">导出Word</button>
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
            <div class="info-item"><label>定级备案</label><span>{{ project.filing_status }}</span></div>
            <div class="info-item"><label>审批时间</label><span>{{ project.approval_date || '/' }}</span></div>
            <div class="info-item"><label>业务负责人</label><span>{{ project.business_manager_name || '/' }}</span></div>
            <div class="info-item"><label>实施负责人</label><span>{{ project.implementation_manager_name || '/' }}</span></div>
            <div class="info-item"><label>项目状态</label><span class="badge" :class="getStatusClass(project.status)">{{ getStatusText(project.status) }}</span></div>
            <div class="info-item"><label>创建人</label><span>{{ project.creator_name || '/' }}</span></div>
          </div>
        </section>

        <section class="card">
          <h2>系统信息 ({{ project.systems?.length || 0 }})</h2>
          <div v-if="project.systems?.length > 0" class="systems-table">
            <table class="table">
              <thead><tr><th>系统编号</th><th>系统名称</th><th>系统级别</th><th>系统类型</th></tr></thead>
              <tbody>
                <tr v-for="sys in project.systems" :key="sys.id">
                  <td>{{ sys.system_code || '/' }}</td><td>{{ sys.system_name }}</td><td>{{ sys.system_level }}</td><td>{{ sys.system_type }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state" style="padding: 2rem;"><p class="text-muted">暂无系统信息</p></div>
        </section>

        <section class="card">
          <h2>人员分配</h2>
          <div v-if="assignments.length > 0" class="assignments-list">
            <div v-for="a in assignments" :key="a.id" class="assignment-item">
              <div class="assignee-info">
                <div class="avatar-sm">{{ a.assignee_name?.charAt(0) || '?' }}</div>
                <div><div class="assignee-name">{{ a.assignee_name }}</div><div class="assignee-dept text-muted">{{ a.department || '未填写部门' }}</div></div>
              </div>
              <div class="contribution-text">{{ a.contribution || '未填写贡献率' }}</div>
            </div>
          </div>
          <div v-else class="empty-state" style="padding: 2rem;"><p class="text-muted">暂无分配记录</p></div>
        </section>

        <section v-if="userStore.isEmployee && myAssignment" class="card contribution-card">
          <h2>填写我的贡献信息</h2>
          <form @submit.prevent="saveContribution" class="contribution-form">
            <div class="input-group"><label>部门</label><input v-model="contributionForm.department" class="input" placeholder="输入部门名称" /></div>
            <div class="input-group"><label>人员贡献率描述</label><textarea v-model="contributionForm.contribution" class="textarea" rows="4" placeholder="如：张三：源代码审计、报告撰写（100%）"></textarea></div>
            <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
          </form>
        </section>
      </div>

      <!-- 分发模态框 -->
      <div v-if="showAssignModal" class="modal-overlay" @click.self="showAssignModal = false">
        <div class="modal">
          <div class="modal-header"><h2>分发项目</h2><button class="btn btn-ghost" @click="showAssignModal = false">✕</button></div>
          <div class="modal-body">
            <p class="mb-2">选择要分配的员工：</p>
            <div class="employee-list">
              <label v-for="emp in employees" :key="emp.id" class="checkbox-wrapper">
                <div class="checkbox" :class="{ checked: selectedEmployees.includes(emp.id) }" @click="toggleEmployee(emp.id)">
                  <svg v-if="selectedEmployees.includes(emp.id)" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span>{{ emp.display_name }}</span>
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showAssignModal = false">取消</button>
            <button class="btn btn-primary" @click="assignProject" :disabled="assigning || selectedEmployees.length === 0">{{ assigning ? '分发中...' : '确认分发' }}</button>
          </div>
        </div>
      </div>
    </template>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectsApi, usersApi, exportsApi } from '../api'
import AppLayout from '../components/AppLayout.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const project = ref(null)
const assignments = ref([])
const employees = ref([])
const showAssignModal = ref(false)
const selectedEmployees = ref([])
const assigning = ref(false)
const saving = ref(false)

const contributionForm = reactive({ department: '', contribution: '' })

const categoryMap = { '等保测评': '等保', '密码评估': '密评', '风险评估': '风评', '安全评估': '安评', '数据评估': '数评', '软件测试': '软测', '安全服务': '安服', '其他': '其他' }
function getCategoryShort(cat) { return categoryMap[cat] || cat }
function getStatusClass(s) { return { draft: 'badge-warning', assigned: 'badge-info', completed: 'badge-success' }[s] || 'badge-info' }
function getStatusText(s) { return { draft: '待分发', assigned: '进行中', completed: '已完成' }[s] || s }

const myAssignment = computed(() => assignments.value.find(a => a.assignee_id === userStore.user?.id))

function toggleEmployee(id) {
  const idx = selectedEmployees.value.indexOf(id)
  if (idx >= 0) selectedEmployees.value.splice(idx, 1)
  else selectedEmployees.value.push(id)
}

async function assignProject() {
  assigning.value = true
  try {
    await projectsApi.assign(route.params.id, { assignee_ids: selectedEmployees.value })
    showAssignModal.value = false
    await fetchData()
  } catch (err) { console.error(err) }
  finally { assigning.value = false }
}

async function saveContribution() {
  saving.value = true
  try {
    await projectsApi.updateContribution(route.params.id, contributionForm)
    await fetchData()
  } catch (err) { console.error(err) }
  finally { saving.value = false }
}

async function exportWord() {
  try {
    const response = await exportsApi.word(route.params.id)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.value.project_code}完结单.docx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => window.URL.revokeObjectURL(url), 100)
  } catch (err) { console.error(err); alert('导出失败') }
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
    if (userStore.isManager) {
      const empRes = await usersApi.getEmployees()
      employees.value = empRes.data
    }
    const my = assignments.value.find(a => a.assignee_id === userStore.user?.id)
    if (my) { contributionForm.department = my.department || ''; contributionForm.contribution = my.contribution || '' }
  } catch (err) { console.error(err) }
  finally { loading.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }
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

.assignments-list { display: flex; flex-direction: column; gap: 1rem; }
.assignment-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); }
.assignee-info { display: flex; align-items: center; gap: 0.75rem; }
.avatar-sm { width: 32px; height: 32px; background: var(--accent-gradient); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 600; }
.assignee-name { font-weight: 500; }
.assignee-dept { font-size: 0.85rem; }
.contribution-text { flex: 1; font-size: 0.9rem; color: var(--text-secondary); text-align: right; white-space: pre-wrap; }
.contribution-card { max-width: 600px; }
.contribution-form { display: flex; flex-direction: column; gap: 1rem; }
.employee-list { display: flex; flex-direction: column; gap: 0.75rem; max-height: 300px; overflow-y: auto; }
</style>
