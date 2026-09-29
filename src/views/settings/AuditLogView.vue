<script setup lang="ts">
import PaginationBar from '@/components/PaginationBar.vue'
import { usePerPage } from '@/lib/paging'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { addDays, startOfMonth, todayIn } from '@/lib/dates'
import { formatDateTime } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import type { AuditEntry, AuditPage, StaffMember } from '@/types/staff'

const auth = useAuthStore()
const timezone = auth.user?.organization?.timezone

const today = todayIn(timezone)
const from = ref(startOfMonth(today))
const to = ref(today)
const action = ref('')
const person = ref('')
const pageNumber = ref(1)
const perPage = usePerPage('audit-log')

const result = ref<AuditPage | null>(null)
const staff = ref<StaffMember[]>([])
const loading = ref(false)
const error = ref('')
const open = ref<number | null>(null)

const actionLabels: Record<string, string> = {
  'sale.void': 'Voided a sale',
  'sale.refund': 'Refunded a sale',
  'expense.update': 'Changed an expense',
  'shift.close': 'Closed a shift',
  'staff.create': 'Added a staff member',
  'staff.role_change': "Changed someone's role",
  'staff.deactivate': 'Deactivated an account',
  'staff.activate': 'Reactivated an account',
  'staff.password_reset': "Reset someone's password",
}

const fieldLabels: Record<string, string> = {
  status: 'Status',
  reason: 'Reason',
  total: 'Total',
  cash: 'Cash paid back',
  debt_cancelled: 'Debt cancelled',
  refund_id: 'Refund',
  role: 'Role',
  email: 'Email',
  amount: 'Amount',
  category: 'Category',
  description: 'Note',
  expense_date: 'Date',
  cashier_id: 'Cashier',
  expected_cash: 'Expected cash',
  actual_cash: 'Counted cash',
  variance: 'Difference',
  note: 'Note',
  signed_out_everywhere: 'Signed out everywhere',
}

function actionLabel(a: string): string {
  return actionLabels[a] ?? a.replace(/[._]/g, ' ')
}

const staffNames = computed(() => new Map(staff.value.map((s) => [s.id, s.name])))

function subject(entry: AuditEntry): string {
  if (entry.entity === 'User')
    return staffNames.value.get(entry.entity_id) ?? `Staff #${entry.entity_id}`
  return `${entry.entity} #${entry.entity_id}`
}

function fieldLabel(key: string): string {
  return fieldLabels[key] ?? key.replace(/_/g, ' ')
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function detailRows(entry: AuditEntry): { key: string; before: string; after: string }[] {
  const keys = new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})])
  return [...keys].map((key) => ({
    key: fieldLabel(key),
    before: entry.before && key in entry.before ? show(entry.before[key]) : '',
    after: entry.after && key in entry.after ? show(entry.after[key]) : '',
  }))
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      from: from.value,
      to: to.value,
      page: String(pageNumber.value),
      per_page: String(perPage.value),
    })
    if (action.value) params.set('action', action.value)
    if (person.value) params.set('user_id', person.value)
    result.value = await apiFetch<AuditPage>(`/audit-logs?${params}`)
    open.value = null
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function refilter() {
  pageNumber.value = 1
  void load()
}

function goTo(n: number) {
  pageNumber.value = n
  void load()
}

function changeSize(n: number) {
  perPage.value = n
  refilter()
}

const last30 = () => {
  to.value = today
  from.value = addDays(today, -29)
  refilter()
}

onMounted(async () => {
  try {
    staff.value = await apiFetch<StaffMember[]>('/staff')
  } catch {
    // The filter and names are conveniences; the log itself still loads.
  }
  await load()
})
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Admin</p>
        <h1>Audit log</h1>
        <p class="sub">
          A record of sensitive actions in this shop. Entries can't be edited or deleted.
        </p>
      </div>
    </header>

    <form class="filters card" @submit.prevent="refilter">
      <div class="field">
        <label for="a-from">From</label>
        <input id="a-from" v-model="from" type="date" :max="today" @change="refilter" />
      </div>
      <div class="field">
        <label for="a-to">To</label>
        <input id="a-to" v-model="to" type="date" :max="today" @change="refilter" />
      </div>
      <div class="field">
        <label for="a-action">Action</label>
        <select id="a-action" v-model="action" @change="refilter">
          <option value="">All actions</option>
          <option v-for="a in result?.actions ?? []" :key="a" :value="a">
            {{ actionLabel(a) }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="a-person">Person</label>
        <select id="a-person" v-model="person" @change="refilter">
          <option value="">Everyone</option>
          <option v-for="s in staff" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
      <button type="button" class="btn-quiet" @click="last30">Last 30 days</button>
    </form>

    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div class="card table-card">
      <p v-if="loading && !result" class="state">Loading…</p>
      <p v-else-if="result && !result.page.data.length" class="state">
        Nothing was recorded in this period.
      </p>

      <div v-else-if="result" class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>On</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <template v-for="entry in result.page.data" :key="entry.id">
              <tr>
                <td class="muted">{{ formatDateTime(entry.created_at) }}</td>
                <td>{{ entry.user?.name ?? 'System' }}</td>
                <td class="what">{{ actionLabel(entry.action) }}</td>
                <td>
                  <RouterLink
                    v-if="entry.entity === 'Sale'"
                    :to="`/sales/${entry.entity_id}`"
                    class="link"
                  >
                    {{ subject(entry) }}
                  </RouterLink>
                  <span v-else>{{ subject(entry) }}</span>
                </td>
                <td class="actions">
                  <button
                    v-if="entry.before || entry.after"
                    type="button"
                    class="link toggle"
                    :aria-expanded="open === entry.id"
                    @click="open = open === entry.id ? null : entry.id"
                  >
                    {{ open === entry.id ? 'Hide' : 'Details' }}
                  </button>
                </td>
              </tr>
              <tr v-if="open === entry.id" class="detail">
                <td colspan="5">
                  <table class="inner">
                    <thead>
                      <tr>
                        <th>Detail</th>
                        <th>Before</th>
                        <th>After</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in detailRows(entry)" :key="row.key">
                        <td>{{ row.key }}</td>
                        <td>{{ row.before || '—' }}</td>
                        <td>{{ row.after || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <PaginationBar
        v-if="result"
        :page="result.page.current_page"
        :last-page="result.page.last_page"
        :total="result.page.total"
        :per-page="perPage"
        :disabled="loading"
        noun="entries"
        @update:page="goTo"
        @update:per-page="changeSize"
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

.sub,
.muted {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.sub {
  margin-top: 0.25rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  padding: 1rem 1.25rem;
}

.filters .field {
  min-width: 150px;
}

.btn-quiet {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-quiet:hover:not(:disabled) {
  background: var(--color-canvas);
}

.btn-quiet:disabled {
  opacity: 0.5;
  cursor: default;
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
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.what {
  font-weight: 600;
}

.actions {
  text-align: right;
}

.toggle {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  cursor: pointer;
}

.detail td {
  padding: 0.25rem 1.25rem 1rem;
  background: var(--color-canvas);
}

.inner {
  max-width: 560px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.inner th,
.inner td {
  padding: 0.5rem 0.875rem;
  white-space: normal;
}

.inner tr:last-child td {
  border-bottom: none;
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
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--color-border);
}

@media (max-width: 860px) {
  .page {
    padding: 1.25rem 1rem;
  }
}
</style>
