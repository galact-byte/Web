<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <span class="logo-text">慎微</span>
      </div>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          <span>仪表盘</span>
        </router-link>
        <router-link to="/projects" class="nav-item" :class="{ active: $route.path.startsWith('/projects') }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <span>项目管理</span>
        </router-link>
        <router-link to="/workload" class="nav-item" :class="{ active: $route.path === '/workload' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
          <span>工作量统计</span>
        </router-link>
        <router-link to="/export" class="nav-item" :class="{ active: $route.path === '/export' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span>导出完结单</span>
        </router-link>
        <!-- 项目进度下拉菜单（仅经理可见） -->
        <div v-if="userStore.isManager" class="nav-group">
          <button class="nav-group-toggle" :class="{ active: $route.path.startsWith('/progress') }" @click="progressOpen = !progressOpen">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            <span>项目进度</span>
            <svg class="group-chevron" :class="{ open: progressOpen }" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <div v-show="progressOpen" class="nav-group-items">
            <router-link to="/progress/dengbao" class="nav-sub-item" :class="{ active: $route.path === '/progress/dengbao' }">
              <span class="dot"></span>等保测评
            </router-link>
            <router-link to="/progress/password" class="nav-sub-item" :class="{ active: $route.path === '/progress/password' }">
              <span class="dot"></span>密码评估
            </router-link>
            <router-link to="/progress/security" class="nav-sub-item" :class="{ active: $route.path === '/progress/security' }">
              <span class="dot"></span>安全评估
            </router-link>
            <router-link to="/progress/risk" class="nav-sub-item" :class="{ active: $route.path === '/progress/risk' }">
              <span class="dot"></span>风险评估
            </router-link>
            <router-link to="/progress/testing" class="nav-sub-item" :class="{ active: $route.path === '/progress/testing' }">
              <span class="dot"></span>软件测试
            </router-link>
            <router-link to="/progress/service" class="nav-sub-item" :class="{ active: $route.path === '/progress/service' }">
              <span class="dot"></span>安全服务
            </router-link>
            <router-link to="/progress/comprehensive" class="nav-sub-item" :class="{ active: $route.path === '/progress/comprehensive' }">
              <span class="dot"></span>综合服务
            </router-link>
          </div>
        </div>
        <router-link v-if="userStore.isManager" to="/users" class="nav-item" :class="{ active: $route.path === '/users' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          <span>用户管理</span>
        </router-link>
        <router-link v-if="userStore.isManager" to="/backup" class="nav-item" :class="{ active: $route.path === '/backup' }">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>备份恢复</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="avatar">{{ userStore.user?.display_name?.charAt(0) || 'U' }}</div>
          <div class="user-details">
            <div class="user-name">{{ userStore.user?.display_name }}</div>
            <div class="user-role">{{ userStore.isManager ? '经理' : '员工' }}</div>
          </div>
        </div>
        <div class="footer-actions">
          <button class="btn-theme" @click="toggleTheme" :title="isDark ? '切换浅色主题' : '切换深色主题'">
            <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>
          <button class="btn-logout" @click="handleLogout" title="退出登录">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { useTheme } from '../composables/useTheme'

const router = useRouter()
const userStore = useUserStore()
const { isDark, toggleTheme } = useTheme()
const progressOpen = ref(true)

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }

.sidebar {
  width: 240px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  display: flex; flex-direction: column;
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
}
.sidebar-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1.25rem 1rem;
  border-bottom: 1px solid var(--border-color);
}
.logo {
  width: 36px; height: 36px;
  background: var(--accent-primary);
  border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  color: white;
  transition: transform 0.3s ease;
  flex-shrink: 0;
}
.logo:hover { transform: rotate(8deg); }
.logo-text { font-size: 1rem; font-weight: 600; }

.sidebar-nav {
  flex: 1;
  padding: 0.75rem 0.625rem;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
}
.nav-item {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.625rem 0.75rem;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  transition: color 0.15s ease, background 0.15s ease;
  text-decoration: none;
  font-size: 0.9rem;
  cursor: pointer;
  position: relative;
}
.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 60%;
  border-radius: 0 2px 2px 0;
  background: var(--accent-primary);
  transition: transform 0.2s ease;
}
.nav-item.active::before {
  transform: translateY(-50%) scaleY(1);
}
.nav-item:hover::before {
  transform: translateY(-50%) scaleY(0.5);
}
.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.nav-item.active {
  background: var(--accent-glow);
  color: var(--accent-primary);
  font-weight: 500;
}

/* Nav group (dropdown menu) */
.nav-group { margin: 2px 0; }
.nav-group-toggle {
  display: flex; align-items: center; gap: 0.625rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  font-size: 0.9rem;
  cursor: pointer;
  background: none; border: none;
  text-align: left;
  position: relative;
}
.nav-group-toggle:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.nav-group-toggle.active {
  color: var(--accent-primary);
  font-weight: 500;
}
.nav-group-toggle.active::before {
  content: '';
  position: absolute;
  left: -0.625rem;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--accent-primary);
  border-radius: 0 2px 2px 0;
}
.nav-group-toggle .group-chevron {
  margin-left: auto;
  transition: transform 0.2s ease;
  opacity: 0.5;
}
.nav-group-toggle .group-chevron.open { transform: rotate(180deg); }
.nav-group-items {
  padding: 2px 0 2px 0.5rem;
}
.nav-sub-item {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: var(--text-muted);
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
  text-decoration: none;
  font-size: 0.85rem;
  cursor: pointer;
}
.nav-sub-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
.nav-sub-item.active {
  background: var(--accent-glow);
  color: var(--accent-primary);
  font-weight: 500;
}
.nav-sub-item .dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  flex-shrink: 0;
}
.nav-sub-item.active .dot {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.sidebar-footer {
  padding: 0.75rem;
  border-top: 1px solid var(--border-color);
  display: flex; align-items: center; justify-content: space-between;
}
.user-info { display: flex; align-items: center; gap: 0.625rem; }
.avatar {
  width: 32px; height: 32px;
  background: var(--accent-primary);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 600; font-size: 0.8rem;
  flex-shrink: 0;
}
.user-name { font-weight: 500; font-size: 0.85rem; }
.user-role { font-size: 0.7rem; color: var(--text-muted); }
.footer-actions { display: flex; align-items: center; gap: 2px; }
.btn-theme, .btn-logout {
  padding: 0.4rem;
  background: transparent; border: none;
  color: var(--text-muted);
  cursor: pointer; border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  display: flex; align-items: center;
}
.btn-theme:hover { background: var(--accent-glow); color: var(--accent-primary); }
.btn-logout:hover { background: var(--error-bg); color: var(--error); }

.main-content { flex: 1; margin-left: 240px; padding: 1.5rem 2rem; min-width: 0; }

@media (max-width: 768px) {
  .sidebar { width: 100%; height: auto; position: relative; }
  .main-content { margin-left: 0; }
}
</style>
