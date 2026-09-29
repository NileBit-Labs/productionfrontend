<script setup lang="ts">
import PaginationBar from '@/components/PaginationBar.vue'
import ResponsiveDataView from '@/components/ResponsiveDataView.vue'
import { usePerPage } from '@/lib/paging'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import CategoriesModal from '@/components/inventory/CategoriesModal.vue'
import ImportModal from '@/components/inventory/ImportModal.vue'
import ProductFormModal from '@/components/inventory/ProductFormModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatQuantity, formatUgx } from '@/lib/format'
import { useCategoriesStore } from '@/stores/categories'
import type { ManagedProduct, Paginated } from '@/types/inventory'

const categories = useCategoriesStore()

const page = ref<Paginated<ManagedProduct> | null>(null)
const loading = ref(false)
const error = ref('')
const notice = ref('')

const search = ref('')
const categoryId = ref('')
const status = ref<'active' | 'archived' | 'all'>('active')
const stockFilter = ref<'' | 'low' | 'out'>('')
const pageNo = ref(1)
const perPage = usePerPage('products')

const editing = ref<ManagedProduct | null>(null)
const adding = ref(false)
const showCategories = ref(false)
const showImport = ref(false)

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
    if (categoryId.value) params.set('category_id', categoryId.value)
    if (stockFilter.value === 'low') params.set('low_stock', '1')
    if (stockFilter.value === 'out') params.set('out_of_stock', '1')
    page.value = await apiFetch<Paginated<ManagedProduct>>(`/products?${params}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

// Typing in the search box shouldn't fire a request per keystroke.
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    pageNo.value = 1
    void load()
  }, 250)
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

function toggleStock(value: 'low' | 'out') {
  stockFilter.value = stockFilter.value === value ? '' : value
  refilter()
}

function saved(product: ManagedProduct) {
  notice.value = `${product.name} saved.`
  adding.value = false
  editing.value = null
  void load()
}

function imported(count: number) {
  showImport.value = false
  notice.value = `${count} product${count === 1 ? '' : 's'} imported.`
  void categories.load()
  refilter()
}

const margin = (p: ManagedProduct) =>
  p.selling_price > 0 ? Math.round(((p.selling_price - p.current_cost) / p.selling_price) * 100) : 0

onMounted(() => {
  void categories.load()
  void load()
})
</script>

<template>
  <main class="ui-page">
    <header class="ui-head">
      <div>
        <p class="ui-eyebrow">Catalog</p>
        <h1>Products</h1>
      </div>
      <div class="ui-actions">
        <button type="button" class="btn ui-btn-secondary" @click="showCategories = true">
          Categories
        </button>
        <button type="button" class="btn ui-btn-secondary" @click="showImport = true">
          Import
        </button>
        <button type="button" class="btn btn-primary" @click="adding = true">Add product</button>
      </div>
    </header>

    <form class="ui-filters card" @submit.prevent="refilter">
      <div class="field grow">
        <label for="pf-search">Search</label>
        <input id="pf-search" v-model="search" type="search" placeholder="Name, SKU or barcode" />
      </div>
      <div class="field">
        <label for="pf-cat">Category</label>
        <select id="pf-cat" v-model="categoryId" @change="refilter">
          <option value="">All categories</option>
          <option v-for="c in categories.list" :key="c.id" :value="String(c.id)">
            {{ c.name }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="pf-status">Show</label>
        <select id="pf-status" v-model="status" @change="refilter">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </div>
      <div class="ui-chips">
        <button
          type="button"
          class="ui-chip"
          :class="{ active: stockFilter === 'low' }"
          @click="toggleStock('low')"
        >
          Low stock
        </button>
        <button
          type="button"
          class="ui-chip"
          :class="{ active: stockFilter === 'out' }"
          @click="toggleStock('out')"
        >
          Out of stock
        </button>
      </div>
    </form>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div class="card ui-table-card">
      <p v-if="loading && !page" class="ui-state">Loading…</p>
      <div v-else-if="page && !page.data.length" class="ui-state">
        <p>No products match.</p>
        <p v-if="!search && !categoryId && !stockFilter && status === 'active'">
          Add your first product, or import a list from a spreadsheet.
        </p>
      </div>

      <ResponsiveDataView v-else-if="page">
        <template #table>
          <div class="ui-table-scroll">
            <table class="ui-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th class="num">Price</th>
              <th class="num">Cost</th>
              <th class="num">Margin</th>
              <th class="num">In stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="product in page.data" :key="product.id">
              <td>
                <button type="button" class="table-text-action" @click="editing = product">
                  {{ product.name }}
                </button>
                <small v-if="product.sku || product.barcode">
                  {{ [product.sku, product.barcode].filter(Boolean).join(' · ') }}
                </small>
              </td>
              <td :class="{ muted: !product.category }">
                {{ product.category ?? 'Uncategorised' }}
              </td>
              <td class="num">{{ formatUgx(product.selling_price) }}</td>
              <td class="num">{{ formatUgx(product.current_cost) }}</td>
              <td class="num">{{ margin(product) }}%</td>
              <td class="num">
                {{ formatQuantity(product.stock) }}
                <small>{{ product.base_unit }}</small>
              </td>
              <td>
                <span v-if="product.status === 'archived'" class="ui-badge">Archived</span>
                <span v-else-if="product.is_out" class="ui-badge bad">Out of stock</span>
                <span v-else-if="product.is_low" class="ui-badge warn">Low stock</span>
                <span v-else class="ui-badge ok">In stock</span>
              </td>
            </tr>
          </tbody>
            </table>
          </div>
        </template>
        <template #mobile>
          <li v-for="product in page.data" :key="product.id" class="data-row">
            <div class="data-row-main">
              <span class="data-row-title">{{ product.name }}</span>
              <span class="data-row-value">{{ formatUgx(product.selling_price) }}</span>
            </div>
            <p v-if="product.sku || product.barcode" class="data-row-meta">
              {{ [product.sku, product.barcode].filter(Boolean).join(' · ') }}
            </p>
            <div class="data-row-footer">
              <span class="data-row-meta">
                {{ formatQuantity(product.stock) }} {{ product.base_unit }}
                <span v-if="product.category">· {{ product.category }}</span>
              </span>
              <span v-if="product.status === 'archived'" class="ui-badge">Archived</span>
              <span v-else-if="product.is_out" class="ui-badge bad">Out of stock</span>
              <span v-else-if="product.is_low" class="ui-badge warn">Low stock</span>
              <span v-else class="ui-badge ok">In stock</span>
            </div>
            <button type="button" class="data-row-action" @click="editing = product">Edit product</button>
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
        noun="products"
        @update:page="goTo"
        @update:per-page="changeSize"
      />
    </div>

    <ProductFormModal v-if="adding" @close="adding = false" @saved="saved" />
    <ProductFormModal v-if="editing" :product="editing" @close="editing = null" @saved="saved" />
    <CategoriesModal v-if="showCategories" @close="showCategories = false" @changed="load" />
    <ImportModal v-if="showImport" @close="showImport = false" @imported="imported" />
  </main>
</template>

<style scoped>
.notice {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.875rem;
}

.ui-state p + p {
  margin-top: 0.25rem;
  font-size: 0.875rem;
}
</style>
