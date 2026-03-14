<template>
  <AppLayout>
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
                <button class="btn btn-ghost btn-sm" @click="confirmResetPassword(user)" title="重置密码"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></button>
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

    <!-- 重置密码确认 -->
    <div v-if="showResetModal" class="modal-overlay" @click.self="showResetModal = false">
      <div class="modal">
        <div class="modal-header"><h2>重置密码</h2><button class="btn btn-ghost" @click="showResetModal = false">✕</button></div>
        <div class="modal-body"><p>确定要重置用户 <strong>{{ userToReset?.display_name }}</strong> 的密码为默认密码 <code>123456</code> 吗？</p><p class="text-muted" style="margin-top: 0.5rem; font-size: 0.85rem;">该用户下次登录时将被要求修改密码。</p></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showResetModal = false">取消</button>
          <button class="btn btn-primary" @click="resetPassword" :disabled="resetting">{{ resetting ? '重置中...' : '确认重置' }}</button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { usersApi } from '../api'
import AppLayout from '../components/AppLayout.vue'

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
const showResetModal = ref(false)
const userToReset = ref(null)
const resetting = ref(false)

const form = reactive({ username: '', password: '', display_name: '', role: 'employee', department: '' })

function formatDate(dateStr) {
  if (!dateStr) return '/'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

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

function confirmDelete(user) { userToDelete.value = user; showDeleteModal.value = true }
function confirmResetPassword(user) { userToReset.value = user; showResetModal.value = true }

async function resetPassword() {
  resetting.value = true
  try {
    const res = await usersApi.resetPassword(userToReset.value.id)
    showResetModal.value = false
    alert(res.data.message || '密码重置成功')
  } catch (err) { console.error(err); alert(err.response?.data?.detail || '重置失败') }
  finally { resetting.value = false }
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
    userToDelete.value = null
    await fetchUsers()
  } catch (err) {
    console.error(err)
    alert(err.response?.data?.detail || '删除失败，请稍后重试')
  } finally { deleting.value = false }
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
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-family: 'DM Serif Display', serif; font-size: 1.5rem; font-weight: 400; margin-bottom: 0.25rem; }
.loading-container { display: flex; justify-content: center; padding: 4rem; }
.action-btns { display: flex; gap: 0.25rem; }
.modal-body { display: flex; flex-direction: column; gap: 1rem; }
</style>
