<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ResponsiveDataView from '@/components/ResponsiveDataView.vue'
import { useClientPage } from '@/lib/paging'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatUgx, localDate } from '@/lib/format'

interface Expense {
  id: number
  category: string
  amount: number
  description: string | null
  expense_date: string
  recorder?: { id: number; name: string }
}

interface ExpenseList {
  from: string
  to: string
  total: number
  by_category: { category: string; total: number }[]
  categories: string[]
  data: Expense[]
}

const today = localDate()
const monthStart = localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

const list = ref<ExpenseList | null>(null)
const loading = ref(false)
const error = ref('')
const from = ref(monthStart)
const to = ref(today)
const category = ref('')

const editing = ref<Expense | null>(null)
const adding = ref(false)
const form = ref({ category: 'Other', amount: 0, description: '', expense_date: today })
const saving = ref(false)
const formError = ref('')

const expenseItems = computed(() => list.value?.data ?? [])
const { page, perPage, total, lastPage, rows } = useClientPage(expenseItems, 'expenses')

const largest = computed(() => Math.max(...(list.value?.by_category.map((c) => c.total) ?? [0]), 1))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ from: from.value, to: to.value })
    if (category.value) params.set('category', category.value)
    list.value = await apiFetch<ExpenseList>(`/expenses?${params}`)
    page.value = 1
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editing.value = null
  form.value = { category: 'Other', amount: 0, description: '', expense_date: today }
  formError.value = ''
  adding.value = true
}

