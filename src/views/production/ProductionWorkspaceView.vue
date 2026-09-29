<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatQuantity, formatUgx } from '@/lib/format'

type Workspace = {
  eyebrow: string
  title: string
  description: string
  endpoint: string
  createLabel: string
  columns: { key: string; label: string; kind?: 'money' | 'quantity' }[]
  empty: string
}

const WORKSPACES: Record<string, Workspace> = {
  'raw-materials': {
    eyebrow: 'Production inventory', title: 'Raw materials',
    description: 'Track ingredients, packaging and measurement units separately from finished goods.',
    endpoint: '/production/raw-materials', createLabel: 'Add raw material',
    columns: [{ key: 'name', label: 'Material' }, { key: 'unit', label: 'Unit' }, { key: 'on_hand', label: 'On hand', kind: 'quantity' }, { key: 'reorder_level', label: 'Reorder level', kind: 'quantity' }],
    empty: 'No raw materials yet. Add the ingredients and packaging used in production.',
  },
  recipes: {
    eyebrow: 'Production planning', title: 'Recipes & BOMs',
    description: 'Define the materials and quantities needed to make each finished product.',
    endpoint: '/production/recipes', createLabel: 'Create recipe',
    columns: [{ key: 'name', label: 'Recipe' }, { key: 'product_name', label: 'Finished product' }, { key: 'yield_quantity', label: 'Expected yield', kind: 'quantity' }, { key: 'ingredients_count', label: 'Ingredients', kind: 'quantity' }],
    empty: 'No recipes yet. Create a bill of materials before recording a batch.',
  },
  batches: {
    eyebrow: 'Production operations', title: 'Production batches',
    description: 'Record production, actual consumption, output, wastage, and batch traceability.',
    endpoint: '/production/batches', createLabel: 'Start batch',
    columns: [{ key: 'batch_number', label: 'Batch' }, { key: 'recipe_name', label: 'Recipe' }, { key: 'status', label: 'Status' }, { key: 'production_date', label: 'Produced' }, { key: 'saleable_output', label: 'Saleable output', kind: 'quantity' }],
    empty: 'No batches recorded. Start a batch once a recipe is ready.',
  },
  traceability: {
    eyebrow: 'Quality & traceability', title: 'Batch & expiry traceability',
    description: 'Find finished goods by batch number, production date, and expiry date.',
    endpoint: '/production/traceability', createLabel: 'View batches',
    columns: [{ key: 'batch_number', label: 'Batch' }, { key: 'product_name', label: 'Finished product' }, { key: 'produced_at', label: 'Produced' }, { key: 'expires_at', label: 'Expires' }, { key: 'quantity', label: 'Available', kind: 'quantity' }],
    empty: 'No traceable finished-goods batches are available yet.',
  },
  profitability: {
    eyebrow: 'Production intelligence', title: 'Costing & profitability',
    description: 'Review material, packaging, labour and direct-cost totals against saleable output.',
    endpoint: '/production/profitability', createLabel: 'View reports',
    columns: [{ key: 'batch_number', label: 'Batch' }, { key: 'product_name', label: 'Finished product' }, { key: 'batch_cost', label: 'Batch cost', kind: 'money' }, { key: 'unit_cost', label: 'Unit cost', kind: 'money' }, { key: 'gross_profit', label: 'Gross profit', kind: 'money' }],
    empty: 'Costing appears here once a production batch has been completed.',
  },
}

const route = useRoute()
const workspace = computed(() => WORKSPACES[String(route.name)] ?? WORKSPACES['raw-materials']!)
const rows = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const error = ref('')

function display(value: unknown, kind?: 'money' | 'quantity') {
  if (value === null || value === undefined || value === '') return '—'
  if (kind === 'money') return formatUgx(Number(value))
  if (kind === 'quantity') return formatQuantity(Number(value))
  return String(value)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await apiFetch<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>(workspace.value.endpoint)
    rows.value = Array.isArray(response) ? response : (response.data ?? [])
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">{{ workspace.eyebrow }}</p>
        <h1>{{ workspace.title }}</h1>
        <p class="intro">{{ workspace.description }}</p>
      </div>
      <button type="button" class="btn btn-primary" disabled :title="`${workspace.createLabel} is enabled when the Production API is connected`">
        {{ workspace.createLabel }}
      </button>
    </header>

    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
    <section class="card table-card">
      <div class="table-head">
        <p>Live production data</p>
        <button type="button" class="link" :disabled="loading" @click="load">{{ loading ? 'Refreshing…' : 'Refresh' }}</button>
      </div>
      <p v-if="loading && !rows.length" class="ui-state">Loading production data…</p>
      <p v-else-if="!rows.length" class="ui-state">{{ workspace.empty }}</p>
      <div v-else class="table-scroll">
        <table>
          <thead><tr><th v-for="column in workspace.columns" :key="column.key">{{ column.label }}</th></tr></thead>
          <tbody><tr v-for="(row, index) in rows" :key="String(row.id ?? index)"><td v-for="column in workspace.columns" :key="column.key">{{ display(row[column.key], column.kind) }}</td></tr></tbody>
        </table>
      </div>
    </section>
    <p class="note">This screen is ready for the Production API contract and does not alter retail inventory, sales, customer, or staff data.</p>
  </main>
</template>

<style scoped>
.page { flex: 1; width: 100%; max-width: 1680px; margin: 0 auto; padding: 2rem; display: flex; flex-direction: column; gap: 1.25rem; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; }
.eyebrow { font-size: .75rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--color-primary); }
h1 { margin-top: .25rem; font-size: 1.5rem; }
.intro { max-width: 42rem; margin-top: .5rem; color: var(--color-ink-soft); }
.table-card { overflow: hidden; }
.table-head { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-border); font-size: .875rem; font-weight: 600; }
.link { border: 0; background: transparent; color: var(--color-primary); cursor: pointer; font: inherit; }
.link:disabled { opacity: .55; cursor: wait; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .875rem; }
th, td { padding: .875rem 1.25rem; border-bottom: 1px solid var(--color-border); text-align: left; white-space: nowrap; }
th { color: var(--color-ink-faint); font-size: .6875rem; letter-spacing: .04em; text-transform: uppercase; }
tbody tr:last-child td { border-bottom: 0; }
.note { color: var(--color-ink-faint); font-size: .8125rem; }
@media (max-width: 720px) { .page { padding: 1.25rem 1rem; } .page-head { align-items: stretch; flex-direction: column; } .page-head .btn { width: 100%; min-height: 44px; } }
</style>
