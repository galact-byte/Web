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
// 全局应用组件
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
