<template>
  <Teleport to="body">
    <Transition name="app-confirm-fade">
      <div v-if="current" class="app-confirm-overlay">
        <div class="app-confirm" :class="`app-confirm-${current.type}`" role="alertdialog" aria-modal="true">
          <div class="app-confirm-icon" aria-hidden="true">
            <svg v-if="current.type === 'danger'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M12 9v4"></path>
              <path d="M12 17h.01"></path>
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
            </svg>
            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 8v5"></path>
              <path d="M12 16h.01"></path>
            </svg>
          </div>

          <div class="app-confirm-body">
            <h3 class="app-confirm-title">{{ current.title }}</h3>
            <p class="app-confirm-message">{{ current.message }}</p>
          </div>

          <div class="app-confirm-actions">
            <button class="btn btn-secondary" type="button" @click="cancelAppConfirm">
              {{ current.cancelText }}
            </button>
            <button ref="confirmButton" class="btn" :class="current.type === 'danger' ? 'btn-danger' : 'btn-primary'" type="button" @click="confirmAppConfirm">
              {{ current.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { nextTick, ref, toRef, watch } from 'vue'
import { cancelAppConfirm, confirmAppConfirm, useAppConfirmState } from '../services/appConfirm'

const state = useAppConfirmState()
const current = toRef(state, 'current')
const confirmButton = ref(null)

watch(current, async (value) => {
  if (!value) return
  await nextTick()
  confirmButton.value?.focus()
}, { flush: 'post' })
</script>

<style scoped>
.app-confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(15, 15, 15, 0.56);
  backdrop-filter: blur(6px);
}

.app-confirm {
  width: min(100%, 460px);
  padding: 1.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}

.app-confirm-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 1rem;
  border-radius: 999px;
}

.app-confirm-warning .app-confirm-icon {
  color: var(--warning);
  background: var(--warning-bg);
}

.app-confirm-danger .app-confirm-icon {
  color: var(--error);
  background: var(--error-bg);
}

.app-confirm-title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.app-confirm-message {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-secondary);
  line-height: 1.65;
}

.app-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.app-confirm-fade-enter-active,
.app-confirm-fade-leave-active {
  transition: opacity 0.18s ease;
}

.app-confirm-fade-enter-active .app-confirm,
.app-confirm-fade-leave-active .app-confirm {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.app-confirm-fade-enter-from,
.app-confirm-fade-leave-to {
  opacity: 0;
}

.app-confirm-fade-enter-from .app-confirm,
.app-confirm-fade-leave-to .app-confirm {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
