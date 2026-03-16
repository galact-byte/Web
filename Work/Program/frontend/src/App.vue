<template>
  <div id="app">
    <router-view v-slot="{ Component }">
      <transition name="page">
        <component :is="Component" :key="$route.path" />
      </transition>
    </router-view>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from './stores/user'

const router = useRouter()
const userStore = useUserStore()

// 应用启动时校验缓存的 token 是否仍然有效
onMounted(async () => {
  if (userStore.token) {
    const user = await userStore.fetchCurrentUser()
    if (!user) {
      // token 已失效，跳转登录
      router.replace('/login')
    } else if (user.must_change_password) {
      // 同步最新的 must_change_password 状态到本地
      router.replace('/login')
    }
  }
})
</script>

<style>
#app {
  min-height: 100vh;
}

/* 路由页面过渡：交叉淡入淡出，无空白闪烁 */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease;
}
.page-enter-from {
  opacity: 0;
}
.page-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  opacity: 0;
}
</style>
