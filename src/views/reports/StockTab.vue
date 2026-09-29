<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import StatTile from '@/components/reports/StatTile.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatQuantity, formatUgx } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import type { StockReport, StockStatus } from '@/types/reports'

const auth = useAuthStore()

const report = ref<StockReport | null>(null)
const loading = ref(false)
const error = ref('')
const status = ref<StockStatus | ''>('')
const search = ref('')
const page = ref(1)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value) })
    if (status.value) params.set('status', status.value)
    if (search.value.trim()) params.set('q', search.value.trim())
    report.value = await apiFetch<StockReport>(`/reports/stock?${params}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})
onUnmounted(() => clearTimeout(timer))

function choose(next: StockStatus | '') {
  status.value = next
  page.value = 1
  void load()
}

function go(delta: number) {
  page.value += delta
  void load()
}

onMounted(load)

const s = computed(() => report.value?.summary)
const chips = computed<{ key: StockStatus | ''; label: string; count?: number }[]>(() => [
  { key: '', label: 'All', count: s.value?.products },
  { key: 'out', label: 'Out of stock', count: s.value?.out },
  { key: 'low', label: 'Running low', count: s.value?.low },
  {
    key: 'ok',
    label: 'Fine',
    count: s.value ? s.value.products - s.value.out - s.value.low : undefined,
  },
])

const label: Record<StockStatus, string> = { out: 'Out', low: 'Low', ok: 'Fine' }
const withValue = computed(() => auth.isOwner)
</script>

<template>
  <div class="rp">
    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
    <p v-if="!report && loading" class="rp-empty">Counting the shelves…</p>

    <template v-if="report && s">
      <section class="rp-tiles">
        <StatTile
          label="Products"
          :value="String(s.products)"
          hint="Active products"
          icon="products"
        />
        <StatTile
          label="Out of stock"
          :value="String(s.out)"
          :hint="s.out ? 'Customers cannot buy these' : 'Nothing is out'"
          :trend="s.out ? 'down' : null"
          icon="inventory"
        />
        <StatTile
          label="Running low"
          :value="String(s.low)"
          hint="At or under their own low-stock level"
          icon="purchases"
        />
        <StatTile
          v-if="withValue && s.value_at_cost !== undefined"
          label="Stock value"
          :value="formatUgx(s.value_at_cost)"
          :hint="`${formatUgx(s.value_at_retail ?? 0)} at selling prices`"
          icon="credit"
        />
        <StatTile
          v-else
          label="In stock"
          :value="String(s.in_stock)"
          hint="Products with some on the shelf"
          icon="credit"
        />
      </section>

      <section class="card rp-panel">
        <div class="tools">
          <div class="chips" role="group" aria-label="Show">
            <button
              v-for="c in chips"
              :key="c.key"
              type="button"
              class="chip"
              :class="{ on: status === c.key }"
              @click="choose(c.key)"
            >
              {{ c.label }}<span v-if="c.count !== undefined" class="count">{{ c.count }}</span>
            </button>
          </div>
          <input
            v-model="search"
            type="search"
            class="search"
            placeholder="Search name, SKU or barcode"
            aria-label="Search products"
          />
        </div>

        <p v-if="!report.page.data.length" class="rp-empty">No products match.</p>
        <div v-else class="rp-scroll" :class="{ dim: loading }">
          <table class="rp-table">
            <thead>
              <tr>
                <th>Product</th>
                <th class="num">On hand</th>
                <th class="num">Low-stock level</th>
                <th>Status</th>
                <th v-if="withValue" class="num">Value at cost</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in report.page.data" :key="p.id">
                <td class="clip">
                  {{ p.name }}
                  <span v-if="p.sku" class="rp-meta"> · {{ p.sku }}</span>
                </td>
                <td class="num strong" :class="{ neg: p.stock <= 0 }">
                  {{ formatQuantity(p.stock) }} <span class="rp-meta">{{ p.unit }}</span>
                </td>
                <td class="num">
                  {{ p.low_stock_level ? formatQuantity(p.low_stock_level) : '—' }}
                </td>
                <td>
                  <span class="rp-pill" :class="p.status">{{ label[p.status] }}</span>
                </td>
                <td v-if="withValue" class="num">{{ formatUgx(p.value_at_cost ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="report.page.last_page > 1" class="rp-pager">
          <button type="button" class="rp-quiet" :disabled="page <= 1 || loading" @click="go(-1)">
            Previous
          </button>
          <span class="rp-meta">
            Page {{ report.page.current_page }} of {{ report.page.last_page }} ·
            {{ report.page.total }} products
          </span>
          <button
            type="button"
            class="rp-quiet"
            :disabled="page >= report.page.last_page || loading"
            @click="go(1)"
          >
            Next
          </button>
        </div>
      </section>

      <p class="rp-note">
        <b>How this is worked out.</b> On hand is every stock movement added up (deliveries in,
        sales and losses out), as of right now. A product is out at zero or below, and low when it
        is at or under the low-stock level set for that product.
        <template v-if="withValue">
          Value counts only stock actually on the shelf, at what it cost you.
        </template>
      </p>
    </template>
  </div>
</template>

<style scoped>
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.chip:hover {
  border-color: var(--color-primary);
}

.chip.on {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.count {
  font-size: 0.75rem;
  opacity: 0.75;
}

.search {
  min-width: 240px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.875rem;
}

.search:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.dim {
  opacity: 0.6;
}
</style>
