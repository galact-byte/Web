import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

export interface ThemeColorOption {
  name: string
  value: string
}

export const themeColors: ThemeColorOption[] = [
  { name: '工程蓝', value: '#2563eb' },
  { name: '深海青', value: '#0284c7' },
  { name: '靛蓝', value: '#4f46e5' },
  { name: '翡翠绿', value: '#10b981' },
  { name: '青碧色', value: '#06b6d4' },
  { name: '琥珀橙', value: '#f59e0b' },
  { name: '珊瑚红', value: '#ef4444' },
  { name: '品红色', value: '#ec4899' }
]

const STORAGE_KEY = 'docgen-settings'

const theme = ref<'light' | 'dark' | 'auto'>('light')
const primaryColor = ref<string>('#2563eb')
const fontSize = ref<'small' | 'medium' | 'large'>('medium')
const animations = ref<boolean>(true)
const notifications = ref<boolean>(true)
const showTips = ref<boolean>(true)
const backgroundImage = ref<string>('')
const backgroundOpacity = ref<number>(30)

let mediaListenerBound = false

const safeParse = (raw: string): Record<string, any> => {
  try {
    return JSON.parse(raw) || {}
  } catch (e) {
    console.error('读取外观设置失败，使用默认值:', e)
    return {}
  }
}

export const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '79, 70, 229'
}

// 在主题色上选对比度更高的文字色（白或深灰），按 WCAG 相对亮度计算
export const onPrimaryColor = (hex: string): string => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return '#ffffff'
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
    const c = parseInt(v, 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const whiteContrast = 1.05 / (lum + 0.05)
  const darkContrast = (lum + 0.05) / 0.059
  return whiteContrast >= darkContrast ? '#ffffff' : '#111827'
}

export const applyTheme = (themeValue: string = theme.value): void => {
  const html = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = themeValue === 'dark' || (themeValue === 'auto' && prefersDark)

  html.classList.toggle('dark', isDark)
  html.style.colorScheme = isDark ? 'dark' : 'light'
}

export const applyPrimaryColor = (color: string = primaryColor.value): void => {
  const root = document.documentElement
  root.style.setProperty('--on-primary', onPrimaryColor(color))
  root.style.setProperty('--primary-color', color)
  root.style.setProperty('--primary-color-rgb', hexToRgb(color))
}

export const applyFontSize = (size: string = fontSize.value): void => {
  const sizes: Record<string, string> = {
    small: '12px',
    medium: '14px',
    large: '16px'
  }
  const val = sizes[size] || '14px'
  const root = document.documentElement
  root.style.setProperty('--base-font-size', val)
  root.style.setProperty('--el-font-size-base', val)
}

export const applyAnimations = (enabled: boolean = animations.value): void => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const active = enabled && !prefersReduced
  const duration = active ? '0.2s' : '0s'
  const root = document.documentElement
  root.style.setProperty('--transition-duration', duration)
  root.classList.toggle('reduce-motion', !active)
}

export const applyBackgroundImage = (
  image: string = backgroundImage.value,
  opacityVal: number = backgroundOpacity.value
): void => {
  const root = document.documentElement
  const container = document.querySelector('.app-container') as HTMLElement | null

  if (image) {
    // opacityVal (0~80): 控制整体与卡片毛玻璃透光度，同时保证深浅色文字对比度
    const t = Math.max(0, Math.min(85, opacityVal)) / 100
    const bgAlpha = Math.max(0.32, +(0.82 - t * 0.58).toFixed(2))
    const sidebarAlpha = Math.max(0.46, +(0.86 - t * 0.48).toFixed(2))
    const cardAlpha = Math.max(0.30, +(0.84 - t * 0.64).toFixed(2))

    root.style.setProperty('--content-opacity', bgAlpha.toString())
    root.style.setProperty('--sidebar-opacity', sidebarAlpha.toString())
    root.style.setProperty('--card-opacity', cardAlpha.toString())
    if (container) {
      container.style.backgroundImage = `url(${image})`
      container.style.backgroundSize = 'cover'
      container.style.backgroundPosition = 'center'
      container.style.backgroundAttachment = 'fixed'
    }
  } else {
    root.style.setProperty('--content-opacity', '1')
    root.style.setProperty('--sidebar-opacity', '1')
    root.style.setProperty('--card-opacity', '1')
    if (container) {
      container.style.backgroundImage = ''
    }
  }
}

