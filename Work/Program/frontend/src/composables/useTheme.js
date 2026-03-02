import { ref } from 'vue'

// Module-level singleton — all components share the same reactive state
const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')

export function useTheme() {
  function toggleTheme() {
    isDark.value = !isDark.value
    const theme = isDark.value ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }

  return { isDark, toggleTheme }
}
