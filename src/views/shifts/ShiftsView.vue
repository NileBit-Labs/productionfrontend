<script setup lang="ts">
import PaginationBar from '@/components/PaginationBar.vue'
import { usePerPage } from '@/lib/paging'
import { onMounted, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime, formatUgx } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import type { Paginated } from '@/types/sales'
import type { Shift } from '@/types/shifts'

const auth = useAuthStore()

const shifts = ref<Shift[]>([])
const page = ref(1)
const lastPage = ref(1)
const total = ref(0)
const perPage = usePerPage('shifts')
const loading = ref(false)
const error = ref('')
const detail = ref<Shift | null>(null)

async function load(target = 1) {
  loading.value = true
  error.value = ''
  try {
    const result = await apiFetch<Paginated<Shift>>(
      `/shifts?page=${target}&per_page=${perPage.value}`,
    )
    shifts.value = result.data
    page.value = result.current_page
    lastPage.value = result.last_page
    total.value = result.total
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function open(shift: Shift) {
  try {
    detail.value = await apiFetch<Shift>(`/shifts/${shift.id}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

onMounted(() => load())
</script>

<template>
  <main class="page">
    <header>
      <p class="eyebrow">Sales</p>
      <h1>Shifts</h1>
      <p class="sub">
        {{ auth.canManage ? "Every cashier's till sessions." : 'Your till sessions.' }} Start and
        close a shift from the Sell screen.
      </p>
    </header>

    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div class="card table-card">
      <p v-if="loading && !shifts.length" class="state">Loading…</p>
      <p v-else-if="!shifts.length" class="state">No shifts yet.</p>

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th v-if="auth.canManage">Cashier</th>
              <th>Opened</th>
              <th>Closed</th>
              <th class="num">Float</th>
              <th class="num">Expected</th>
              <th class="num">Counted</th>
              <th class="num">Difference</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="shift in shifts" :key="shift.id">
              <td v-if="auth.canManage">{{ shift.cashier?.name }}</td>
              <td>{{ formatDateTime(shift.opened_at) }}</td>
              <td>
                <span v-if="!shift.closed_at" class="badge open">Open</span>
                <template v-else>{{ formatDateTime(shift.closed_at) }}</template>
              </td>
              <td class="num">{{ formatUgx(shift.opening_cash) }}</td>
              <td class="num">
                {{ shift.expected_cash != null ? formatUgx(shift.expected_cash) : '—' }}
              </td>
              <td class="num">
                {{ shift.actual_cash != null ? formatUgx(shift.actual_cash) : '—' }}
              </td>
              <td
                class="num strong"
                :class="{ short: (shift.variance ?? 0) < 0, over: (shift.variance ?? 0) > 0 }"
              >
                <template v-if="shift.variance == null">—</template>
                <template v-else-if="shift.variance === 0">Balanced</template>
                <template v-else
                  >{{ shift.variance > 0 ? '+' : '−'
                  }}{{ formatUgx(Math.abs(shift.variance)) }}</template
                >
              </td>
              <td class="num">
                <button type="button" class="link view" @click="open(shift)">Details</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PaginationBar
        :page="page"
        :last-page="lastPage"
        :total="total"
        :per-page="perPage"
        :disabled="loading"
        noun="shifts"
        @update:page="load"
        @update:per-page="
          (n) => {
            perPage = n
            load(1)
          }
        "
      />
    </div>

    <BaseModal
      v-if="detail"
      :title="`Shift · ${detail.cashier?.name ?? ''}`"
      @close="detail = null"
    >
      <dl class="figures">
        <div>
          <dt>Starting float</dt>
          <dd>{{ formatUgx(detail.opening_cash) }}</dd>
        </div>
        <div>
          <dt>Cash sales</dt>
          <dd>{{ formatUgx(detail.summary?.cash_sales ?? 0) }}</dd>
        </div>
        <div>
          <dt>Customer repayments</dt>
          <dd>{{ formatUgx(detail.summary?.cash_repayments ?? 0) }}</dd>
        </div>
        <div>
          <dt>Cash paid out</dt>
          <dd>− {{ formatUgx(detail.summary?.cash_refunds ?? 0) }}</dd>
        </div>
        <div class="strong">
          <dt>Expected in drawer</dt>
          <dd>{{ formatUgx(detail.summary?.expected_cash ?? 0) }}</dd>
        </div>
        <div v-if="detail.actual_cash != null" class="strong">
          <dt>Counted</dt>
          <dd>{{ formatUgx(detail.actual_cash) }}</dd>
        </div>
      </dl>

      <p v-if="detail.changed_since_close" class="late">
        Expected cash has risen by {{ formatUgx(detail.changed_since_close) }} since this shift
        closed — sales made during it were synced late.
      </p>

      <template v-if="detail.summary?.other_methods.length">
        <h3>Not cash</h3>
        <dl class="figures">
          <div v-for="m in detail.summary.other_methods" :key="m.method">
            <dt>{{ m.method.replace('_', ' ').toLowerCase() }}</dt>
            <dd>{{ formatUgx(m.in - m.out) }}</dd>
          </div>
        </dl>
      </template>

      <p v-if="detail.close_note" class="note">“{{ detail.close_note }}”</p>
    </BaseModal>
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

.sub {
  margin-top: 0.25rem;
  color: var(--color-ink-faint);
  font-size: 0.875rem;
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

.num {
  text-align: right;
}

.strong {
  font-weight: 600;
}

.short {
  color: var(--color-danger);
}

.over {
  color: #b45309;
}

.badge.open {
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.view {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  cursor: pointer;
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
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--color-border);
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.pager div {
  display: flex;
  gap: 0.5rem;
}

.pager .btn {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
}

.figures {
  margin: 0 0 1rem;
}

.figures div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
  text-transform: capitalize;
}

.figures dt {
  color: var(--color-ink-soft);
}

.figures dd {
  margin: 0;
}

.figures .strong {
  font-weight: 700;
}

h3 {
  margin: 1rem 0 0.25rem;
  font-size: 0.8125rem;
  color: var(--color-ink-faint);
}

.late {
  margin-bottom: 1rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: #fef3c7;
  color: #92400e;
  font-size: 0.8125rem;
}

.note {
  margin-top: 0.5rem;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  font-style: italic;
}

@media (max-width: 860px) {
  .page {
    padding: 1.25rem 1rem;
  }
}
</style>
