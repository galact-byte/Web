<template>
  <div class="app-container">
    <div class="layout-wrapper">
      <!-- 侧边栏 -->
      <aside class="sidebar">
        <div class="logo">
          <div class="logo-icon">D</div>
          <h3>DocGen Pro</h3>
        </div>
        <nav class="nav-menu">
          <button
            v-for="item in menuItems"
            :key="item.index"
            @click="activeMenu = item.index"
            :class="['menu-item', { active: activeMenu === item.index }]"
          >
            <component :is="item.icon" class="menu-icon" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <!-- 主内容区 -->
      <main class="main-content">
        <transition name="fade" mode="out-in">
          <component :is="currentComponent" :key="activeMenu" />
        </transition>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Document, Files, Setting, Monitor, Brush } from '@element-plus/icons-vue'
import SingleProject from './components/SingleProject.vue'
import MultiProject from './components/MultiProject.vue'
import TemplateManager from './components/TemplateManager.vue'
import Settings from './components/Settings.vue'
import EnvSettings from './components/EnvSettings.vue'

const activeMenu = ref('1')

const menuItems = [
  { index: '1', label: '单项目生成', icon: Document },
  { index: '2', label: '多项目生成', icon: Files },
  { index: '3', label: '模板管理', icon: Setting },
  { index: '4', label: '环境变量', icon: Monitor },
  { index: '5', label: '外观设置', icon: Brush }
]

const currentComponent = computed(() => {
  switch (activeMenu.value) {
    case '1': return SingleProject
    case '2': return MultiProject
    case '3': return TemplateManager
    case '4': return EnvSettings
    case '5': return Settings
    default: return SingleProject
  }
})

// function to convert hex to rgb
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '79, 70, 229'
}

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

// 在主题色上选对比度更高的文字色（白或深灰），按 WCAG 相对亮度计算
const onPrimaryColor = (hex: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return '#ffffff'
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
    const c = parseInt(v, 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const whiteContrast = 1.05 / (lum + 0.05)
  const darkContrast = (lum + 0.05) / 0.059
  return whiteContrast >= darkContrast ? '#ffffff' : '#111827'
}

const applyPrimaryColor = (color: string) => {
  document.documentElement.style.setProperty('--on-primary', onPrimaryColor(color))
  document.documentElement.style.setProperty('--primary-color', color)
  document.documentElement.style.setProperty('--primary-color-rgb', hexToRgb(color))
}

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

const applyAnimations = (enabled: boolean) => {
  const duration = enabled ? '0.3s' : '0s'
  document.documentElement.style.setProperty('--transition-duration', duration)
}

const applyBackgroundImage = (image: string, opacityVal: number) => {
  const container = document.querySelector('.app-container') as HTMLElement
  if (!container) return
  
  const opacity = (100 - opacityVal) / 100
  document.documentElement.style.setProperty('--content-opacity', opacity.toString())
  
  if (image) {
    container.style.backgroundImage = `url(${image})`
    container.style.backgroundSize = 'cover'
    container.style.backgroundPosition = 'center'
    container.style.backgroundAttachment = 'fixed'
  } else {
    container.style.backgroundImage = ''
    document.documentElement.style.setProperty('--content-opacity', '1')
  }
}

const loadSettings = () => {
  const savedSettings = localStorage.getItem('docgen-settings')
  if (savedSettings) {
    let settings: Record<string, any> = {}
    try {
      settings = JSON.parse(savedSettings) || {}
    } catch (e) {
      console.error('读取外观设置失败，使用默认值:', e)
    }
    applyTheme(settings.theme || 'light')
    applyPrimaryColor(settings.primaryColor || '#4f46e5')
    applyFontSize(settings.fontSize || 'medium')
    applyAnimations(settings.animations !== false)
    applyBackgroundImage(settings.backgroundImage || '', settings.backgroundOpacity ?? 30)
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-size: var(--base-font-size, 14px);
}

.layout-wrapper {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar {
  width: 240px;
  background-color: rgba(var(--bg-sidebar-rgb), var(--content-opacity, 1));
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  backdrop-filter: blur(10px);
  transition: background-color var(--transition-duration, 0.3s), border-color var(--transition-duration, 0.3s);
}

.logo {
  height: 80px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: var(--primary-color, #4f46e5);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 12px;
  font-size: 18px;
  color: var(--on-primary, #ffffff);
}

.logo h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-main);
  font-weight: 600;
}

.nav-menu {
  flex: 1;
  padding: 16px 12px;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 4px;
  border: none;
  background: transparent;
  color: var(--text-sidebar);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
}

.menu-item:hover {
  background: var(--el-fill-color-light);
  color: var(--text-main);
}

.menu-item.active {
  background: var(--primary-color, #4f46e5);
  color: var(--on-primary, #ffffff);
}

.menu-icon {
  width: 20px;
  height: 20px;
}

.main-content {
  flex: 1;
  background-color: rgba(var(--bg-content-rgb), var(--content-opacity, 1));
  overflow: auto;
  padding: 32px;
  backdrop-filter: blur(10px);
  transition: background-color var(--transition-duration, 0.3s);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-duration, 0.3s) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>