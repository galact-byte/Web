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

const applyPrimaryColor = (color: string) => {
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
    const settings = JSON.parse(savedSettings)
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
  --bg-sidebar-rgb: 31, 41, 55;
  --bg-content-rgb: 243, 244, 246;
  --text-main: #1f2937;
  --text-sidebar: #9ca3af;
}

:global(.dark) .app-container {
  --bg-sidebar-rgb: 17, 24, 39;
  --bg-content-rgb: 17, 24, 39;
  --text-main: #f3f4f6;
  --text-sidebar: #9ca3af;
}

.layout-wrapper {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar {
  width: 240px;
  background-color: rgba(var(--bg-sidebar-rgb), var(--content-opacity));
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  backdrop-filter: blur(10px);
  transition: background-color var(--transition-duration, 0.3s), border-color var(--transition-duration, 0.3s);
}

.logo {
  height: 80px;
  display: flex;
  align-items: center;
  padding: 0 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, var(--primary-color, #4f46e5) 0%, #818cf8 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 12px;
  font-size: 18px;
  color: white;
}

.logo h3 {
  margin: 0;
  font-size: 18px;
  color: white;
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
  background: rgba(255, 255, 255, 0.05);
  color: white;
}

.menu-item.active {
  background: var(--primary-color, #4f46e5);
  color: white;
  box-shadow: 0 4px 12px rgba(var(--primary-color-rgb, 79, 70, 229), 0.4);
}

.menu-icon {
  width: 20px;
  height: 20px;
}

.main-content {
  flex: 1;
  background-color: rgba(var(--bg-content-rgb), var(--content-opacity));
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