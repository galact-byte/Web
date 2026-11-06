<template>
  <div class="multi-project">
    <div class="page-header">
      <div class="title-group">
        <h2>多项目批量生成</h2>
        <p class="subtitle">批量管理并生成多个项目的过程文档</p>
      </div>
      <div class="actions">
        <div class="secondary-actions">
          <el-button @click="openOutputFolder">
            <el-icon class="el-icon--left"><FolderOpened /></el-icon>
            打开输出目录
          </el-button>
          <el-button @click="loadData">
            <el-icon class="el-icon--left"><Refresh /></el-icon>
            刷新列表
          </el-button>
          <el-button @click="showHistoryDialog">
            <el-icon class="el-icon--left"><Clock /></el-icon>
            历史记录
          </el-button>
          <el-button @click="showRecycleBin">
            <el-icon class="el-icon--left"><Delete /></el-icon>
            回收站
            <el-badge v-if="recycleBin.length > 0" :value="recycleBin.length" class="badge-inline" />
          </el-button>
          <el-button type="warning" plain @click="clearAll" :disabled="projects.length === 0">
            <el-icon class="el-icon--left"><DeleteFilled /></el-icon>
            清空列表
          </el-button>
        </div>
        <div class="primary-actions">
          <el-button type="primary" plain @click="addProject">
            <el-icon class="el-icon--left"><Plus /></el-icon>
            新增项目
          </el-button>
          <el-button
            type="primary"
            @click="generate"
            :loading="generating"
            :disabled="projects.length === 0"
          >
            <el-icon class="el-icon--left"><Files /></el-icon>
            批量生成
          </el-button>
        </div>
      </div>
    </div>

    <el-card class="table-card" shadow="never">
      <el-table
        :data="projects"
        style="width: 100%"
        stripe
        empty-text="暂无项目数据，请点击右上角「新增项目」添加"
      >
        <el-table-column type="index" label="#" width="48" align="center" />
        <el-table-column prop="项目编号" label="项目编号" width="132" show-overflow-tooltip>
          <template #default="scope">
            <el-tag v-if="scope.row.项目编号" type="info" effect="plain">
              {{ scope.row.项目编号 }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="项目名称" label="项目名称" min-width="160" show-overflow-tooltip>
          <template #default="scope">
            <span style="font-weight: 500">{{ scope.row.项目名称 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="单位名称" label="单位名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="系统" label="包含系统" width="96" align="center">
          <template #default="scope">
            <el-tag size="small" type="primary">
              {{ scope.row.系统 ? scope.row.系统.length : 0 }} 个
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="210" align="center">
          <template #default="scope">
            <el-button
              link
              type="primary"
              :icon="Edit"
              @click="editProject(scope.$index, scope.row)"
            >
              编辑
            </el-button>
            <el-button
              link
              type="primary"
              :icon="CopyDocument"
              @click="duplicateProject(scope.$index, scope.row)"
            >
              复制
            </el-button>
            <el-button link type="danger" :icon="Delete" @click="deleteProject(scope.$index)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div v-if="showTips" class="footer-tip">
      <el-alert
        title="提示：点击「批量生成」将依次处理列表中的所有项目；删除或清空的项目可在「回收站」中找回。"
        type="info"
        show-icon
        :closable="false"
      />
    </div>

    <!-- 编辑/新增项目对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑项目' : '新增项目'"
      width="780px"
      top="5vh"
    >
      <el-form ref="projectFormRef" :model="projectForm" :rules="projectRules" label-width="120px">
        <el-form-item label="项目编号" prop="项目编号">
          <el-input v-model="projectForm.项目编号" placeholder="请输入项目编号/测评编号" clearable />
        </el-form-item>
        <el-form-item label="项目名称" prop="项目名称" required>
          <el-input v-model="projectForm.项目名称" placeholder="请输入项目名称（必填）" clearable />
        </el-form-item>
        <el-form-item label="单位名称" prop="单位名称">
          <el-input v-model="projectForm.单位名称" placeholder="请输入单位名称" clearable />
        </el-form-item>
        <el-form-item label="委托单位联系人" prop="委托单位联系人">
          <el-input v-model="projectForm.委托单位联系人" placeholder="请输入联系人" clearable />
        </el-form-item>
        <el-form-item label="委托单位联系方式" prop="委托单位联系方式">
          <el-input v-model="projectForm.委托单位联系方式" placeholder="请输入联系方式" clearable />
        </el-form-item>
        <el-form-item label="具体业务名称" prop="具体业务名称">
          <el-input v-model="projectForm.具体业务名称" placeholder="请输入业务名称" clearable />
        </el-form-item>
        <el-form-item label="业务影响" prop="业务影响">
          <el-input v-model="projectForm.业务影响" placeholder="默认为: 中断、停机等" clearable />
        </el-form-item>
        <el-form-item label="影响后果" prop="影响后果">
          <el-input
            v-model="projectForm.影响后果"
            placeholder="默认为: 关键业务无法办理等"
            clearable
          />
        </el-form-item>

        <el-divider content-position="left">包含系统 ({{ projectForm.系统.length }})</el-divider>
        <el-row
          v-for="(sys, idx) in projectForm.系统"
          :key="idx"
          :gutter="10"
          style="margin-bottom: 10px"
        >
          <el-col :span="14">
            <el-input v-model="sys.系统名称" placeholder="系统名称" clearable />
          </el-col>
          <el-col :span="6">
            <el-select v-model="sys.系统级别" placeholder="级别">
              <el-option label="二级" value="二级" />
              <el-option label="三级" value="三级" />
              <el-option label="四级" value="四级" />
            </el-select>
          </el-col>
          <el-col :span="4">
            <el-button
              type="danger"
              :icon="Delete"
              circle
              aria-label="删除系统"
              title="删除系统"
              @click="projectForm.系统.splice(idx, 1)"
            />
          </el-col>
        </el-row>
        <el-button
          type="primary"
          plain
          :icon="Plus"
          @click="projectForm.系统.push({ 系统名称: '', 系统级别: '三级' })"
          style="width: 100%"
        >
          添加系统
        </el-button>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveProject">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 回收站对话框 -->
    <el-dialog v-model="recycleBinVisible" title="多项目回收站" width="860px" top="5vh">
      <el-table :data="recycleBin" style="width: 100%" max-height="500" empty-text="回收站是空的">
        <el-table-column type="index" label="#" width="60" align="center" />
        <el-table-column prop="项目编号" label="项目编号" width="140" show-overflow-tooltip />
        <el-table-column prop="项目名称" label="项目名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="单位名称" label="单位名称" width="180" show-overflow-tooltip />
        <el-table-column prop="deletedAt" label="删除时间" width="180" />
        <el-table-column label="操作" width="160" align="center">
          <template #default="scope">
            <el-button link type="success" @click="restoreProject(scope.$index)">
              <el-icon><RefreshLeft /></el-icon>
              恢复
            </el-button>
            <el-button link type="danger" @click="permanentDelete(scope.$index)">
              <el-icon><Delete /></el-icon>
              彻底删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="recycleBinVisible = false">关闭</el-button>
        <el-button type="danger" @click="clearRecycleBin" :disabled="recycleBin.length === 0">
          清空回收站
        </el-button>
      </template>
    </el-dialog>

    <!-- 历史记录对话框 -->
    <el-dialog v-model="historyVisible" title="多项目历史记录 (最近20条)" width="860px" top="5vh">
      <el-timeline v-if="historyRecords.length > 0">
        <el-timeline-item
          v-for="(record, idx) in historyRecords"
          :key="idx"
          :timestamp="record.timestamp"
          placement="top"
        >
          <el-card shadow="hover">
            <div class="history-card-header">
              <span>共 {{ record.data.projects?.length || 0 }} 个项目</span>
              <div class="history-card-actions">
                <el-button type="primary" size="small" @click="loadFromHistory(idx)">
                  恢复此版本
                </el-button>
                <el-button type="danger" link size="small" @click="deleteHistoryRecord(idx)">
                  删除
                </el-button>
              </div>
            </div>
            <div class="history-projects">
              <el-tag
                v-for="(proj, pIdx) in (record.data.projects || []).slice(0, 5)"
                :key="pIdx"
                style="margin-right: 8px; margin-top: 8px"
              >
                {{ proj.项目名称 }}
              </el-tag>
              <span
                v-if="(record.data.projects?.length || 0) > 5"
                style="color: var(--el-text-color-secondary); margin-top: 8px"
              >
                ... 等 {{ record.data.projects.length }} 个项目
              </span>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无多项目历史记录" />
      <template #footer>
        <el-button @click="historyVisible = false">关闭</el-button>
        <el-button
          type="danger"
          @click="clearAllMultiHistory"
          :disabled="historyRecords.length === 0"
        >
          清空多项目历史
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  Refresh,
  Files,
  FolderOpened,
  Plus,
  Edit,
  CopyDocument,
  Delete,
  Clock,
  DeleteFilled,
  RefreshLeft
} from '@element-plus/icons-vue'
import {
  fetchSplitHistory,
  saveMultiHistoryList,
  type MultiHistoryEntry,
  type ProjectData
} from '../utils/history'
import { useSettings } from '../composables/useSettings'

const { showTips, notify } = useSettings()

const createEmptyProject = (): ProjectData => ({
  项目编号: '',
  项目名称: '',
  单位名称: '',
  委托单位联系人: '',
  委托单位联系方式: '',
  具体业务名称: '',
  业务影响: '',
  影响后果: '',
  系统: []
})

const projects = ref<ProjectData[]>([])
const generating = ref(false)
const recycleBin = ref<ProjectData[]>([])
const historyRecords = ref<MultiHistoryEntry[]>([])

const dialogVisible = ref(false)
const recycleBinVisible = ref(false)
const historyVisible = ref(false)
const isEditing = ref(false)
const editingIndex = ref(-1)
const projectFormRef = ref<FormInstance>()
const projectForm = ref<ProjectData>(createEmptyProject())

const projectRules: FormRules = {
  项目名称: [{ required: true, message: '请输入项目名称', trigger: 'blur' }]
}

const sanitizeProjects = (list: ProjectData[]): ProjectData[] =>
  list.map((p) => ({
    项目编号: p.项目编号 || '',
    项目名称: p.项目名称 || '',
    单位名称: p.单位名称 || '',
    委托单位联系人: p.委托单位联系人 || '',
    委托单位联系方式: p.委托单位联系方式 || '',
    具体业务名称: p.具体业务名称 || '',
    业务影响: p.业务影响 || '',
    影响后果: p.影响后果 || '',
    系统: (p.系统 || []).map((s) => ({
      系统名称: s.系统名称 || '',
      系统级别: s.系统级别 || '三级'
    }))
  }))

const loadData = async () => {
  try {
    const data = await window.api.readConfig('Projects.json')
    if (data && Array.isArray(data.projects)) {
      projects.value = data.projects
      notify('success', `已加载 ${projects.value.length} 个项目`)
    } else {
      projects.value = []
    }
  } catch (e) {
    ElMessage.error('加载失败: ' + e)
  }
}

const loadRecycleBin = async () => {
  try {
    const data = await window.api.readConfig('RecycleBin.json')
    recycleBin.value = Array.isArray(data?.projects) ? data.projects : []
  } catch (e) {
    console.error('Failed to load recycle bin:', e)
  }
}

const saveRecycleBin = async () => {
  try {
    const plain = JSON.parse(JSON.stringify(recycleBin.value))
    const ok = await window.api.saveFile('RecycleBin.json', { projects: plain })
    if (!ok) throw new Error('保存失败')
  } catch (e) {
    console.error('Failed to save recycle bin:', e)
    ElMessage.error('回收站保存失败: ' + e)
  }
}

const saveToHistory = async () => {
  try {
    const cleanCurrent = sanitizeProjects(projects.value)
    if (cleanCurrent.length === 0) return

    const { multi } = await fetchSplitHistory()
    if (multi.length > 0) {
      const lastProjects = multi[0]?.data?.projects || []
      if (JSON.stringify(lastProjects) === JSON.stringify(cleanCurrent)) {
        return
      }
    }

    const newEntry: MultiHistoryEntry = {
      mode: 'multi',
      timestamp: new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      data: { projects: cleanCurrent }
    }
    const nextMulti = [newEntry, ...multi].slice(0, 20)
    await saveMultiHistoryList(nextMulti)
    historyRecords.value = nextMulti
  } catch (e) {
    console.error('Failed to save history:', e)
  }
}

const loadHistory = async () => {
  try {
    const { multi } = await fetchSplitHistory()
    historyRecords.value = multi
  } catch (e) {
    console.error('Failed to load history:', e)
  }
}

const deleteHistoryRecord = async (index: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条历史版本记录吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const nextList = [...historyRecords.value]
    nextList.splice(index, 1)
    const ok = await saveMultiHistoryList(nextList)
    if (ok) {
      historyRecords.value = nextList
      notify('success', '已删除历史版本')
    } else {
      ElMessage.error('删除历史记录失败')
    }
  } catch {
    // 用户取消
  }
}

const clearAllMultiHistory = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清空所有 ${historyRecords.value.length} 条多项目历史记录吗？此操作不可恢复！`,
      '警告',
      {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'error'
      }
    )
    const ok = await saveMultiHistoryList([])
    if (ok) {
      historyRecords.value = []
      historyVisible.value = false
      notify('success', '已清空多项目历史记录')
    } else {
      ElMessage.error('清空历史记录失败')
    }
  } catch {
    // 用户取消
  }
}

const saveToFile = async () => {
  try {
    await saveToHistory()
    const cleanProjects = sanitizeProjects(projects.value)
    const success = await window.api.saveFile('Projects.json', { projects: cleanProjects })
    if (!success) {
      throw new Error('保存失败')
    }
    return true
  } catch (e) {
    console.error('Failed to save projects:', e)
    ElMessage.error('保存失败: ' + e)
    return false
  }
}

const addProject = () => {
  isEditing.value = false
  projectForm.value = createEmptyProject()
  projectFormRef.value?.clearValidate()
  dialogVisible.value = true
}

const editProject = (index: number, row: ProjectData) => {
  isEditing.value = true
  editingIndex.value = index
  const cloned = JSON.parse(JSON.stringify(row))
  projectForm.value = {
    ...createEmptyProject(),
    ...cloned,
    系统: Array.isArray(cloned.系统) ? cloned.系统 : []
  }
  projectFormRef.value?.clearValidate()
  dialogVisible.value = true
}

const duplicateProject = async (index: number, row: ProjectData) => {
  const cloned: ProjectData = JSON.parse(JSON.stringify(row))
  cloned.项目名称 = `${cloned.项目名称 || '未命名项目'} - 副本`
  projects.value.splice(index + 1, 0, cloned)
  const success = await saveToFile()
  if (success) {
    notify('success', '已复制项目')
  }
}

const deleteProject = async (index: number) => {
  try {
    await ElMessageBox.confirm('删除的项目将移到回收站，确定删除吗？', '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const deletedProject = JSON.parse(JSON.stringify(projects.value[index]))
    deletedProject.deletedAt = new Date().toLocaleString('zh-CN')
    recycleBin.value.push(deletedProject)

    projects.value.splice(index, 1)

    const success = await saveToFile()
    if (success) {
      await saveRecycleBin()
      notify('success', '已删除（可在回收站中恢复）')
    }
  } catch {
    // User cancelled
  }
}

const clearAll = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清空所有 ${projects.value.length} 个项目吗？清空的项目将移到回收站。`,
      '清空确认',
      {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const timestamp = new Date().toLocaleString('zh-CN')
    projects.value.forEach((proj) => {
      const deleted = JSON.parse(JSON.stringify(proj))
      deleted.deletedAt = timestamp
      recycleBin.value.push(deleted)
    })

    projects.value = []

    const success = await saveToFile()
    if (success) {
      await saveRecycleBin()
      notify('success', '已清空所有项目（可在回收站中恢复）')
    }
  } catch {
    // User cancelled
  }
}

