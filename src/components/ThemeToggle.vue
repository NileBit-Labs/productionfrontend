<script setup lang="ts">
import { useThemeStore, type Theme } from '@/stores/theme'

const themeStore = useThemeStore()

const options: { value: Theme; label: string; title: string }[] = [
  { value: 'light', label: '☀', title: 'Light' },
  { value: 'system', label: '◐', title: 'Match system' },
  { value: 'dark', label: '☾', title: 'Dark' },
]
</script>

<template>
  <div class="theme-toggle" role="radiogroup" aria-label="Theme">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="themeStore.theme === option.value"
      :aria-label="option.title"
      :title="option.title"
      class="theme-option"
      :class="{ active: themeStore.theme === option.value }"
      @click="themeStore.setTheme(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  padding: 2px;
  background: var(--color-canvas);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.theme-option {
  display: grid;
  place-items: center;
  width: 32px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-ink-faint);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.theme-option:hover {
  color: var(--color-ink);
}

.theme-option.active {
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.08);
}

@media (max-width: 640px) {
  .theme-option {
    width: 40px;
    height: 40px;
  }
}
</style>
