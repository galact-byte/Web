<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div>
        <span class="logo-text">完结单平台</span>
      </div>
      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg><span>仪表盘</span></router-link>
        <router-link to="/projects" class="nav-item active"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span>项目管理</span></router-link>
        <router-link to="/workload" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg><span>工作量统计</span></router-link>
        <router-link to="/export" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>导出完结单</span></router-link>
        <router-link v-if="userStore.isManager" to="/users" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg><span>用户管理</span></router-link>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info"><div class="avatar">{{ userStore.user?.display_name?.charAt(0) || 'U' }}</div><div class="user-details"><div class="user-name">{{ userStore.user?.display_name }}</div><div class="user-role">{{ userStore.isManager ? '经理' : '员工' }}</div></div></div>
        <button class="btn-logout" @click="handleLogout"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></button>
      </div>
    </aside>

    <main class="main-content">
      <header class="page-header">
        <div>
          <router-link to="/projects" class="back-link">← 返回项目列表</router-link>
          <h1>{{ isEdit ? '编辑项目' : '新建项目' }}</h1>
        </div>
      </header>

      <div v-if="loading" class="loading-container"><div class="loading-spinner"></div></div>

      <form v-else @submit.prevent="handleSubmit" class="project-form">
        <!-- 基本信息 -->
        <section class="form-section card">
          <h2 class="section-title">基本信息</h2>
          <div class="form-grid">
            <div class="input-group">
              <label for="project_code">项目编号 *</label>
              <input id="project_code" v-model="form.project_code" class="input" placeholder="QZXGC-202512001" required />
            </div>
            <div class="input-group">
              <label for="project_name">项目名称 *</label>
              <input id="project_name" v-model="form.project_name" class="input" placeholder="输入项目名称" required />
            </div>
            <div class="input-group">
              <label for="client_name">被测单位名称</label>
              <input id="client_name" v-model="form.client_name" class="input" placeholder="输入被测单位名称" />
            </div>
            <div class="input-group">
              <label for="project_location">项目地点</label>
              <input id="project_location" v-model="form.project_location" class="input" placeholder="如：太原" />
            </div>
            <div class="input-group">
              <label for="business_category">业务类别 *</label>
              <select id="business_category" v-model="form.business_category" class="select" required>
                <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
              </select>
            </div>
            <div class="input-group">
              <label for="contract_status">合同状态</label>
              <select id="contract_status" v-model="form.contract_status" class="select">
                <option value="已签订">已签订</option>
                <option value="未签订">未签订</option>
              </select>
            </div>
            <div class="input-group">
              <label for="filing_status">定级备案状态</label>
              <select id="filing_status" v-model="form.filing_status" class="select">
                <option value="已备案">已备案</option>
                <option value="未备案">未备案</option>
              </select>
            </div>
            <div class="input-group">
              <label for="approval_date">审批完成时间</label>
              <input id="approval_date" v-model="form.approval_date" type="date" class="input" />
            </div>
            <div class="input-group">
              <label for="business_manager_id">业务负责人</label>
              <select id="business_manager_id" v-model="form.business_manager_id" class="select">
                <option :value="null">请选择</option>
                <option v-for="u in managers" :key="u.id" :value="u.id">{{ u.display_name }}</option>
              </select>
            </div>
            <div class="input-group">
              <label for="implementation_manager_id">实施负责人</label>
              <select id="implementation_manager_id" v-model="form.implementation_manager_id" class="select">
                <option :value="null">请选择</option>
                <option v-for="u in managers" :key="u.id" :value="u.id">{{ u.display_name }}</option>
              </select>
            </div>
          </div>
        </section>

        <!-- 系统信息 -->
        <section class="form-section card">
          <div class="section-header-row">
            <h2 class="section-title">系统信息</h2>
            <button type="button" class="btn btn-secondary btn-sm" @click="addSystem">+ 添加系统</button>
          </div>

          <div v-if="form.systems.length === 0" class="empty-systems">
            <p class="text-muted">暂无系统，点击上方按钮添加</p>
          </div>

          <div v-else class="systems-list">
            <div v-for="(sys, index) in form.systems" :key="index" class="system-item">
              <div class="system-fields">
                <div class="input-group">
                  <label>系统编号</label>
                  <input v-model="sys.system_code" class="input" placeholder="可选" />
                </div>
                <div class="input-group">
                  <label>系统名称 *</label>
                  <input v-model="sys.system_name" class="input" placeholder="输入系统名称" required />
                </div>
                <div class="input-group">
                  <label>系统级别</label>
                  <select v-model="sys.system_level" class="select">
                    <option value="/">/ (不适用)</option>
                    <option value="第一级">第一级</option>
                    <option value="第二级">第二级</option>
                    <option value="第三级">第三级</option>
                    <option value="第四级">第四级</option>
                    <option value="第五级">第五级</option>
                  </select>
                </div>
                <div class="input-group">
                  <label>系统类型</label>
                  <select v-model="sys.system_type" class="select">
                    <option value="/">/</option>
                    <option value="传统系统">传统系统</option>
                    <option value="云计算（租户）">云计算（租户）</option>
                    <option value="云计算（平台）">云计算（平台）</option>
                    <option value="工控系统">工控系统</option>
                    <option value="物联网">物联网</option>
                    <option value="移动互联">移动互联</option>
                    <option value="大数据">大数据</option>
                  </select>
                </div>
              </div>
              <button type="button" class="btn-remove" @click="removeSystem(index)" title="删除">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        </section>

        <div class="form-actions">
          <router-link to="/projects" class="btn btn-secondary">取消</router-link>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            {{ submitting ? '保存中...' : (isEdit ? '保存修改' : '创建项目') }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectsApi, usersApi } from '../api'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const submitting = ref(false)
