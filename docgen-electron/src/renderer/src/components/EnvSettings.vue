<template>
  <div class="env-settings">
    <div class="page-header">
      <div class="title-group">
        <h2>环境变量</h2>
        <p class="subtitle">配置全局通用的委托测评单位与联系信息</p>
      </div>
      <div class="actions">
        <el-button type="primary" @click="saveEnv" :loading="saving">
          <el-icon class="el-icon--left"><Check /></el-icon>
          保存配置
        </el-button>
      </div>
    </div>

    <el-card class="settings-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>全局占位符变量</span>
        </div>
      </template>

      <el-alert
        v-if="showTips"
        title="这些变量将被用于所有单项目与多项目文档生成"
        type="info"
        show-icon
        :closable="false"
        style="margin-bottom: 20px"
      />

      <el-form label-width="140px">
        <el-form-item label="委托测评单位名称">
          <el-input v-model="envVars.CLIENT_COMPANY" placeholder="例如：xxx公司" clearable />
        </el-form-item>

        <el-form-item label="测评联系人">
          <el-input v-model="envVars.EVAL_CONTACT" placeholder="例如：张三" clearable />
        </el-form-item>

        <el-form-item label="联系电话">
          <el-input v-model="envVars.EVAL_PHONE" placeholder="例如：138xxxxxxxx" clearable />
        </el-form-item>
      </el-form>

      <div v-if="showTips" class="tips-box">
        <p><strong>使用说明：</strong></p>
        <ul>
          <li>这些变量会在文档生成时自动替换对应的占位符</li>
          <li>配置保存后会立即写入 <code>.env</code> 并对后续所有文档生成生效</li>
          <li>可在 Word 模板与规则中使用这些占位符，无需每次重复填写</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { useSettings } from '../composables/useSettings'

const { showTips, notify } = useSettings()

const envVars = ref({
  CLIENT_COMPANY: '',
  EVAL_CONTACT: '',
  EVAL_PHONE: ''
})

const saving = ref(false)

const loadEnv = async () => {
  try {
    const result = await window.api.loadEnv()
    if (result.success && result.data) {
      envVars.value = {
        CLIENT_COMPANY: result.data.CLIENT_COMPANY || '',
        EVAL_CONTACT: result.data.EVAL_CONTACT || '',
        EVAL_PHONE: result.data.EVAL_PHONE || ''
      }
    }
  } catch (e) {
    console.error('加载环境变量失败:', e)
  }
}

const saveEnv = async () => {
  saving.value = true
  try {
    const plainEnvVars = JSON.parse(JSON.stringify(envVars.value))
    const result = await window.api.saveEnv(plainEnvVars)
    if (result.success) {
      notify('success', '环境变量保存成功')
    } else {
      ElMessage.error('保存失败: ' + result.message)
    }
  } catch (e) {
    ElMessage.error('保存失败: ' + e)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadEnv()
})
</script>

<style scoped>
.env-settings {
  max-width: 880px;
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 16px;
}

.settings-card {
  border-radius: 12px;
}

.tips-box {
  margin-top: 24px;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.tips-box p {
  margin: 0 0 8px 0;
  font-weight: 500;
}

.tips-box ul {
  margin: 0;
  padding-left: 20px;
}

.tips-box li {
  margin-bottom: 6px;
}
</style>
