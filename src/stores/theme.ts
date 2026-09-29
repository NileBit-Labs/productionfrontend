import { ref } from 'vue'
import { defineStore } from 'pinia'

export type Theme = 'light' | 'dark' | 'system'

function readStoredTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(readStoredTheme())
  applyTheme(theme.value)

  function setTheme(next: Theme) {
    theme.value = next
    if (next === 'system') {
      localStorage.removeItem('theme')
    } else {
      localStorage.setItem('theme', next)
    }
    applyTheme(next)
  }

  return { theme, setTheme }
})
