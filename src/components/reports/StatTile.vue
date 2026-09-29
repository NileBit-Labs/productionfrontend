<script setup lang="ts">
import NavIcon from '@/components/NavIcon.vue'

defineProps<{
  label: string
  value: string
  hint?: string
  icon?: string
  /** Colours the hint: up = good news, down = bad news. */
  trend?: 'up' | 'down' | null
}>()
</script>

<template>
  <div class="tile card">
    <p class="label">
      <span v-if="icon" class="badge"><NavIcon :name="icon" /></span>
      {{ label }}
    </p>
    <p class="value">{{ value }}</p>
    <p v-if="hint" class="hint" :class="trend">{{ hint }}</p>
  </div>
</template>

<style scoped>
.tile {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.125rem 1.25rem 1.25rem;
  min-width: 0;
}

.label {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8125rem;
  color: var(--color-ink-faint);
}

.badge {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.value {
  margin-top: 0.375rem;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.hint {
  font-size: 0.75rem;
  color: var(--color-ink-faint);
}

.hint.up {
  color: var(--color-primary);
}

.hint.down {
  color: var(--color-danger);
}
</style>
