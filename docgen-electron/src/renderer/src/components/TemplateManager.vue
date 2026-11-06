<template>
  <div class="template-manager">
    <div class="page-header">
      <div class="title-group">
        <h2>模板资源</h2>
        <p class="subtitle">管理用于生成的 Word 模板与 JSON 替换规则</p>
      </div>
      <div class="actions">
        <el-button @click="showRecycleBin">
          <el-icon class="el-icon--left"><Delete /></el-icon>
          回收站
          <el-badge
            v-if="recycleBin.length > 0"
            :value="recycleBin.length"
            style="margin-left: 8px"
          />
        </el-button>
        <input
          ref="fileInput"
          type="file"
          accept=".docx,.json"
          style="display: none"
          @change="handleFileSelect"
          multiple
        />
        <el-button type="primary" @click="triggerFileSelect">
          <el-icon class="el-icon--left"><Upload /></el-icon>
          上传资源
        </el-button>
      </div>
    </div>

    <div
      :class="['content-wrapper', { 'is-dragging': isDragging }]"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="handleFileDrop"
    >
      <div v-if="isDragging" class="drop-overlay">
        <el-icon class="drop-icon"><Upload /></el-icon>
        <span>释放鼠标以上传 .docx 模板或 .json 规则文件</span>
      </div>
      <el-tabs v-model="activeTab" class="custom-tabs">
        <el-tab-pane :label="`文档模板 (.docx) (${templates.length})`" name="templates">
          <el-table
            :data="templates"
            style="width: 100%"
            :show-header="true"
            row-class-name="file-row"
            empty-text="暂无 Word 模板，请点击右上角「上传资源」添加 .docx 文件"
          >
            <el-table-column label="类型" width="68" align="center">
              <template #default>
                <div class="icon-wrapper doc" aria-hidden="true">
                  <el-icon><Document /></el-icon>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="文件名" min-width="280" show-overflow-tooltip>
              <template #default="scope">
                <span class="file-name">{{ scope.row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="date" label="修改时间" width="160" />
            <el-table-column prop="size" label="大小" width="100" />
            <el-table-column label="操作" align="right" width="160">
              <template #default="scope">
                <el-button link type="primary" @click="previewTemplate(scope.row.name)">
                  打开预览
                </el-button>
                <el-button link type="danger" @click="deleteTemplate(scope.row.name)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`生成规则 (.json) (${rules.length})`" name="rules">
          <el-table
            :data="rules"
            style="width: 100%"
            :show-header="true"
            row-class-name="file-row"
            empty-text="暂无 JSON 规则，请点击右上角「上传资源」添加 .json 文件"
          >
            <el-table-column label="类型" width="68" align="center">
              <template #default>
                <div class="icon-wrapper json" aria-hidden="true">
                  <span class="json-tag">{}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="文件名" min-width="280" show-overflow-tooltip>
              <template #default="scope">
                <span class="file-name">{{ scope.row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="date" label="修改时间" width="160" />
            <el-table-column prop="size" label="大小" width="100" />
            <el-table-column label="操作" align="right" width="160">
              <template #default="scope">
                <el-button link type="primary" @click="editRule(scope.row.name)">编辑</el-button>
                <el-button link type="danger" @click="deleteRule(scope.row.name)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-if="showTips" class="footer-tip">
      <el-alert
        title="提示：支持批量上传 .docx 模板与 .json 规则文件，系统将按扩展名自动归入对应目录。"
        type="info"
        show-icon
        :closable="false"
      />
    </div>

    <!-- JSON 编辑对话框 -->
    <el-dialog v-model="editDialogVisible" :title="`编辑规则: ${currentEditFile}`" width="800px">
      <el-input
        v-model="editContent"
        type="textarea"
        :rows="20"
        placeholder="JSON 内容"
        style="font-family: 'JetBrains Mono', Consolas, monospace"
      />
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 回收站对话框 -->
    <el-dialog v-model="recycleBinVisible" title="模板与规则回收站" width="800px">
      <el-table :data="recycleBin" style="width: 100%" empty-text="回收站是空的">
        <el-table-column type="index" width="60" align="center" label="#" />
        <el-table-column prop="name" label="文件名" min-width="220" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.type === 'docx' ? 'primary' : 'warning'">
              {{ scope.row.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="deletedAt" label="移入时间" width="180" />
        <el-table-column label="操作" width="180" align="center">
          <template #default="scope">
            <el-button link type="success" @click="restoreFile(scope.row)">恢复</el-button>
            <el-button link type="danger" @click="permanentDelete(scope.$index)">
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Upload, Document, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettings } from '../composables/useSettings'

interface ResourceFile {
  name: string
  date: string
  mtime?: string
  size: string
}

interface TrashFileItem {
  name: string
  folder: 'templates' | 'rules'
  deletedAt: string
  type: 'docx' | 'json'
}

const { showTips, notify } = useSettings()

const activeTab = ref('templates')
const templates = ref<ResourceFile[]>([])
const rules = ref<ResourceFile[]>([])
const editDialogVisible = ref(false)
const currentEditFile = ref<string>('')
const editContent = ref('')

const recycleBin = ref<TrashFileItem[]>([])
const recycleBinVisible = ref(false)

// 加载文件列表
const loadFiles = async () => {
  try {
    const [templatesList, rulesList] = await Promise.all([
      window.api.listFiles('templates'),
      window.api.listFiles('rules')
    ])
    templates.value = Array.isArray(templatesList) ? templatesList : []
    rules.value = Array.isArray(rulesList) ? rulesList : []
  } catch (e) {
    ElMessage.error('加载文件列表失败: ' + e)
  }
}

// 从磁盘 .trash 目录加载回收站列表，确保切换页面或重启后不丢失
const loadRecycleBin = async () => {
  try {
    const [trashedTemplates, trashedRules] = await Promise.all([
      window.api.listFiles('.trash/templates'),
      window.api.listFiles('.trash/rules')
    ])

    const list: TrashFileItem[] = []
    if (Array.isArray(trashedTemplates)) {
      for (const item of trashedTemplates) {
        list.push({
          name: item.name,
          folder: 'templates',
          deletedAt: item.mtime || item.date || '-',
          type: 'docx'
        })
      }
    }
    if (Array.isArray(trashedRules)) {
      for (const item of trashedRules) {
        list.push({
          name: item.name,
          folder: 'rules',
          deletedAt: item.mtime || item.date || '-',
          type: 'json'
        })
      }
    }
    recycleBin.value = list
  } catch (e) {
    console.error('加载模板回收站失败:', e)
  }
}

const previewTemplate = async (filename: string) => {
  try {
    const success = await window.api.openFile('templates', filename)
    if (!success) {
      ElMessage.error('无法打开文件')
    }
  } catch (e) {
    ElMessage.error('打开文件失败: ' + e)
  }
}

const showRecycleBin = async () => {
  await loadRecycleBin()
  recycleBinVisible.value = true
}

const clearRecycleBin = async () => {
  try {
    await ElMessageBox.confirm('确定要清空回收站吗？此操作无法撤销。', '警告', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    })

    for (const file of recycleBin.value) {
      await window.api.permanentDeleteFile(file.folder, file.name)
    }

    await loadRecycleBin()
    notify('success', '回收站已清空')
  } catch {
    // 用户取消
  }
}

const restoreFile = async (file: TrashFileItem) => {
  try {
    const success = await window.api.restoreFile(file.folder, file.name)
    if (success) {
      notify('success', '文件已恢复')
      await Promise.all([loadFiles(), loadRecycleBin()])
    } else {
      ElMessage.error('恢复失败')
    }
  } catch (e) {
    ElMessage.error('恢复失败: ' + e)
  }
}

const permanentDelete = async (index: number) => {
  try {
    await ElMessageBox.confirm('彻底删除后无法恢复，确定吗？', '警告', {
      confirmButtonText: '彻底删除',
      cancelButtonText: '取消',
      type: 'error'
    })

    const file = recycleBin.value[index]
    const success = await window.api.permanentDeleteFile(file.folder, file.name)

    if (success) {
      await loadRecycleBin()
      notify('success', '已彻底删除')
    } else {
      ElMessage.error('删除失败')
    }
  } catch {
    // 用户取消
  }
}

const editRule = async (filename: string) => {
  try {
    const content = await window.api.readFileContent('rules', filename)
    if (content !== null) {
      currentEditFile.value = filename
      try {
        editContent.value = content ? JSON.stringify(JSON.parse(content), null, 2) : '{}'
      } catch {
        editContent.value = content
      }
      editDialogVisible.value = true
    }
  } catch (e) {
    ElMessage.error('读取文件失败: ' + e)
  }
}

const saveEdit = async () => {
  try {
    JSON.parse(editContent.value)
    const success = await window.api.writeFileContent(
      'rules',
      currentEditFile.value,
      editContent.value
    )
    if (success) {
      notify('success', '保存成功')
      editDialogVisible.value = false
      await loadFiles()
    } else {
      ElMessage.error('保存失败')
    }
  } catch (e) {
    ElMessage.error('JSON 格式错误: ' + e)
  }
}

const deleteTemplate = async (filename: string) => {
  try {
    await ElMessageBox.confirm(`确定要删除 "${filename}" 吗？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const success = await window.api.deleteFile('templates', filename)
    if (success) {
      notify('success', '已删除（可在回收站中恢复）')
      await Promise.all([loadFiles(), loadRecycleBin()])
    } else {
      ElMessage.error('删除失败')
    }
  } catch {
    // 用户取消
  }
}

const deleteRule = async (filename: string) => {
  try {
    await ElMessageBox.confirm(`确定要删除 "${filename}" 吗？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const success = await window.api.deleteFile('rules', filename)
    if (success) {
      notify('success', '已删除（可在回收站中恢复）')
      await Promise.all([loadFiles(), loadRecycleBin()])
    } else {
      ElMessage.error('删除失败')
    }
  } catch {
    // 用户取消
  }
}

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const triggerFileSelect = () => {
  fileInput.value?.click()
}

const onDragOver = () => {
  isDragging.value = true
}

const onDragLeave = (e: DragEvent) => {
  const currentTarget = e.currentTarget as HTMLElement | null
  const related = e.relatedTarget as Node | null
  if (currentTarget && related && currentTarget.contains(related)) return
  isDragging.value = false
}

const processUploadedFiles = async (files: FileList | File[]) => {
  if (!files || files.length === 0) return

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fileName = file.name
    const fileExt = fileName.split('.').pop()?.toLowerCase()

    let targetFolder = ''
    if (fileExt === 'docx') {
      targetFolder = 'templates'
    } else if (fileExt === 'json') {
      targetFolder = 'rules'
    } else {
      ElMessage.warning(`不支持的文件类型: ${fileName}`)
      continue
    }

    try {
      const content = await readFileAsBuffer(file)
      const success = await window.api.uploadFile(targetFolder, fileName, content)

      if (success) {
        notify('success', `已上传: ${fileName}`)
      } else {
        ElMessage.error(`上传失败: ${fileName}`)
      }
    } catch (e) {
      ElMessage.error(`上传失败: ${fileName} - ${e}`)
    }
  }

  await loadFiles()
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    await processUploadedFiles(target.files)
  }
  if (target) target.value = ''
}

const handleFileDrop = async (event: DragEvent) => {
  isDragging.value = false
  if (event.dataTransfer?.files) {
    await processUploadedFiles(event.dataTransfer.files)
  }
}

const readFileAsBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

onMounted(() => {
  loadFiles()
  loadRecycleBin()
})
</script>

<style scoped>
.template-manager {
  display: flex;
  flex-direction: column;
}

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

.content-wrapper {
  position: relative;
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 2px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  transition: border-color var(--transition-duration, 0.2s) ease;
}

.content-wrapper.is-dragging {
  border-color: var(--primary-color, #2563eb);
}

.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: color-mix(in srgb, var(--primary-color, #2563eb) 10%, var(--el-bg-color));
  border: 2px dashed var(--primary-color, #2563eb);
  border-radius: 11px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--primary-color, #2563eb);
  font-weight: 600;
  font-size: 15px;
  pointer-events: none;
}

.drop-icon {
  font-size: 28px;
}

.footer-tip {
  margin-top: 16px;
}

:deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background-color: var(--el-border-color-lighter);
}

:deep(.el-tabs__header) {
  margin: 0;
  padding: 0 20px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
  border-radius: 12px 12px 0 0;
}

:deep(.el-tabs__item) {
  height: 52px;
  line-height: 52px;
  font-size: 15px;
  color: var(--el-text-color-secondary);
}

:deep(.el-tabs__item.is-active) {
  color: var(--primary-color, #4f46e5);
  font-weight: 600;
}

.icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-wrapper.doc {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.icon-wrapper.json {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.json-tag {
  font-weight: bold;
  font-size: 12px;
}

.file-name {
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.actions .el-button {
  display: flex;
  align-items: center;
}

.actions :deep(.el-badge) {
  margin-left: 8px;
}

.actions :deep(.el-badge__content) {
  background-color: #ef4444;
  border: none;
}
</style>
