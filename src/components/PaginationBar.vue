<script setup lang="ts">
import { computed } from 'vue'
import { PAGE_SIZES } from '@/lib/paging'

const props = defineProps<{
  page: number
  lastPage: number
  total: number
  perPage: number
  noun?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:page': [page: number]; 'update:perPage': [size: number] }>()

const from = computed(() => (props.total ? (props.page - 1) * props.perPage + 1 : 0))
const to = computed(() => Math.min(props.page * props.perPage, props.total))
const sizes = computed(() =>
  PAGE_SIZES.includes(props.perPage)
    ? PAGE_SIZES
    : [...PAGE_SIZES, props.perPage].sort((a, b) => a - b),
)

// 1 … 4 5 6 … 20: the first and last page, and the ones around where you are.
const numbers = computed<(number | '…')[]>(() => {
  const last = props.lastPage
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const wanted = new Set([1, last, props.page - 1, props.page, props.page + 1])
  if (props.page <= 3) [2, 3, 4].forEach((n) => wanted.add(n))
  if (props.page >= last - 2) [last - 1, last - 2, last - 3].forEach((n) => wanted.add(n))
  const sorted = [...wanted].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push('…')
    out.push(n)
  })
  return out
})

const go = (n: number) => {
  if (!props.disabled && n >= 1 && n <= props.lastPage && n !== props.page) emit('update:page', n)
}
</script>

<template>
  <div v-if="total > 0" class="pager">
    <p class="range">
      Showing <strong>{{ from }}–{{ to }}</strong> of <strong>{{ total }}</strong>
      {{ noun ?? 'results' }}
    </p>

    <div class="controls">
      <label class="size">
        <span>Rows per page</span>
        <select
          :value="perPage"
          :disabled="disabled"
          @change="emit('update:perPage', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="n in sizes" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>

      <nav class="pages" aria-label="Pagination">
        <button
          type="button"
          :disabled="disabled || page <= 1"
          aria-label="Previous page"
          @click="go(page - 1)"
        >
          ‹
        </button>
        <template v-for="(n, i) in numbers" :key="i">
          <span v-if="n === '…'" class="gap">…</span>
          <button
            v-else
            type="button"
            :class="{ active: n === page }"
            :aria-current="n === page ? 'page' : undefined"
            :disabled="disabled"
            @click="go(n)"
          >
            {{ n }}
          </button>
        </template>
        <button
          type="button"
          :disabled="disabled || page >= lastPage"
          aria-label="Next page"
          @click="go(page + 1)"
        >
          ›
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--color-border);
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.range strong {
  color: var(--color-ink);
  font-weight: 600;
}

.controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
}

.size {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.size select {
  min-height: 34px;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.875rem;
}

.pages {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.pages button {
  min-width: 34px;
  min-height: 34px;
  padding: 0 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.pages button:hover:not(:disabled):not(.active) {
  background: var(--color-canvas);
  color: var(--color-ink);
}

.pages button.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 600;
}

.pages button:disabled:not(.active) {
  opacity: 0.4;
  cursor: default;
}

.gap {
  min-width: 24px;
  text-align: center;
  color: var(--color-ink-faint);
}

@media (max-width: 640px) {
  .pager {
    justify-content: center;
    text-align: center;
  }
}
</style>
