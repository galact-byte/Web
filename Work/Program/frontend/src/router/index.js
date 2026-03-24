import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/Projects.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/projects/create',
    name: 'CreateProject',
    component: () => import('../views/ProjectForm.vue'),
    meta: { requiresAuth: true, requiresManager: true }
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: () => import('../views/ProjectDetail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/projects/:id/edit',
    name: 'EditProject',
    component: () => import('../views/ProjectForm.vue'),
    meta: { requiresAuth: true, requiresManager: true }
  },
  {
    path: '/workload',
    name: 'Workload',
    component: () => import('../views/Workload.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/export',
    name: 'Export',
    component: () => import('../views/Export.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('../views/Users.vue'),
    meta: { requiresAuth: true, requiresManager: true }
  },
  {
    path: '/backup',
    name: 'Backup',
    component: () => import('../views/Backup.vue'),
    meta: { requiresAuth: true, requiresManager: true }
  },
  {
    path: '/progress/:type',
    name: 'ProjectProgress',
    component: () => import('../views/ProjectProgress.vue'),
    meta: { requiresAuth: true, requiresManager: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 导航守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  // 1. 强制改密优先级最高：已登录但需改密 → 只能留在登录页
  if (userStore.isLoggedIn && userStore.mustChangePassword) {
    if (to.name === 'Login') {
      next()  // 允许停留在登录页（显示改密弹窗）
    } else {
      next('/login')
    }
    return
  }

  // 2. 未登录 → 需认证页面跳转到登录
  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next('/login')
  // 3. 已登录 → 不允许访问登录页
  } else if (to.meta.requiresGuest && userStore.isLoggedIn) {
    next('/')
  // 4. 权限不足 → 非经理不能访问经理页面
  } else if (to.meta.requiresManager && !userStore.isManager) {
    next('/')
  } else {
    next()
  }
})

export default router
