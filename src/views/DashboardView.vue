<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BarChart, { type BarPoint } from '@/components/reports/BarChart.vue'
import DonutChart, { type Slice } from '@/components/reports/DonutChart.vue'
import StatTile from '@/components/reports/StatTile.vue'
import { apiErrorMessage, apiFetch, isNetworkFailure } from '@/lib/api'
import { METHOD_COLORS, METHOD_LABELS, percentChange } from '@/lib/chart'
import { shortDay, weekdayShort } from '@/lib/dates'
import { formatDateTime, formatQuantity, formatUgx } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useShopStore } from '@/stores/shop'
import type { Dashboard, DashboardOwnerManager } from '@/types/reports'

const auth = useAuthStore()
const shopStore = useShopStore()

const data = ref<Dashboard | null>(null)
const error = ref('')
const offline = ref(false)
const loading = ref(false)
const updatedAt = ref<Date | null>(null)

const firstName = computed(() => auth.user?.name?.split(' ')[0] ?? '')
const isOwnerManager = computed(() => data.value !== null && data.value.role !== 'cashier')
const full = computed(() => (isOwnerManager.value ? (data.value as DashboardOwnerManager) : null))

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await apiFetch<Dashboard>('/reports/dashboard')
    offline.value = false
    updatedAt.value = new Date()
  } catch (e) {
    offline.value = isNetworkFailure(e)
    error.value = offline.value
      ? "Can't reach the server, so these figures can't be refreshed. Selling still works and syncs later."
      : apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

// Coming back to the tab (or the till) shows fresh figures without a reload.
function onVisible() {
  if (document.visibilityState === 'visible') void load()
}

onMounted(() => {
  void load()
  document.addEventListener('visibilitychange', onVisible)
})
onUnmounted(() => document.removeEventListener('visibilitychange', onVisible))

const longDate = computed(() =>
  data.value
    ? new Date(`${data.value.date}T00:00:00Z`).toLocaleDateString('en-UG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : new Date().toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'long' }),
)

const vsYesterday = computed(() => {
  const d = full.value
  if (!d) return null
  const change = percentChange(d.today.net_sales, d.yesterday_net_sales)
  if (change === null) return { text: 'No sales yesterday to compare', trend: null }
  if (change === 0) return { text: 'Same as yesterday', trend: null }
  return {
    text: `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}% vs yesterday`,
    trend: change > 0 ? ('up' as const) : ('down' as const),
  }
})

const weekChange = computed(() => {
  const d = full.value
  if (!d) return null
  const change = percentChange(d.week.net_sales, d.week.previous_net_sales)
  if (change === null) return null
  return {
    text: `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs the 7 days before`,
    up: change >= 0,
  }
})

const moneyReceived = computed(
  () => full.value?.payment_methods.reduce((sum, m) => sum + m.amount, 0) ?? 0,
)

const points = computed<BarPoint[]>(() =>
  (full.value?.series ?? []).map((s) => ({
    label: weekdayShort(s.date),
    value: s.net_sales,
    tip: `${shortDay(s.date)} — ${formatUgx(s.net_sales)} · ${s.sales_count} sale${s.sales_count === 1 ? '' : 's'}`,
  })),
)

const slices = computed<Slice[]>(() =>
  (full.value?.payment_methods ?? []).map((m) => ({
    label: METHOD_LABELS[m.method] ?? m.method,
    value: m.amount,
    color: METHOD_COLORS[m.method] ?? 'var(--chart-4)',
  })),
)

const topMax = computed(() =>
  Math.max(1, ...(full.value?.top_products.map((p) => p.revenue) ?? [1])),
)
const brandNew = computed(() => data.value !== null && data.value.recent_sales.length === 0)

function shown(iso: string): string {
  return formatDateTime(iso)
}
</script>

<template>
  <main class="dashboard">
    <div class="dashboard-header">
      <div>
        <p class="eyebrow">{{ shopStore.currentShop?.name }} · {{ longDate }}</p>
        <h1>Welcome back, {{ firstName }}</h1>
      </div>
      <button type="button" class="refresh" :disabled="loading" @click="load">
        {{ loading ? 'Refreshing…' : 'Refresh' }}
        <span v-if="updatedAt && !loading" class="stamp">
          · {{ updatedAt.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }) }}
        </span>
      </button>
    </div>

    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
    <p v-if="!data && loading" class="state">Loading today's figures…</p>

    <!-- Cashier: only what they rang up themselves -->
    <template v-if="data && data.role === 'cashier'">
      <section class="stat-grid three">
        <StatTile label="Your sales today" :value="String(data.today.sales_count)" icon="sell" />
        <StatTile label="Rung up today" :value="formatUgx(data.today.total)" icon="sales" />
        <StatTile label="Average sale" :value="formatUgx(data.today.average_sale)" icon="reports" />
      </section>

      <section class="card panel">
        <div class="panel-head">
          <h2>Your recent sales</h2>
          <RouterLink to="/pos" class="btn btn-primary small">Start selling</RouterLink>
        </div>
        <p v-if="!data.recent_sales.length" class="empty-note">
          Nothing rung up yet. Your sales will list here as you make them.
        </p>
        <ul v-else class="recent">
          <li v-for="s in data.recent_sales" :key="s.id">
            <RouterLink :to="`/sales/${s.id}`" class="link">{{ s.sale_number }}</RouterLink>
            <span class="muted">{{ shown(s.created_at) }}</span>
            <span class="who">
              {{ s.customer ?? 'Walk-in' }}
              <span v-if="s.status === 'voided'" class="pill">Voided</span>
            </span>
            <span class="amount" :class="{ struck: s.status === 'voided' }">{{
              formatUgx(s.total)
            }}</span>
          </li>
        </ul>
      </section>
    </template>

    <!-- Owner and manager -->
    <template v-else-if="full">
      <section class="stat-grid">
        <StatTile
          label="Today's sales"
          :value="formatUgx(full.today.net_sales)"
          :hint="vsYesterday?.text"
          :trend="vsYesterday?.trend"
          icon="sell"
        />
        <StatTile
          label="Sales made"
          :value="String(full.today.sales_count)"
          :hint="
            full.today.sales_count
              ? `Average ${formatUgx(full.today.average_sale)}`
              : 'None yet today'
          "
          icon="sales"
        />
        <StatTile
          v-if="full.role === 'owner'"
          label="Gross profit"
          :value="formatUgx(full.today.gross_profit ?? 0)"
          hint="Sales less the cost of what was sold"
          icon="reports"
        />
        <StatTile
          v-else
          label="Money received"
          :value="formatUgx(moneyReceived)"
          hint="Cash, mobile money and card"
          icon="credit"
        />
        <StatTile
          label="Expenses"
          :value="formatUgx(full.today.expenses)"
          :hint="
            full.today.refunds
              ? `${formatUgx(full.today.refunds)} refunded today`
              : 'Recorded today'
          "
          icon="expenses"
        />
      </section>

      <section class="chart-row">
        <div class="card panel">
          <div class="panel-head">
            <h2>Sales, last 7 days</h2>
            <span class="panel-meta">
              {{ formatUgx(full.week.net_sales) }}
              <template v-if="weekChange">
                ·
                <span :class="weekChange.up ? 'up' : 'down'">{{ weekChange.text }}</span>
              </template>
            </span>
          </div>
          <BarChart :points="points" empty-text="No sales in the last 7 days yet." />
        </div>

        <div class="card panel">
          <div class="panel-head">
            <h2>Money received</h2>
            <span class="panel-meta">Today</span>
          </div>
          <DonutChart
            :slices="slices"
            center-label="Received today"
            empty-text="No money received yet"
          />
        </div>
      </section>

      <section class="lower-row">
        <div class="card panel">
          <div class="panel-head">
            <h2>Top products</h2>
            <span class="panel-meta">Last 7 days</span>
          </div>
          <p v-if="!full.top_products.length" class="empty-note">
            Nothing sold yet — your best sellers will rank here.
          </p>
          <ul v-else class="top">
            <li v-for="p in full.top_products" :key="p.product_id">
              <div class="top-line">
                <span class="top-name">{{ p.name }}</span>
                <span class="amount">{{ formatUgx(p.revenue) }}</span>
              </div>
              <span class="track">
                <span class="fill" :style="{ width: (p.revenue / topMax) * 100 + '%' }" />
              </span>
              <span class="muted">{{ formatQuantity(p.quantity) }} sold</span>
            </li>
          </ul>
        </div>

        <div class="card panel">
          <div class="panel-head">
            <h2>Stock alerts</h2>
            <RouterLink to="/reports?tab=stock" class="link small">View</RouterLink>
          </div>
          <div class="alerts">
            <div class="alert-box" :class="{ bad: full.stock.out > 0 }">
              <span class="big">{{ full.stock.out }}</span>
              <span class="muted">out of stock</span>
            </div>
            <div class="alert-box" :class="{ warn: full.stock.low > 0 }">
              <span class="big">{{ full.stock.low }}</span>
              <span class="muted">running low</span>
            </div>
          </div>
          <p v-if="!full.stock.attention.length" class="muted note">
            All {{ full.stock.products }} products are comfortably stocked.
          </p>
          <ul v-else class="mini">
            <li v-for="p in full.stock.attention" :key="p.id">
              <span class="mini-name">{{ p.name }}</span>
              <span class="tag" :class="p.status">
                {{ p.status === 'out' ? 'Out' : `${formatQuantity(p.stock)} left` }}
              </span>
            </li>
          </ul>
        </div>

        <div class="card panel">
          <div class="panel-head">
            <h2>Customer debt</h2>
            <RouterLink to="/credit" class="link small">View</RouterLink>
          </div>
          <p class="big-money">{{ formatUgx(full.debt.total_owed) }}</p>
          <p class="muted">
            owed by {{ full.debt.customers_owing }}
            {{ full.debt.customers_owing === 1 ? 'customer' : 'customers' }}
          </p>
          <p v-if="full.debt.overdue" class="overdue">
            {{ formatUgx(full.debt.overdue) }} is past its due date
          </p>
          <ul v-if="full.debt.top.length" class="mini">
            <li v-for="c in full.debt.top" :key="c.id">
              <RouterLink :to="`/customers/${c.id}`" class="mini-name link">{{
                c.name
              }}</RouterLink>
              <span class="amount">{{ formatUgx(c.balance) }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section class="card panel">
        <div class="panel-head">
          <h2>Recent sales</h2>
          <RouterLink to="/sales" class="link small">All sales</RouterLink>
        </div>
        <div v-if="brandNew" class="empty-note">
          <p>No sales yet. Once you make your first sale it shows up here.</p>
          <RouterLink to="/pos" class="btn btn-primary small">Make your first sale</RouterLink>
        </div>
        <ul v-else class="recent">
          <li v-for="s in full.recent_sales" :key="s.id">
            <RouterLink :to="`/sales/${s.id}`" class="link">{{ s.sale_number }}</RouterLink>
            <span class="muted">{{ shown(s.created_at) }}</span>
            <span class="who">
              {{ s.customer ?? 'Walk-in' }}
              <span class="muted">· {{ s.cashier }}</span>
              <span v-if="s.status === 'voided'" class="pill">Voided</span>
            </span>
            <span class="amount" :class="{ struck: s.status === 'voided' }">{{
              formatUgx(s.total)
            }}</span>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.dashboard {
  flex: 1;
  padding: 2rem 2rem 3rem;
  max-width: 1680px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dashboard-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-primary);
}

