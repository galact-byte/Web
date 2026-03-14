<template>
  <AppLayout>
    <header class="page-header">
      <div>
        <h1>项目管理</h1>
        <p class="text-muted">管理所有项目和系统信息</p>
      </div>
      <div class="header-actions">
        <div class="filter-group">
          <select v-model="statusFilter" class="select" style="width: 140px;">
            <option value="">全部状态</option>
            <option value="draft">待分发</option>
            <option value="assigned">进行中</option>
            <option value="completed">已完成</option>
          </select>
        </div>
        <router-link v-if="userStore.isManager" to="/projects/create" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          新建项目
        </router-link>
      </div>
    </header>

    <div v-if="loading" class="loading-container"><div class="loading-spinner"></div></div>

    <div v-else-if="filteredProjects.length === 0" class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
      <h3>暂无项目</h3>
      <p>{{ userStore.isManager ? '点击右上角按钮创建第一个项目' : '等待经理分配项目' }}</p>
    </div>

    <div v-else class="table-container">
      <table class="table">
        <thead>
          <tr><th>项目编号</th><th>项目名称</th><th>客户单位</th><th>业务类别</th><th>项目地点</th><th>系统数</th><th>状态</th><th>操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="project in filteredProjects" :key="project.id">
            <td><code>{{ project.project_code }}</code></td>
            <td><router-link :to="`/projects/${project.id}`" class="project-link">{{ project.project_name }}</router-link></td>
            <td>{{ project.client_name || '/' }}</td>
            <td><span class="badge badge-primary">{{ getCategoryShort(project.business_category) }}</span></td>
            <td>{{ project.project_location || '/' }}</td>
            <td>{{ project.systems_count }}</td>
            <td>
              <span class="badge" :class="getStatusClass(project.status)">{{ getStatusText(project.status) }}</span>
              <span v-if="project.status === 'assigned' && project.total_employee_count > 0" class="submit-progress">
                {{ project.submitted_count }}/{{ project.total_employee_count }}
              </span>
            </td>
            <td>
              <div class="action-btns">
                <router-link :to="`/projects/${project.id}`" class="btn btn-ghost btn-sm" title="查看">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </router-link>
                <router-link v-if="userStore.isManager" :to="`/projects/${project.id}/edit`" class="btn btn-ghost btn-sm" title="编辑">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </router-link>
                <button v-if="userStore.isManager" class="btn btn-ghost btn-sm" @click="confirmDelete(project)" title="删除">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 删除确认模态框 -->
    <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
      <div class="modal">
        <div class="modal-header"><h2>确认删除</h2><button class="btn btn-ghost" @click="showDeleteModal = false">✕</button></div>
        <div class="modal-body">
          <p>确定要删除项目 <strong>{{ projectToDelete?.project_name }}</strong> 吗？</p>
          <p class="text-muted mt-1">此操作不可撤销，相关的系统和分配记录也将被删除。</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="showDeleteModal = false">取消</button>
          <button class="btn btn-danger" @click="deleteProject" :disabled="deleting">{{ deleting ? '删除中...' : '确认删除' }}</button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { projectsApi } from '../api'
import AppLayout from '../components/AppLayout.vue'
import { getCategoryShort, getStatusClass, getStatusText } from '../utils/project'

const userStore = useUserStore()

const loading = ref(true)
const projects = ref([])
const statusFilter = ref('')
const showDeleteModal = ref(false)
const projectToDelete = ref(null)
const deleting = ref(false)

const filteredProjects = computed(() => {
  if (!statusFilter.value) return projects.value
  return projects.value.filter(p => p.status === statusFilter.value)
})

function confirmDelete(project) { projectToDelete.value = project; showDeleteModal.value = true }

async function deleteProject() {
  if (!projectToDelete.value) return
  deleting.value = true
  try {
    await projectsApi.delete(projectToDelete.value.id)
    projects.value = projects.value.filter(p => p.id !== projectToDelete.value.id)
    showDeleteModal.value = false
    projectToDelete.value = null
  } catch (err) {
    console.error('Delete failed:', err)
    alert(err.response?.data?.detail || '删除失败，请稍后重试')
  } finally { deleting.value = false }
}

async function fetchProjects() {
  loading.value = true
  try {
    const response = await projectsApi.getAll()
    projects.value = response.data
  } catch (err) { console.error('Fetch failed:', err) }
  finally { loading.value = false }
}

onMounted(fetchProjects)
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; }
.page-header h1 { font-family: 'DM Serif Display', serif; font-size: 1.5rem; font-weight: 400; margin-bottom: 0.25rem; }
.header-actions { display: flex; gap: 1rem; align-items: center; }
.filter-group { display: flex; gap: 0.5rem; }
.loading-container { display: flex; justify-content: center; padding: 4rem; }
.project-link { color: var(--accent-primary); font-weight: 500; }
.project-link:hover { text-decoration: underline; }
.action-btns { display: flex; gap: 0.25rem; }
code { background: var(--bg-tertiary); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.85rem; }
.submit-progress { font-size: 0.75rem; color: var(--text-muted); margin-left: 0.4rem; }
</style>
