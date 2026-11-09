<template>
  <div class="single-project">
    <div class="page-header">
      <div class="title-group">
        <h2>单项目生成</h2>
        <p class="subtitle">填写单个项目信息以生成授权与过程文档</p>
      </div>
      <div class="actions">
        <div class="secondary-actions">
          <el-button @click="openOutputFolder">
            <el-icon class="el-icon--left"><FolderOpened /></el-icon>
            打开输出目录
          </el-button>
          <el-button @click="openHistory">
            <el-icon class="el-icon--left"><Timer /></el-icon>
            加载历史数据
          </el-button>
          <el-button @click="resetForm">
            <el-icon class="el-icon--left"><Delete /></el-icon>
            清空表单
          </el-button>
        </div>
        <div class="primary-actions">
          <el-button type="primary" @click="generate" :loading="generating">
            <el-icon class="el-icon--left"><VideoPlay /></el-icon>
            开始生成
          </el-button>
        </div>
      </div>
    </div>

    <!-- History Dialog -->
    <el-dialog v-model="historyVisible" title="单项目历史记录 (最近10条)" width="700px">
      <el-table :data="historyList" stripe style="width: 100%" @row-click="selectHistory">
        <el-table-column prop="data.项目编号" label="项目编号" width="140" show-overflow-tooltip />
        <el-table-column prop="data.项目名称" label="项目名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="timestamp" label="生成时间" width="170" />
        <el-table-column label="操作" width="140" align="center">
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
          清空单项目历史
        </el-button>
      </template>
    </el-dialog>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      v-if="form"
      class="project-form"
    >
      <el-row :gutter="20">
        <!-- Left Column: Basic Info -->
        <el-col :xs="24" :lg="10" class="form-col">
          <el-card class="section-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span>基本信息</span>
              </div>
            </template>
            <el-form-item label="项目编号" prop="项目编号">
              <el-input v-model="form.项目编号" placeholder="请输入项目编号" clearable />
            </el-form-item>
            <el-form-item label="项目名称" prop="项目名称" required>
              <el-input v-model="form.项目名称" placeholder="请输入项目名称（必填）" clearable />
            </el-form-item>
            <el-form-item label="单位名称" prop="单位名称">
              <el-input v-model="form.单位名称" placeholder="请输入单位名称" clearable />
            </el-form-item>
            <el-form-item label="验证测试方式" prop="验证测试方式">
              <VerificationMode v-model="form.验证测试方式" />
            </el-form-item>
          </el-card>

          <el-card class="section-card" shadow="hover" style="margin-top: 16px">
            <template #header>
              <div class="card-header">
                <span>联系信息（环境恢复）</span>
              </div>
            </template>
            <el-row :gutter="14">
              <el-col :span="12">
                <el-form-item label="联系人" prop="委托单位联系人">
                  <el-input v-model="form.委托单位联系人" placeholder="请输入联系人" clearable />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="联系方式" prop="委托单位联系方式">
                  <el-input v-model="form.委托单位联系方式" placeholder="请输入联系电话" clearable />
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>
        </el-col>

        <!-- Right Column: Business & Systems -->
        <el-col :xs="24" :lg="14" class="form-col">
          <el-card v-if="form.验证测试方式 === '自愿放弃验证测试'" class="section-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <span>业务详情（自愿放弃声明）</span>
              </div>
            </template>
            <el-form-item label="具体业务名称" prop="具体业务名称">
              <el-input
                v-model="form.具体业务名称"
                type="textarea"
                :rows="2"
                placeholder="请输入涉及的具体业务名称"
              />
            </el-form-item>
            <el-row :gutter="14">
              <el-col :span="12">
                <el-form-item label="业务影响" prop="业务影响">
                  <el-input v-model="form.业务影响" placeholder="默认为: 中断、停机等" clearable />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="影响后果" prop="影响后果">
                  <el-input v-model="form.影响后果" placeholder="默认为: 业务中断等" clearable />
                </el-form-item>
              </el-col>
            </el-row>
          </el-card>

          <el-card class="section-card" shadow="hover" :style="{ marginTop: form.验证测试方式 === '自愿放弃验证测试' ? '16px' : '0' }">
            <template #header>
              <div class="card-header">
                <span>系统列表 ({{ form.系统.length }})</span>
                <el-button type="primary" link :icon="Plus" @click="addSystem">
                  添加系统
                </el-button>
              </div>
            </template>

            <el-table :data="form.系统" style="width: 100%" empty-text="暂无系统数据，点击右上角「添加系统」新增">
              <el-table-column prop="系统名称" label="系统名称">
                <template #default="scope">
                  <el-input
                    v-model="scope.row.系统名称"
                    placeholder="请输入被测系统名称"
                    clearable
                  />
                </template>
              </el-table-column>
              <el-table-column prop="系统级别" label="级别" width="130">
                <template #default="scope">
                  <el-select v-model="scope.row.系统级别">
                    <el-option label="二级" value="二级" />
                    <el-option label="三级" value="三级" />
                    <el-option label="四级" value="四级" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="68" align="center">
                <template #default="scope">
                  <el-button
                    type="danger"
                    link
                    :icon="Delete"
                    aria-label="删除系统"
                    title="删除系统"
                    @click="removeSystem(scope.$index)"
                  />
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </el-form>

    <div v-if="showTips" class="footer-tip">
      <el-alert
        title="提示：填写项目名称与系统列表后点击「开始生成」，生成成功的项目会自动记入单项目历史记录。"
        type="info"
        show-icon
        :closable="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Delete, VideoPlay, Plus, FolderOpened, Timer } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  fetchSplitHistory,
  saveSingleHistoryList,
  type ProjectData,
  type SingleHistoryEntry
} from '../utils/history'
import VerificationMode from './VerificationMode.vue'
import { useSettings } from '../composables/useSettings'

