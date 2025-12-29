<template>
  <div class="multi-project">
    <div class="page-header">
        <div class="title-group">
            <h2>多项目批量生成</h2>
            <p class="subtitle">批量处理 Projects.json 中的所有项目</p>
        </div>
        <div class="actions">
             <el-button @click="openOutputFolder">
                <el-icon class="el-icon--left"><FolderOpened /></el-icon> 打开输出目录
             </el-button>
             <el-button @click="loadData">
                <el-icon class="el-icon--left"><Refresh /></el-icon> 刷新列表
             </el-button>
             <el-button @click="showHistoryDialog">
                <el-icon class="el-icon--left"><Clock /></el-icon> 历史记录
             </el-button>
             <el-button @click="showRecycleBin" :badge="recycleBin.length > 0 ? recycleBin.length : ''">
                <el-icon class="el-icon--left"><Delete /></el-icon> 回收站 <el-badge v-if="recycleBin.length > 0" :value="recycleBin.length" class="item" />
             </el-button>
             <el-button type="warning" @click="clearAll" :disabled="projects.length === 0">
                <el-icon class="el-icon--left"><DeleteFilled /></el-icon> 清空表单
             </el-button>
             <el-button type="primary" @click="addProject">
                <el-icon class="el-icon--left"><Plus /></el-icon> 新增项目
             </el-button>
             <el-button type="success" @click="generate" :loading="generating">
                <el-icon class="el-icon--left"><Files /></el-icon> 批量生成
             </el-button>
        </div>
    </div>

    <el-card class="table-card" shadow="never">
        <el-table :data="projects" style="width: 100%" stripe size="large">
        <el-table-column type="index" width="60" align="center" />
        <el-table-column prop="项目编号" label="项目编号" width="160">
            <template #default="scope">
                <el-tag type="info" effect="plain">{{ scope.row.项目编号 }}</el-tag>
            </template>
        </el-table-column>
        <el-table-column prop="项目名称" label="项目名称" min-width="200" show-overflow-tooltip>
            <template #default="scope">
                <span style="font-weight: 500">{{ scope.row.项目名称 }}</span>
            </template>
        </el-table-column>
        <el-table-column prop="单位名称" label="单位名称" width="200" show-overflow-tooltip />
        <el-table-column prop="系统" label="包含系统" width="120">
            <template #default="scope">
                <el-tag size="small" type="primary">{{ scope.row.系统 ? scope.row.系统.length : 0 }} 个</el-tag>
            </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="center" fixed="right">
            <template #default="scope">
                <el-button link type="primary" icon="Edit" @click="editProject(scope.$index, scope.row)">编辑</el-button>
                <el-button link type="danger" icon="Delete" @click="deleteProject(scope.$index)">删除</el-button>
            </template>
        </el-table-column>
        </el-table>
        
        <div v-if="projects.length === 0" class="empty-state">
            <el-empty description="暂无项目数据" />
        </div>
    </el-card>
    
    <div class="footer-tip">
        <el-alert
            title="提示:点击'批量生成'将处理列表中的所有项目"
            type="info"
            show-icon
            :closable="false"
        />
    </div>

    <!-- 编辑/新增项目对话框 -->
    <el-dialog 
        v-model="dialogVisible" 
        :title="isEditing ? '编辑项目' : '新增项目'"
        width="800px"
        top="5vh"
    >
        <el-form :model="projectForm" label-width="120px">
            <el-form-item label="项目编号">
                <el-input v-model="projectForm.项目编号" placeholder="请输入项目编号/测评编号" />
            </el-form-item>
            <el-form-item label="项目名称">
                <el-input v-model="projectForm.项目名称" placeholder="请输入项目名称" />
            </el-form-item>
            <el-form-item label="单位名称">
                <el-input v-model="projectForm.单位名称" placeholder="请输入单位名称" />
            </el-form-item>
            <el-form-item label="委托单位联系人">
                <el-input v-model="projectForm.委托单位联系人" placeholder="请输入联系人" />
            </el-form-item>
            <el-form-item label="委托单位联系方式">
                <el-input v-model="projectForm.委托单位联系方式" placeholder="请输入联系方式" />
            </el-form-item>
            <el-form-item label="具体业务名称">
                <el-input v-model="projectForm.具体业务名称" placeholder="请输入业务名称" />
            </el-form-item>
             <el-form-item label="业务影响">
                <el-input v-model="projectForm.业务影响" placeholder="默认为: 中断、停机等" />
            </el-form-item>
            <el-form-item label="影响后果">
                <el-input v-model="projectForm.影响后果" placeholder="默认为: 关键业务无法办理等" />
            </el-form-item>

            <el-divider content-position="left">包含系统 ({{ projectForm.系统.length }})</el-divider>
             <el-row v-for="(sys, idx) in projectForm.系统" :key="idx" :gutter="10" style="margin-bottom: 10px;">
                <el-col :span="14">
                    <el-input v-model="sys.系统名称" placeholder="系统名称" />
                </el-col>
                <el-col :span="6">
                     <el-select v-model="sys.系统级别" placeholder="级别">
                        <el-option label="二级" value="二级" />
                        <el-option label="三级" value="三级" />
                    </el-select>
                </el-col>
                <el-col :span="4">
                    <el-button type="danger" icon="Delete" circle @click="projectForm.系统.splice(idx, 1)" />
                </el-col>
            </el-row>
            <el-button type="primary" plain icon="Plus" @click="projectForm.系统.push({ '系统名称': '', '系统级别': '三级' })" style="width: 100%">
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
    <el-dialog v-model="recycleBinVisible" title="回收站" width="900px" top="5vh">
        <el-table :data="recycleBin" style="width: 100%" max-height="500">
            <el-table-column type="index" width="60" align="center" />
            <el-table-column prop="项目编号" label="项目编号" width="140" />
            <el-table-column prop="项目名称" label="项目名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="单位名称" label="单位名称" width="180" show-overflow-tooltip />
            <el-table-column prop="deletedAt" label="删除时间" width="180" />
            <el-table-column label="操作" width="160" align="center">
                <template #default="scope">
                    <el-button link type="success" @click="restoreProject(scope.$index)">
                        <el-icon><RefreshLeft /></el-icon> 恢复
                    </el-button>
                    <el-button link type="danger" @click="permanentDelete(scope.$index)">
                        <el-icon><Delete /></el-icon> 彻底删除
                    </el-button>
                </template>
            </el-table-column>
        </el-table>
        <div v-if="recycleBin.length === 0" style="padding: 40px; text-align: center; color: #909399;">
            回收站是空的
        </div>
        <template #footer>
            <el-button @click="recycleBinVisible = false">关闭</el-button>
            <el-button type="danger" @click="clearRecycleBin" :disabled="recycleBin.length === 0">清空回收站</el-button>
        </template>
    </el-dialog>

    <!-- 历史记录对话框 -->
    <el-dialog v-model="historyVisible" title="历史记录" width="900px" top="5vh">
        <el-timeline>
            <el-timeline-item 
                v-for="(record, idx) in historyRecords" 
                :key="idx"
                :timestamp="record.timestamp"
                placement="top"
            >
                <el-card shadow="hover">
                    <div class="history-card-header">
                        <span>共 {{ record.data.projects?.length || 0 }} 个项目</span>
                        <el-button type="primary" size="small" @click="loadFromHistory(idx)">
                            恢复此版本
                        </el-button>
                    </div>
                    <div class="history-projects">
                        <el-tag 
                            v-for="(proj, pIdx) in (record.data.projects || []).slice(0, 5)" 
                            :key="pIdx"
                            style="margin-right: 8px; margin-top: 8px;"
                        >
                            {{ proj.项目名称 }}
                        </el-tag>
                        <span v-if="(record.data.projects?.length || 0) > 5" style="color: #909399;">
                            ... 等 {{ record.data.projects.length }} 个项目
                        </span>
                    </div>
                </el-card>
            </el-timeline-item>
        </el-timeline>
        <div v-if="historyRecords.length === 0" style="padding: 40px; text-align: center; color: #909399;">
            暂无历史记录
        </div>
        <template #footer>
            <el-button @click="historyVisible = false">关闭</el-button>
        </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Files, FolderOpened, Plus, Edit, Delete, Clock, DeleteFilled, RefreshLeft } from '@element-plus/icons-vue'