const managers = ref([])

const categories = [
  { value: '等保测评', label: '等保测评' },
  { value: '密码评估', label: '密码评估' },
  { value: '风险评估', label: '风险评估' },
  { value: '安全评估', label: '安全评估' },
  { value: '数据评估', label: '数据评估' },
  { value: '软件测试', label: '软件测试' },
  { value: '安全服务', label: '安全服务' },
  { value: '其他', label: '其他' }
]

const form = reactive({
  project_code: '',
  project_name: '',
  client_name: '',
  business_category: '等保测评',
  project_location: '',
  contract_status: '未签订',
  filing_status: '未备案',
  business_manager_id: null,
  implementation_manager_id: null,
  approval_date: '',
  systems: []
})

function addSystem() {
  form.systems.push({ system_code: '', system_name: '', system_level: '第二级', system_type: '传统系统' })
}

function removeSystem(index) {
  form.systems.splice(index, 1)
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

async function handleSubmit() {
  submitting.value = true
  try {
    const data = { ...form, systems: form.systems.filter(s => s.system_name) }
    if (isEdit.value) {
      await projectsApi.update(route.params.id, data)
    } else {
      await projectsApi.create(data)
    }
    router.push('/projects')
  } catch (err) {
    console.error('Submit failed:', err)
    alert(err.response?.data?.detail || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function fetchData() {
  loading.value = true
  try {
    const managersRes = await usersApi.getManagers()
    managers.value = managersRes.data

    if (isEdit.value) {
      const res = await projectsApi.get(route.params.id)
      const p = res.data
      Object.assign(form, {
        project_code: p.project_code,
        project_name: p.project_name,
        client_name: p.client_name,
        business_category: p.business_category,
        project_location: p.project_location,
        contract_status: p.contract_status,
        filing_status: p.filing_status,
        business_manager_id: p.business_manager_id,
        implementation_manager_id: p.implementation_manager_id,
        approval_date: p.approval_date || '',
        systems: p.systems.map(s => ({ system_code: s.system_code, system_name: s.system_name, system_level: s.system_level, system_type: s.system_type }))
      })
    }
  } catch (err) {
    console.error('Fetch failed:', err)
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
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
.btn-logout { padding: 0.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); }
.btn-logout:hover { background: var(--error-bg); color: var(--error); }

.main-content { flex: 1; margin-left: 260px; padding: 2rem; }
.page-header { margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; }
.back-link { color: var(--text-secondary); font-size: 0.9rem; display: inline-block; margin-bottom: 0.5rem; }
.back-link:hover { color: var(--accent-primary); }

.loading-container { display: flex; justify-content: center; padding: 4rem; }

.project-form { display: flex; flex-direction: column; gap: 1.5rem; max-width: 900px; }
.form-section { padding: 1.5rem; }
.section-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); }
.section-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); }
.section-header-row .section-title { margin: 0; padding: 0; border: none; }

.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.25rem; }

.empty-systems { padding: 2rem; text-align: center; background: var(--bg-tertiary); border-radius: var(--radius-md); }

.systems-list { display: flex; flex-direction: column; gap: 1rem; }
.system-item { display: flex; gap: 1rem; align-items: flex-start; padding: 1rem; background: var(--bg-tertiary); border-radius: var(--radius-md); border: 1px solid var(--border-color); }
.system-fields { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.btn-remove { padding: 0.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); }
.btn-remove:hover { background: var(--error-bg); color: var(--error); }

.form-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }

@media (max-width: 900px) {
  .form-grid { grid-template-columns: 1fr; }
  .system-fields { grid-template-columns: 1fr 1fr; }
}
</style>
