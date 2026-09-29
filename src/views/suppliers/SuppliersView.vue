<script setup lang="ts">
import PaginationBar from '@/components/PaginationBar.vue'
import ResponsiveDataView from '@/components/ResponsiveDataView.vue'
import { usePerPage } from '@/lib/paging'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import SupplierFormModal from '@/components/purchasing/SupplierFormModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatUgx } from '@/lib/format'
import type { Paginated } from '@/types/inventory'
import type { Supplier, SupplierSummary } from '@/types/purchasing'

const router = useRouter()

const summary = ref<SupplierSummary | null>(null)
const page = ref<Paginated<Supplier> | null>(null)
const loading = ref(false)
const error = ref('')

const search = ref('')
const status = ref<'active' | 'inactive' | 'all'>('active')
const owingOnly = ref(false)
const pageNo = ref(1)
const perPage = usePerPage('suppliers')
const adding = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      status: status.value,
      page: String(pageNo.value),
      per_page: String(perPage.value),
    })
    if (search.value.trim()) params.set('search', search.value.trim())
    if (owingOnly.value) params.set('owing', '1')
    const res = await apiFetch<{ summary: SupplierSummary; suppliers: Paginated<Supplier> }>(
      `/suppliers?${params}`,
    )
    summary.value = res.summary
    page.value = res.suppliers
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(refilter, 250)
})
onUnmounted(() => clearTimeout(timer))

function refilter() {
  pageNo.value = 1
  void load()
}

function goTo(n: number) {
  pageNo.value = n
  void load()
}

function changeSize(n: number) {
  perPage.value = n
  refilter()
}

function created(supplier: Supplier) {
  adding.value = false
  void router.push(`/suppliers/${supplier.id}`)
}

onMounted(load)
</script>

<template>
  <main class="ui-page">
    <header class="ui-head">
      <div>
        <p class="ui-eyebrow">Purchasing</p>
        <h1>Suppliers</h1>
      </div>
      <div class="ui-actions">
        <button type="button" class="btn btn-primary" @click="adding = true">Add supplier</button>
      </div>
    </header>

    <section v-if="summary" class="cards">
      <div class="card stat">
        <p class="label">Suppliers</p>
        <p class="value">{{ summary.suppliers }}</p>
      </div>
      <div class="card stat">
        <p class="label">You owe</p>
        <p class="value" :class="{ owes: summary.total_owed > 0 }">
          {{ formatUgx(summary.total_owed) }}
        </p>
      </div>
      <div class="card stat">
        <p class="label">Suppliers owed</p>
        <p class="value">{{ summary.owing }}</p>
      </div>
    </section>

    <form class="ui-filters card" @submit.prevent="refilter">
      <div class="field grow">
        <label for="sf-search">Search</label>
        <input id="sf-search" v-model="search" type="search" placeholder="Name or phone" />
      </div>
      <div class="field">
        <label for="sf-status">Show</label>
        <select id="sf-status" v-model="status" @change="refilter">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>
      <div class="ui-chips">
        <button
          type="button"
          class="ui-chip"
          :class="{ active: owingOnly }"
          @click="((owingOnly = !owingOnly), refilter())"
        >
          Owed money
        </button>
      </div>
    </form>

    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div class="card ui-table-card">
      <p v-if="loading && !page" class="ui-state">Loading…</p>
      <div v-else-if="page && !page.data.length" class="ui-state">
        <p>No suppliers match.</p>
        <p v-if="!search && !owingOnly && status === 'active'">
          Add the people you buy stock from to record purchases and what you owe them.
        </p>
      </div>

      <ResponsiveDataView v-else-if="page">
        <template #table>
          <div class="ui-table-scroll">
            <table class="ui-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Phone</th>
              <th class="num">You owe</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="supplier in page.data" :key="supplier.id">
              <td><RouterLink class="link" :to="`/suppliers/${supplier.id}`">{{ supplier.name }}</RouterLink></td>
              <td :class="{ muted: !supplier.phone }">{{ supplier.phone ?? '—' }}</td>
              <td class="num" :class="{ owes: supplier.balance > 0 }">
                {{ supplier.balance > 0 ? formatUgx(supplier.balance) : '—' }}
              </td>
              <td>
                <span class="ui-badge" :class="{ ok: supplier.is_active }">
                  {{ supplier.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </tr>
          </tbody>
            </table>
          </div>
        </template>
        <template #mobile>
          <li v-for="supplier in page.data" :key="supplier.id" class="data-row">
            <div class="data-row-main">
              <RouterLink class="data-row-title link" :to="`/suppliers/${supplier.id}`">
                {{ supplier.name }}
              </RouterLink>
              <span v-if="supplier.balance > 0" class="data-row-value owes">
                {{ formatUgx(supplier.balance) }}
              </span>
            </div>
            <div class="data-row-meta">
              <span>{{ supplier.phone ?? 'No phone number' }}</span>
              <span v-if="supplier.balance <= 0">No outstanding balance</span>
            </div>
            <div class="data-row-footer">
              <span class="ui-badge" :class="{ ok: supplier.is_active }">
                {{ supplier.is_active ? 'Active' : 'Inactive' }}
              </span>
              <RouterLink class="data-row-action" :to="`/suppliers/${supplier.id}`">View supplier</RouterLink>
            </div>
          </li>
        </template>
      </ResponsiveDataView>

      <PaginationBar
        v-if="page"
        :page="page.current_page"
        :last-page="page.last_page"
        :total="page.total"
        :per-page="perPage"
        :disabled="loading"
        noun="suppliers"
        @update:page="goTo"
        @update:per-page="changeSize"
      />
    </div>

    <SupplierFormModal v-if="adding" @close="adding = false" @saved="created" />
  </main>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat {
  padding: 1rem 1.25rem;
}

.label {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.value {
  margin-top: 0.125rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.owes {
  color: var(--color-danger);
  font-weight: 600;
}

.value.owes {
  font-weight: 700;
}

@media (max-width: 720px) {
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>
