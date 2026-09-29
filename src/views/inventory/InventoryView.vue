<script setup lang="ts">
import PaginationBar from '@/components/PaginationBar.vue'
import ResponsiveDataView from '@/components/ResponsiveDataView.vue'
import { usePerPage } from '@/lib/paging'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StockActionModal from '@/components/inventory/StockActionModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime, formatQuantity, formatUgx } from '@/lib/format'
import { useCategoriesStore } from '@/stores/categories'
import {
  MOVEMENT_LABELS,
  type InventorySummary,
  type ManagedProduct,
  type Movement,
  type MovementType,
  type Paginated,
} from '@/types/inventory'

const route = useRoute()
const router = useRouter()
const categories = useCategoriesStore()

const tab = ref<'stock' | 'history'>(route.query.product ? 'history' : 'stock')

// ---- Stock levels ----
const summary = ref<InventorySummary | null>(null)
const stock = ref<Paginated<ManagedProduct> | null>(null)
const search = ref('')
const categoryId = ref('')
const filter = ref<'' | 'low' | 'out'>('')
const stockPage = ref(1)
const stockPerPage = usePerPage('inventory-stock')

// ---- History ----
const movements = ref<Paginated<Movement> | null>(null)
const movementType = ref('')
const from = ref('')
const to = ref('')
const historyPage = ref(1)
const historyPerPage = usePerPage('inventory-history')
const productFilter = ref<{ id: number; name: string } | null>(null)

const loading = ref(false)
const error = ref('')
const notice = ref('')
const acting = ref<ManagedProduct | null>(null)

