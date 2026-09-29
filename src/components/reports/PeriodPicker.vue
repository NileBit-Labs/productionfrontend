<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { addDays, startOfMonth } from '@/lib/dates'
import type { DateRange } from '@/types/reports'

const props = defineProps<{ modelValue: DateRange; today: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: DateRange] }>()

const MAX_DAYS = 366

function lastMonth(today: string): DateRange {
  const thisMonth = startOfMonth(today)
  const end = addDays(thisMonth, -1)
  return { from: startOfMonth(end), to: end }
}

const presets = computed<{ key: string; label: string; range: DateRange }[]>(() => [
  { key: 'today', label: 'Today', range: { from: props.today, to: props.today } },
  {
    key: 'yesterday',
    label: 'Yesterday',
    range: { from: addDays(props.today, -1), to: addDays(props.today, -1) },
  },
  { key: '7', label: 'Last 7 days', range: { from: addDays(props.today, -6), to: props.today } },
  { key: '30', label: 'Last 30 days', range: { from: addDays(props.today, -29), to: props.today } },
  {
    key: 'month',
    label: 'This month',
    range: { from: startOfMonth(props.today), to: props.today },
  },
  { key: 'last', label: 'Last month', range: lastMonth(props.today) },
])

const active = computed(
  () =>
    presets.value.find(
      (p) => p.range.from === props.modelValue.from && p.range.to === props.modelValue.to,
    )?.key ?? 'custom',
)

const custom = ref({ from: props.modelValue.from, to: props.modelValue.to })
const showCustom = ref(false)

watch(
  () => props.modelValue,
  (v) => (custom.value = { from: v.from, to: v.to }),
)

const days = computed(() => {
  const a = new Date(`${custom.value.from}T00:00:00Z`).getTime()
  const b = new Date(`${custom.value.to}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000) + 1
})

const customProblem = computed(() => {
  if (!custom.value.from || !custom.value.to) return 'Choose both dates.'
  if (days.value < 1) return 'The start date must be on or before the end date.'
  if (days.value > MAX_DAYS) return 'Choose a period of at most a year.'
  return ''
})

function pick(range: DateRange) {
  showCustom.value = false
  emit('update:modelValue', { from: range.from, to: range.to })
}

function applyCustom() {
  if (customProblem.value) return
  emit('update:modelValue', { from: custom.value.from, to: custom.value.to })
}
</script>

<template>
  <div class="picker">
    <div class="chips" role="group" aria-label="Period">
      <button
        v-for="p in presets"
        :key="p.key"
        type="button"
        class="chip"
        :class="{ on: active === p.key && !showCustom }"
        @click="pick(p.range)"
      >
        {{ p.label }}
      </button>
      <button
        type="button"
        class="chip"
        :class="{ on: showCustom || active === 'custom' }"
        @click="showCustom = !showCustom"
      >
        Custom
      </button>
    </div>

    <form v-if="showCustom || active === 'custom'" class="custom" @submit.prevent="applyCustom">
      <div class="field">
        <label for="rp-from">From</label>
        <input id="rp-from" v-model="custom.from" type="date" :max="today" />
      </div>
      <div class="field">
        <label for="rp-to">To</label>
        <input id="rp-to" v-model="custom.to" type="date" :max="today" />
      </div>
      <button type="submit" class="apply" :disabled="!!customProblem">Apply</button>
      <p v-if="customProblem" class="problem">{{ customProblem }}</p>
    </form>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip {
  padding: 0.4375rem 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition:
    background-color 0.12s,
    border-color 0.12s;
}

.chip:hover {
  border-color: var(--color-primary);
}

.chip.on {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.custom {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
}

.custom .field {
  min-width: 150px;
}

.apply {
  padding: 0.625rem 1rem;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.apply:disabled {
  opacity: 0.5;
  cursor: default;
}

.problem {
  flex-basis: 100%;
  color: var(--color-danger);
  font-size: 0.8125rem;
}
</style>
