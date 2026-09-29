<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import CustomerFormModal from '@/components/customers/CustomerFormModal.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import ResponsiveDataView from '@/components/ResponsiveDataView.vue'
import { useClientPage } from '@/lib/paging'
import { formatUgx } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useCustomersStore } from '@/stores/customers'
import { useShopStore } from '@/stores/shop'

const customers = useCustomersStore()
const shop = useShopStore()
const auth = useAuthStore()
const router = useRouter()

const search = ref('')
const adding = ref(false)

onMounted(() => {
  if (shop.currentShop) void customers.load(shop.currentShop.id)
})

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return customers.list.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.phone?.includes(q),
  )
})

const { page, perPage, total, lastPage, rows } = useClientPage(visible, 'customers')
watch(search, () => (page.value = 1))

function onSaved(customer: { id: number }) {
  adding.value = false
  void router.push(`/customers/${customer.id}`)
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Customers</p>
        <h1>Customers</h1>
      </div>
      <button type="button" class="btn btn-primary" @click="adding = true">Add customer</button>
    </header>

    <input
      v-model="search"
      class="search"
      type="search"
      placeholder="Search by name or phone…"
      aria-label="Search customers"
    />

    <p v-if="customers.error" class="alert-danger">{{ customers.error }}</p>

    <div class="card table-card">
      <p v-if="customers.loading && !customers.list.length" class="state">Loading customers…</p>
      <p v-else-if="!customers.list.length" class="state">
        No customers yet. Add one here, or while making a sale.
      </p>
      <p v-else-if="!visible.length" class="state">No customers match “{{ search }}”.</p>

      <ResponsiveDataView v-else>
        <template #table>
          <div class="table-scroll">
            <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th class="num">Owes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="customer in rows" :key="customer.id">
              <td>
                <RouterLink class="link" :to="`/customers/${customer.id}`">{{
                  customer.name
                }}</RouterLink>
              </td>
              <td>{{ customer.phone ?? '—' }}</td>
              <td class="num" :class="{ owes: customer.balance > 0 }">
                {{ customer.balance > 0 ? formatUgx(customer.balance) : '—' }}
              </td>
              <td>
                <span v-if="customer.overdue" class="badge overdue">Overdue</span>
                <span v-else-if="customer.balance > 0" class="badge owing">Owes</span>
                <span v-else class="badge clear">Clear</span>
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
              <span v-if="customer.balance > 0" class="data-row-value owes">
                {{ formatUgx(customer.balance) }}
              </span>
            </div>
            <div class="data-row-meta">
              <span>{{ customer.phone ?? 'No phone number' }}</span>
              <span v-if="customer.balance <= 0">No outstanding balance</span>
            </div>
            <div class="data-row-footer">
              <span v-if="customer.overdue" class="badge overdue">Overdue</span>
              <span v-else-if="customer.balance > 0" class="badge owing">Owes</span>
              <span v-else class="badge clear">Clear</span>
              <RouterLink class="data-row-action" :to="`/customers/${customer.id}`">View customer</RouterLink>
            </div>
          </li>
        </template>
      </ResponsiveDataView>
      <PaginationBar
        :page="page"
        :last-page="lastPage"
        :total="total"
        :per-page="perPage"
        noun="customers"
        @update:page="(n) => (page = n)"
        @update:per-page="
          (n) => {
            perPage = n
            page = 1
          }
        "
      />
    </div>

    <CustomerFormModal
      v-if="adding"
      :can-edit-notes="auth.canManage"
      @close="adding = false"
      @saved="onSaved"
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

.search {
  width: 100%;
  min-height: 44px;
  padding: 0 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 0.9375rem;
  outline: none;
}

.search:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
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

.owes {
  color: var(--color-danger);
  font-weight: 600;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge.clear {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.badge.owing {
  background: #fef3c7;
  color: #92400e;
}

.badge.overdue {
  background: var(--color-danger-soft);
  color: var(--color-danger);
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
}
</style>
