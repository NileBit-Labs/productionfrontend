<script setup lang="ts">
import { computed } from 'vue'
import '@/assets/charts.css'
import { formatUgx } from '@/lib/format'

export interface Slice {
  label: string
  value: number
  color: string
}

const props = defineProps<{ slices: Slice[]; centerLabel?: string; emptyText?: string }>()

// Money paid back out can leave a method at zero or below; only positive
// amounts can be drawn as a share of the whole.
const shown = computed(() => props.slices.filter((s) => s.value > 0))
const total = computed(() => shown.value.reduce((sum, s) => sum + s.value, 0))

const gradient = computed(() => {
  if (!total.value) return 'var(--color-border)'
  let at = 0
  const stops = shown.value.map((s) => {
    const from = at
    at += (s.value / total.value) * 100
    return `${s.color} ${from}% ${at}%`
  })
  return `conic-gradient(${stops.join(', ')})`
})

const percent = (v: number) => (total.value ? Math.round((v / total.value) * 100) : 0)
</script>

<template>
  <div class="donut-block">
    <div class="donut" :style="{ background: gradient }" role="img" :aria-label="centerLabel">
      <div class="center">
        <template v-if="total">
          <span class="v">{{ formatUgx(total) }}</span>
          <span class="l">{{ centerLabel ?? 'Total' }}</span>
        </template>
        <span v-else class="l">{{ emptyText ?? 'Nothing yet' }}</span>
      </div>
    </div>

    <ul class="legend">
      <li v-for="s in shown" :key="s.label">
        <span class="dot" :style="{ background: s.color }" />
        <span class="name">{{ s.label }}</span>
        <span class="amount">{{ formatUgx(s.value) }}</span>
        <span class="pct">{{ percent(s.value) }}%</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.donut {
  position: relative;
  width: 168px;
  height: 168px;
  border-radius: 50%;
  flex-shrink: 0;
}

.donut::after {
  content: '';
  position: absolute;
  inset: 24px;
  border-radius: 50%;
  background: var(--color-surface);
}

.center {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  padding: 0 2.25rem;
  text-align: center;
}

.v {
  font-size: 0.9375rem;
  font-weight: 600;
}

.l {
  font-size: 0.6875rem;
  color: var(--color-ink-faint);
}

.legend {
  align-self: stretch;
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.legend li {
  display: grid;
  grid-template-columns: 8px 1fr auto 2.5rem;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8125rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pct {
  text-align: right;
  color: var(--color-ink-faint);
  font-variant-numeric: tabular-nums;
}
</style>