const projects = ref<any[]>([])
const generating = ref(false)
const recycleBin = ref<any[]>([])
const historyRecords = ref<any[]>([])

// Dialog logic
const dialogVisible = ref(false)
const recycleBinVisible = ref(false)
const historyVisible = ref(false)
const isEditing = ref(false)
const editingIndex = ref(-1)
const projectForm = ref<any>({
    "项目编号": "", "项目名称": "", "单位名称": "", 
    "委托单位联系人": "", "委托单位联系方式": "", 
    "具体业务名称": "", "业务影响": "", "影响后果": "", 
    "系统": []
})

const loadData = async () => {
    try {
        const data = await window.api.readConfig('Projects.json')
        if (data && data.projects) {
            projects.value = data.projects
            ElMessage.success(`加载了 ${projects.value.length} 个项目`)
        } else {
             projects.value = []
        }
    } catch (e) {
        ElMessage.error('加载失败: ' + e)
    }
}

const saveToHistory = async () => {
    try {
        // 保存当前状态到历史记录
        const history = await window.api.getHistory() || []
        const newEntry = {
            timestamp: new Date().toLocaleString('zh-CN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            data: { projects: JSON.parse(JSON.stringify(projects.value)) }
        }
        history.unshift(newEntry)
        // 只保留最近20条历史
        if (history.length > 20) {
            history.splice(20)
        }
        await window.api.saveFile('history.json', history)
    } catch (e) {
        console.error('Failed to save history:', e)
    }
}

const loadHistory = async () => {
    try {
        const history = await window.api.getHistory()
        historyRecords.value = history || []
    } catch (e) {
        console.error('Failed to load history:', e)
    }
}

const saveToFile = async () => {
    try {
        // 保存前先保存到历史记录
        await saveToHistory()
        
        // 创建一个纯净的数据副本
        const cleanProjects = projects.value.map(p => {
            return {
                项目编号: p.项目编号 || '',
                项目名称: p.项目名称 || '',
                单位名称: p.单位名称 || '',
                委托单位联系人: p.委托单位联系人 || '',
                委托单位联系方式: p.委托单位联系方式 || '',
                具体业务名称: p.具体业务名称 || '',
                业务影响: p.业务影响 || '',
                影响后果: p.影响后果 || '',
                系统: (p.系统 || []).map((s: any) => ({
                    系统名称: s.系统名称 || '',
                    系统级别: s.系统级别 || '三级'
                }))
            }
        })
        
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
    projectForm.value = {
        "项目编号": "", "项目名称": "", "单位名称": "", 
        "委托单位联系人": "", "委托单位联系方式": "", 
        "具体业务名称": "", "业务影响": "", "影响后果": "", 
        "系统": []
    }
    dialogVisible.value = true
}

const editProject = (index: number, row: any) => {
    isEditing.value = true
    editingIndex.value = index
    projectForm.value = JSON.parse(JSON.stringify(row))
    if (!projectForm.value.系统) projectForm.value.系统 = []
    dialogVisible.value = true
}

const deleteProject = async (index: number) => {
    try {
        await ElMessageBox.confirm('删除的项目将移到回收站,确定删除吗?', '提示', {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning'
        })
        
        // 添加到回收站
        const deletedProject = JSON.parse(JSON.stringify(projects.value[index]))
        deletedProject.deletedAt = new Date().toLocaleString('zh-CN')
        recycleBin.value.push(deletedProject)
        
        // 从项目列表中删除
        projects.value.splice(index, 1)
        
        const success = await saveToFile()
        if (success) {
            ElMessage.success('已删除(可在回收站中恢复)')
        }
    } catch (e) {
        // User cancelled
    }
}

const clearAll = async () => {
    try {
        await ElMessageBox.confirm(
            `确定要清空所有 ${projects.value.length} 个项目吗? 清空的项目将移到回收站。`, 
            '清空确认', 
            {
                confirmButtonText: '确定清空',
                cancelButtonText: '取消',
                type: 'warning'
            }
        )
        
        // 所有项目移到回收站
        const timestamp = new Date().toLocaleString('zh-CN')
        projects.value.forEach(proj => {
            const deleted = JSON.parse(JSON.stringify(proj))
            deleted.deletedAt = timestamp
            recycleBin.value.push(deleted)
        })
        
        // 清空项目列表
        projects.value = []
        
        const success = await saveToFile()
        if (success) {
            ElMessage.success('已清空所有项目(可在回收站中恢复)')
        }
    } catch (e) {
        // User cancelled
    }
}

const restoreProject = async (index: number) => {
    const project = recycleBin.value[index]
    delete project.deletedAt // 移除删除时间标记
    
    projects.value.push(project)
    recycleBin.value.splice(index, 1)
    
    const success = await saveToFile()
    if (success) {
        ElMessage.success('项目已恢复')
    }
}

const permanentDelete = async (index: number) => {
    try {
        await ElMessageBox.confirm('彻底删除后无法恢复,确定吗?', '警告', {
            confirmButtonText: '彻底删除',
            cancelButtonText: '取消',
            type: 'error'
        })
        recycleBin.value.splice(index, 1)
        ElMessage.success('已彻底删除')
    } catch (e) {
        // User cancelled
    }
}

const clearRecycleBin = async () => {
    try {
        await ElMessageBox.confirm('确定要清空回收站吗? 此操作不可恢复!', '警告', {
            confirmButtonText: '清空',
            cancelButtonText: '取消',
            type: 'error'
        })
        recycleBin.value = []
        ElMessage.success('回收站已清空')
    } catch (e) {
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
        await ElMessageBox.confirm(
            '恢复此历史版本将覆盖当前的项目列表,确定吗?', 
            '确认恢复', 
            {
                confirmButtonText: '确定恢复',
                cancelButtonText: '取消',
                type: 'warning'
            }
        )
        
        const record = historyRecords.value[index]
        projects.value = JSON.parse(JSON.stringify(record.data.projects || []))
        
        const success = await saveToFile()
        if (success) {
            historyVisible.value = false
            ElMessage.success('已恢复历史版本')
        }
    } catch (e) {
        // User cancelled
    }
}

const saveProject = async () => {
    if (!projectForm.value.项目名称) {
        ElMessage.warning('项目名称不能为空')
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
        ElMessage.success('已保存')
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
        // 先保存到文件
        await saveToFile()
        
        // 创建纯净的数据副本传递
        const cleanProjects = projects.value.map(p => ({
            项目编号: p.项目编号 || '',
            项目名称: p.项目名称 || '',
            单位名称: p.单位名称 || '',
            委托单位联系人: p.委托单位联系人 || '',
            委托单位联系方式: p.委托单位联系方式 || '',
            具体业务名称: p.具体业务名称 || '',
            业务影响: p.业务影响 || '',
            影响后果: p.影响后果 || '',
            系统: (p.系统 || []).map((s: any) => ({
                系统名称: s.系统名称 || '',
                系统级别: s.系统级别 || '三级'
            }))
        }))
        
        const res = await window.api.runDocGen('2', { projects: cleanProjects })
        if (res.success) {
            ElMessage.success('批量生成完成,请检查输出目录')
        } else {
             console.error(res.error)
             ElMessage.error('批量生成失败')
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
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
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

.actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.table-card {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e5e7eb;
}

.empty-state {
    padding: 40px;
}

.footer-tip {
    margin-top: 24px;
}

.history-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.history-projects {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
}
</style>