<template>
  <div class="settings">
    <div class="page-header">
      <div class="title-group">
        <h2>外观设置</h2>
        <p class="subtitle">个性化您的 DocGen Pro 界面与交互偏好</p>
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
            <el-radio-button value="light" label="light">浅色</el-radio-button>
            <el-radio-button value="dark" label="dark">深色</el-radio-button>
            <el-radio-button value="auto" label="auto">跟随系统</el-radio-button>
          </el-radio-group>
        </div>

        <el-divider />

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><Discount /></el-icon>
            <span>主题色</span>
          </div>
          <div class="color-picker-group" role="radiogroup" aria-label="选择主题色">
            <button
              v-for="color in themeColors"
              :key="color.value"
              type="button"
              :class="['color-option', { active: primaryColor === color.value }]"
              :style="{ backgroundColor: color.value }"
              :title="color.name"
              :aria-label="`主题色：${color.name}`"
              :aria-pressed="primaryColor === color.value"
              @click="handleColorChange(color.value)"
            >
              <el-icon v-if="primaryColor === color.value" :color="onPrimaryColor(color.value)">
                <Check />
              </el-icon>
            </button>
          </div>
        </div>
      </el-card>

      <el-card class="settings-card" shadow="hover">
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
            <el-radio-button value="small" label="small">小 (12px)</el-radio-button>
            <el-radio-button value="medium" label="medium">中 (14px)</el-radio-button>
            <el-radio-button value="large" label="large">大 (16px)</el-radio-button>
          </el-radio-group>
        </div>

        <el-divider />

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><MagicStick /></el-icon>
            <div class="setting-text">
              <span>界面过渡动画</span>
              <small class="setting-desc">开启页面切换与按钮过渡效果（自动遵循系统减弱动画设置）</small>
            </div>
          </div>
          <el-switch v-model="animations" @change="handleAnimationChange" />
        </div>
      </el-card>

      <el-card class="settings-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>交互与提示</span>
          </div>
        </template>

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><Bell /></el-icon>
            <div class="setting-text">
              <span>常规操作通知</span>
              <small class="setting-desc">关闭后仅静默常规成功提示，错误与警告仍会正常弹出</small>
            </div>
          </div>
          <el-switch v-model="notifications" @change="handleNotificationChange" />
        </div>

        <el-divider />

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><QuestionFilled /></el-icon>
            <div class="setting-text">
              <span>显示页面提示信息</span>
              <small class="setting-desc">在各功能页底部或顶部显示操作说明提示框</small>
            </div>
          </div>
          <el-switch v-model="showTips" @change="handleShowTipsChange" />
        </div>
      </el-card>

      <el-card class="settings-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>背景设置</span>
          </div>
        </template>

        <div class="setting-item">
          <div class="setting-label">
            <el-icon><Picture /></el-icon>
            <span>自定义背景图</span>
          </div>
          <div class="background-controls">
            <el-button size="small" @click="selectBackgroundImage">选择图片</el-button>
            <el-button
              size="small"
              type="danger"
              plain
              @click="clearBackgroundImage"
              v-if="backgroundImage"
            >
              清除
            </el-button>
          </div>
        </div>

        <el-divider v-if="backgroundImage" />

        <div class="setting-item" v-if="backgroundImage">
          <div class="setting-label">
            <el-icon><View /></el-icon>
            <span>内容区透光度 ({{ backgroundOpacity }}%)</span>
          </div>
          <el-slider
            v-model="backgroundOpacity"
            :min="0"
            :max="80"
            :step="5"
            style="width: 200px"
            @change="handleBackgroundOpacityChange"
          />
        </div>

        <div v-if="backgroundImage" class="background-preview">
          <img :src="backgroundImage" alt="自定义背景图片预览" />
        </div>
      </el-card>

      <div class="reset-section">
        <el-button type="danger" plain @click="resetSettings">
          <el-icon class="el-icon--left"><RefreshLeft /></el-icon>
          恢复默认设置
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import {
  Sunny,
  Discount,
  Document,
  MagicStick,
  Bell,
  QuestionFilled,
  RefreshLeft,
  Check,
  Picture,
  View
} from '@element-plus/icons-vue'
import { useSettings } from '../composables/useSettings'

const {
  theme,
  primaryColor,
  fontSize,
  animations,
  notifications,
  showTips,
  backgroundImage,
  backgroundOpacity,
  themeColors,
  onPrimaryColor,
  applyTheme,
  applyPrimaryColor,
  applyFontSize,
  applyAnimations,
  applyBackgroundImage,
  loadSettings,
  saveSettings,
  resetAllSettings,
  notify
} = useSettings()

const handleThemeChange = (value: string | number | boolean | undefined) => {
  applyTheme(String(value || 'light'))
  saveSettings()
  notify('success', '主题已更新')
}

const handleColorChange = (color: string) => {
  primaryColor.value = color
  applyPrimaryColor(color)
  saveSettings()
  notify('success', '主题色已更新')
}

const handleFontSizeChange = (value: string | number | boolean | undefined) => {
  applyFontSize(String(value || 'medium'))
  saveSettings()
  notify('success', '字体大小已更新')
}

const handleAnimationChange = (value: string | number | boolean) => {
  applyAnimations(Boolean(value))
  saveSettings()
}

const handleNotificationChange = () => {
  saveSettings()
}

const handleShowTipsChange = () => {
  saveSettings()
}

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
        const ok = saveSettings()
        if (ok && backgroundImage.value) {
          notify('success', '背景图片已设置')
        }
      }
      reader.readAsDataURL(file)
    }
  }
  input.click()
}

const clearBackgroundImage = () => {
  backgroundImage.value = ''
  backgroundOpacity.value = 30
  applyBackgroundImage()
  saveSettings()
  notify('success', '背景图片已清除')
}

const handleBackgroundOpacityChange = () => {
  applyBackgroundImage()
  saveSettings()
}

const resetSettings = async () => {
  try {
    await ElMessageBox.confirm('确定要恢复所有默认外观设置吗？', '确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    resetAllSettings()
    notify('success', '已恢复默认设置')
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
  max-width: 880px;
}

.page-header {
  margin-bottom: 18px;
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

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-card {
  border-radius: 12px;
  background-color: rgba(var(--bg-card-rgb), var(--card-opacity, 1));
}

.card-header {
  font-weight: 600;
  font-size: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  gap: 16px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.setting-label .el-icon {
  font-size: 20px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.setting-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.color-picker-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.color-option {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color var(--transition-duration, 0.2s) ease,
    box-shadow var(--transition-duration, 0.2s) ease;
  border: 2px solid transparent;
  padding: 0;
}

.color-option:hover {
  border-color: var(--el-border-color);
}

.color-option.active {
  border-color: #ffffff;
  box-shadow: 0 0 0 2px var(--primary-color, #4f46e5);
}

.reset-section {
  display: flex;
  justify-content: center;
  padding: 16px 0 24px;
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
