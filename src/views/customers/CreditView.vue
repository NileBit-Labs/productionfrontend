<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ResponsiveDataView from '@/components/ResponsiveDataView.vue'
import { useClientPage } from '@/lib/paging'
import { RouterLink } from 'vue-router'
import RepaymentModal from '@/components/customers/RepaymentModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatUgx } from '@/lib/format'
import type { Customer } from '@/types/customers'

const debtors = ref<Customer[]>([])
const loading = ref(false)
const error = ref('')
const collecting = ref<Customer | null>(null)

const totalOwed = computed(() => debtors.value.reduce((sum, c) => sum + c.balance, 0))
const { page, perPage, total, lastPage, rows } = useClientPage(debtors, 'credit')
const overdueCount = computed(() => debtors.value.filter((c) => c.overdue).length)

async function load() {
  loading.value = true
  error.value = ''
  try {
    debtors.value = await apiFetch<Customer[]>('/customers?owing=1')
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function onPaid() {
  collecting.value = null
  await load()
}

onMounted(load)
</script>

<template>
  <main class="page">
    <header>
      <p class="eyebrow">Customers</p>
      <h1>Credit &amp; debtors</h1>
    </header>

    <section class="stats">
      <div class="card stat">
        <p class="label">Total owed to you</p>
        <p class="value owes">{{ formatUgx(totalOwed) }}</p>
      </div>
      <div class="card stat">
        <p class="label">Customers who owe</p>
        <p class="value">{{ debtors.length }}</p>
      </div>
      <div class="card stat">
        <p class="label">Overdue</p>
        <p class="value" :class="{ owes: overdueCount }">{{ overdueCount }}</p>
      </div>
    </section>

    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div class="card table-card">
      <p v-if="loading && !debtors.length" class="state">Loading…</p>
      <p v-else-if="!debtors.length" class="state">Nobody owes you anything. 🎉</p>

      <ResponsiveDataView v-else>
        <template #table>
          <div class="table-scroll">
            <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Pay by</th>
              <th class="num">Owes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="customer in rows" :key="customer.id">
              <td>
                <RouterLink class="link" :to="`/customers/${customer.id}`">{{
                  customer.name
                }}</RouterLink>
                <span v-if="customer.overdue" class="badge">Overdue</span>
              </td>
              <td>{{ customer.phone ?? '—' }}</td>
              <td>{{ customer.oldest_due_date ?? '—' }}</td>
              <td class="num owes">{{ formatUgx(customer.balance) }}</td>
              <td class="num">
                <button type="button" class="btn small" @click="collecting = customer">
                  Collect
                </button>
              </td>
            </tr>
          </tbody>
            </table>
          </div>
        </template>
        <template #mobile>
          <li v-for="customer in rows" :key="customer.id" class="data-row">
            <div class="data-row-main">
              <RouterLink class="data-row-title link" :to="`/customers/${customer.id}`">
                {{ customer.name }}
              </RouterLink>
              <span class="data-row-value owes">{{ formatUgx(customer.balance) }}</span>
            </div>
            <div class="data-row-meta">
              <span>{{ customer.phone ?? 'No phone number' }}</span>
              <span>Pay by {{ customer.oldest_due_date ?? '—' }}</span>
            </div>
            <div class="data-row-footer">
              <span v-if="customer.overdue" class="badge">Overdue</span>
              <RouterLink class="data-row-action" :to="`/customers/${customer.id}`">View ledger</RouterLink>
              <button type="button" class="data-row-action" @click="collecting = customer">Collect payment</button>
            </div>
          </li>
        </template>
      </ResponsiveDataView>
      <PaginationBar
        :page="page"
        :last-page="lastPage"
        :total="total"
        :per-page="perPage"
        noun="customers with balances"
        @update:page="(n) => (page = n)"
        @update:per-page="
          (n) => {
            perPage = n
            page = 1
          }
        "
      />
    </div>

    <RepaymentModal
      v-if="collecting"
      :customer="collecting"
      @close="collecting = null"
      @paid="onPaid"
    />
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

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat {
  padding: 1.25rem 1.5rem;
}

.label {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.value {
  margin-top: 0.25rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.owes {
  color: var(--color-danger);
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
}

td {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

tbody tr:last-child td {
  border-bottom: none;
}

.num {
  text-align: right;
  font-weight: 600;
}

.badge {
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.6875rem;
  font-weight: 600;
}

.btn.small {
  min-height: 34px;
  padding: 0 0.875rem;
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.8125rem;
}

.state {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-ink-faint);
}

@media (max-width: 860px) {
  .page {
    padding: 1.25rem 1rem;
  }

  .stats {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .value {
    overflow-wrap: anywhere;
  }
}
</style>
