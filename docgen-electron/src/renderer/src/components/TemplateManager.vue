<template>
    <div class="template-manager">
        <div class="page-header">
            <div class="title-group">
                <h2>模板资源</h2>
                <p class="subtitle">管理用于生成的 Word 模板与 JSON 替换规则</p>
            </div>
            <div class="actions">
                <input ref="fileInput" type="file" accept=".docx,.json" style="display: none" @change="handleFileSelect" multiple/>
                <el-button type="primary" size="large" @click="triggerFileSelect">
                    <el-icon class="el-icon--left">
                        <Upload />
                    </el-icon> 上传资源
                </el-button>
            </div>
        </div>

        <div class="content-wrapper">
            <el-tabs v-model="activeTab" class="custom-tabs">
                <el-tab-pane label="文档模板 (.docx)" name="templates">
                    <el-table :data="templates" style="width: 100%" :show-header="true" row-class-name="file-row">
                        <el-table-column width="60">
                            <template #default>
                                <div class="icon-wrapper doc">
                                    <el-icon>
                                        <Document />
                                    </el-icon>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column prop="name" label="文件名" min-width="300">
                            <template #default="scope">
                                <span class="file-name">{{ scope.row.name }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="date" label="修改时间" width="180" />
                        <el-table-column prop="size" label="大小" width="100" />
                        <el-table-column align="right" width="150">
                            <template #default="scope">
                                <el-button link type="primary" @click="previewTemplate(scope.row.name)">预览</el-button>
                                <el-button link type="danger" @click="deleteTemplate(scope.row.name)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>

                <el-tab-pane label="生成规则 (.json)" name="rules">
                    <el-table :data="rules" style="width: 100%" :show-header="true" row-class-name="file-row">
                        <el-table-column width="60">
                            <template #default>
                                <div class="icon-wrapper json">
                                    <span class="json-tag">{}</span>
                                </div>
                            </template>
                        </el-table-column>
                        <el-table-column prop="name" label="文件名" min-width="300">
                            <template #default="scope">
                                <span class="file-name">{{ scope.row.name }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="date" label="修改时间" width="180" />
                        <el-table-column align="right" width="150">
                            <template #default="scope">
                                <el-button link type="primary" @click="editRule(scope.row.name)">编辑</el-button>
                                <el-button link type="danger" @click="deleteRule(scope.row.name)">删除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-tab-pane>
            </el-tabs>
        </div>
    </div>
    <!-- JSON 编辑对话框 -->
    <el-dialog v-model="editDialogVisible" :title="`编辑: ${currentEditFile}`" width="800px">
        <el-input v-model="editContent" type="textarea" :rows="20" placeholder="JSON 内容"
            style="font-family: monospace;" />
        <template #footer>
            <el-button @click="editDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveEdit">保存</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Upload, Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete } from '@element-plus/icons-vue'

const activeTab = ref('templates')
const templates = ref<any[]>([])
const rules = ref<any[]>([])
const uploadDialogVisible = ref(false)
const editDialogVisible = ref(false)
const currentEditFile = ref<any>(null)
const editContent = ref('')
const loadFiles = async () => {
    try {
        templates.value = await window.api.listFiles('templates')
        rules.value = await window.api.listFiles('rules')
    } catch (e) {
        console.error('Failed to load files:', e)
    }
}

// 刷新文件列表
const refreshFiles = async () => {
    await loadFiles()
    ElMessage.success('已刷新')
}

// 预览 Word 文档（用系统默认程序打开）
const previewTemplate = async (filename: string) => {
    try {
        const success = await window.api.openFile('templates', filename)
        if (!success) {
            ElMessage.error('无法打开文件')
        }
    } catch (e) {
        ElMessage.error('打开失败: ' + e)
    }
}

// 编辑 JSON 文件
const editRule = async (filename: string) => {
    try {
        const content = await window.api.readFileContent('rules', filename)
        if (content) {
            currentEditFile.value = filename
            editContent.value = JSON.stringify(JSON.parse(content), null, 2)
            editDialogVisible.value = true
        }
    } catch (e) {
        ElMessage.error('读取文件失败: ' + e)
    }
}

// 保存编辑的 JSON
const saveEdit = async () => {
    try {
        JSON.parse(editContent.value) // 验证 JSON 格式
        const success = await window.api.writeFileContent('rules', currentEditFile.value, editContent.value)
        if (success) {
            ElMessage.success('保存成功')
            editDialogVisible.value = false
            await loadFiles()
        } else {
            ElMessage.error('保存失败')
        }
    } catch (e) {
        ElMessage.error('JSON 格式错误: ' + e)
    }
}

// 删除模板
const deleteTemplate = async (filename: string) => {
    try {
        await ElMessageBox.confirm(`确定要删除 "${filename}" 吗？`, '确认删除', {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning'
        })

        const success = await window.api.deleteFile('templates', filename)
        if (success) {
            ElMessage.success('已删除')
            await loadFiles()
        } else {
            ElMessage.error('删除失败')
        }
    } catch (e) {
        // 用户取消
    }
}

// 删除规则
const deleteRule = async (filename: string) => {
    try {
        await ElMessageBox.confirm(`确定要删除 "${filename}" 吗？`, '确认删除', {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning'
        })

        const success = await window.api.deleteFile('rules', filename)
        if (success) {
            ElMessage.success('已删除')
            await loadFiles()
        } else {
            ElMessage.error('删除失败')
        }
    } catch (e) {
        // 用户取消
    }
}

// 上传文件
// 添加 ref
const fileInput = ref<HTMLInputElement | null>(null)

// 触发文件选择
const triggerFileSelect = () => {
    fileInput.value?.click()
}

// 处理文件选择
const handleFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement
    const files = target.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileName = file.name
        const fileExt = fileName.split('.').pop()?.toLowerCase()

        // 判断目标文件夹
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
            // 读取文件内容
            const content = await readFileAsBuffer(file)
            
            // 上传文件
            const success = await window.api.uploadFile(targetFolder, fileName, content)
            
            if (success) {
                ElMessage.success(`已上传: ${fileName}`)
            } else {
                ElMessage.error(`上传失败: ${fileName}`)
            }
        } catch (e) {
            ElMessage.error(`上传失败: ${fileName} - ${e}`)
        }
    }

    // 刷新列表
    await loadFiles()
    
    // 清空 input，允许重复上传同一文件
    if (target) target.value = ''
}

// 读取文件为 Buffer
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
})
</script>

<style scoped>
.template-manager {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.title-group h2 {
    font-size: 24px;
    color: #1f2937;
    margin-bottom: 4px;
}

.subtitle {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
}

.content-wrapper {
    background: white;
    border-radius: 12px;
    padding: 2px;
    /* slight padding for border effect if needed */
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    flex: 1;
    overflow: hidden;
    border: 1px solid #e5e7eb;
}

/* Custom Tabs Styling */
:deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: #f3f4f6;
}

:deep(.el-tabs__header) {
    margin: 0;
    padding: 0 20px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    border-radius: 12px 12px 0 0;
}

:deep(.el-tabs__item) {
    height: 56px;
    line-height: 56px;
    font-size: 15px;
    color: #6b7280;
}

:deep(.el-tabs__item.is-active) {
    color: #4f46e5;
    font-weight: 600;
}

/* Table Styling */
.icon-wrapper {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.icon-wrapper.doc {
    background: #eff6ff;
    color: #3b82f6;
}

.icon-wrapper.json {
    background: #fff7ed;
    color: #f59e0b;
}

.json-tag {
    font-weight: bold;
    font-size: 12px;
}

.file-name {
    font-weight: 500;
    color: #374151;
}
</style>
