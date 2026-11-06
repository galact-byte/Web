<template>
  <div :class="['app-container', { 'has-bg-image': hasBackgroundImage }]">
    <div class="layout-wrapper">
      <!-- 侧边栏 -->
      <aside class="sidebar" aria-label="主导航侧边栏">
        <div class="logo">
          <div class="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="logo-svg">
              <!-- 后层文档页（代表多项目/批量模板） -->
              <path
                d="M8 4.5C8 3.67157 8.67157 3 9.5 3H16.3787C16.7765 3 17.158 3.15804 17.4393 3.43934L19.5607 5.56066C19.842 5.84196 20 6.2235 20 6.62132V17C20 17.8284 19.3284 18.5 18.5 18.5H15.5"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                 opacity="0.55"
              />
              <!-- 前层主文档页 -->
              <rect
                x="4"
                y="6"
                width="11.5"
                height="15"
                rx="2"
                fill="currentColor"
                fill-opacity="0.12"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round"
              />
              <!-- 文档正文条纹与生成完成勾号 -->
              <path
                d="M7 10.2H12.5M7 13H10.5"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
              <path
                d="M7.3 16.8L9.1 18.5L12.4 15.2"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div class="logo-text">
            <h1>DocGen Pro</h1>
            <span class="logo-subtitle">测评文档工作台</span>
          </div>
        </div>
        <nav class="nav-menu" aria-label="功能导航">
          <button
            v-for="item in menuItems"
            :key="item.index"
            type="button"
            @click="activeMenu = item.index"
            :aria-current="activeMenu === item.index ? 'page' : undefined"
            :class="['menu-item', { active: activeMenu === item.index }]"
          >
            <component :is="item.icon" class="menu-icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <!-- 主内容区 -->
      <main class="main-content">
        <transition name="fade" mode="out-in">
          <keep-alive>
            <component :is="currentComponent" :key="activeMenu" />
          </keep-alive>
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
import { useSettings } from './composables/useSettings'

const activeMenu = ref('1')
const { hasBackgroundImage, loadSettings } = useSettings()

const menuItems = [
  { index: '1', label: '单项目生成', icon: Document },
  { index: '2', label: '多项目生成', icon: Files },
  { index: '3', label: '模板管理', icon: Setting },
  { index: '4', label: '环境变量', icon: Monitor },
  { index: '5', label: '外观设置', icon: Brush }
]

const currentComponent = computed(() => {
  switch (activeMenu.value) {
    case '1':
      return SingleProject
    case '2':
      return MultiProject
    case '3':
      return TemplateManager
    case '4':
      return EnvSettings
    case '5':
      return Settings
    default:
      return SingleProject
  }
})

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
  background-color: rgba(var(--bg-sidebar-rgb), var(--sidebar-opacity, 1));
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-lighter);
  flex-shrink: 0;
  transition:
    background-color var(--transition-duration, 0.2s) ease,
    border-color var(--transition-duration, 0.2s) ease;
}

.has-bg-image .sidebar,
.has-bg-image .main-content {
  backdrop-filter: blur(18px) saturate(140%);
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.logo-mark {
  width: 36px;
  height: 36px;
  background: color-mix(in srgb, var(--accent-readable, var(--primary-color, #2563eb)) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-readable, var(--primary-color, #2563eb)) 30%, transparent);
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-readable, var(--primary-color, #2563eb));
  flex-shrink: 0;
}

.logo-svg {
  width: 21px;
  height: 21px;
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.logo-text h1 {
  margin: 0;
  font-size: 15px;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--text-main);
  font-weight: 700;
}

.logo-subtitle {
  font-size: 11px;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.nav-menu {
  flex: 1;
  padding: 12px 10px;
}

.menu-item {
  position: relative;
  width: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  margin-bottom: 4px;
  border: none;
  background: transparent;
  color: var(--text-sidebar);
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color var(--transition-duration, 0.2s) ease,
    color var(--transition-duration, 0.2s) ease;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
}

.menu-item:hover {
  background: var(--el-fill-color-light);
  color: var(--text-main);
}

.menu-item.active {
  background: color-mix(in srgb, var(--accent-readable, var(--primary-color, #2563eb)) 14%, transparent);
  color: var(--accent-readable, var(--primary-color, #2563eb));
  font-weight: 600;
}

.menu-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--accent-readable, var(--primary-color, #2563eb));
}

.menu-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  background-color: rgba(var(--bg-content-rgb), var(--content-opacity, 1));
  overflow: auto;
  padding: 24px 28px;
  transition: background-color var(--transition-duration, 0.2s) ease;
}

@media (max-width: 960px) {
  .sidebar {
    width: 200px;
  }
  .main-content {
    padding: 20px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-duration, 0.2s) ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
