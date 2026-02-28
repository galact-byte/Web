<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header"><div class="logo"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></div><span class="logo-text">完结单平台</span></div>
      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg><span>仪表盘</span></router-link>
        <router-link to="/projects" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span>项目管理</span></router-link>
        <router-link to="/workload" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg><span>工作量统计</span></router-link>
        <router-link to="/export" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg><span>导出完结单</span></router-link>
        <router-link v-if="userStore.isManager" to="/users" class="nav-item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg><span>用户管理</span></router-link>
        <router-link v-if="userStore.isManager" to="/backup" class="nav-item active"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span>备份恢复</span></router-link>
      </nav>
      <div class="sidebar-footer"><div class="user-info"><div class="avatar">{{ userStore.user?.display_name?.charAt(0) || 'U' }}</div><div class="user-details"><div class="user-name">{{ userStore.user?.display_name }}</div><div class="user-role">{{ userStore.isManager ? '经理' : '员工' }}</div></div></div><div class="footer-actions"><button class="btn-theme" @click="toggleTheme" :title="isDark ? '切换浅色主题' : '切换深色主题'"><svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg><svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg></button><button class="btn-logout" @click="handleLogout"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></button></div></div>
    </aside>

    <main class="main-content">
      <header class="page-header">
        <div><h1>备份与恢复</h1><p class="text-muted">管理数据库备份，防止数据丢失</p></div>
      </header>

      <!-- 备份操作 -->
      <section class="card">
        <h2>数据备份</h2>
        <p class="section-desc">将当前数据库中的所有数据导出为备份文件，建议定期备份。</p>
        <div class="backup-actions">
          <div class="backup-card" @click="exportJson">
            <div class="backup-icon json-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            </div>
            <div class="backup-info">
              <h3>JSON 备份</h3>
              <p>导出所有数据为 JSON 格式，可用于跨数据库恢复</p>
            </div>
            <div class="backup-status">
              <span v-if="exportingJson" class="loading-spinner-sm"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </div>
          </div>

          <div class="backup-card" @click="downloadDb">
            <div class="backup-icon db-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
            </div>
            <div class="backup-info">
              <h3>数据库文件备份</h3>
              <p>直接下载 SQLite 数据库文件（仅 SQLite 模式可用）</p>
            </div>
            <div class="backup-status">
              <span v-if="downloadingDb" class="loading-spinner-sm"></span>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </div>
          </div>
        </div>
      </section>

      <!-- 恢复操作 -->
      <section class="card restore-section">
        <h2>数据恢复</h2>
        <p class="section-desc warning-text">从 JSON 备份文件恢复数据。此操作将覆盖当前所有数据，请谨慎操作！</p>

        <div class="restore-area" :class="{ 'drag-over': isDragOver }" @dragover.prevent="isDragOver = true" @dragleave="isDragOver = false" @drop.prevent="handleDrop">
          <input type="file" ref="fileInput" accept=".json" @change="handleFileSelect" style="display: none" />

          <div v-if="!selectedFile" class="upload-prompt" @click="$refs.fileInput.click()">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <h3>点击或拖拽上传备份文件</h3>
            <p>支持 .json 格式的备份文件</p>
          </div>

          <div v-else class="file-selected">
            <div class="file-info">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <div>
                <div class="file-name">{{ selectedFile.name }}</div>
                <div class="file-size">{{ formatFileSize(selectedFile.size) }}</div>
              </div>
            </div>
            <div class="file-actions">
              <button class="btn btn-ghost btn-sm" @click="clearFile">取消</button>
              <button class="btn btn-danger btn-sm" @click="confirmRestore" :disabled="importing">
                {{ importing ? '恢复中...' : '确认恢复' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 恢复结果 -->
        <div v-if="restoreResult" class="restore-result">
          <div class="result-icon success">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div class="result-info">
            <h3>恢复成功</h3>
            <div class="result-stats">
              <span>用户: {{ restoreResult.users }}</span>
              <span>项目: {{ restoreResult.projects }}</span>
              <span>系统: {{ restoreResult.systems }}</span>
              <span>分配: {{ restoreResult.assignments }}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- 确认弹窗 -->
  <div v-if="showConfirm" class="modal-overlay" @click.self="showConfirm = false">
    <div class="modal">
      <div class="modal-header">
        <h3>确认恢复数据？</h3>
      </div>
      <div class="modal-body">
        <p class="warning-text">此操作将清空当前数据库中的所有数据，并用备份文件中的数据替换。</p>
        <p><strong>此操作不可撤销，请确保已备份当前数据！</strong></p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" @click="showConfirm = false">取消</button>
        <button class="btn btn-danger" @click="doRestore" :disabled="importing">
          {{ importing ? '恢复中...' : '确认恢复' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { backupApi } from '../api'

const router = useRouter()
const userStore = useUserStore()

const exportingJson = ref(false)
const downloadingDb = ref(false)
const importing = ref(false)
const selectedFile = ref(null)
const isDragOver = ref(false)
const showConfirm = ref(false)
const restoreResult = ref(null)
const fileInput = ref(null)
const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')

function handleLogout() { userStore.logout(); router.push('/login') }
function toggleTheme() { isDark.value = !isDark.value; const t = isDark.value ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', t); localStorage.setItem('theme', t) }

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function triggerDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

async function exportJson() {
  if (exportingJson.value) return
  exportingJson.value = true
  try {
    const response = await backupApi.exportJson()
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_')
    triggerDownload(new Blob([response.data]), `backup_${timestamp}.json`)
  } catch (err) {
    console.error(err)
    alert('导出失败: ' + (err.response?.data?.detail || err.message))
  } finally {
    exportingJson.value = false
  }
}

async function downloadDb() {
  if (downloadingDb.value) return
  downloadingDb.value = true
  try {
    const response = await backupApi.downloadDb()
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_')
    triggerDownload(new Blob([response.data]), `backup_${timestamp}.db`)
  } catch (err) {
    console.error(err)
    const msg = err.response?.status === 400 ? '当前数据库非 SQLite，不支持直接下载' : '下载失败'
    alert(msg)
  } finally {
    downloadingDb.value = false
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file && file.name.endsWith('.json')) {
    selectedFile.value = file
    restoreResult.value = null
  } else if (file) {
    alert('仅支持 .json 格式的备份文件')
  }
}

function handleDrop(e) {
  isDragOver.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.name.endsWith('.json')) {
    selectedFile.value = file
    restoreResult.value = null
  } else if (file) {
    alert('仅支持 .json 格式的备份文件')
  }
}

function clearFile() {
  selectedFile.value = null
  restoreResult.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function confirmRestore() {
  showConfirm.value = true
}

async function doRestore() {
  if (!selectedFile.value || importing.value) return
  importing.value = true
  showConfirm.value = false
  try {
    const response = await backupApi.importJson(selectedFile.value)
    restoreResult.value = response.data.stats
    selectedFile.value = null
    if (fileInput.value) fileInput.value.value = ''
    // 恢复后刷新当前用户状态
    await userStore.fetchCurrentUser()
  } catch (err) {
    console.error(err)
    alert('恢复失败: ' + (err.response?.data?.detail || err.message))
  } finally {
    importing.value = false
  }
}
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
.page-header { margin-bottom: 2rem; }
.page-header h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; }

.card h2 { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
.section-desc { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.25rem; }
.warning-text { color: var(--error); }

/* 备份卡片 */
.backup-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.backup-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast); }
.backup-card:hover { border-color: var(--accent-primary); box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15); }
.backup-icon { width: 56px; height: 56px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.json-icon { background: rgba(99, 102, 241, 0.15); color: var(--accent-primary); }
.db-icon { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.backup-info { flex: 1; }
.backup-info h3 { font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem; }
.backup-info p { font-size: 0.85rem; color: var(--text-secondary); margin: 0; }
.backup-status { color: var(--text-muted); }

/* 恢复区域 */
.restore-section { margin-top: 1.5rem; }
.restore-area { border: 2px dashed var(--border-color); border-radius: var(--radius-md); padding: 2rem; text-align: center; transition: all var(--transition-fast); }
.restore-area.drag-over { border-color: var(--accent-primary); background: rgba(99, 102, 241, 0.05); }
.upload-prompt { cursor: pointer; color: var(--text-secondary); }
.upload-prompt svg { margin: 0 auto 1rem; display: block; color: var(--text-muted); }
.upload-prompt h3 { font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-primary); }
.upload-prompt p { font-size: 0.85rem; margin: 0; }

.file-selected { display: flex; align-items: center; justify-content: space-between; }
.file-info { display: flex; align-items: center; gap: 0.75rem; color: var(--accent-primary); }
.file-name { font-weight: 500; }
.file-size { font-size: 0.8rem; color: var(--text-muted); }
.file-actions { display: flex; align-items: center; gap: 0.5rem; }

.btn-danger { background: var(--error); color: white; border: none; padding: 0.5rem 1rem; border-radius: var(--radius-sm); cursor: pointer; font-weight: 500; }
.btn-danger:hover { opacity: 0.9; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

/* 恢复结果 */
.restore-result { display: flex; align-items: center; gap: 1rem; margin-top: 1.25rem; padding: 1rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); }
.result-icon.success { color: #10b981; }
.result-info h3 { font-size: 1rem; font-weight: 600; color: #10b981; margin-bottom: 0.25rem; }
.result-stats { display: flex; gap: 1.5rem; font-size: 0.85rem; color: var(--text-secondary); }

/* 确认弹窗 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal { background: var(--bg-primary); border-radius: var(--radius-lg, 12px); padding: 1.5rem; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); }
.modal-header h3 { font-size: 1.15rem; font-weight: 600; margin-bottom: 1rem; }
.modal-body p { margin-bottom: 0.75rem; font-size: 0.9rem; color: var(--text-secondary); }
.modal-body p strong { color: var(--text-primary); }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }

.loading-spinner-sm { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border-color); border-top-color: var(--accent-primary); border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