async function loadStock() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(stockPage.value),
      per_page: String(stockPerPage.value),
    })
    if (search.value.trim()) params.set('search', search.value.trim())
    if (categoryId.value) params.set('category_id', categoryId.value)
    if (filter.value) params.set('filter', filter.value)
    const res = await apiFetch<{ summary: InventorySummary; products: Paginated<ManagedProduct> }>(
      `/inventory?${params}`,
    )
    summary.value = res.summary
    stock.value = res.products
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(historyPage.value),
      per_page: String(historyPerPage.value),
    })
    if (productFilter.value) params.set('product_id', String(productFilter.value.id))
    if (movementType.value) params.set('type', movementType.value)
    if (from.value) params.set('from', from.value)
    if (to.value) params.set('to', to.value)
    movements.value = await apiFetch<Paginated<Movement>>(`/inventory/movements?${params}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

const reload = () => (tab.value === 'stock' ? loadStock() : loadHistory())

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    stockPage.value = 1
    void loadStock()
  }, 250)
})
onUnmounted(() => clearTimeout(timer))

function refilterStock() {
  stockPage.value = 1
  void loadStock()
}

function changeStockSize(n: number) {
  stockPerPage.value = n
  refilterStock()
}

function changeHistorySize(n: number) {
  historyPerPage.value = n
  refilterHistory()
}

function refilterHistory() {
  historyPage.value = 1
  void loadHistory()
}

function toggle(value: 'low' | 'out') {
  filter.value = filter.value === value ? '' : value
  refilterStock()
}

function showTab(next: 'stock' | 'history') {
  tab.value = next
  notice.value = ''
  void reload()
}

async function showHistoryFor(product: ManagedProduct) {
  notice.value = ''
  productFilter.value = { id: product.id, name: product.name }
  await router.replace({ query: { product: String(product.id) } })
  tab.value = 'history'
  refilterHistory()
}

async function clearProduct() {
  productFilter.value = null
  await router.replace({ query: {} })
  refilterHistory()
}

function updated() {
  const name = acting.value?.name
  acting.value = null
  notice.value = `Stock updated for ${name}.`
  void loadStock()
}

const referenceText = (m: Movement) => {
  if (!m.reference) return ''
  const kind = m.reference.type === 'Sale' ? 'Sale' : m.reference.type
  return m.reference.label ? `${kind} ${m.reference.label}` : kind
}

const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatQuantity(Math.abs(n))
const types = computed(() => Object.entries(MOVEMENT_LABELS) as [MovementType, string][])

onMounted(async () => {
  void categories.load()
  const id = Number(route.query.product)
  if (id) {
    try {
      const p = await apiFetch<ManagedProduct>(`/products/${id}`)
      productFilter.value = { id: p.id, name: p.name }
    } catch {
      // A stale link just shows the whole history.
    }
  }
  void reload()
  if (tab.value === 'history') void loadStock()
})
</script>

<template>
  <main class="ui-page">
    <header class="ui-head">
      <div>
        <p class="ui-eyebrow">Catalog</p>
        <h1>Inventory</h1>
      </div>
      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'stock'"
          :class="{ active: tab === 'stock' }"
          @click="showTab('stock')"
        >
          Stock levels
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'history'"
          :class="{ active: tab === 'history' }"
          @click="showTab('history')"
        >
          History
        </button>
      </div>
    </header>

    <section v-if="summary" class="cards">
      <div class="card stat">
        <p class="label">Products</p>
        <p class="value">{{ summary.items }}</p>
      </div>
      <div class="card stat">
        <p class="label">Stock value (at cost)</p>
        <p class="value">{{ formatUgx(summary.stock_value) }}</p>
      </div>
      <div class="card stat" :class="{ warn: summary.low_stock > 0 }">
        <p class="label">Running low</p>
        <p class="value">{{ summary.low_stock }}</p>
      </div>
      <div class="card stat" :class="{ bad: summary.out_of_stock > 0 }">
        <p class="label">Out of stock</p>
        <p class="value">{{ summary.out_of_stock }}</p>
      </div>
    </section>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="error" class="alert-danger">{{ error }}</p>

    <!-- Stock levels -->
    <template v-if="tab === 'stock'">
      <form class="ui-filters card" @submit.prevent="refilterStock">
        <div class="field grow">
          <label for="i-search">Search</label>
          <input id="i-search" v-model="search" type="search" placeholder="Name, SKU or barcode" />
        </div>
        <div class="field">
          <label for="i-cat">Category</label>
          <select id="i-cat" v-model="categoryId" @change="refilterStock">
            <option value="">All categories</option>
            <option v-for="c in categories.list" :key="c.id" :value="String(c.id)">
              {{ c.name }}
            </option>
          </select>
        </div>
        <div class="ui-chips">
          <button
            type="button"
            class="ui-chip"
            :class="{ active: filter === 'low' }"
            @click="toggle('low')"
          >
            Low stock
          </button>
          <button
            type="button"
            class="ui-chip"
            :class="{ active: filter === 'out' }"
            @click="toggle('out')"
          >
            Out of stock
          </button>
        </div>
      </form>

      <div class="card ui-table-card">
        <p v-if="loading && !stock" class="ui-state">Loading…</p>
        <p v-else-if="stock && !stock.data.length" class="ui-state">No products match.</p>

        <ResponsiveDataView v-else-if="stock">
          <template #table>
            <div class="ui-table-scroll">
              <table class="ui-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th class="num">In stock</th>
                <th class="num">Reorder at</th>
                <th class="num">Value</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in stock.data" :key="product.id">
                <td>{{ product.name }}</td>
                <td :class="{ muted: !product.category }">{{ product.category ?? '—' }}</td>
                <td class="num">
                  <strong>{{ formatQuantity(product.stock) }}</strong>
                  <small>{{ product.base_unit }}</small>
                </td>
                <td class="num muted">
                  {{
                    product.low_stock_threshold ? formatQuantity(product.low_stock_threshold) : '—'
                  }}
                </td>
                <td class="num">{{ formatUgx(product.stock_value) }}</td>
                <td>
                  <span v-if="product.is_out" class="ui-badge bad">Out of stock</span>
                  <span v-else-if="product.is_low" class="ui-badge warn">Low stock</span>
                  <span v-else class="ui-badge ok">In stock</span>
                </td>
                <td class="num">
                  <div class="row-actions">
                    <button type="button" class="link" @click="acting = product">Update</button>
                    <button type="button" class="link" @click="showHistoryFor(product)">
                      History
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
              </table>
            </div>
          </template>
          <template #mobile>
            <li v-for="product in stock.data" :key="product.id" class="data-row">
              <div class="data-row-main">
                <span class="data-row-title">{{ product.name }}</span>
                <span class="data-row-value">
                  {{ formatQuantity(product.stock) }} {{ product.base_unit }}
                </span>
              </div>
              <div class="data-row-meta">
                <span>{{ product.category ?? 'Uncategorised' }}</span>
                <span>
                  Reorder at
                  {{ product.low_stock_threshold ? formatQuantity(product.low_stock_threshold) : '—' }}
                </span>
                <span>{{ formatUgx(product.stock_value) }}</span>
              </div>
              <div class="data-row-footer">
                <span v-if="product.is_out" class="ui-badge bad">Out of stock</span>
                <span v-else-if="product.is_low" class="ui-badge warn">Low stock</span>
                <span v-else class="ui-badge ok">In stock</span>
                <button type="button" class="data-row-action" @click="acting = product">Update stock</button>
                <button type="button" class="data-row-action" @click="showHistoryFor(product)">History</button>
              </div>
            </li>
          </template>
        </ResponsiveDataView>

        <PaginationBar
          v-if="stock"
          :page="stock.current_page"
          :last-page="stock.last_page"
          :total="stock.total"
          :per-page="stockPerPage"
          :disabled="loading"
          noun="products"
          @update:page="
            (n) => {
              stockPage = n
              loadStock()
            }
          "
          @update:per-page="changeStockSize"
        />
      </div>
    </template>

    <!-- History -->
    <template v-else>
      <form class="ui-filters card" @submit.prevent="refilterHistory">
        <div v-if="productFilter" class="field">
          <label>Product</label>
          <span class="pill">
            {{ productFilter.name }}
            <button type="button" aria-label="Show all products" @click="clearProduct">×</button>
          </span>
        </div>
        <div class="field">
          <label for="h-type">Type</label>
          <select id="h-type" v-model="movementType" @change="refilterHistory">
            <option value="">All movements</option>
            <option v-for="[value, label] in types" :key="value" :value="value">{{ label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="h-from">From</label>
          <input id="h-from" v-model="from" type="date" @change="refilterHistory" />
        </div>
        <div class="field">
          <label for="h-to">To</label>
          <input id="h-to" v-model="to" type="date" @change="refilterHistory" />
        </div>
      </form>

      <div class="card ui-table-card">
        <p v-if="loading && !movements" class="ui-state">Loading…</p>
        <p v-else-if="movements && !movements.data.length" class="ui-state">
          No stock movements match.
        </p>

        <ResponsiveDataView v-else-if="movements">
          <template #table>
            <div class="ui-table-scroll">
              <table class="ui-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th>What happened</th>
                <th class="num">Change</th>
                <th>Note</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in movements.data" :key="m.id">
                <td>{{ formatDateTime(m.created_at) }}</td>
                <td>{{ m.product_name }}</td>
                <td>
                  {{ MOVEMENT_LABELS[m.type] ?? m.type }}
                  <small v-if="m.reference">{{ referenceText(m) }}</small>
                </td>
                <td class="num" :class="m.quantity_delta < 0 ? 'out' : 'in'">
                  {{ signed(m.quantity_delta) }} <small>{{ m.unit }}</small>
                </td>
                <td class="note" :class="{ muted: !m.reason }">{{ m.reason ?? '—' }}</td>
                <td>{{ m.performed_by }}</td>
              </tr>
            </tbody>
              </table>
            </div>
          </template>
          <template #mobile>
            <li v-for="m in movements.data" :key="m.id" class="data-row">
              <div class="data-row-main">
                <span class="data-row-title">{{ m.product_name }}</span>
                <span class="data-row-value" :class="m.quantity_delta < 0 ? 'out' : 'in'">
                  {{ signed(m.quantity_delta) }} {{ m.unit }}
                </span>
              </div>
              <div class="data-row-meta">
                <span>{{ formatDateTime(m.created_at) }}</span>
                <span>{{ MOVEMENT_LABELS[m.type] ?? m.type }}</span>
                <span v-if="m.reference">{{ referenceText(m) }}</span>
              </div>
              <div class="data-row-footer">
                <span class="data-row-meta">{{ m.reason ?? 'No note' }}</span>
                <span class="data-row-meta">{{ m.performed_by }}</span>
              </div>
            </li>
          </template>
        </ResponsiveDataView>

        <PaginationBar
          v-if="movements"
          :page="movements.current_page"
          :last-page="movements.last_page"
          :total="movements.total"
          :per-page="historyPerPage"
          :disabled="loading"
          noun="movements"
          @update:page="
            (n) => {
              historyPage = n
              loadHistory()
            }
          "
          @update:per-page="changeHistorySize"
        />
      </div>
    </template>

    <StockActionModal v-if="acting" :product="acting" @close="acting = null" @done="updated" />
  </main>
</template>

<style scoped>
.tabs {
  display: flex;
  padding: 3px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
}

.tabs button {
  min-height: 34px;
  padding: 0 1rem;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.tabs button.active {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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

.stat.warn .value {
  color: #b45309;
}

.stat.bad .value {
  color: var(--color-danger);
}

.notice {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.875rem;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.row-actions .link {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  cursor: pointer;
}

.in {
  color: var(--color-primary);
  font-weight: 600;
}

.out {
  color: var(--color-danger);
  font-weight: 600;
}

.note {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 40px;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
}

.pill button {
  border: none;
  background: none;
  color: var(--color-ink-faint);
  font-size: 1.125rem;
  cursor: pointer;
}

@media (max-width: 860px) {
  .cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .cards {
    grid-template-columns: 1fr;
  }

  .value {
    overflow-wrap: anywhere;
  }

  .tabs {
    width: 100%;
  }

  .tabs button {
    flex: 1;
    min-width: 0;
    padding: 0 0.625rem;
  }
}
</style>
