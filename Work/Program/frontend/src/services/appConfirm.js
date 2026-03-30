import { reactive } from 'vue'

const state = reactive({
  queue: [],
  current: null,
})

function showNextConfirm() {
  if (state.current || state.queue.length === 0) return
  state.current = state.queue.shift()
}

export function showAppConfirm(message, options = {}) {
  return new Promise((resolve) => {
    state.queue.push({
      title: options.title || '请确认操作',
      message,
      type: options.type || 'warning',
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      resolve,
    })
    showNextConfirm()
  })
}

function finish(result) {
  if (!state.current) return
  const current = state.current
  state.current = null
  current.resolve(result)
  showNextConfirm()
}

export function confirmAppConfirm() {
  finish(true)
}

export function cancelAppConfirm() {
  finish(false)
}

export function useAppConfirmState() {
  return state
}