h1 {
  margin-top: 0.25rem;
  font-size: 1.5rem;
}

.refresh {
  padding: 0.4375rem 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.refresh:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-ink);
}

.stamp {
  color: var(--color-ink-faint);
}

.state {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-ink-faint);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
}

.stat-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.chart-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1.25rem;
}

.lower-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
}

.panel {
  padding: 1.5rem;
  min-width: 0;
}

.panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  margin-bottom: 1.25rem;
}

.panel-head h2 {
  font-size: 0.9375rem;
}

.panel-meta,
.muted {
  font-size: 0.75rem;
  color: var(--color-ink-faint);
}

.small {
  font-size: 0.8125rem;
}

.btn.small {
  padding: 0.4375rem 0.875rem;
  text-decoration: none;
}

.up {
  color: var(--color-primary);
}

.down {
  color: var(--color-danger);
}

.empty-note {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  color: var(--color-ink-faint);
  font-size: 0.875rem;
}

.top {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.top li {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.top-line {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.top-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.amount.struck {
  text-decoration: line-through;
  color: var(--color-ink-faint);
}

.track {
  height: 6px;
  border-radius: 3px;
  background: var(--color-border);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--chart-1);
}

.alerts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.alert-box {
  display: flex;
  flex-direction: column;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.alert-box.bad {
  border-color: transparent;
  background: var(--color-danger-soft);
}

.alert-box.bad .big {
  color: var(--color-danger);
}

.alert-box.warn {
  border-color: transparent;
  background: rgba(217, 119, 6, 0.12);
}

.alert-box.warn .big {
  color: var(--chart-2);
}

.big {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.1;
}

.note {
  margin-top: 0.875rem;
}

.mini {
  list-style: none;
  padding: 0;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
}

.mini li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-top: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.mini-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  flex-shrink: 0;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  background: rgba(217, 119, 6, 0.12);
  color: var(--chart-2);
}

.tag.out {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.big-money {
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

.overdue {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.8125rem;
  font-weight: 500;
}

.recent {
  list-style: none;
  padding: 0;
}

.recent li {
  display: grid;
  grid-template-columns: 7rem 10rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.recent li:first-child {
  border-top: none;
  padding-top: 0;
}

.who {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill {
  margin-left: 0.5rem;
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.6875rem;
  font-weight: 600;
}

@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chart-row,
  .lower-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .dashboard {
    padding: 1.25rem 1rem 2rem;
  }

  .stat-grid,
  .stat-grid.three {
    grid-template-columns: minmax(0, 1fr);
  }

  .recent li {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.125rem;
  }

  .recent li .muted {
    grid-column: 1;
  }

  .recent li .who {
    grid-column: 1;
  }

  .recent li .amount {
    grid-column: 2;
    grid-row: 1 / span 3;
  }
}
</style>
