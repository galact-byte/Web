<template>
    <div class="single-project">
        <div class="page-header">
            <div class="title-group">
                <h2>单项目生成</h2>
                <p class="subtitle">填写项目信息以生成相关文档</p>
            </div>
            <div class="actions">
                <el-button @click="openOutputFolder" size="large">
                    <el-icon class="el-icon--left">
                        <FolderOpened />
                    </el-icon> 打开输出目录
                </el-button>
                <el-button @click="resetForm" size="large">
                    <el-icon class="el-icon--left">
                        <Delete />
                    </el-icon> 清空表单
                </el-button>
                <el-button @click="openHistory" size="large">
                    <el-icon class="el-icon--left">
                        <Timer />
                    </el-icon> 加载历史数据
                </el-button>
                <el-button type="primary" @click="generate" :loading="generating" size="large">
                    <el-icon class="el-icon--left">
                        <VideoPlay />
                    </el-icon> 开始生成
                </el-button>
            </div>
        </div>

        <!-- History Dialog -->
        <el-dialog v-model="historyVisible" title="历史记录 (最近10条)" width="700px">
            <el-table :data="historyList" stripe style="width: 100%" @row-click="selectHistory">
                <el-table-column prop="data.项目名称" label="项目名称" min-width="200" />
                <el-table-column prop="timestamp" label="生成时间" width="180" />
                <el-table-column label="操作" width="180" align="center">
                    <template #default="scope">
                        <el-button link type="primary" size="small" @click.stop="selectHistory(scope.row)">
                            加载
                        </el-button>
                        <el-button link type="danger" size="small" @click.stop="deleteHistory(scope.$index)">
                            删除
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
            <template #footer>
                <el-button @click="historyVisible = false">关闭</el-button>
                <el-button type="danger" @click="clearAllHistory" :disabled="historyList.length === 0">
                    清空所有历史
                </el-button>
            </template>
        </el-dialog>

        <el-form :model="form" label-position="top" v-if="form" class="project-form">
            <el-row :gutter="24">
                <!-- Left Column: Basic Info -->
                <el-col :span="10">
                    <el-card class="section-card" shadow="hover">
                        <template #header>
                            <div class="card-header">
                                <span>基本信息</span>
                            </div>
                        </template>
                        <el-form-item label="项目编号">
                            <el-input v-model="form.项目编号" placeholder="请输入项目编号" size="large" />
                        </el-form-item>
                        <el-form-item label="项目名称">
                            <el-input v-model="form.项目名称" placeholder="请输入项目名称" size="large" />
                        </el-form-item>
                        <el-form-item label="单位名称">
                            <el-input v-model="form.单位名称" placeholder="请输入单位名称" size="large" />
                        </el-form-item>
                    </el-card>

                    <el-card class="section-card" shadow="hover" style="margin-top: 24px;">
                        <template #header>
                            <div class="card-header">
                                <span>联系信息（环境恢复）</span>
                            </div>
                        </template>
                        <el-row :gutter="16">
                            <el-col :span="12">
                                <el-form-item label="联系人">
                                    <el-input v-model="form.委托单位联系人" placeholder="请输入联系人" size="large" />
                                </el-form-item>
                            </el-col>
                            <el-col :span="12">
                                <el-form-item label="联系方式">
                                    <el-input v-model="form.委托单位联系方式" size="large" />
                                </el-form-item>
                            </el-col>
                        </el-row>
                    </el-card>
                </el-col>

                <!-- Right Column: Business & Systems -->
                <el-col :span="14">
                    <el-card class="section-card" shadow="hover">
                        <template #header>
                            <div class="card-header">
                                <span>业务详情（自愿放弃声明）</span>
                            </div>
                        </template>
                        <el-form-item label="具体业务名称">
                            <el-input v-model="form.具体业务名称" type="textarea" :rows="3" size="large" />
                        </el-form-item>
                        <el-row :gutter="16">
                            <el-col :span="12">
                                <el-form-item label="业务影响">
                                    <el-input v-model="form.业务影响" placeholder="默认为: 中断、停机等" size="large" />
                                </el-form-item>
                            </el-col>
                            <el-col :span="12">
                                <el-form-item label="影响后果">
                                    <el-input v-model="form.影响后果" placeholder="默认为: 业务中断等" size="large" />
                                </el-form-item>
                            </el-col>
                        </el-row>
                    </el-card>

                    <el-card class="section-card" shadow="hover" style="margin-top: 24px;">
                        <template #header>
                            <div class="card-header">
                                <span>系统列表</span>
                                <el-button type="primary" link @click="addSystem">
                                    <el-icon>
                                        <Plus />
                                    </el-icon> 添加系统
                                </el-button>
                            </div>
                        </template>

                        <el-table :data="form.系统" style="width: 100%" empty-text="暂无系统数据">
                            <el-table-column prop="系统名称" label="系统名称">
                                <template #default="scope">
                                    <el-input v-model="scope.row.系统名称" size="large" />
                                </template>
                            </el-table-column>
                            <el-table-column prop="系统级别" label="级别" width="140">
                                <template #default="scope">
                                    <el-select v-model="scope.row.系统级别" size="large">
                                        <el-option label="二级" value="二级" />
                                        <el-option label="三级" value="三级" />
                                        <el-option label="四级" value="四级" />
                                    </el-select>
                                </template>
                            </el-table-column>
                            <el-table-column width="60" align="center">
                                <template #default="scope">
                                    <el-button type="danger" link icon="Delete" @click="removeSystem(scope.$index)" />
                                </template>
                            </el-table-column>
                        </el-table>
                    </el-card>
                </el-col>
            </el-row>
        </el-form>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Delete, VideoPlay, Refresh, Plus, FolderOpened, Timer } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const form = ref<any>({
    "项目编号": "",
    "项目名称": "",
    "单位名称": "",
    "委托单位联系人": "",
    "委托单位联系方式": "",
    "具体业务名称": "",
    "业务影响": "",
    "影响后果": "",
    "系统": []
})

