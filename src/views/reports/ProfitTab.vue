<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BarChart, { type BarPoint } from '@/components/reports/BarChart.vue'
import PeriodPicker from '@/components/reports/PeriodPicker.vue'
import StatTile from '@/components/reports/StatTile.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { dayMonth, longDay, shortDay, weekdayShort } from '@/lib/dates'
import { formatQuantity, formatUgx } from '@/lib/format'
import type { DateRange, ProfitReport } from '@/types/reports'

const props = defineProps<{ today: string; modelValue: DateRange }>()
const emit = defineEmits<{ 'update:modelValue': [value: DateRange] }>()
const range = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const report = ref<ProfitReport | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ from: range.value.from, to: range.value.to })
    report.value = await apiFetch<ProfitReport>(`/reports/profit?${params}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

watch(range, load, { immediate: true })

const s = computed(() => report.value?.summary)

const points = computed<BarPoint[]>(() => {
  const days = report.value?.daily ?? []
  return days.map((d) => ({
    label: days.length <= 7 ? weekdayShort(d.date) : dayMonth(d.date),
    value: d.gross_profit,
    tip: `${shortDay(d.date)} — ${formatUgx(d.gross_profit)} profit on ${formatUgx(d.net_sales)} sales`,
  }))
})

const expenseMax = computed(() =>
  Math.max(1, ...(report.value?.expenses.map((e) => e.amount) ?? [1])),
)

const period = computed(() =>
  range.value.from === range.value.to
    ? longDay(range.value.from)
    : `${longDay(range.value.from)} – ${longDay(range.value.to)}`,
)

const pct = (v: number | null) => (v === null ? '—' : `${v}%`)
</script>

<template>
  <div class="rp">
    <PeriodPicker v-model="range" :today="today" />

    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
    <p v-if="!report && loading" class="rp-empty">Working out the figures…</p>

    <template v-if="report && s">
      <section class="rp-tiles" :class="{ dim: loading }">
        <StatTile
          label="Net sales"
          :value="formatUgx(s.net_sales)"
          hint="After refunds"
          icon="sell"
        />
        <StatTile
          label="Cost of goods"
          :value="formatUgx(s.cost_of_goods)"
          hint="What the goods sold cost you"
          icon="products"
        />
        <StatTile
          label="Gross profit"
          :value="formatUgx(s.gross_profit)"
          :hint="s.margin === null ? 'No sales to compare' : `${s.margin}% of sales`"
          :trend="s.gross_profit > 0 ? 'up' : s.gross_profit < 0 ? 'down' : null"
          icon="reports"
        />
        <StatTile
          label="Profit after expenses"
          :value="formatUgx(s.operating_profit)"
          :hint="`${formatUgx(s.expenses)} of expenses`"
          :trend="s.operating_profit > 0 ? 'up' : s.operating_profit < 0 ? 'down' : null"
          icon="expenses"
        />
      </section>

      <section class="card rp-panel">
        <div class="rp-panel-head">
          <h2>Gross profit by day</h2>
          <span class="rp-meta">{{ period }}</span>
        </div>
        <BarChart :points="points" empty-text="No sales in this period." />
      </section>

      <section class="rp-cols">
        <div class="card rp-panel">
          <div class="rp-panel-head">
            <h2>Expenses</h2>
            <span class="rp-meta">{{ formatUgx(s.expenses) }} in total</span>
          </div>
          <p v-if="!report.expenses.length" class="rp-empty">
            No expenses recorded in this period.
          </p>
          <ul v-else class="rp-bars">
            <li v-for="e in report.expenses" :key="e.category">
              <span class="label">{{ e.category }}</span>
              <span class="track"
                ><span class="fill" :style="{ width: (e.amount / expenseMax) * 100 + '%' }"
              /></span>
              <span class="amount">{{ formatUgx(e.amount) }}</span>
            </li>
          </ul>
        </div>

        <div class="card rp-panel">
          <div class="rp-panel-head"><h2>The sum</h2></div>
          <table class="rp-table">
            <tbody>
              <tr>
                <td>Net sales</td>
                <td class="num">{{ formatUgx(s.net_sales) }}</td>
              </tr>
              <tr>
                <td>− Cost of goods sold</td>
                <td class="num">{{ formatUgx(s.cost_of_goods) }}</td>
              </tr>
              <tr>
                <td class="strong">Gross profit</td>
                <td class="num strong" :class="{ neg: s.gross_profit < 0 }">
                  {{ formatUgx(s.gross_profit) }}
                </td>
              </tr>
              <tr>
                <td>− Expenses</td>
                <td class="num">{{ formatUgx(s.expenses) }}</td>
              </tr>
              <tr>
                <td class="strong">Profit after expenses</td>
                <td class="num strong" :class="{ neg: s.operating_profit < 0 }">
                  {{ formatUgx(s.operating_profit) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card rp-panel">
        <div class="rp-panel-head">
          <h2>Profit by product</h2>
          <span class="rp-meta">Use Export above to download this data.</span>
        </div>
        <p v-if="!report.products.length" class="rp-empty">Nothing sold in this period.</p>
        <div v-else class="rp-scroll">
          <table class="rp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th class="num">Sold</th>
                <th class="num">Revenue</th>
                <th class="num">Cost</th>
                <th class="num">Profit</th>
                <th class="num">Margin</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in report.products" :key="p.product_id">
                <td class="clip">{{ p.name }}</td>
                <td class="num">{{ formatQuantity(p.quantity) }}</td>
                <td class="num">{{ formatUgx(p.revenue) }}</td>
                <td class="num">{{ formatUgx(p.cost) }}</td>
                <td class="num strong" :class="{ neg: p.profit < 0 }">{{ formatUgx(p.profit) }}</td>
                <td class="num" :class="{ neg: (p.margin ?? 0) < 0 }">{{ pct(p.margin) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="rp-note">
        <b>How this is worked out.</b> Cost uses what each item cost when it was sold, so changing a
        cost price later never rewrites past profit. Goods that come back and go on the shelf give
        their cost back; damaged returns don't, so they show as a real loss. Expenses count on the
        date written on the expense. Showing the 50 most profitable products.
      </p>
    </template>
  </div>
</template>

<style scoped>
.dim {
  opacity: 0.6;
}
</style>
