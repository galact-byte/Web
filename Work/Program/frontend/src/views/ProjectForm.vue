<template>
  <AppLayout>
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
          <div class="input-group"><label for="project_code">项目编号 *</label><input id="project_code" v-model="form.project_code" class="input" placeholder="QZXGC-202512001" required /></div>
          <div class="input-group"><label for="project_name">项目名称 *</label><input id="project_name" v-model="form.project_name" class="input" placeholder="输入项目名称" required /></div>
          <div class="input-group"><label for="client_name">被测单位名称</label><input id="client_name" v-model="form.client_name" class="input" placeholder="输入被测单位名称" /></div>
          <div class="input-group"><label for="project_location">项目地点</label><input id="project_location" v-model="form.project_location" class="input" placeholder="如：太原" /></div>
          <div class="input-group">
            <label for="business_category">业务类别 *</label>
            <select id="business_category" v-model="form.business_category" class="select" required>
              <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
            </select>
          </div>
          <div class="input-group">
            <label for="contract_status">合同状态</label>
            <select id="contract_status" v-model="form.contract_status" class="select"><option value="已签订">已签订</option><option value="未签订">未签订</option></select>
          </div>
          <div class="input-group">
            <label for="filing_status">备案情况</label>
            <select id="filing_status" v-model="form.filing_status" class="select"><option value="已备案">已备案</option><option value="未备案">未备案</option></select>
          </div>
          <div class="input-group">
            <label for="business_manager_name">业务负责人</label>
            <input id="business_manager_name" v-model="form.business_manager_name" class="input" placeholder="输入业务负责人姓名" />
          </div>
          <div class="input-group">
            <label for="implementation_manager_id">实施负责人</label>
            <select id="implementation_manager_id" v-model="form.implementation_manager_id" class="select"><option :value="null">请选择</option><option v-for="u in allUsers" :key="u.id" :value="u.id">{{ u.display_name }}</option></select>
          </div>
          <div class="input-group"><label for="contact_name">客户联系人</label><input id="contact_name" v-model="form.contact_name" class="input" placeholder="输入客户联系人姓名" /></div>
          <div class="input-group"><label for="contact_phone">联系电话</label><input id="contact_phone" v-model="form.contact_phone" class="input" placeholder="输入联系电话" /></div>
        </div>
      </section>

      <!-- 系统信息 -->
      <section class="form-section card">
        <div class="section-header-row">
          <h2 class="section-title">系统信息</h2>
          <button type="button" class="btn btn-secondary btn-sm" @click="addSystem">+ 添加系统</button>
        </div>

        <div v-if="form.systems.length === 0" class="empty-systems"><p class="text-muted">暂无系统，点击上方按钮添加</p></div>

        <div v-else class="systems-list">
          <div v-for="(sys, index) in form.systems" :key="index" class="system-item">
            <div class="system-fields">
              <div class="input-group"><label>系统编号</label><input v-model="sys.system_code" class="input" placeholder="可选" /></div>
              <div class="input-group"><label>系统名称 *</label><input v-model="sys.system_name" class="input" placeholder="输入系统名称" required /></div>
              <div class="input-group">
                <label>系统级别</label>
                <select v-model="sys.system_level" class="select">
                  <option value="第一级">第一级</option><option value="第二级">第二级</option><option value="第三级">第三级</option><option value="第四级">第四级</option><option value="第五级">第五级</option>
                </select>
              </div>
              <div class="input-group">
                <label>系统类型</label>
                <select v-model="sys.system_type" class="select">
                  <option value="传统系统">传统系统</option><option value="云计算（租户）">云计算（租户）</option><option value="云计算（平台）">云计算（平台）</option><option value="工控系统">工控系统</option><option value="物联网">物联网</option><option value="移动互联">移动互联</option><option value="大数据">大数据</option>
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
        <button type="button" class="btn btn-secondary" @click="router.back()">取消</button>
        <button type="submit" class="btn btn-primary" :disabled="submitting">{{ submitting ? '保存中...' : (isEdit ? '保存修改' : '创建项目') }}</button>
      </div>
    </form>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { projectsApi, usersApi } from '../api'
import AppLayout from '../components/AppLayout.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const submitting = ref(false)
const allUsers = ref([])

const categories = [
  { value: '等保测评', label: '等保测评' }, { value: '密码评估', label: '密码评估' },
  { value: '风险评估', label: '风险评估' }, { value: '安全评估', label: '安全评估' },
  { value: '数据评估', label: '数据评估' }, { value: '软件测试', label: '软件测试' },
  { value: '安全服务', label: '安全服务' }, { value: '其他', label: '其他' }
]

const form = reactive({
  project_code: '', project_name: '', client_name: '', business_category: '等保测评',
  project_location: '', contract_status: '未签订', filing_status: '未备案',
  priority: '/', business_manager_name: '', implementation_manager_id: null,
  contact_name: '', contact_phone: '',
  systems: []
})

function addSystem() {
  form.systems.push({ system_code: '', system_name: '', system_level: '第二级', system_type: '传统系统', archive_status: '否' })
}

function removeSystem(index) { form.systems.splice(index, 1) }

async function handleSubmit() {
  // 警告用户未填写系统名称的系统将被忽略
  const emptySystems = form.systems.filter(s => !s.system_name.trim())
  if (emptySystems.length > 0) {
    if (!confirm(`有 ${emptySystems.length} 个系统未填写名称，提交时将被忽略。是否继续？`)) return
  }

  submitting.value = true
  try {
    const data = { ...form, systems: form.systems.filter(s => s.system_name.trim()) }
    if (isEdit.value) {
      await projectsApi.update(route.params.id, data)
    } else {
      await projectsApi.create(data)
    }
    router.push('/projects')
  } catch (err) {
    console.error('Submit failed:', err)
    alert(err.response?.data?.detail || '操作失败')
  } finally { submitting.value = false }
}

async function fetchData() {
  loading.value = true
  try {
    const usersRes = await usersApi.getAll()
    allUsers.value = usersRes.data
    if (isEdit.value) {
      const res = await projectsApi.get(route.params.id)
      const p = res.data
      Object.assign(form, {
        project_code: p.project_code, project_name: p.project_name, client_name: p.client_name,
        business_category: p.business_category, project_location: p.project_location,
        contract_status: p.contract_status, filing_status: p.filing_status,
        priority: p.priority || '/',
        business_manager_name: p.business_manager_name || '', implementation_manager_id: p.implementation_manager_id,
        contact_name: p.contact_name || '', contact_phone: p.contact_phone || '',
        systems: p.systems.map(s => ({ system_code: s.system_code, system_name: s.system_name, system_level: s.system_level, system_type: s.system_type, archive_status: s.archive_status || '否' }))
      })
    }
  } catch (err) { console.error('Fetch failed:', err) }
  finally { loading.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { margin-bottom: 2rem; }
.page-header h1 { font-family: 'DM Serif Display', serif; font-size: 1.5rem; font-weight: 400; }
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

@media (max-width: 900px) { .form-grid { grid-template-columns: 1fr; } .system-fields { grid-template-columns: 1fr 1fr; } }
</style>