const resetForm = async () => {
    form.value = {
        "项目编号": "",
        "项目名称": "",
        "单位名称": "",
        "委托单位联系人": "",
        "委托单位联系方式": "",
        "具体业务名称": "",
        "业务影响": "",
        "影响后果": "",
        "系统": []
    }
    
    // 同时清空 information.json 文件
    try {
        await window.api.saveFile('information.json', form.value)
    } catch (e) {
        console.error('清空配置文件失败:', e)
    }
    
    ElMessage.success('表单已清空')
}

const generating = ref(false)
const historyVisible = ref(false)
const historyList = ref<any[]>([])

const openHistory = async () => {
    try {
        const history = await window.api.getHistory()
        if (history && history.length > 0) {
            // 过滤掉无效的历史记录
            historyList.value = history.filter((item: any) => item.data && item.data['项目名称'] && String(item.data['项目名称']).trim())
            
            if (historyList.value.length > 0) {
                historyVisible.value = true
            } else {
                ElMessage.info('暂无有效历史记录')
            }
        } else {
            ElMessage.info('暂无历史记录')
        }
    } catch (e) {
        ElMessage.error('获取历史记录失败: ' + e)
    }
}

const selectHistory = (row: any) => {
    form.value = row.data // Use the 'data' field from history entry
    historyVisible.value = false
    ElMessage.success('已加载历史记录')
}

// 删除单条历史记录
const deleteHistory = async (index: number) => {
    try {
        await ElMessageBox.confirm('确定要删除这条历史记录吗？', '确认删除', {
            confirmButtonText: '删除',
            cancelButtonText: '取消',
            type: 'warning'
        })
        
        historyList.value.splice(index, 1)
        
        // 保存更新后的历史记录
        // Ensure we send a plain array, stripping Vue reactivity
        const plainHistory = JSON.parse(JSON.stringify(historyList.value))
        const success = await window.api.saveFile('history.json', plainHistory)
        
        if (success) {
            ElMessage.success('已删除')
        } else {
            ElMessage.error('删除失败，未能保存到文件')
        }
    } catch (e) {
        // 用户取消
    }
}

// 清空所有历史记录
const clearAllHistory = async () => {
    try {
        await ElMessageBox.confirm(
            `确定要清空所有 ${historyList.value.length} 条历史记录吗？此操作不可恢复！`, 
            '警告', 
            {
                confirmButtonText: '清空',
                cancelButtonText: '取消',
                type: 'error'
            }
        )
        
        historyList.value = []
        const success = await window.api.saveFile('history.json', [])
        
        if (success) {
            ElMessage.success('已清空所有历史记录')
            historyVisible.value = false
        } else {
            ElMessage.error('清空失败，未能保存到文件')
        }
    } catch (e) {
        // 用户取消
    }
}

// Deprecated: loadData replaced by openHistory logic, keeping for reference or explicit file load if needed later
// const loadData = async () => { ... }

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

const addSystem = () => {
    form.value.系统.push({ "系统名称": "", "系统级别": "三级" })
}

const removeSystem = (index: number) => {
    form.value.系统.splice(index, 1)
}

const generate = async () => {
    generating.value = true
    try {
        const res = await window.api.runDocGen('1', JSON.parse(JSON.stringify(form.value)))
        if (res.success) {
            ElMessage.success('文档生成成功！')
        } else {
            console.error(res.error)
            // Show detailed error to user since they cannot see console in production
            ElMessageBox.alert(
                `错误信息:\n${res.error || res.output || 'Unknown Error'}`, 
                '文档生成失败', 
                {
                    confirmButtonText: '确定',
                    type: 'error',
                    customStyle: { maxWidth: '90%' }
                }
            )
        }
    } catch (e) {
        ElMessage.error('调用失败: ' + e)
    } finally {
        generating.value = false
    }
}

onMounted(() => {
    // loadData() // 默认不加载，显示空白表单 
})
</script>

<style scoped>
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

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
}

.section-card {
    transition: all 0.3s ease;
}
</style>
