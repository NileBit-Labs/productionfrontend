<script setup lang="ts">
import PaginationBar from '@/components/PaginationBar.vue'
import { usePerPage } from '@/lib/paging'
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import PaySupplierModal from '@/components/purchasing/PaySupplierModal.vue'
import SupplierFormModal from '@/components/purchasing/SupplierFormModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime, formatUgx } from '@/lib/format'
import type { Paginated } from '@/types/inventory'
import { LEDGER_LABELS, type Supplier, type SupplierLedgerEntry } from '@/types/purchasing'

const route = useRoute()

const supplier = ref<Supplier | null>(null)
const ledger = ref<Paginated<SupplierLedgerEntry> | null>(null)
const ledgerPage = ref(1)
const ledgerPerPage = usePerPage('supplier-ledger', 25)
const error = ref('')
const notice = ref('')
const paying = ref(false)
const editing = ref(false)

async function load() {
  error.value = ''
  try {
    supplier.value = await apiFetch<Supplier>(`/suppliers/${route.params.id}`)
    await loadLedger()
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

async function loadLedger() {
  ledger.value = await apiFetch<Paginated<SupplierLedgerEntry>>(
    `/suppliers/${route.params.id}/ledger?page=${ledgerPage.value}&per_page=${ledgerPerPage.value}`,
  )
}

function changeSize(n: number) {
  ledgerPerPage.value = n
  goTo(1)
}

function goTo(n: number) {
  ledgerPage.value = n
  void loadLedger().catch((e) => (error.value = apiErrorMessage(e)))
}

async function paid() {
  paying.value = false
  notice.value = 'Payment recorded.'
  ledgerPage.value = 1
  await load()
}

async function saved() {
  editing.value = false
  notice.value = 'Supplier saved.'
  await load()
}

const reference = (entry: SupplierLedgerEntry) => entry.note ?? ''

onMounted(load)
</script>

<template>
  <main class="ui-page">
    <RouterLink class="back link" to="/suppliers">← Suppliers</RouterLink>

    <p v-if="error" class="alert-danger">{{ error }}</p>
    <p v-else-if="!supplier" class="ui-state">Loading…</p>

    <template v-else>
      <header class="head card">
        <div class="who">
          <h1>{{ supplier.name }}</h1>
          <p class="muted">
            {{
              [supplier.phone, supplier.email].filter(Boolean).join(' · ') || 'No contact details'
            }}
          </p>
          <p v-if="supplier.address" class="muted">{{ supplier.address }}</p>
          <p v-if="supplier.notes" class="notes">{{ supplier.notes }}</p>
          <span v-if="!supplier.is_active" class="ui-badge">Inactive</span>
        </div>

        <div class="balance">
          <p class="muted">{{ supplier.balance > 0 ? 'You owe' : 'Account' }}</p>
          <p class="amount" :class="{ owes: supplier.balance > 0 }">
            {{ supplier.balance > 0 ? formatUgx(supplier.balance) : 'Settled' }}
          </p>
          <div class="ui-actions">
            <button type="button" class="btn ui-btn-secondary" @click="editing = true">Edit</button>
            <RouterLink
              v-if="supplier.is_active"
              class="btn ui-btn-secondary"
              :to="`/purchases/new?supplier=${supplier.id}`"
            >
              New purchase
            </RouterLink>
            <button
              v-if="supplier.balance > 0"
              type="button"
              class="btn btn-primary"
              @click="paying = true"
            >
              Pay supplier
            </button>
          </div>
        </div>
      </header>

      <p v-if="notice" class="notice" role="status">{{ notice }}</p>

      <section v-if="supplier.open_purchases?.length" class="card block">
        <h2>Unpaid purchases</h2>
        <ul class="open">
          <li v-for="p in supplier.open_purchases" :key="p.purchase_id">
            <RouterLink class="link" :to="`/purchases/${p.purchase_id}`">{{
              p.purchase_number
            }}</RouterLink>
            <span class="muted">{{ p.purchase_date }}</span>
            <strong>{{ formatUgx(p.owed) }}</strong>
          </li>
        </ul>
      </section>

      <section class="card ui-table-card">
        <h2 class="pad">Account history</h2>
        <p v-if="ledger && !ledger.data.length" class="ui-state">
          Nothing yet. Purchases bought on credit and payments will show here.
        </p>
        <div v-else-if="ledger" class="ui-table-scroll">
          <table class="ui-table">
            <thead>
              <tr>
                <th>When</th>
                <th>What</th>
                <th>Note</th>
                <th>By</th>
                <th class="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in ledger.data" :key="entry.id">
                <td>{{ formatDateTime(entry.created_at) }}</td>
                <td>{{ LEDGER_LABELS[entry.type] ?? entry.type }}</td>
                <td :class="{ muted: !entry.note }">
                  <RouterLink
                    v-if="entry.reference?.type === 'Purchase'"
                    class="link"
                    :to="`/purchases/${entry.reference.id}`"
                  >
                    {{ reference(entry) || 'Purchase' }}
                  </RouterLink>
                  <template v-else>{{ reference(entry) || '—' }}</template>
                </td>
                <td>{{ entry.recorded_by }}</td>
                <td class="num" :class="entry.amount < 0 ? 'in' : 'out'">
                  {{ entry.amount < 0 ? '−' : '+' }}{{ formatUgx(Math.abs(entry.amount)) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <PaginationBar
          v-if="ledger"
          :page="ledger.current_page"
          :last-page="ledger.last_page"
          :total="ledger.total"
          :per-page="ledgerPerPage"
          noun="entries"
          @update:page="goTo"
          @update:per-page="changeSize"
        />
      </section>

      <PaySupplierModal v-if="paying" :supplier="supplier" @close="paying = false" @paid="paid" />
      <SupplierFormModal
        v-if="editing"
        :supplier="supplier"
        @close="editing = false"
        @saved="saved"
      />
    </template>
  </main>
</template>

<style scoped>
.back {
  align-self: flex-start;
  font-size: 0.875rem;
}

.head {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 1.5rem;
}

.who h1 {
  font-size: 1.5rem;
}

.muted {
  color: var(--color-ink-faint);
  font-size: 0.875rem;
}

.notes {
  margin-top: 0.5rem;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.balance {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.375rem;
}

.amount {
  font-size: 1.75rem;
  font-weight: 700;
}

.amount.owes {
  color: var(--color-danger);
}

.notice {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.875rem;
}

.block {
  padding: 1.25rem 1.5rem;
}

h2 {
  font-size: 1rem;
}

.pad {
  padding: 1.25rem 1.5rem 0.5rem;
}

.open {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
}

.open li {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.open li:last-child {
  border-bottom: none;
}

.open .muted {
  flex: 1;
}

.in {
  color: var(--color-primary);
  font-weight: 600;
}

.out {
  color: var(--color-danger);
  font-weight: 600;
}

@media (max-width: 720px) {
  .balance {
    align-items: flex-start;
  }
}
</style>