const ensureMediaListeners = (): void => {
  if (mediaListenerBound || typeof window === 'undefined') return
  mediaListenerBound = true

  const darkMedia = window.matchMedia('(prefers-color-scheme: dark)')
  darkMedia.addEventListener('change', () => {
    if (theme.value === 'auto') {
      applyTheme('auto')
    }
  })

  const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionMedia.addEventListener('change', () => {
    applyAnimations(animations.value)
  })
}

export const loadSettings = (): void => {
  ensureMediaListeners()
  const savedSettings = localStorage.getItem(STORAGE_KEY)
  if (savedSettings) {
    const settings = safeParse(savedSettings)
    theme.value = settings.theme || 'light'
    primaryColor.value = settings.primaryColor || '#2563eb'
    fontSize.value = settings.fontSize || 'medium'
    animations.value = settings.animations !== false
    notifications.value = settings.notifications !== false
    showTips.value = settings.showTips !== false
    backgroundImage.value = settings.backgroundImage || ''
    backgroundOpacity.value = settings.backgroundOpacity ?? 30
  }

  applyTheme(theme.value)
  applyPrimaryColor(primaryColor.value)
  applyFontSize(fontSize.value)
  applyAnimations(animations.value)
  applyBackgroundImage(backgroundImage.value, backgroundOpacity.value)
}

export const saveSettings = (): boolean => {
  const payload = {
    theme: theme.value,
    primaryColor: primaryColor.value,
    fontSize: fontSize.value,
    animations: animations.value,
    notifications: notifications.value,
    showTips: showTips.value,
    backgroundImage: backgroundImage.value,
    backgroundOpacity: backgroundOpacity.value
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch (e) {
    console.error('保存外观设置失败:', e)
    if (backgroundImage.value) {
      backgroundImage.value = ''
      applyBackgroundImage('', backgroundOpacity.value)
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...payload, backgroundImage: '' })
        )
      } catch {
        // ignore secondary error
      }
      ElMessage.error('背景图片过大，无法保存，已取消设置')
    } else {
      ElMessage.error('外观设置保存失败')
    }
    return false
  }
}

export const resetAllSettings = (): void => {
  theme.value = 'light'
  primaryColor.value = '#2563eb'
  fontSize.value = 'medium'
  animations.value = true
  notifications.value = true
  showTips.value = true
  backgroundImage.value = ''
  backgroundOpacity.value = 30

  localStorage.removeItem(STORAGE_KEY)

  applyTheme('light')
  applyPrimaryColor('#2563eb')
  applyFontSize('medium')
  applyAnimations(true)
  applyBackgroundImage('', 30)
}

// 受「消息通知」开关控制的提示函数：关闭通知时仅静默常规成功/信息提示，警告与错误始终提示
export const notify = (
  type: 'success' | 'info' | 'warning' | 'error',
  message: string
): void => {
  if (!notifications.value && (type === 'success' || type === 'info')) {
    return
  }
  ElMessage[type](message)
}

export function useSettings() {
  const hasBackgroundImage = computed(() => Boolean(backgroundImage.value))

  return {
    theme,
    primaryColor,
    fontSize,
    animations,
    notifications,
    showTips,
    backgroundImage,
    backgroundOpacity,
    hasBackgroundImage,
    themeColors,
    onPrimaryColor,
    applyTheme,
    applyPrimaryColor,
    applyFontSize,
    applyAnimations,
    applyBackgroundImage,
    loadSettings,
    saveSettings,
    resetAllSettings,
    notify
  }
}
