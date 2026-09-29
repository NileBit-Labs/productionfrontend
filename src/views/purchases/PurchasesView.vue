<script setup lang="ts">
import PaginationBar from '@/components/PaginationBar.vue'
import ResponsiveDataView from '@/components/ResponsiveDataView.vue'
import { usePerPage } from '@/lib/paging'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatUgx } from '@/lib/format'
import type { Paginated } from '@/types/inventory'
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONE,
  type PurchaseRow,
  type Supplier,
} from '@/types/purchasing'

const route = useRoute()

const page = ref<Paginated<PurchaseRow> | null>(null)
const suppliers = ref<Supplier[]>([])
const loading = ref(false)
const error = ref('')

const search = ref('')
const supplierId = ref(typeof route.query.supplier === 'string' ? route.query.supplier : '')
const status = ref('')
const from = ref('')
const to = ref('')
const pageNo = ref(1)
const perPage = usePerPage('purchases')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(pageNo.value),
      per_page: String(perPage.value),
    })
    if (search.value.trim()) params.set('search', search.value.trim())
    if (supplierId.value) params.set('supplier_id', supplierId.value)
    if (status.value) params.set('status', status.value)
    if (from.value) params.set('from', from.value)
    if (to.value) params.set('to', to.value)
    page.value = await apiFetch<Paginated<PurchaseRow>>(`/purchases?${params}`)
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

onMounted(async () => {
  void load()
  try {
    const res = await apiFetch<{ suppliers: Paginated<Supplier> }>('/suppliers?status=all')
    suppliers.value = res.suppliers.data
  } catch {
    // The list still works without the supplier filter.
  }
})
</script>

<template>
  <main class="ui-page">
    <header class="ui-head">
      <div>
        <p class="ui-eyebrow">Purchasing</p>
        <h1>Purchases</h1>
      </div>
      <div class="ui-actions">
        <RouterLink class="btn btn-primary" to="/purchases/new">New purchase</RouterLink>
      </div>
    </header>

    <form class="ui-filters card" @submit.prevent="refilter">
      <div class="field grow">
        <label for="pu-search">Search</label>
        <input
          id="pu-search"
          v-model="search"
          type="search"
          placeholder="Purchase number or invoice reference"
        />
      </div>
      <div class="field">
        <label for="pu-supplier">Supplier</label>
        <select id="pu-supplier" v-model="supplierId" @change="refilter">
          <option value="">All suppliers</option>
          <option v-for="s in suppliers" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
        </select>
      </div>
      <div class="field">
        <label for="pu-status">Status</label>
        <select id="pu-status" v-model="status" @change="refilter">
          <option value="">All</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div class="field">
        <label for="pu-from">From</label>
        <input id="pu-from" v-model="from" type="date" @change="refilter" />
      </div>
      <div class="field">
        <label for="pu-to">To</label>
        <input id="pu-to" v-model="to" type="date" @change="refilter" />
      </div>
    </form>

    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div class="card ui-table-card">
      <p v-if="loading && !page" class="ui-state">Loading…</p>
      <div v-else-if="page && !page.data.length" class="ui-state">
        <p>No purchases match.</p>
        <p v-if="!search && !supplierId && !status && !from && !to">
          Record stock you buy from a supplier and it is added to your inventory.
        </p>
      </div>

      <ResponsiveDataView v-else-if="page">
        <template #table>
          <div class="ui-table-scroll">
            <table class="ui-table">
          <thead>
            <tr>
              <th>Purchase</th>
              <th>Date</th>
              <th>Supplier</th>
              <th class="num">Total</th>
              <th class="num">Still owed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="purchase in page.data" :key="purchase.id">
              <td>
                <RouterLink class="link" :to="`/purchases/${purchase.id}`">
                  {{ purchase.purchase_number }}
                </RouterLink>
                <small>
                  {{ purchase.items_count }} item{{ purchase.items_count === 1 ? '' : 's' }}
                  <template v-if="purchase.reference"> · {{ purchase.reference }}</template>
                </small>
              </td>
              <td>{{ purchase.purchase_date }}</td>
              <td>{{ purchase.supplier.name }}</td>
              <td class="num">{{ formatUgx(purchase.total) }}</td>
              <td class="num" :class="{ muted: purchase.owed === 0 }">
                {{ purchase.owed > 0 ? formatUgx(purchase.owed) : '—' }}
              </td>
              <td>
                <span class="ui-badge" :class="PAYMENT_STATUS_TONE[purchase.payment_status]">
                  {{ PAYMENT_STATUS_LABELS[purchase.payment_status] }}
                </span>
              </td>
            </tr>
          </tbody>
            </table>
          </div>
        </template>
        <template #mobile>
          <li v-for="purchase in page.data" :key="purchase.id" class="data-row">
            <div class="data-row-main">
              <RouterLink class="data-row-title link" :to="`/purchases/${purchase.id}`">
                {{ purchase.purchase_number }}
              </RouterLink>
              <span class="data-row-value">{{ formatUgx(purchase.total) }}</span>
            </div>
            <div class="data-row-meta">
              <span>{{ purchase.supplier.name }}</span>
              <span>{{ purchase.purchase_date }}</span>
              <span>{{ purchase.items_count }} item{{ purchase.items_count === 1 ? '' : 's' }}</span>
            </div>
            <div class="data-row-footer">
              <span class="data-row-meta">
                {{ purchase.owed > 0 ? `Outstanding ${formatUgx(purchase.owed)}` : 'Paid in full' }}
              </span>
              <span class="ui-badge" :class="PAYMENT_STATUS_TONE[purchase.payment_status]">
                {{ PAYMENT_STATUS_LABELS[purchase.payment_status] }}
              </span>
            </div>
            <RouterLink class="data-row-action" :to="`/purchases/${purchase.id}`">View purchase</RouterLink>
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
        noun="purchases"
        @update:page="goTo"
        @update:per-page="changeSize"
      />
    </div>
  </main>
</template>
