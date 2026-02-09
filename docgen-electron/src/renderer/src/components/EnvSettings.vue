<!-- src/components/EnvSettings.vue -->
<template>
  <div class="env-settings">
    <el-card class="settings-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>环境变量配置</span>
          <el-button type="primary" size="small" @click="saveEnv" :loading="saving">
            保存配置
          </el-button>
        </div>
      </template>

      <el-alert
        title="这些变量将被用于所有文档生成"
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      />

      <el-form label-width="140px">
        <el-form-item label="委托测评单位名称">
          <el-input 
            v-model="envVars.CLIENT_COMPANY" 
            placeholder="例如：xxx公司"
          />
        </el-form-item>

        <el-form-item label="测评联系人">
          <el-input 
            v-model="envVars.EVAL_CONTACT" 
            placeholder="例如：张三"
          />
        </el-form-item>

        <el-form-item label="联系电话">
          <el-input 
            v-model="envVars.EVAL_PHONE" 
            placeholder="例如：138xxxxxxxx"
          />
        </el-form-item>
      </el-form>

      <div class="tips-box">
        <p><strong>使用说明：</strong></p>
        <ul>
          <li>这些变量会在文档中自动替换对应的占位符</li>
          <li>配置保存后会立即生效，影响后续所有文档生成</li>
          <li>可以在模板文档中使用这些占位符，无需每次手动填写</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const envVars = ref({
  CLIENT_COMPANY: '',
  EVAL_CONTACT: '',
  EVAL_PHONE: ''
})

const saving = ref(false)
const placeholderExample = ref('{{CLIENT_COMPANY}}')

// 加载环境变量
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

// 保存环境变量
const saveEnv = async () => {
  saving.value = true
  try {
    // Fix: Clone object to remove Vue Proxy properties which cause 'object could not be cloned' error
    const plainEnvVars = JSON.parse(JSON.stringify(envVars.value))
    const result = await window.api.saveEnv(plainEnvVars)
    if (result.success) {
      ElMessage.success('环境变量保存成功')
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
  max-width: 800px;
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
  background: #f9fafb;
  border-radius: 8px;
  font-size: 14px;
  color: #4b5563;
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

.tips-box code {
  background: #e5e7eb;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}
</style>