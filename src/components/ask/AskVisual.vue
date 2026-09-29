<script setup lang="ts">
import { computed } from 'vue'
import { formatQuantity, formatUgx } from '@/lib/format'
import type { AskVisual } from '@/types/ask'

const props = defineProps<{ visual: AskVisual }>()

const max = computed(() => Math.max(...props.visual.points.map((p) => p.value), 0))

function show(value: number): string {
  if (props.visual.unit === 'ugx') return formatUgx(value)
  if (props.visual.unit === 'units') return formatQuantity(value)
  return String(value)
}

// 1.2M, 45K: short enough to sit above a narrow bar.
function compact(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${+(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`
  return String(n)
}

const width = (value: number) =>
  max.value > 0 ? `${Math.max((value / max.value) * 100, value > 0 ? 2 : 0)}%` : '0%'
</script>

<template>
  <figure class="visual">
    <figcaption>{{ visual.title }}</figcaption>

    <div
      v-if="visual.type === 'bars'"
      class="bars"
      :style="{ gridTemplateColumns: `repeat(${visual.points.length}, minmax(0, 1fr))` }"
    >
      <div
        v-for="p in visual.points"
        :key="p.label"
        class="col"
        :title="`${p.label}: ${show(p.value)}`"
      >
        <span class="top">{{
          p.value > 0 && visual.points.length <= 14 ? compact(p.value) : ''
        }}</span>
        <span
          class="bar"
          :style="{
            height: max > 0 ? `${Math.max((p.value / max) * 100, p.value > 0 ? 3 : 1)}%` : '1%',
          }"
        />
        <span class="label">{{ p.label }}</span>
      </div>
    </div>

    <ul v-else class="ranking">
      <li v-for="p in visual.points" :key="p.label">
        <span class="name" :title="p.label">{{ p.label }}</span>
        <span class="track"><span class="fill" :style="{ width: width(p.value) }" /></span>
        <span class="value">{{ show(p.value) }}</span>
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.visual {
  margin: 0;
  padding: 0.875rem 1rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-canvas);
}

figcaption {
  margin-bottom: 0.75rem;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 600;
}

.bars {
  display: grid;
  gap: 0.375rem;
  height: 150px;
  align-items: stretch;
}

.col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  min-width: 0;
}

.top {
  height: 1rem;
  color: var(--color-ink-faint);
  font-size: 0.6875rem;
  white-space: nowrap;
}

.bar {
  width: 100%;
  max-width: 34px;
  min-height: 2px;
  border-radius: 3px 3px 0 0;
  background: var(--color-primary);
}

.label {
  max-width: 100%;
  overflow: hidden;
  color: var(--color-ink-faint);
  font-size: 0.6875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ranking li {
  display: grid;
  grid-template-columns: minmax(90px, 30%) 1fr auto;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-ink);
}

.track {
  height: 8px;
  border-radius: 4px;
  background: var(--color-border);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--color-primary);
}

.value {
  min-width: 5.5rem;
  color: var(--color-ink-soft);
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}
</style>
