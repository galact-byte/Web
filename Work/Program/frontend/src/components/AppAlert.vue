<template>
  <Teleport to="body">
    <Transition name="app-alert-fade">
      <div v-if="current" class="app-alert-overlay">
        <div class="app-alert" :class="`app-alert-${current.type}`" role="alertdialog" aria-modal="true">
          <div class="app-alert-icon" aria-hidden="true">
            <svg v-if="current.type === 'success'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg v-else-if="current.type === 'error'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <circle cx="12" cy="16" r="1"></circle>
            </svg>
          </div>

          <div class="app-alert-body">
            <h3 v-if="current.title" class="app-alert-title">{{ current.title }}</h3>
            <p class="app-alert-message">{{ current.message }}</p>
          </div>

          <div class="app-alert-actions">
            <button ref="confirmButton" class="btn btn-primary" type="button" @click="closeAppAlert">
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
import { closeAppAlert, useAppAlertState } from '../services/appAlert'

const state = useAppAlertState()
const current = toRef(state, 'current')
const confirmButton = ref(null)

watch(current, async (value) => {
  if (!value) return
  await nextTick()
  confirmButton.value?.focus()
}, { flush: 'post' })
</script>

<style scoped>
.app-alert-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(15, 15, 15, 0.52);
  backdrop-filter: blur(6px);
}

.app-alert {
  width: min(100%, 420px);
  padding: 1.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}

.app-alert-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin-bottom: 1rem;
  border-radius: 999px;
  background: var(--bg-tertiary);
}

.app-alert-info .app-alert-icon {
  color: var(--accent-primary);
  background: var(--accent-glow);
}

.app-alert-success .app-alert-icon {
  color: var(--success);
  background: var(--success-bg);
}

.app-alert-error .app-alert-icon {
  color: var(--error);
  background: var(--error-bg);
}

.app-alert-title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}

.app-alert-message {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-secondary);
  line-height: 1.65;
}

.app-alert-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.app-alert-fade-enter-active,
.app-alert-fade-leave-active {
  transition: opacity 0.18s ease;
}

.app-alert-fade-enter-active .app-alert,
.app-alert-fade-leave-active .app-alert {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.app-alert-fade-enter-from,
.app-alert-fade-leave-to {
  opacity: 0;
}

.app-alert-fade-enter-from .app-alert,
.app-alert-fade-leave-to .app-alert {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
