<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import CustomerFormModal from '@/components/customers/CustomerFormModal.vue'
import RepaymentModal from '@/components/customers/RepaymentModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime, formatUgx } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { LEDGER_LABELS, type Customer, type LedgerEntry } from '@/types/customers'

const route = useRoute()
const auth = useAuthStore()

const customer = ref<Customer | null>(null)
const ledger = ref<LedgerEntry[]>([])
const error = ref('')
const paying = ref(false)
const editing = ref(false)

async function load() {
  error.value = ''
  try {
    customer.value = await apiFetch<Customer>(`/customers/${route.params.id}`)
    if (auth.canManage) {
      ledger.value = await apiFetch<LedgerEntry[]>(`/customers/${route.params.id}/ledger`)
    }
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

async function onChanged() {
  paying.value = false
  editing.value = false
  await load()
}

onMounted(load)
</script>

<template>
  <main class="page">
    <RouterLink class="back" to="/customers">← Customers</RouterLink>

    <p v-if="error" class="alert-danger">{{ error }}</p>
    <p v-else-if="!customer" class="state">Loading…</p>

    <template v-else>
      <header class="head card">
        <div>
          <h1>{{ customer.name }}</h1>
          <p class="muted">{{ customer.phone ?? 'No phone number' }}</p>
          <p v-if="customer.notes" class="notes">{{ customer.notes }}</p>
        </div>
        <div class="balance">
          <p class="muted">{{ customer.balance > 0 ? 'Owes' : 'Account' }}</p>
          <p class="amount" :class="{ owes: customer.balance > 0 }">
            {{ customer.balance > 0 ? formatUgx(customer.balance) : 'Clear' }}
          </p>
          <span v-if="customer.overdue" class="badge overdue">Overdue</span>
        </div>
      </header>

      <div class="cols" :class="{ single: !auth.canManage }">
        <section v-if="auth.canManage" class="card block">
          <h2>Account history</h2>
          <p v-if="!ledger.length" class="muted">Nothing yet.</p>
          <table v-else>
            <thead>
              <tr>
                <th>Date</th>
                <th>What happened</th>
                <th class="num">Amount</th>
                <th class="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in ledger" :key="entry.id">
                <td>{{ formatDateTime(entry.created_at) }}</td>
                <td>
                  {{ LEDGER_LABELS[entry.type] }}
                  <span v-if="entry.note" class="muted"> · {{ entry.note }}</span>
                </td>
                <td class="num" :class="entry.amount > 0 ? 'owes' : 'paid'">
                  {{ entry.amount > 0 ? '+' : '−' }}{{ formatUgx(Math.abs(entry.amount)) }}
                </td>
                <td class="num">{{ formatUgx(entry.balance_after) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
        <div class="side">
          <div class="actions">
            <button
              v-if="customer.balance > 0"
              type="button"
              class="btn btn-primary"
              @click="paying = true"
            >
              Record repayment
            </button>
            <button v-if="auth.canManage" type="button" class="btn" @click="editing = true">
              Edit
            </button>
          </div>
          <section v-if="customer.open_sales?.length" class="card block">
            <h2>Still owed for</h2>
            <ul class="open">
              <li v-for="sale in customer.open_sales" :key="sale.sale_id">
                <RouterLink class="link" :to="`/sales/${sale.sale_id}`">{{
                  sale.sale_number
                }}</RouterLink>
                <span class="muted">{{
                  sale.due_date ? `pay by ${sale.due_date}` : 'no due date'
                }}</span>
                <strong>{{ formatUgx(sale.owed) }}</strong>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>

    <RepaymentModal
      v-if="paying && customer"
      :customer="customer"
      @close="paying = false"
      @paid="onChanged"
    />
    <CustomerFormModal
      v-if="editing && customer"
      :customer="customer"
      :can-edit-notes="auth.canManage"
      @close="editing = false"
      @saved="onChanged"
    />
  </main>
</template>

<style scoped>
.cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 1.25rem;
  align-items: start;
}

.cols.single {
  grid-template-columns: minmax(0, 560px);
}

.side {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

@media (max-width: 1000px) {
  .cols,
  .cols.single {
    grid-template-columns: 1fr;
  }
}

.page {
  flex: 1;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 1.75rem 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.back {
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  text-decoration: none;
}

.back:hover {
  color: var(--color-primary);
}

.state {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-ink-faint);
}

.head {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.5rem;
}

h1 {
  font-size: 1.375rem;
}

.muted {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.notes {
  margin-top: 0.75rem;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.balance {
  text-align: right;
}

.amount {
  font-size: 1.5rem;
  font-weight: 700;
}

.amount.owes,
.owes {
  color: var(--color-danger);
}

.paid {
  color: var(--color-primary);
}

.badge {
  display: inline-block;
  margin-top: 0.25rem;
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.75rem;
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.actions .btn:not(.btn-primary) {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
}

.block {
  padding: 1.25rem 1.5rem;
}

.block h2 {
  margin-bottom: 0.75rem;
  font-size: 0.9375rem;
}

.open {
  list-style: none;
  margin: 0;
  padding: 0;
}

.open li {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.open li:last-child {
  border-bottom: none;
}

.open strong {
  margin-left: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

th {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-ink-faint);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}

td {
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--color-border);
}

tbody tr:last-child td {
  border-bottom: none;
}

.num {
  text-align: right;
  white-space: nowrap;
}
</style>
