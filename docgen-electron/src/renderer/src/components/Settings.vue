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

      <el-card class="settings-card" shadow="hover" style="margin-top: 24px;">
        <template #header>
          <div class="card-header">
            <span>背景设置</span>
          </div>
        </template>

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><Picture /></el-icon>
            <span>背景图片</span>
          </div>
          <div class="background-controls">
            <el-button size="small" @click="selectBackgroundImage">选择图片</el-button>
            <el-button size="small" type="danger" plain @click="clearBackgroundImage" v-if="backgroundImage">清除</el-button>
          </div>
        </div>

        <el-divider v-if="backgroundImage" />

        <div class="setting-item" v-if="backgroundImage">
          <div class="setting-label">
            <el-icon><View /></el-icon>
            <span>背景透明度</span>
          </div>
          <el-slider v-model="backgroundOpacity" :min="0" :max="100" :step="5" style="width: 200px;" @change="handleBackgroundOpacityChange" />
        </div>

        <div v-if="backgroundImage" class="background-preview">
          <img :src="backgroundImage" alt="背景预览" />
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
import { Sunny, Discount, Document, MagicStick, Bell, QuestionFilled, RefreshLeft, Check, Picture, View } from '@element-plus/icons-vue'

// 设置状态
const theme = ref('light')
const primaryColor = ref('#4f46e5')
const fontSize = ref('medium')
const animations = ref(true)
const notifications = ref(true)
const showTips = ref(true)
const backgroundImage = ref('')
const backgroundOpacity = ref(30)

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
    backgroundImage.value = settings.backgroundImage || ''
    backgroundOpacity.value = settings.backgroundOpacity ?? 30
    
    // 应用设置
    applyTheme(theme.value)
    applyPrimaryColor(primaryColor.value)
    applyFontSize(fontSize.value)
    applyAnimations(animations.value)
    applyBackgroundImage()
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
    showTips: showTips.value,
    backgroundImage: backgroundImage.value,
    backgroundOpacity: backgroundOpacity.value
  }
  localStorage.setItem('docgen-settings', JSON.stringify(settings))
}

// function to convert hex to rgb
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '79, 70, 229'
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
  document.documentElement.style.setProperty('--primary-color-rgb', hexToRgb(color))
}

// 应用字体大小
const applyFontSize = (size: string) => {
  const sizes: Record<string, string> = {
    small: '12px',
    medium: '14px',
    large: '16px'
  }
  const val = sizes[size] || '14px'
  document.documentElement.style.setProperty('--base-font-size', val)
  document.documentElement.style.setProperty('--el-font-size-base', val)
}

// 应用动画设置
const applyAnimations = (enabled: boolean) => {
  const duration = enabled ? '0.3s' : '0s'
  document.documentElement.style.setProperty('--transition-duration', duration)
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

// 选择背景图片
const selectBackgroundImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        backgroundImage.value = ev.target?.result as string
        applyBackgroundImage()
        saveSettings()
        ElMessage.success('背景图片已设置')
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

// 清除背景图片
const clearBackgroundImage = () => {
  backgroundImage.value = ''
  backgroundOpacity.value = 30
  applyBackgroundImage()
  saveSettings()
  ElMessage.success('背景图片已清除')
}

// 处理背景透明度变化
const handleBackgroundOpacityChange = () => {
  applyBackgroundImage()
  saveSettings()
}

// 应用背景图片
const applyBackgroundImage = () => {
  const container = document.querySelector('.app-container') as HTMLElement
  if (!container) return
  
  // convert opacity 0-100 to 0-1, but reversed logic?
  // User wants "Transparency" or "Opacity"?
  // If text is "Background Transparency", usually 100% means fully transparent.
  // Code says: "背景透明度" (Background Transparency).
  // Current logic in Settings.vue: `overlayOpacity = (100 - val)/100`. So 100 val = 0 overlay opacity = Transparent Overlay? No.
  // Let's assume standard behavior:
  // If I set "Transparency", I expect higher value = more transparent content.
  // So `--content-opacity` should be `(100 - transparency) / 100`.
  // If value is 30, opacity is 0.7.
  
  const opacity = (100 - backgroundOpacity.value) / 100
  document.documentElement.style.setProperty('--content-opacity', opacity.toString())
  
  if (backgroundImage.value) {
    container.style.backgroundImage = `url(${backgroundImage.value})`
    container.style.backgroundSize = 'cover'
    container.style.backgroundPosition = 'center'
    container.style.backgroundAttachment = 'fixed'
  } else {
    container.style.backgroundImage = ''
    document.documentElement.style.setProperty('--content-opacity', '1')
  }
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
    backgroundImage.value = ''
    backgroundOpacity.value = 30
    
    localStorage.removeItem('docgen-settings')
    
    applyTheme('light')
    applyPrimaryColor('#4f46e5')
    applyFontSize('medium')
    applyAnimations(true)
    applyBackgroundImage()
    
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
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
}

:global(.dark) .settings-card {
  background-color: rgba(30, 30, 45, 0.85);
  border-color: rgba(255, 255, 255, 0.1);
  color: #fff;
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

.background-controls {
  display: flex;
  gap: 8px;
}

.background-preview {
  margin-top: 16px;
  border-radius: 8px;
  overflow: hidden;
  max-height: 150px;
}

.background-preview img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
}
</style>