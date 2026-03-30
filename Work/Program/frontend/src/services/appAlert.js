import { reactive } from 'vue'

const state = reactive({
  queue: [],
  current: null,
})

function showNextAlert() {
  if (state.current || state.queue.length === 0) return
  state.current = state.queue.shift()
}

export function showAppAlert(message, options = {}) {
  return new Promise((resolve) => {
    state.queue.push({
      id: Date.now() + Math.random(),
      title: options.title || '',
      message,
      type: options.type || 'info',
      confirmText: options.confirmText || '知道了',
      resolve,
    })
    showNextAlert()
  })
}

export function closeAppAlert() {
  if (!state.current) return
  const current = state.current
  state.current = null
  current.resolve()
  showNextAlert()
}

export function useAppAlertState() {
  return state
}