const { showTips, notify } = useSettings()

const createEmptyForm = (): ProjectData => ({
  项目编号: '',
  项目名称: '',
  单位名称: '',
  委托单位联系人: '',
  委托单位联系方式: '',
  验证测试方式: '自愿放弃验证测试',
  具体业务名称: '',
  业务影响: '',
  影响后果: '',
  系统: []
})

const formRef = ref<FormInstance>()
const form = ref<ProjectData>(createEmptyForm())

const rules: FormRules = {
  项目名称: [{ required: true, message: '请输入项目名称', trigger: 'blur' }]
}

const isFormDirty = (): boolean => {
  const f = form.value
  return Boolean(
    f.项目编号.trim() ||
      f.项目名称.trim() ||
      f.单位名称.trim() ||
      f.委托单位联系人.trim() ||
      f.委托单位联系方式.trim() ||
      f.验证测试方式 !== '自愿放弃验证测试' ||
      f.具体业务名称.trim() ||
      f.业务影响.trim() ||
      f.影响后果.trim() ||
      f.系统.length > 0
  )
}

const resetForm = async () => {
  if (isFormDirty()) {
    try {
      await ElMessageBox.confirm('确定要清空当前已填写的表单内容吗？', '清空确认', {
        confirmButtonText: '确定清空',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
  }

  form.value = createEmptyForm()
  formRef.value?.clearValidate()

  try {
    await window.api.saveFile('information.json', form.value)
  } catch (e) {
    console.error('清空配置文件失败:', e)
  }

  notify('success', '表单已清空')
}

const generating = ref(false)
const historyVisible = ref(false)
const historyList = ref<SingleHistoryEntry[]>([])

const openHistory = async () => {
  try {
    const { single } = await fetchSplitHistory()
    historyList.value = single
    if (historyList.value.length > 0) {
      historyVisible.value = true
    } else {
      notify('info', '暂无单项目历史记录')
    }
  } catch (e) {
    ElMessage.error('获取历史记录失败: ' + e)
  }
}

const selectHistory = (row: SingleHistoryEntry) => {
  const cloned = JSON.parse(JSON.stringify(row.data || {}))
  form.value = {
    ...createEmptyForm(),
    ...cloned,
    系统: Array.isArray(cloned.系统) ? cloned.系统 : []
  }
  formRef.value?.clearValidate()
  historyVisible.value = false
  notify('success', '已加载历史记录')
}

const deleteHistory = async (index: number) => {
  try {
    await ElMessageBox.confirm('确定要删除这条历史记录吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const nextList = [...historyList.value]
    nextList.splice(index, 1)
    const success = await saveSingleHistoryList(nextList)

    if (success) {
      historyList.value = nextList
      notify('success', '已删除历史记录')
    } else {
      ElMessage.error('删除失败，未能保存到文件')
    }
  } catch {
    // 用户取消
  }
}

const clearAllHistory = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清空所有 ${historyList.value.length} 条单项目历史记录吗？此操作不可恢复！`,
      '警告',
      {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'error'
      }
    )

    const success = await saveSingleHistoryList([])
    if (success) {
      historyList.value = []
      historyVisible.value = false
      notify('success', '已清空单项目历史记录')
    } else {
      ElMessage.error('清空失败，未能保存到文件')
    }
  } catch {
    // 用户取消
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

const addSystem = () => {
  form.value.系统.push({ 系统名称: '', 系统级别: '三级' })
}

const removeSystem = (index: number) => {
  form.value.系统.splice(index, 1)
}

const generate = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    ElMessage.warning('请先填写必填项（项目名称）')
    return
  }

  const hasEmptySystem = form.value.系统.some((s) => !s.系统名称 || !s.系统名称.trim())
  if (hasEmptySystem) {
    ElMessage.warning('系统列表中存在未填写名称的系统，请补全或删除空行')
    return
  }

  generating.value = true
  try {
    const res = await window.api.runDocGen('1', JSON.parse(JSON.stringify(form.value)))
    if (res.success) {
      notify('success', '文档生成成功！')
    } else {
      console.error(res.error)
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

.form-col {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.footer-tip {
  margin-top: 4px;
}
</style>