function openEdit(expense: Expense) {
  editing.value = expense
  form.value = {
    category: expense.category,
    amount: expense.amount,
    description: expense.description ?? '',
    expense_date: expense.expense_date,
  }
  formError.value = ''
  adding.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    const body = {
      ...form.value,
      amount: Math.round(Number(form.value.amount)),
      description: form.value.description || null,
    }
    if (editing.value) {
      await apiFetch(`/expenses/${editing.value.id}`, { method: 'PATCH', body })
    } else {
      await apiFetch('/expenses', { method: 'POST', body })
    }
    adding.value = false
    await load()
  } catch (e) {
    formError.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Finance</p>
        <h1>Expenses</h1>
      </div>
      <button type="button" class="btn btn-primary" @click="openAdd">Add expense</button>
    </header>

    <form class="filters card" @submit.prevent="load">
      <div class="field">
        <label for="from">From</label>
        <input id="from" v-model="from" type="date" :max="today" @change="load" />
      </div>
      <div class="field">
        <label for="to">To</label>
        <input id="to" v-model="to" type="date" :max="today" @change="load" />
      </div>
      <div class="field">
        <label for="cat">Category</label>
        <select id="cat" v-model="category" @change="load">
          <option value="">All</option>
          <option v-for="c in list?.categories ?? []" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </form>

    <p v-if="error" class="alert-danger">{{ error }}</p>

    <section v-if="list" class="summary">
      <div class="card total">
        <p class="label">Total spent</p>
        <p class="value">{{ formatUgx(list.total) }}</p>
        <p class="hint">{{ list.data.length }} expense{{ list.data.length === 1 ? '' : 's' }}</p>
      </div>

      <div class="card breakdown">
        <p class="label">By category</p>
        <p v-if="!list.by_category.length" class="hint">Nothing recorded in this period.</p>
        <ul v-else>
          <li v-for="row in list.by_category" :key="row.category">
            <span class="cat">{{ row.category }}</span>
            <span class="bar"><span :style="{ width: (row.total / largest) * 100 + '%' }" /></span>
            <span class="amt">{{ formatUgx(row.total) }}</span>
          </li>
        </ul>
      </div>
    </section>

    <div class="card table-card">
      <p v-if="loading && !list" class="state">Loading…</p>
      <p v-else-if="list && !list.data.length" class="state">No expenses in this period.</p>

      <ResponsiveDataView v-else-if="list">
        <template #table>
          <div class="table-scroll">
            <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>By</th>
              <th class="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="expense in rows" :key="expense.id">
              <td>{{ expense.expense_date }}</td>
              <td>{{ expense.category }}</td>
              <td class="desc">{{ expense.description ?? '—' }}</td>
              <td>{{ expense.recorder?.name }}</td>
              <td class="num">{{ formatUgx(expense.amount) }}</td>
              <td class="num">
                <button type="button" class="link edit" @click="openEdit(expense)">Edit</button>
              </td>
            </tr>
          </tbody>
            </table>
          </div>
        </template>
        <template #mobile>
          <li v-for="expense in rows" :key="expense.id" class="data-row">
            <div class="data-row-main">
              <span class="data-row-title">{{ expense.category }}</span>
              <span class="data-row-value">{{ formatUgx(expense.amount) }}</span>
            </div>
            <div class="data-row-meta">
              <span>{{ expense.expense_date }}</span>
              <span>{{ expense.recorder?.name ?? '—' }}</span>
            </div>
            <p v-if="expense.description" class="data-row-meta">{{ expense.description }}</p>
            <button type="button" class="data-row-action" @click="openEdit(expense)">Edit expense</button>
          </li>
        </template>
      </ResponsiveDataView>
      <PaginationBar
        :page="page"
        :last-page="lastPage"
        :total="total"
        :per-page="perPage"
        noun="expenses"
        @update:page="(n) => (page = n)"
        @update:per-page="
          (n) => {
            perPage = n
            page = 1
          }
        "
      />
    </div>

    <BaseModal
      v-if="adding"
      :title="editing ? 'Edit expense' : 'Add expense'"
      @close="adding = false"
    >
      <form class="form" @submit.prevent="save">
        <p v-if="formError" class="alert-danger">{{ formError }}</p>

        <div class="field">
          <label for="e-cat">Category</label>
          <select id="e-cat" v-model="form.category">
            <option v-for="c in list?.categories ?? ['Other']" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="field">
          <label for="e-amount">Amount (UGX)</label>
          <input
            id="e-amount"
            v-model.number="form.amount"
            type="number"
            inputmode="numeric"
            min="1"
            required
          />
        </div>
        <div class="field">
          <label for="e-date">Date</label>
          <input id="e-date" v-model="form.expense_date" type="date" :max="today" required />
        </div>
        <div class="field">
          <label for="e-desc">Note <span class="optional">(optional)</span></label>
          <input id="e-desc" v-model="form.description" type="text" maxlength="500" />
        </div>

        <p v-if="editing" class="audit-note">
          Changes to an expense are recorded in the audit log.
        </p>

        <button
          type="submit"
          class="btn btn-primary btn-block"
          :disabled="saving || !(form.amount > 0)"
        >
          {{ saving ? 'Saving…' : 'Save expense' }}
        </button>
      </form>
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

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem 1.25rem;
}

.filters .field {
  min-width: 150px;
}

.summary {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.25rem;
}

.total,
.breakdown {
  padding: 1.25rem 1.5rem;
}

.label {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.value {
  margin-top: 0.25rem;
  font-size: 1.75rem;
  font-weight: 700;
}

.hint {
  margin-top: 0.25rem;
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.breakdown ul {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.breakdown li {
  display: grid;
  grid-template-columns: 120px 1fr auto;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
}

.cat {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-ink-soft);
}

.bar {
  height: 8px;
  border-radius: 4px;
  background: var(--color-border);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: 4px;
  background: var(--color-primary);
}

.amt {
  font-weight: 600;
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

.desc {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.num {
  text-align: right;
  font-weight: 600;
}

.edit {
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

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.optional {
  font-weight: 400;
  color: var(--color-ink-faint);
}

.audit-note {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

@media (max-width: 860px) {
  .page {
    padding: 1.25rem 1rem;
  }

  .summary {
    grid-template-columns: 1fr;
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
  }

  .filters {
    padding: 1rem;
  }

  .filters .field {
    width: 100%;
    min-width: 0;
  }

  .breakdown li {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .breakdown .bar {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
