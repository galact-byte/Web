<template>
  <Teleport to="body">
    <Transition name="toast-fade">
      <div v-if="visible" class="toast-overlay">
        <div class="toast-box" :class="type">
          <div class="toast-icon" v-if="type === 'success'">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="toast-icon" v-else>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          </div>
          <p class="toast-msg">{{ message }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  message: { type: String, default: '' },
  type: { type: String, default: 'success' },  // success | error
  duration: { type: Number, default: 2000 },
})

const emit = defineEmits(['done'])
const visible = ref(false)
let timer = null

watch(() => props.message, (val) => {
  if (!val) return
  visible.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    visible.value = false
    emit('done')
  }, props.duration)
}, { immediate: true })
</script>

<style scoped>
.toast-overlay {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.toast-box {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.8rem 1.5rem;
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  pointer-events: auto;
}
.toast-box.success .toast-icon { color: #10b981; }
.toast-box.error .toast-icon { color: #ef4444; }
.toast-msg { margin: 0; font-size: 0.95rem; color: var(--text-primary, #f5f5f5); }
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.2s ease; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; }
</style>