const restoreProject = async (index: number) => {
  const project = JSON.parse(JSON.stringify(recycleBin.value[index]))
  delete project.deletedAt

  projects.value.push(project)
  recycleBin.value.splice(index, 1)

  const success = await saveToFile()
  if (success) {
    await saveRecycleBin()
    notify('success', '项目已恢复')
  }
}

const permanentDelete = async (index: number) => {
  try {
    await ElMessageBox.confirm('彻底删除后无法恢复，确定吗？', '警告', {
      confirmButtonText: '彻底删除',
      cancelButtonText: '取消',
      type: 'error'
    })
    recycleBin.value.splice(index, 1)
    await saveRecycleBin()
    notify('success', '已彻底删除')
  } catch {
    // User cancelled
  }
}

const clearRecycleBin = async () => {
  try {
    await ElMessageBox.confirm('确定要清空回收站吗？此操作不可恢复！', '警告', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'error'
    })
    recycleBin.value = []
    await saveRecycleBin()
    notify('success', '回收站已清空')
  } catch {
    // User cancelled
  }
}

const showRecycleBin = () => {
  recycleBinVisible.value = true
}

const showHistoryDialog = async () => {
  await loadHistory()
  historyVisible.value = true
}

const loadFromHistory = async (index: number) => {
  try {
    await ElMessageBox.confirm('恢复此历史版本将覆盖当前的项目列表，确定吗？', '确认恢复', {
      confirmButtonText: '确定恢复',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const record = historyRecords.value[index]
    projects.value = JSON.parse(JSON.stringify(record.data.projects || []))

    const success = await saveToFile()
    if (success) {
      historyVisible.value = false
      notify('success', '已恢复历史版本')
    }
  } catch {
    // User cancelled
  }
}

const saveProject = async () => {
  if (projectFormRef.value) {
    try {
      await projectFormRef.value.validate()
    } catch {
      ElMessage.warning('项目名称不能为空')
      return
    }
  } else if (!projectForm.value.项目名称.trim()) {
    ElMessage.warning('项目名称不能为空')
    return
  }

  const hasEmptySystem = projectForm.value.系统.some((s) => !s.系统名称 || !s.系统名称.trim())
  if (hasEmptySystem) {
    ElMessage.warning('包含系统中存在未填写名称的系统，请补全或删除空行')
    return
  }

  if (isEditing.value) {
    projects.value[editingIndex.value] = JSON.parse(JSON.stringify(projectForm.value))
  } else {
    projects.value.push(JSON.parse(JSON.stringify(projectForm.value)))
  }

  const success = await saveToFile()
  if (success) {
    dialogVisible.value = false
    notify('success', '项目已保存')
  }
}

const openOutputFolder = async () => {
  try {
    const success = await window.api.openFolder('授权文档输出目录')
    if (!success) {
      ElMessage.warning('输出目录不存在或无法打开')
    }
  } catch (e) {
    ElMessage.error('打开失败: ' + e)
  }
}

const generate = async () => {
  if (projects.value.length === 0) {
    ElMessage.warning('没有项目可以生成')
    return
  }

  generating.value = true
  try {
    await saveToFile()
    const cleanProjects = sanitizeProjects(projects.value)
    const res = await window.api.runDocGen('2', { projects: cleanProjects })
    if (res.success) {
      notify('success', '批量生成完成，请检查输出目录')
    } else {
      console.error(res.error)
      ElMessageBox.alert(
        `错误信息:\n${res.error || res.output || 'Unknown Error'}`,
        '批量生成失败',
        {
          confirmButtonText: '确定',
          type: 'error',
          customStyle: { maxWidth: '90%' }
        }
      )
    }
  } catch (e) {
    console.error('执行出错:', e)
    ElMessage.error('执行出错: ' + e)
  } finally {
    generating.value = false
  }
}

onMounted(() => {
  loadData()
  loadHistory()
  loadRecycleBin()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;
  gap: 12px;
}

.title-group h2 {
  font-size: 20px;
  color: var(--text-main, #1f2937);
  margin-bottom: 4px;
}

.subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.secondary-actions,
.primary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.primary-actions {
  padding-left: 16px;
  border-left: 1px solid var(--el-border-color-lighter);
}

.badge-inline {
  margin-left: 6px;
}

.table-card {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
}

.text-muted {
  color: var(--el-text-color-placeholder);
}

.footer-tip {
  margin-top: 20px;
}

.history-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.history-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-projects {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
</style>
