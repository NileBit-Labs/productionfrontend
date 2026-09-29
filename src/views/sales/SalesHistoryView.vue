<script setup lang="ts">
import PaginationBar from '@/components/PaginationBar.vue'
import ResponsiveDataView from '@/components/ResponsiveDataView.vue'
import { usePerPage } from '@/lib/paging'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime, formatUgx } from '@/lib/format'
import { paymentLabel, type Paginated, type Sale } from '@/types/sales'

const sales = ref<Sale[]>([])
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const perPage = usePerPage('sales')
const loading = ref(false)
const error = ref('')

const status = ref('')
const from = ref('')
const to = ref('')

async function load(target = 1) {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: String(target), per_page: String(perPage.value) })
    if (status.value) params.set('status', status.value)
    if (from.value) params.set('from', from.value)
    if (to.value) params.set('to', to.value)

    const result = await apiFetch<Paginated<Sale>>(`/sales?${params}`)
    sales.value = result.data
    page.value = result.current_page
    lastPage.value = result.last_page
    total.value = result.total
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function methods(sale: Sale) {
  const used = new Set(
    (sale.payments ?? []).filter((p) => p.direction === 'in').map((p) => paymentLabel(p.method)),
  )
  return [...used].join(', ') || '—'
}

onMounted(() => load())
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Sales</p>
        <h1>Sales history</h1>
      </div>
      <RouterLink class="btn btn-primary" to="/pos">New sale</RouterLink>
    </header>

    <form class="filters card" @submit.prevent="load(1)">
      <div class="field">
        <label for="status">Status</label>
        <select id="status" v-model="status" @change="load(1)">
          <option value="">All</option>
          <option value="completed">Completed</option>
          <option value="voided">Voided</option>
        </select>
      </div>
      <div class="field">
        <label for="from">From</label>
        <input id="from" v-model="from" type="date" @change="load(1)" />
      </div>
      <div class="field">
        <label for="to">To</label>
        <input id="to" v-model="to" type="date" @change="load(1)" />
      </div>
    </form>

    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div class="card table-card">
      <p v-if="loading && !sales.length" class="state">Loading sales…</p>
      <p v-else-if="!sales.length" class="state">No sales found.</p>

      <ResponsiveDataView v-else>
        <template #table>
          <div class="table-scroll">
            <table>
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Date</th>
              <th>Served by</th>
              <th class="num">Items</th>
              <th>Paid with</th>
              <th class="num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sale in sales" :key="sale.id">
              <td>
                <RouterLink class="link" :to="`/sales/${sale.id}`">{{
                  sale.sale_number
                }}</RouterLink>
              </td>
              <td>{{ formatDateTime(sale.created_at) }}</td>
              <td>{{ sale.cashier?.name }}</td>
              <td class="num">{{ sale.items_count }}</td>
              <td>{{ methods(sale) }}</td>
              <td class="num strong">{{ formatUgx(sale.total) }}</td>
              <td>
                <span class="badge" :class="sale.status">{{ sale.status }}</span>
              </td>
            </tr>
          </tbody>
            </table>
          </div>
        </template>
        <template #mobile>
          <li v-for="sale in sales" :key="sale.id" class="data-row">
            <div class="data-row-main">
              <RouterLink class="data-row-title link" :to="`/sales/${sale.id}`">
                {{ sale.sale_number }}
              </RouterLink>
              <span class="data-row-value">{{ formatUgx(sale.total) }}</span>
            </div>
            <div class="data-row-meta">
              <span>{{ formatDateTime(sale.created_at) }}</span>
              <span>{{ sale.cashier?.name ?? '—' }}</span>
              <span>{{ sale.items_count }} item{{ sale.items_count === 1 ? '' : 's' }}</span>
            </div>
            <div class="data-row-footer">
              <span class="data-row-meta">{{ methods(sale) }}</span>
              <span class="badge" :class="sale.status">{{ sale.status }}</span>
            </div>
            <RouterLink class="data-row-action" :to="`/sales/${sale.id}`">View sale</RouterLink>
          </li>
        </template>
      </ResponsiveDataView>

      <PaginationBar
        :page="page"
        :last-page="lastPage"
        :total="total"
        :per-page="perPage"
        :disabled="loading"
        noun="sales"
        @update:page="load"
        @update:per-page="
          (n) => {
            perPage = n
            load(1)
          }
        "
      />
    </div>
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
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

.page-head .btn {
  text-decoration: none;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem 1.25rem;
}

.filters .field {
  min-width: 150px;
}

.table-card {
  overflow: hidden;
}

.table-scroll {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

th {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-ink-faint);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: var(--color-canvas);
}

.num {
  text-align: right;
}

.strong {
  font-weight: 600;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.completed {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.badge.voided {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.state {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-ink-faint);
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--color-border);
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.pager .btn {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
}

.pager div {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 860px) {
  .page {
    padding: 1.25rem 1rem;
  }
}

@media (max-width: 640px) {
  .page-head {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .page-head .btn {
    width: 100%;
    min-height: 44px;
    text-align: center;
  }

  .filters {
    padding: 1rem;
  }

  .filters .field {
    width: 100%;
    min-width: 0;
  }
}
</style>
