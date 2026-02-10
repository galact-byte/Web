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
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 导航守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    next('/login')
  } else if (to.meta.requiresGuest && userStore.isLoggedIn) {
    next('/')
  } else if (to.meta.requiresManager && !userStore.isManager) {
    next('/')
  } else {
    next()
  }
})

export default router
