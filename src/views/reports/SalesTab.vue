<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BarChart, { type BarPoint } from '@/components/reports/BarChart.vue'
import DonutChart, { type Slice } from '@/components/reports/DonutChart.vue'
import PeriodPicker from '@/components/reports/PeriodPicker.vue'
import StatTile from '@/components/reports/StatTile.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { METHOD_COLORS, METHOD_LABELS } from '@/lib/chart'
import { dayMonth, longDay, shortDay, weekdayShort } from '@/lib/dates'
import { formatQuantity, formatUgx } from '@/lib/format'
import type { DateRange, SalesReport } from '@/types/reports'

const props = defineProps<{ today: string; modelValue: DateRange }>()
const emit = defineEmits<{ 'update:modelValue': [value: DateRange] }>()
const range = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const report = ref<SalesReport | null>(null)
const loading = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ from: range.value.from, to: range.value.to })
    report.value = await apiFetch<SalesReport>(`/reports/sales?${params}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

watch(range, load, { immediate: true })

const s = computed(() => report.value?.summary)
const label = (date: string) =>
  (report.value?.daily.length ?? 0) <= 7 ? weekdayShort(date) : dayMonth(date)

const points = computed<BarPoint[]>(() =>
  (report.value?.daily ?? []).map((d) => ({
    label: label(d.date),
    value: d.net_sales,
    tip: `${shortDay(d.date)} — ${formatUgx(d.net_sales)} · ${d.sales_count} sale${d.sales_count === 1 ? '' : 's'}`,
  })),
)

const slices = computed<Slice[]>(() =>
  (report.value?.payment_methods ?? []).map((m) => ({
    label: METHOD_LABELS[m.method] ?? m.method,
    value: m.amount,
    color: METHOD_COLORS[m.method] ?? 'var(--chart-4)',
  })),
)

const topMax = computed(() => Math.max(1, ...(report.value?.products.map((p) => p.revenue) ?? [1])))

const period = computed(() =>
  range.value.from === range.value.to
    ? longDay(range.value.from)
    : `${longDay(range.value.from)} – ${longDay(range.value.to)}`,
)
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
          :hint="
            s.refunds
              ? `${formatUgx(s.gross_sales)} sold, ${formatUgx(s.refunds)} refunded`
              : `${formatUgx(s.gross_sales)} sold`
          "
          icon="sell"
        />
        <StatTile
          label="Sales made"
          :value="String(s.sales_count)"
          :hint="s.sales_count ? `Average ${formatUgx(s.average_sale)}` : 'No sales in this period'"
          icon="sales"
        />
        <StatTile
          label="Discounts given"
          :value="formatUgx(s.discounts)"
          hint="Already taken off the sales above"
          icon="credit"
        />
        <StatTile
          label="Sold on credit"
          :value="formatUgx(s.credit_given)"
          hint="Not paid at the till"
          icon="customers"
        />
      </section>

      <section class="card rp-panel">
        <div class="rp-panel-head">
          <h2>Net sales by day</h2>
          <span class="rp-meta">{{ period }}</span>
        </div>
        <BarChart :points="points" empty-text="No sales in this period." />
      </section>

      <section class="rp-cols">
        <div class="card rp-panel">
          <div class="rp-panel-head">
            <h2>Money received</h2>
            <span class="rp-meta">By how it was paid</span>
          </div>
          <DonutChart :slices="slices" center-label="Received" empty-text="No money received" />
        </div>

        <div class="card rp-panel">
          <div class="rp-panel-head">
            <h2>Who rang up the sales</h2>
            <span class="rp-meta">Before refunds</span>
          </div>
          <p v-if="!report.cashiers.length" class="rp-empty">No sales in this period.</p>
          <div v-else class="rp-scroll">
            <table class="rp-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th class="num">Sales</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in report.cashiers" :key="c.user_id">
                  <td>{{ c.name }}</td>
                  <td class="num">{{ c.sales_count }}</td>
                  <td class="num strong">{{ formatUgx(c.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="card rp-panel">
        <div class="rp-panel-head">
          <h2>Best sellers</h2>
          <span class="rp-meta">By revenue, after discounts and refunds</span>
        </div>
        <p v-if="!report.products.length" class="rp-empty">Nothing sold in this period.</p>
        <ul v-else class="rp-bars wide">
          <li v-for="p in report.products" :key="p.product_id">
            <span class="label" :title="p.name">{{ p.name }}</span>
            <span class="track"
              ><span class="fill" :style="{ width: Math.max(0, (p.revenue / topMax) * 100) + '%' }"
            /></span>
            <span class="amount">
              {{ formatUgx(p.revenue) }}
              <span class="rp-meta"> · {{ formatQuantity(p.quantity) }}</span>
            </span>
          </li>
        </ul>
      </section>

      <section class="card rp-panel">
        <div class="rp-panel-head">
          <h2>Day by day</h2>
          <span class="rp-meta">Use Export above to download this data.</span>
        </div>
        <div class="rp-scroll">
          <table class="rp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th class="num">Sales</th>
                <th class="num">Sold</th>
                <th class="num">Refunded</th>
                <th class="num">Net</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in [...report.daily].reverse()" :key="d.date">
                <td>{{ shortDay(d.date) }}</td>
                <td class="num">{{ d.sales_count }}</td>
                <td class="num">{{ formatUgx(d.gross_sales) }}</td>
                <td class="num">{{ d.refunds ? formatUgx(d.refunds) : '—' }}</td>
                <td class="num strong" :class="{ neg: d.net_sales < 0 }">
                  {{ formatUgx(d.net_sales) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p class="rp-note">
        <b>How this is worked out.</b> Each sale counts on the day it was made, in the shop's own
        timezone. A refund counts on the day it was given, so a day you have already closed never
        changes afterwards.
        <template v-if="s.voided_count">
          {{ s.voided_count }} voided sale{{ s.voided_count === 1 ? '' : 's' }} ({{
            formatUgx(s.voided_value)
          }}) {{ s.voided_count === 1 ? 'is' : 'are' }} left out of every figure.
        </template>
        <template v-else>Voided sales are left out of every figure.</template>
      </p>
    </template>
  </div>
</template>

<style scoped>
.dim {
  opacity: 0.6;
}
</style>
