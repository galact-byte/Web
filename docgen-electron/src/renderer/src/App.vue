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
import { ref, computed } from 'vue'
import { Document, Files, Setting } from '@element-plus/icons-vue'
import SingleProject from './components/SingleProject.vue'
import MultiProject from './components/MultiProject.vue'
import TemplateManager from './components/TemplateManager.vue'
import Settings from './components/Settings.vue'

const activeMenu = ref('1')

const menuItems = [
  { index: '1', label: '单项目生成', icon: Document },
  { index: '2', label: '多项目生成', icon: Files },
  { index: '3', label: '模板管理', icon: Setting },
  { index: '4', label: '外观设置', icon: Setting }
]

const currentComponent = computed(() => {
  switch (activeMenu.value) {
    case '1': return SingleProject
    case '2': return MultiProject
    case '3': return TemplateManager
    case '4': return Settings
    default: return SingleProject
  }
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.layout-wrapper {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar {
  width: 240px;
  background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
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
  background: linear-gradient(135deg, #4f46e5 0%, #818cf8 100%);
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
  color: #9ca3af;
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
  background: #4f46e5;
  color: white;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
}

.menu-icon {
  width: 20px;
  height: 20px;
}

.main-content {
  flex: 1;
  background: #f3f4f6;
  overflow: auto;
  padding: 32px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>