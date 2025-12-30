<template>
  <div class="settings">
    <div class="page-header">
      <div class="title-group">
        <h2>外观设置</h2>
        <p class="subtitle">个性化您的 DocGen Pro 体验</p>
      </div>
    </div>

    <div class="settings-content">
      <el-card class="settings-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>主题设置</span>
          </div>
        </template>
        
        <div class="setting-item">
          <div class="setting-label">
            <el-icon><Sunny /></el-icon>
            <span>主题模式</span>
          </div>
          <el-radio-group v-model="theme" @change="handleThemeChange">
            <el-radio-button label="light">浅色</el-radio-button>
            <el-radio-button label="dark">深色</el-radio-button>
            <el-radio-button label="auto">跟随系统</el-radio-button>
          </el-radio-group>
        </div>

        <el-divider />

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><Discount /></el-icon>
            <span>主题色</span>
          </div>
          <div class="color-picker-group">
            <div 
              v-for="color in themeColors" 
              :key="color.value"
              :class="['color-option', { active: primaryColor === color.value }]"
              :style="{ backgroundColor: color.value }"
              @click="handleColorChange(color.value)"
            >
              <el-icon v-if="primaryColor === color.value" color="#fff"><Check /></el-icon>
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="settings-card" shadow="hover" style="margin-top: 24px;">
        <template #header>
          <div class="card-header">
            <span>显示设置</span>
          </div>
        </template>

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><Document /></el-icon>
            <span>字体大小</span>
          </div>
          <el-radio-group v-model="fontSize" @change="handleFontSizeChange">
            <el-radio-button label="small">小</el-radio-button>
            <el-radio-button label="medium">中</el-radio-button>
            <el-radio-button label="large">大</el-radio-button>
          </el-radio-group>
        </div>

        <el-divider />

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><MagicStick /></el-icon>
            <span>动画效果</span>
          </div>
          <el-switch v-model="animations" @change="handleAnimationChange" />
        </div>
      </el-card>

      <el-card class="settings-card" shadow="hover" style="margin-top: 24px;">
        <template #header>
          <div class="card-header">
            <span>其他设置</span>
          </div>
        </template>

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><Bell /></el-icon>
            <span>消息通知</span>
          </div>
          <el-switch v-model="notifications" @change="handleNotificationChange" />
        </div>

        <el-divider />

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><QuestionFilled /></el-icon>
            <span>显示提示信息</span>
          </div>
          <el-switch v-model="showTips" @change="handleShowTipsChange" />
        </div>
      </el-card>

      <div class="reset-section">
        <el-button type="danger" plain @click="resetSettings">
          <el-icon><RefreshLeft /></el-icon> 恢复默认设置
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Sunny, Discount, Document, MagicStick, Bell, QuestionFilled, RefreshLeft, Check } from '@element-plus/icons-vue'

// 设置状态
const theme = ref('light')
const primaryColor = ref('#4f46e5')
const fontSize = ref('medium')
const animations = ref(true)
const notifications = ref(true)
const showTips = ref(true)

// 主题颜色选项
const themeColors = [
  { name: '靛蓝', value: '#4f46e5' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
  { name: '红色', value: '#ef4444' },
  { name: '橙色', value: '#f59e0b' },
  { name: '绿色', value: '#10b981' },
  { name: '青色', value: '#06b6d4' }
]

// 加载设置
const loadSettings = () => {
  const savedSettings = localStorage.getItem('docgen-settings')
  if (savedSettings) {
    const settings = JSON.parse(savedSettings)
    theme.value = settings.theme || 'light'
    primaryColor.value = settings.primaryColor || '#4f46e5'
    fontSize.value = settings.fontSize || 'medium'
    animations.value = settings.animations !== false
    notifications.value = settings.notifications !== false
    showTips.value = settings.showTips !== false
    
    // 应用设置
    applyTheme(theme.value)
    applyPrimaryColor(primaryColor.value)
    applyFontSize(fontSize.value)
    applyAnimations(animations.value)
  }
}

// 保存设置
const saveSettings = () => {
  const settings = {
    theme: theme.value,
    primaryColor: primaryColor.value,
    fontSize: fontSize.value,
    animations: animations.value,
    notifications: notifications.value,
    showTips: showTips.value
  }
  localStorage.setItem('docgen-settings', JSON.stringify(settings))
}

// 应用主题
const applyTheme = (themeValue: string) => {
  const html = document.documentElement
  
  if (themeValue === 'dark') {
    html.classList.add('dark')
  } else if (themeValue === 'light') {
    html.classList.remove('dark')
  } else if (themeValue === 'auto') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (isDark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }
}

// 应用主题色
const applyPrimaryColor = (color: string) => {
  document.documentElement.style.setProperty('--primary-color', color)
}

// 应用字体大小
const applyFontSize = (size: string) => {
  const sizes = {
    small: '13px',
    medium: '14px',
    large: '16px'
  }
  document.documentElement.style.setProperty('--base-font-size', sizes[size])
}

// 应用动画设置
const applyAnimations = (enabled: boolean) => {
  if (enabled) {
    document.documentElement.style.removeProperty('--transition-duration')
  } else {
    document.documentElement.style.setProperty('--transition-duration', '0s')
  }
}

// 处理主题变化
const handleThemeChange = (value: string) => {
  applyTheme(value)
  saveSettings()
  ElMessage.success('主题已更新')
}

// 处理颜色变化
const handleColorChange = (color: string) => {
  primaryColor.value = color
  applyPrimaryColor(color)
  saveSettings()
  ElMessage.success('主题色已更新')
}

// 处理字体大小变化
const handleFontSizeChange = (value: string) => {
  applyFontSize(value)
  saveSettings()
  ElMessage.success('字体大小已更新')
}

// 处理动画变化
const handleAnimationChange = (value: boolean) => {
  applyAnimations(value)
  saveSettings()
}

// 处理通知变化
const handleNotificationChange = () => {
  saveSettings()
}

// 处理提示变化
const handleShowTipsChange = () => {
  saveSettings()
}

// 恢复默认设置
const resetSettings = async () => {
  try {
    await ElMessageBox.confirm('确定要恢复默认设置吗？', '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    theme.value = 'light'
    primaryColor.value = '#4f46e5'
    fontSize.value = 'medium'
    animations.value = true
    notifications.value = true
    showTips.value = true
    
    localStorage.removeItem('docgen-settings')
    
    applyTheme('light')
    applyPrimaryColor('#4f46e5')
    applyFontSize('medium')
    applyAnimations(true)
    
    ElMessage.success('已恢复默认设置')
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.settings {
  max-width: 800px;
}

.page-header {
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

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-card {
  border-radius: 12px;
}

.card-header {
  font-weight: 600;
  font-size: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #374151;
}

.setting-label .el-icon {
  font-size: 20px;
  color: #6b7280;
}

.color-picker-group {
  display: flex;
  gap: 12px;
}

.color-option {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.color-option:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.color-option.active {
  border-color: #fff;
  box-shadow: 0 0 0 2px currentColor;
}

.reset-section {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}
</style>