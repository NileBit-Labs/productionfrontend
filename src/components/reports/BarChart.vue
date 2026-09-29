<script setup lang="ts">
import { computed } from 'vue'
import '@/assets/charts.css'
import { compactUgx, niceScale } from '@/lib/chart'

export interface BarPoint {
  label: string
  value: number
  /** Shown on hover, e.g. "Wed 10 Sep — UGX 45,000". */
  tip: string
}

const props = withDefaults(
  defineProps<{
    points: BarPoint[]
    height?: number
    format?: (n: number) => string
    emptyText?: string
  }>(),
  { height: 240, format: compactUgx, emptyText: 'Nothing to show for this period.' },
)

const scale = computed(() => {
  const values = props.points.map((p) => p.value)
  const { bottom, top, step } = niceScale(Math.min(0, ...values), Math.max(0, ...values))
  return { top, bottom, step, span: top - bottom }
})

const hasData = computed(() => props.points.some((p) => p.value !== 0))

const ticks = computed(() => {
  const { bottom, step, span } = scale.value
  const count = Math.round(span / step)
  return Array.from({ length: count + 1 }, (_, i) => ({
    value: bottom + step * i,
    pct: (i / count) * 100,
  }))
})

const zeroPct = computed(() => (-scale.value.bottom / scale.value.span) * 100)

function barStyle(value: number) {
  const { span } = scale.value
  // A day with nothing is a thin mark on the zero line, not an invisible bar.
  if (value === 0) return { bottom: `calc(${zeroPct.value}% - 1px)`, height: '2px' }
  const size = (Math.abs(value) / span) * 100
  return value >= 0
    ? { bottom: `${zeroPct.value}%`, height: `${size}%` }
    : { bottom: `${zeroPct.value - size}%`, height: `${size}%` }
}

// Never more than about eight labels, however many bars there are.
const labelEvery = computed(() => Math.max(1, Math.ceil(props.points.length / 8)))
</script>

<template>
  <div class="chart" :style="{ '--h': `${height}px` }">
    <div class="y">
      <span v-for="t in ticks" :key="t.pct" :style="{ bottom: `${t.pct}%` }">
        {{ format(t.value) }}
      </span>
    </div>

    <div class="plot">
      <span v-for="t in ticks" :key="t.pct" class="grid" :style="{ bottom: `${t.pct}%` }" />
      <span v-if="scale.bottom < 0" class="zero" :style="{ bottom: `${zeroPct}%` }" />

      <div class="bars">
        <div
          v-for="(p, i) in points"
          :key="i"
          class="col"
          tabindex="0"
          role="img"
          :aria-label="p.tip"
        >
          <span
            class="bar"
            :class="{ neg: p.value < 0, blank: p.value === 0 }"
            :style="barStyle(p.value)"
          />
          <span class="tip" :class="{ end: i > points.length - 4 }">{{ p.tip }}</span>
        </div>
      </div>

      <p v-if="!hasData" class="empty">{{ emptyText }}</p>
    </div>

    <div class="x">
      <span v-for="(p, i) in points" :key="i" class="xl">
        <template v-if="i % labelEvery === 0">{{ p.label }}</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.chart {
  display: grid;
  grid-template-columns: 3rem 1fr;
  grid-template-rows: var(--h) 1.75rem;
  column-gap: 0.5rem;
}

.y {
  position: relative;
  grid-row: 1;
}

.y span {
  position: absolute;
  right: 0;
  transform: translateY(50%);
  font-size: 0.6875rem;
  color: var(--color-ink-faint);
  font-variant-numeric: tabular-nums;
}

.plot {
  position: relative;
  grid-row: 1;
  grid-column: 2;
}

.grid {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--color-border);
}

.zero {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid var(--color-border-strong);
}

.bars {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 0.25rem;
}

.col {
  position: relative;
  flex: 1;
  min-width: 0;
  outline: none;
}

.bar {
  position: absolute;
  left: 12%;
  right: 12%;
  max-width: 44px;
  margin: 0 auto;
  border-radius: 3px 3px 0 0;
  background: var(--chart-1);
  transition: filter 0.12s;
}

.bar.neg {
  background: var(--chart-negative);
  border-radius: 0 0 3px 3px;
}

.bar.blank {
  background: var(--color-border-strong);
  border-radius: 1px;
}

.col:hover .bar,
.col:focus-visible .bar {
  filter: brightness(1.15);
}

.col::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 4px;
}

.col:hover::before,
.col:focus-visible::before {
  background: var(--color-primary-soft);
}

.tip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  z-index: 5;
  transform: translateX(-50%);
  padding: 0.375rem 0.625rem;
  border-radius: var(--radius-sm);
  background: var(--color-ink);
  color: var(--color-canvas);
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.1s;
}

.tip.end {
  left: auto;
  right: 0;
  transform: none;
}

.col:hover .tip,
.col:focus-visible .tip {
  opacity: 1;
}

.empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--color-ink-faint);
  font-size: 0.875rem;
  pointer-events: none;
}

.x {
  grid-row: 2;
  grid-column: 2;
  display: flex;
  gap: 0.25rem;
  padding-top: 0.5rem;
}

.xl {
  flex: 1;
  min-width: 0;
  overflow: visible;
  white-space: nowrap;
  text-align: center;
  font-size: 0.6875rem;
  color: var(--color-ink-faint);
}
</style>
