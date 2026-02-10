<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header"><div class="logo"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div><span class="logo-text">完结单平台</span></div>
      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg><span>仪表盘</span></router-link>
        <router-link to="/projects" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span>项目管理</span></router-link>
        <router-link to="/workload" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg><span>工作量统计</span></router-link>
        <router-link to="/export" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>导出完结单</span></router-link>
        <router-link to="/users" class="nav-item active"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg><span>用户管理</span></router-link>
      </nav>
      <div class="sidebar-footer"><div class="user-info"><div class="avatar">{{ userStore.user?.display_name?.charAt(0) || 'U' }}</div><div class="user-details"><div class="user-name">{{ userStore.user?.display_name }}</div><div class="user-role">经理</div></div></div><div class="footer-actions"><button class="btn-theme" @click="toggleTheme" :title="isDark ? '切换浅色主题' : '切换深色主题'"><svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg><svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button><button class="btn-logout" @click="handleLogout"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></button></div></div>
    </aside>

    <main class="main-content">
      <header class="page-header">
        <div><h1>用户管理</h1><p class="text-muted">管理系统用户和权限</p></div>
        <button class="btn btn-primary" @click="openCreateModal">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          添加用户
        </button>
      </header>

      <div v-if="loading" class="loading-container"><div class="loading-spinner"></div></div>

      <div v-else class="table-container">
        <table class="table">
          <thead><tr><th>用户名</th><th>显示名称</th><th>角色</th><th>部门</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.username }}</td>
              <td>{{ user.display_name }}</td>
              <td><span class="badge" :class="user.role === 'manager' ? 'badge-primary' : 'badge-info'">{{ user.role === 'manager' ? '经理' : '员工' }}</span></td>
              <td>{{ user.department || '/' }}</td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td>
                <div class="action-btns">
                  <button class="btn btn-ghost btn-sm" @click="openEditModal(user)" title="编辑"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                  <button v-if="user.id !== userStore.user?.id" class="btn btn-ghost btn-sm" @click="confirmDelete(user)" title="删除"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 创建/编辑模态框 -->
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal">
          <div class="modal-header"><h2>{{ isEdit ? '编辑用户' : '添加用户' }}</h2><button class="btn btn-ghost" @click="showModal = false">✕</button></div>
          <form @submit.prevent="submitUser" class="modal-body">
            <div class="input-group"><label>用户名 *</label><input v-model="form.username" class="input" placeholder="登录用户名" required :disabled="isEdit" /></div>
            <div class="input-group" v-if="!isEdit"><label>密码 *</label><input v-model="form.password" type="password" class="input" placeholder="登录密码" required /></div>
            <div class="input-group"><label>显示名称 *</label><input v-model="form.display_name" class="input" placeholder="用户姓名" required /></div>
            <div class="input-group"><label>角色 *</label><select v-model="form.role" class="select" required><option value="employee">员工</option><option value="manager">经理</option></select></div>
            <div class="input-group"><label>部门</label><input v-model="form.department" class="input" placeholder="所属部门" /></div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showModal = false">取消</button>
            <button class="btn btn-primary" @click="submitUser" :disabled="submitting">{{ submitting ? '保存中...' : '保存' }}</button>
          </div>
        </div>
      </div>

      <!-- 删除确认 -->
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
        <div class="modal">
          <div class="modal-header"><h2>确认删除</h2><button class="btn btn-ghost" @click="showDeleteModal = false">✕</button></div>
          <div class="modal-body"><p>确定要删除用户 <strong>{{ userToDelete?.display_name }}</strong> 吗？</p></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showDeleteModal = false">取消</button>
            <button class="btn btn-danger" @click="deleteUser" :disabled="deleting">{{ deleting ? '删除中...' : '确认删除' }}</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { usersApi } from '../api'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const users = ref([])
const showModal = ref(false)
const showDeleteModal = ref(false)
const isEdit = ref(false)
const editingId = ref(null)
const userToDelete = ref(null)
const submitting = ref(false)
const deleting = ref(false)
const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')

const form = reactive({ username: '', password: '', display_name: '', role: 'employee', department: '' })

function formatDate(dateStr) {
  if (!dateStr) return '/'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function handleLogout() { userStore.logout(); router.push('/login') }
function toggleTheme() { isDark.value = !isDark.value; const t = isDark.value ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t) }

function openCreateModal() {
  isEdit.value = false
  editingId.value = null
  Object.assign(form, { username: '', password: '', display_name: '', role: 'employee', department: '' })
  showModal.value = true
}

function openEditModal(user) {
  isEdit.value = true
  editingId.value = user.id
  Object.assign(form, { username: user.username, password: '', display_name: user.display_name, role: user.role, department: user.department || '' })
  showModal.value = true
}

function confirmDelete(user) {
  userToDelete.value = user
  showDeleteModal.value = true
}

async function submitUser() {
  submitting.value = true
  try {
    if (isEdit.value) {
      await usersApi.update(editingId.value, { display_name: form.display_name, role: form.role, department: form.department })
    } else {
      await usersApi.create(form)
    }
    showModal.value = false
    await fetchUsers()
  } catch (err) { console.error(err); alert(err.response?.data?.detail || '操作失败') }
  finally { submitting.value = false }
}

async function deleteUser() {
  deleting.value = true
  try {
    await usersApi.delete(userToDelete.value.id)
    showDeleteModal.value = false
    await fetchUsers()
  } catch (err) { console.error(err) }
  finally { deleting.value = false }
}

async function fetchUsers() {
  loading.value = true
  try {
    const response = await usersApi.getAll()
    users.value = response.data
  } catch (err) { console.error(err) }
  finally { loading.value = false }
}

onMounted(fetchUsers)
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
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }

.loading-container { display: flex; justify-content: center; padding: 4rem; }
.action-btns { display: flex; gap: 0.25rem; }

.modal-body { display: flex; flex-direction: column; gap: 1rem; }
</style>
