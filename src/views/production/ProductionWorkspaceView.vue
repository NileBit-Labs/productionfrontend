<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatQuantity, formatUgx, localDate } from '@/lib/format'

type ProductKind = 'raw_material' | 'packaging' | 'finished_good'
type Product = { id: number; name: string; kind: ProductKind; base_unit: string; stock: number; current_cost: number; selling_price: number; family?: string | null; size_label?: string | null; output_equivalent?: number | null; shelf_life_days?: number | null; is_low?: boolean; is_out?: boolean }
type RecipeItem = { product_id: number; quantity: number; note?: string }
type Recipe = { id: number; name: string; family?: string | null; yield_quantity: number; yield_unit: string; instructions?: string | null; status: 'active' | 'archived'; items: RecipeItem[] }
type Output = { product_id: number; product_name: string; quantity: number; unit_cost?: number; output_equivalent?: number; lot_id?: number; remaining_quantity?: number; expiry_date?: string | null }
type Batch = { id: number; batch_number: string; name: string; status: 'draft' | 'completed' | 'cancelled'; recipe?: { id: number; name: string } | null; production_date: string; expiry_date?: string | null; total_cost: number; output_quantity: number; yield_unit?: string; outputs: Output[]; inputs?: Array<{ product_id: number; product_name: string; actual_quantity?: number | null; planned_quantity?: number | null; unit: string }>; costs?: Record<string, number>; notes?: string | null }
type Unit = { id: number; name: string; symbol: string; dimension: string }
type Page<T> = { data: T[] }
type ModalName = 'product' | 'recipe' | 'batch' | 'unit' | 'wastage' | 'detail' | null

const route = useRoute()
const section = computed(() => String(route.name))
const copy = computed(() => ({
  'raw-materials': { eyebrow: 'Production inventory', title: 'Materials & finished goods', description: 'Manage ingredients, packaging and finished products used in production.', action: 'Add product' },
  recipes: { eyebrow: 'Production planning', title: 'Recipes & BOMs', description: 'Define repeatable recipes and the materials required for each yield.', action: 'Create recipe' },
  batches: { eyebrow: 'Production operations', title: 'Production batches', description: 'Plan a run, record actual inputs, then complete it with traceable outputs.', action: 'Start batch' },
  traceability: { eyebrow: 'Quality & traceability', title: 'Batch & lot traceability', description: 'Review production lots, expiry and authoritative remaining quantities.', action: 'Record wastage' },
  profitability: { eyebrow: 'Production intelligence', title: 'Costing & profitability', description: 'See completed batch costs, unit cost and stock at risk.', action: 'Refresh report' },
}[section.value] ?? { eyebrow: 'Production', title: 'Production', description: '', action: 'Refresh' }))

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const modal = ref<ModalName>(null)
const productKind = ref<ProductKind>('raw_material')
const products = ref<Product[]>([])
const recipes = ref<Recipe[]>([])
const batches = ref<Batch[]>([])
const units = ref<Unit[]>([])
const report = ref<Record<string, unknown> | null>(null)
const selectedBatch = ref<Batch | null>(null)
const editingProduct = ref<Product | null>(null)
const editingRecipe = ref<Recipe | null>(null)

const productForm = reactive({ name: '', kind: 'raw_material' as ProductKind, base_unit: 'piece', selling_price: 0, current_cost: 0, low_stock_threshold: 0, opening_stock: 0, family: '', size_label: '', output_equivalent: null as number | null, shelf_life_days: null as number | null })
const recipeForm = reactive({ name: '', family: '', yield_quantity: 1, yield_unit: 'piece', instructions: '', items: [] as RecipeItem[] })
const batchForm = reactive({ recipe_id: 0, name: '', production_date: localDate(), expiry_date: '', planned_yield: 1, yield_unit: 'piece', notes: '', inputs: [] as Array<{ product_id: number; actual_quantity: number }>, outputs: [] as Array<{ product_id: number; quantity: number; output_equivalent?: number; expiry_date?: string }>, direct_expenses: [] as Array<{ type: 'direct_labour' | 'direct_production'; category: string; amount: number; description: string }>, wastage: [] as Array<{ product_id: number; quantity: number; reason: string }> })
const unitForm = reactive({ name: '', symbol: '', dimension: 'count' })
const wastageForm = reactive({ product_id: 0, quantity: 1, reason: '', wastage_date: localDate() })

const materials = computed(() => products.value.filter((p) => p.kind !== 'finished_good'))
const finishedGoods = computed(() => products.value.filter((p) => p.kind === 'finished_good'))
const groupedProducts = computed(() => products.value.filter((p) => p.kind === productKind.value))
const completedBatches = computed(() => batches.value.filter((b) => b.status === 'completed'))

function statusTone(product: Product) {
  if (product.is_out || product.stock <= 0) return 'bad'
  return product.is_low ? 'warn' : 'ok'
}

function productStatus(product: Product) {
  if (product.is_out || product.stock <= 0) return 'Out of stock'
  return product.is_low ? 'Low stock' : 'In stock'
}

function batchTone(status: Batch['status']) {
  return status === 'completed' ? 'ok' : status === 'cancelled' ? 'bad' : 'warn'
}

async function loadProducts() {
  products.value = (await apiFetch<Page<Product>>('/products?status=active&per_page=100')).data
}

async function loadRecipes() {
  recipes.value = (await apiFetch<Page<Recipe>>('/recipes?status=all&per_page=100')).data
}

async function loadBatches() {
  batches.value = (await apiFetch<Page<Batch>>('/production/batches?per_page=100')).data
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([
      loadProducts(),
      loadRecipes(),
      loadBatches(),
      apiFetch<Unit[]>('/measurement-units').then((value) => { units.value = value }),
    ])
    if (section.value === 'profitability') report.value = await apiFetch<Record<string, unknown>>('/reports/production')
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function resetProduct() {
  editingProduct.value = null
  Object.assign(productForm, { name: '', kind: productKind.value, base_unit: units.value[0]?.symbol ?? 'piece', selling_price: 0, current_cost: 0, low_stock_threshold: 0, opening_stock: 0, family: '', size_label: '', output_equivalent: null, shelf_life_days: null })
}

function openProduct(product?: Product) {
  resetProduct()
  editingProduct.value = product ?? null
  if (product) Object.assign(productForm, product)
  modal.value = 'product'
}

async function saveProduct() {
  saving.value = true
  error.value = ''
  try {
    const body = { ...productForm, family: productForm.family || null, size_label: productForm.size_label || null, output_equivalent: productForm.output_equivalent || null, shelf_life_days: productForm.shelf_life_days || null }
    await apiFetch(editingProduct.value ? `/products/${editingProduct.value.id}` : '/products', { method: editingProduct.value ? 'PATCH' : 'POST', body })
    notice.value = editingProduct.value ? 'Product updated.' : 'Product created.'
    modal.value = null
    await loadProducts()
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

function resetRecipe() {
  editingRecipe.value = null
  Object.assign(recipeForm, { name: '', family: '', yield_quantity: 1, yield_unit: units.value[0]?.symbol ?? 'piece', instructions: '', items: [{ product_id: materials.value[0]?.id ?? 0, quantity: 1, note: '' }] })
}

function openRecipe(recipe?: Recipe) {
  resetRecipe()
  editingRecipe.value = recipe ?? null
  if (recipe) Object.assign(recipeForm, { ...recipe, family: recipe.family ?? '', instructions: recipe.instructions ?? '', items: recipe.items.map((item) => ({ ...item, note: item.note ?? '' })) })
  modal.value = 'recipe'
}

async function saveRecipe() {
  saving.value = true
  error.value = ''
  try {
    const body = { ...recipeForm, family: recipeForm.family || null, instructions: recipeForm.instructions || null, items: recipeForm.items.filter((item) => item.product_id > 0) }
    await apiFetch(editingRecipe.value ? `/recipes/${editingRecipe.value.id}` : '/recipes', { method: editingRecipe.value ? 'PATCH' : 'POST', body })
    notice.value = editingRecipe.value ? 'Recipe updated.' : 'Recipe created.'
    modal.value = null
    await loadRecipes()
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

function resetBatch() {
  Object.assign(batchForm, { recipe_id: recipes.value.find((recipe) => recipe.status === 'active')?.id ?? 0, name: '', production_date: localDate(), expiry_date: '', planned_yield: 1, yield_unit: units.value[0]?.symbol ?? 'piece', notes: '', inputs: [], outputs: [], direct_expenses: [], wastage: [] })
  loadRecipeIntoBatch()
}

function openBatchForm() {
  resetBatch()
  modal.value = 'batch'
}

function loadRecipeIntoBatch() {
  const recipe = recipes.value.find((item) => item.id === batchForm.recipe_id)
  if (!recipe) return
  batchForm.name = recipe.name
  batchForm.planned_yield = recipe.yield_quantity
  batchForm.yield_unit = recipe.yield_unit
  batchForm.inputs = recipe.items.map((item) => ({ product_id: item.product_id, actual_quantity: item.quantity }))
}

function addOutput() {
  batchForm.outputs.push({ product_id: finishedGoods.value[0]?.id ?? 0, quantity: 1 })
}

function addDirectExpense() {
  batchForm.direct_expenses.push({ type: 'direct_labour', category: 'Production labour', amount: 0, description: '' })
}

function addBatchWastage() {
  batchForm.wastage.push({ product_id: materials.value[0]?.id ?? 0, quantity: 1, reason: '' })
}

async function saveBatch(complete: boolean) {
  saving.value = true
  error.value = ''
  try {
    const body = { ...batchForm, recipe_id: batchForm.recipe_id || null, expiry_date: batchForm.expiry_date || null, inputs: batchForm.inputs.filter((item) => item.product_id > 0), outputs: batchForm.outputs.filter((item) => item.product_id > 0), direct_expenses: batchForm.direct_expenses.filter((item) => item.amount > 0), wastage: batchForm.wastage.filter((item) => item.product_id > 0 && item.quantity > 0) }
    const draft = await apiFetch<Batch>('/production/batches', { method: 'POST', body: { ...body, inputs: body.inputs.map((item) => ({ product_id: item.product_id, planned_quantity: item.actual_quantity })) } })
    selectedBatch.value = complete ? await apiFetch<Batch>(`/production/batches/${draft.id}/complete`, { method: 'POST', body: { ...body, idempotency_key: crypto.randomUUID() } }) : draft
    notice.value = complete ? 'Batch completed and output lots created.' : 'Batch saved as a draft.'
    modal.value = null
    await Promise.all([loadBatches(), loadProducts()])
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

async function showBatch(batch: Batch) {
  try {
    selectedBatch.value = await apiFetch<Batch>(`/production/batches/${batch.id}`)
    modal.value = 'detail'
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

async function cancelBatch() {
  if (!selectedBatch.value || !confirm(`Cancel ${selectedBatch.value.batch_number}? This cannot reverse output already sold, wasted, or consumed.`)) return
  try {
    selectedBatch.value = await apiFetch<Batch>(`/production/batches/${selectedBatch.value.id}/cancel`, { method: 'POST', body: { reason: 'Cancelled by production manager' } })
    notice.value = 'Batch cancelled.'
    await load()
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

async function saveUnit() {
  saving.value = true
  try {
    await apiFetch('/measurement-units', { method: 'POST', body: unitForm })
    Object.assign(unitForm, { name: '', symbol: '', dimension: 'count' })
    modal.value = null
    notice.value = 'Measurement unit added.'
    await load()
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

async function recordWastage() {
  saving.value = true
  try {
    await apiFetch('/wastage', { method: 'POST', body: { ...wastageForm, idempotency_key: crypto.randomUUID() } })
    modal.value = null
    notice.value = 'Wastage recorded.'
    await Promise.all([loadProducts(), loadBatches()])
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

function reportSummary(key: string): number {
  const summary = report.value?.summary
  return typeof summary === 'object' && summary !== null && key in summary ? Number((summary as Record<string, unknown>)[key]) : 0
}

function reportRows(key: string): Record<string, unknown>[] {
  const value = report.value?.[key]
  return Array.isArray(value) ? value as Record<string, unknown>[] : []
}

function primaryAction() {
  if (section.value === 'raw-materials') openProduct()
  else if (section.value === 'recipes') openRecipe()
  else if (section.value === 'batches') openBatchForm()
  else if (section.value === 'traceability') modal.value = 'wastage'
  else void load()
}

watch(section, () => { modal.value = null; selectedBatch.value = null; void load() })
onMounted(load)
</script>

<template>
  <main class="ui-page production-page">
    <header class="ui-head">
      <div>
        <p class="ui-eyebrow">{{ copy.eyebrow }}</p>
        <h1>{{ copy.title }}</h1>
        <p class="production-intro">{{ copy.description }}</p>
      </div>
      <div class="ui-actions">
        <button class="btn btn-primary" type="button" @click="primaryAction">{{ copy.action }}</button>
      </div>
    </header>

    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>

    <template v-if="section === 'raw-materials'">
      <div class="production-tabs" role="tablist" aria-label="Product group">
        <button v-for="kind in (['raw_material', 'packaging', 'finished_good'] as ProductKind[])" :key="kind" type="button" :class="{ active: productKind === kind }" :aria-selected="productKind === kind" @click="productKind = kind">
          {{ kind === 'raw_material' ? 'Raw materials' : kind === 'finished_good' ? 'Finished goods' : 'Packaging' }}
        </button>
      </div>
      <section class="card ui-table-card">
        <p v-if="loading" class="ui-state">Loading production products…</p>
        <div v-else-if="groupedProducts.length" class="ui-table-scroll">
          <table class="ui-table">
            <thead><tr><th>Product</th><th>Unit</th><th class="num">On hand</th><th class="num">Current cost</th><th>Family / size</th><th>Stock state</th><th /></tr></thead>
            <tbody><tr v-for="product in groupedProducts" :key="product.id"><td><button class="table-text-action" type="button" @click="openProduct(product)">{{ product.name }}</button></td><td>{{ product.base_unit }}</td><td class="num">{{ formatQuantity(product.stock) }}</td><td class="num">{{ formatUgx(product.current_cost) }}</td><td class="ui-muted">{{ [product.family, product.size_label].filter(Boolean).join(' · ') || '—' }}</td><td><span class="ui-badge" :class="statusTone(product)">{{ productStatus(product) }}</span></td><td class="num"><button class="link-button" type="button" @click="openProduct(product)">Edit</button></td></tr></tbody>
          </table>
        </div>
        <div v-else class="ui-state"><p>No {{ productKind === 'finished_good' ? 'finished goods' : productKind === 'packaging' ? 'packaging products' : 'raw materials' }} yet.</p><button class="btn ui-btn-secondary" type="button" @click="openProduct()">Add product</button></div>
      </section>
      <section class="card unit-card">
        <div><h2>Measurement units</h2><p>Use shared units consistently across products, recipes and batch outputs.</p></div>
        <div class="unit-actions"><div class="unit-list"><span v-for="unit in units" :key="unit.id" class="ui-badge">{{ unit.name }} · {{ unit.symbol }}</span><span v-if="!units.length" class="ui-muted">No units configured yet.</span></div><button class="btn ui-btn-secondary" type="button" @click="modal = 'unit'">Add measurement unit</button></div>
      </section>
    </template>

    <template v-else-if="section === 'recipes'">
      <section class="card ui-table-card">
        <p v-if="loading" class="ui-state">Loading recipes…</p>
        <div v-else-if="recipes.length" class="ui-table-scroll"><table class="ui-table"><thead><tr><th>Recipe</th><th>Family</th><th>Expected yield</th><th>Ingredients</th><th>Status</th><th /></tr></thead><tbody><tr v-for="recipe in recipes" :key="recipe.id"><td><button class="table-text-action" type="button" @click="openRecipe(recipe)">{{ recipe.name }}</button></td><td>{{ recipe.family || '—' }}</td><td>{{ formatQuantity(recipe.yield_quantity) }} {{ recipe.yield_unit }}</td><td>{{ recipe.items.length }} ingredient{{ recipe.items.length === 1 ? '' : 's' }}</td><td><span class="ui-badge" :class="recipe.status === 'active' ? 'ok' : ''">{{ recipe.status }}</span></td><td class="num"><button class="link-button" type="button" @click="openRecipe(recipe)">Edit</button></td></tr></tbody></table></div>
        <div v-else class="ui-state"><p>No recipes yet.</p><p>Build a bill of materials before starting a production batch.</p><button class="btn ui-btn-secondary" type="button" @click="openRecipe()">Create recipe</button></div>
      </section>
    </template>

    <template v-else-if="section === 'batches'">
      <section class="card ui-table-card">
        <p v-if="loading" class="ui-state">Loading production batches…</p>
        <div v-else-if="batches.length" class="ui-table-scroll"><table class="ui-table"><thead><tr><th>Batch</th><th>Recipe / product</th><th>Status</th><th>Production date</th><th class="num">Output</th><th class="num">Total cost</th><th /></tr></thead><tbody><tr v-for="batch in batches" :key="batch.id"><td><button class="table-text-action" type="button" @click="showBatch(batch)">{{ batch.batch_number }}</button></td><td>{{ batch.recipe?.name ?? batch.name }}</td><td><span class="ui-badge" :class="batchTone(batch.status)">{{ batch.status }}</span></td><td>{{ batch.production_date }}</td><td class="num">{{ formatQuantity(batch.output_quantity) }} {{ batch.yield_unit }}</td><td class="num">{{ batch.status === 'completed' ? formatUgx(batch.total_cost) : '—' }}</td><td class="num"><button class="link-button" type="button" @click="showBatch(batch)">View</button></td></tr></tbody></table></div>
        <div v-else class="ui-state"><p>No production batches yet.</p><p>Start a draft when you are ready to record a production run.</p><button class="btn ui-btn-secondary" type="button" @click="openBatchForm()">Start batch</button></div>
      </section>
    </template>

    <template v-else-if="section === 'traceability'">
      <section class="trace-help card"><div><h2>Trace every finished output</h2><p>Open a completed batch to see its lot, production date, expiry and authoritative remaining quantity.</p></div><button class="btn ui-btn-secondary" type="button" @click="modal = 'wastage'">Record post-production wastage</button></section>
      <section class="card ui-table-card"><p v-if="loading" class="ui-state">Loading traceability records…</p><div v-else-if="completedBatches.length" class="ui-table-scroll"><table class="ui-table"><thead><tr><th>Batch</th><th>Finished product</th><th>Produced</th><th>Expiry</th><th class="num">Remaining</th><th /></tr></thead><tbody><template v-for="batch in completedBatches" :key="batch.id"><tr v-for="output in batch.outputs" :key="`${batch.id}-${output.product_id}`"><td>{{ batch.batch_number }}</td><td>{{ output.product_name }}</td><td>{{ batch.production_date }}</td><td>{{ output.expiry_date || batch.expiry_date || '—' }}</td><td class="num">{{ output.remaining_quantity == null ? 'Open batch' : formatQuantity(output.remaining_quantity) }}</td><td class="num"><button class="link-button" type="button" @click="showBatch(batch)">Lot details</button></td></tr></template></tbody></table></div><div v-else class="ui-state"><p>No completed production lots yet.</p><p>Lots appear automatically when a batch is completed.</p></div></section>
    </template>

    <template v-else>
      <section class="metric-grid">
        <article class="card metric"><p>Completed batches</p><strong>{{ reportSummary('batches') }}</strong><span>in the selected reporting period</span></article>
        <article class="card metric"><p>Total batch cost</p><strong>{{ formatUgx(reportSummary('total_cost')) }}</strong><span>materials, packaging and direct costs</span></article>
        <article class="card metric"><p>Production wastage</p><strong>{{ formatUgx(reportSummary('wastage_cost')) }}</strong><span>recorded losses</span></article>
        <article class="card metric"><p>Draft batches</p><strong>{{ reportSummary('drafts') }}</strong><span>awaiting completion</span></article>
      </section>
      <section class="card report-card"><div class="section-head"><div><h2>Batch costing</h2><p>Frozen cost and unit cost from completed production batches.</p></div></div><div v-if="reportRows('batches').length" class="ui-table-scroll"><table class="ui-table"><thead><tr><th>Batch</th><th>Output</th><th class="num">Batch cost</th><th class="num">Unit cost</th></tr></thead><tbody><tr v-for="row in reportRows('batches')" :key="String(row.id)"><td>{{ row.batch_number }}</td><td>{{ formatQuantity(Number(row.output_quantity)) }} {{ row.yield_unit }}</td><td class="num">{{ formatUgx(Number(row.total_cost)) }}</td><td class="num">{{ formatUgx(Number(row.cost_per_yield_unit)) }}</td></tr></tbody></table></div><p v-else class="ui-state">No completed batches in this reporting period.</p></section>
      <section class="card report-card"><div class="section-head"><div><h2>Expiry and remaining lots</h2><p>Only authoritative production-lot balances are shown here.</p></div></div><div v-if="reportRows('expiring').length" class="ui-table-scroll"><table class="ui-table"><thead><tr><th>Product</th><th>Batch</th><th>Expiry</th><th class="num">Remaining</th></tr></thead><tbody><tr v-for="row in reportRows('expiring')" :key="`${row.batch_id}-${row.product_id}`"><td>{{ row.product_name }}</td><td>{{ row.batch_number }}</td><td>{{ row.expiry_date }}</td><td class="num">{{ formatQuantity(Number(row.remaining_quantity ?? row.estimated_remaining)) }} {{ row.unit }}</td></tr></tbody></table></div><p v-else class="ui-state">No production lots are expiring in the next 14 days.</p></section>
    </template>

    <BaseModal v-if="modal === 'product'" :title="editingProduct ? 'Edit production product' : 'Add production product'" @close="modal = null">
      <form class="production-form" @submit.prevent="saveProduct">
        <div class="form-section"><h3>Product details</h3><div class="form-grid"><div class="field grow"><label for="product-name">Name</label><input id="product-name" v-model="productForm.name" required autofocus /></div><div class="field"><label for="product-kind">Product kind</label><select id="product-kind" v-model="productForm.kind"><option value="raw_material">Raw material</option><option value="packaging">Packaging</option><option value="finished_good">Finished good</option></select></div><div class="field"><label for="product-unit">Base unit</label><input id="product-unit" v-model="productForm.base_unit" required /></div></div></div>
        <div class="form-section"><h3>Stock and pricing</h3><div class="form-grid"><div class="field"><label for="product-cost">Current cost (UGX)</label><input id="product-cost" v-model.number="productForm.current_cost" type="number" min="0" /></div><div class="field"><label for="product-price">Selling price (UGX)</label><input id="product-price" v-model.number="productForm.selling_price" type="number" min="0" /></div><div class="field"><label for="product-opening">Opening stock</label><input id="product-opening" v-model.number="productForm.opening_stock" type="number" min="0" step="any" :disabled="!!editingProduct" /></div></div></div>
        <div v-if="productForm.kind === 'finished_good'" class="form-section"><h3>Finished-good details</h3><div class="form-grid"><div class="field"><label for="product-family">Family</label><input id="product-family" v-model="productForm.family" /></div><div class="field"><label for="product-size">Size / variant</label><input id="product-size" v-model="productForm.size_label" /></div><div class="field"><label for="product-equivalent">Output equivalent</label><input id="product-equivalent" v-model.number="productForm.output_equivalent" type="number" min=".001" step="any" /></div><div class="field"><label for="product-life">Shelf life (days)</label><input id="product-life" v-model.number="productForm.shelf_life_days" type="number" min="1" /></div></div></div>
        <div class="modal-actions"><button class="btn ui-btn-secondary" type="button" @click="modal = null">Cancel</button><button class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save product' }}</button></div>
      </form>
    </BaseModal>

    <BaseModal v-if="modal === 'unit'" title="Add measurement unit" @close="modal = null">
      <form class="production-form" @submit.prevent="saveUnit"><p class="form-copy">Units are reusable labels for quantities; no conversion rules are introduced here.</p><div class="form-grid"><div class="field"><label for="unit-name">Name</label><input id="unit-name" v-model="unitForm.name" required autofocus /></div><div class="field"><label for="unit-symbol">Symbol</label><input id="unit-symbol" v-model="unitForm.symbol" required /></div><div class="field"><label for="unit-dimension">Dimension</label><select id="unit-dimension" v-model="unitForm.dimension"><option value="count">Count</option><option value="mass">Mass</option><option value="volume">Volume</option><option value="length">Length</option><option value="other">Other</option></select></div></div><div class="modal-actions"><button class="btn ui-btn-secondary" type="button" @click="modal = null">Cancel</button><button class="btn btn-primary" :disabled="saving">Add unit</button></div></form>
    </BaseModal>

    <BaseModal v-if="modal === 'recipe'" :title="editingRecipe ? 'Edit recipe' : 'Create recipe'" @close="modal = null">
      <form class="production-form" @submit.prevent="saveRecipe"><div class="form-section"><h3>Recipe details</h3><div class="form-grid"><div class="field grow"><label for="recipe-name">Recipe name</label><input id="recipe-name" v-model="recipeForm.name" required autofocus /></div><div class="field"><label for="recipe-family">Product family</label><input id="recipe-family" v-model="recipeForm.family" /></div><div class="field"><label for="recipe-yield">Expected yield</label><input id="recipe-yield" v-model.number="recipeForm.yield_quantity" type="number" min=".001" step="any" required /></div><div class="field"><label for="recipe-unit">Yield unit</label><input id="recipe-unit" v-model="recipeForm.yield_unit" required /></div></div><div class="field"><label for="recipe-instructions">Instructions</label><textarea id="recipe-instructions" v-model="recipeForm.instructions" rows="3" /></div></div><div class="form-section"><div class="inline-heading"><div><h3>Ingredients</h3><p>Choose raw materials or packaging and specify the required quantity.</p></div><button class="btn ui-btn-secondary btn-compact" type="button" @click="recipeForm.items.push({ product_id: materials[0]?.id ?? 0, quantity: 1, note: '' })">Add ingredient</button></div><div v-for="(item, index) in recipeForm.items" :key="index" class="line-editor"><div class="field"><label :for="`ingredient-${index}`">Material</label><select :id="`ingredient-${index}`" v-model.number="item.product_id"><option v-for="product in materials" :key="product.id" :value="product.id">{{ product.name }} · {{ product.base_unit }}</option></select></div><div class="field"><label :for="`ingredient-quantity-${index}`">Quantity</label><input :id="`ingredient-quantity-${index}`" v-model.number="item.quantity" type="number" min=".001" step="any" /></div><div class="field"><label :for="`ingredient-note-${index}`">Note</label><input :id="`ingredient-note-${index}`" v-model="item.note" /></div><button class="icon-remove" type="button" :aria-label="`Remove ingredient ${index + 1}`" @click="recipeForm.items.splice(index, 1)">×</button></div></div><div class="modal-actions"><button class="btn ui-btn-secondary" type="button" @click="modal = null">Cancel</button><button class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save recipe' }}</button></div></form>
    </BaseModal>

    <BaseModal v-if="modal === 'batch'" title="Start production batch" wide @close="modal = null">
      <form class="production-form batch-form" @submit.prevent="saveBatch(false)"><div class="form-section"><h3>A. Batch information</h3><div class="form-grid"><div class="field"><label for="batch-recipe">Recipe</label><select id="batch-recipe" v-model.number="batchForm.recipe_id" @change="loadRecipeIntoBatch"><option :value="0">No recipe</option><option v-for="recipe in recipes.filter((item) => item.status === 'active')" :key="recipe.id" :value="recipe.id">{{ recipe.name }}</option></select></div><div class="field grow"><label for="batch-name">Batch name</label><input id="batch-name" v-model="batchForm.name" required /></div><div class="field"><label for="batch-yield">Planned yield</label><input id="batch-yield" v-model.number="batchForm.planned_yield" type="number" min=".001" step="any" /></div><div class="field"><label for="batch-yield-unit">Yield unit</label><input id="batch-yield-unit" v-model="batchForm.yield_unit" /></div></div></div><div class="form-section"><h3>B. Dates & expiry</h3><div class="form-grid"><div class="field"><label for="batch-date">Production date</label><input id="batch-date" v-model="batchForm.production_date" type="date" required /></div><div class="field"><label for="batch-expiry">Expiry / best before</label><input id="batch-expiry" v-model="batchForm.expiry_date" type="date" /></div></div></div><div class="form-section"><h3>C. Actual material inputs</h3><p>These are the quantities actually consumed. They are not inferred from the plan.</p><div v-for="(item, index) in batchForm.inputs" :key="`input-${index}`" class="line-editor"><div class="field"><label :for="`batch-input-${index}`">Material</label><select :id="`batch-input-${index}`" v-model.number="item.product_id"><option v-for="product in materials" :key="product.id" :value="product.id">{{ product.name }} · {{ product.base_unit }}</option></select></div><div class="field"><label :for="`batch-input-qty-${index}`">Actual quantity</label><input :id="`batch-input-qty-${index}`" v-model.number="item.actual_quantity" type="number" min="0" step="any" /></div></div></div><div class="form-section"><div class="inline-heading"><div><h3>D. Finished outputs</h3><p>Add each finished variant produced by this batch.</p></div><button class="btn ui-btn-secondary btn-compact" type="button" @click="addOutput">Add output</button></div><div v-for="(item, index) in batchForm.outputs" :key="`output-${index}`" class="line-editor output-editor"><div class="field"><label :for="`batch-output-${index}`">Finished product</label><select :id="`batch-output-${index}`" v-model.number="item.product_id"><option v-for="product in finishedGoods" :key="product.id" :value="product.id">{{ product.name }}</option></select></div><div class="field"><label :for="`batch-output-qty-${index}`">Quantity</label><input :id="`batch-output-qty-${index}`" v-model.number="item.quantity" type="number" min=".001" step="any" /></div><div class="field"><label :for="`batch-output-equivalent-${index}`">Output equivalent</label><input :id="`batch-output-equivalent-${index}`" v-model.number="item.output_equivalent" type="number" min=".001" step="any" /></div><div class="field"><label :for="`batch-output-expiry-${index}`">Expiry</label><input :id="`batch-output-expiry-${index}`" v-model="item.expiry_date" type="date" /></div><button class="icon-remove" type="button" :aria-label="`Remove output ${index + 1}`" @click="batchForm.outputs.splice(index, 1)">×</button></div></div><div class="form-section"><div class="inline-heading"><div><h3>E. Direct production costs</h3><p>Direct labour and direct production expenses are included in this batch cost.</p></div><button class="btn ui-btn-secondary btn-compact" type="button" @click="addDirectExpense">Add direct cost</button></div><div v-for="(item, index) in batchForm.direct_expenses" :key="`expense-${index}`" class="line-editor expense-editor"><div class="field"><label :for="`cost-type-${index}`">Type</label><select :id="`cost-type-${index}`" v-model="item.type"><option value="direct_labour">Direct labour</option><option value="direct_production">Direct production</option></select></div><div class="field"><label :for="`cost-category-${index}`">Category</label><input :id="`cost-category-${index}`" v-model="item.category" /></div><div class="field"><label :for="`cost-amount-${index}`">Amount (UGX)</label><input :id="`cost-amount-${index}`" v-model.number="item.amount" type="number" min="1" /></div><button class="icon-remove" type="button" :aria-label="`Remove direct cost ${index + 1}`" @click="batchForm.direct_expenses.splice(index, 1)">×</button></div></div><div class="form-section"><div class="inline-heading"><div><h3>F. Production wastage</h3><p>Use this only for losses occurring during this run.</p></div><button class="btn ui-btn-secondary btn-compact" type="button" @click="addBatchWastage">Add wastage</button></div><div v-for="(item, index) in batchForm.wastage" :key="`wastage-${index}`" class="line-editor expense-editor"><div class="field"><label :for="`wastage-product-${index}`">Product</label><select :id="`wastage-product-${index}`" v-model.number="item.product_id"><option v-for="product in materials" :key="product.id" :value="product.id">{{ product.name }}</option></select></div><div class="field"><label :for="`wastage-quantity-${index}`">Quantity</label><input :id="`wastage-quantity-${index}`" v-model.number="item.quantity" type="number" min=".001" step="any" /></div><div class="field"><label :for="`wastage-reason-${index}`">Reason</label><input :id="`wastage-reason-${index}`" v-model="item.reason" /></div><button class="icon-remove" type="button" :aria-label="`Remove wastage ${index + 1}`" @click="batchForm.wastage.splice(index, 1)">×</button></div></div><div class="form-section"><h3>G. Notes</h3><div class="field"><label for="batch-notes">Production notes</label><textarea id="batch-notes" v-model="batchForm.notes" rows="3" /></div></div><div class="modal-actions split-actions"><button class="btn ui-btn-secondary" type="button" @click="modal = null">Cancel</button><div><button class="btn ui-btn-secondary" :disabled="saving">Save draft</button><button class="btn btn-primary" type="button" :disabled="saving" @click="saveBatch(true)">{{ saving ? 'Saving…' : 'Complete batch' }}</button></div></div></form>
    </BaseModal>

    <BaseModal v-if="modal === 'wastage'" title="Record post-production wastage" @close="modal = null">
      <form class="production-form" @submit.prevent="recordWastage"><p class="form-copy">Use this for finished goods or materials written off outside a batch. Batch wastage belongs in the batch completion workflow.</p><div class="form-grid"><div class="field grow"><label for="wastage-product">Product</label><select id="wastage-product" v-model.number="wastageForm.product_id" required><option :value="0" disabled>Choose product</option><option v-for="product in products" :key="product.id" :value="product.id">{{ product.name }} · {{ product.base_unit }}</option></select></div><div class="field"><label for="wastage-quantity">Quantity</label><input id="wastage-quantity" v-model.number="wastageForm.quantity" type="number" min=".001" step="any" required /></div><div class="field"><label for="wastage-date">Date</label><input id="wastage-date" v-model="wastageForm.wastage_date" type="date" required /></div></div><div class="field"><label for="wastage-reason">Reason</label><input id="wastage-reason" v-model="wastageForm.reason" required /></div><div class="modal-actions"><button class="btn ui-btn-secondary" type="button" @click="modal = null">Cancel</button><button class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Record wastage' }}</button></div></form>
    </BaseModal>

    <BaseModal v-if="modal === 'detail' && selectedBatch" :title="`${selectedBatch.batch_number} details`" @close="modal = null">
      <div class="batch-detail"><div class="detail-heading"><div><span class="ui-badge" :class="batchTone(selectedBatch.status)">{{ selectedBatch.status }}</span><p>{{ selectedBatch.name }} · Produced {{ selectedBatch.production_date }}</p></div><button v-if="selectedBatch.status !== 'cancelled'" class="btn danger-button" type="button" @click="cancelBatch">Cancel batch</button></div><section v-if="selectedBatch.costs" class="detail-costs"><div v-for="(cost, name) in selectedBatch.costs" :key="String(name)"><span>{{ String(name).replace('_', ' ') }}</span><strong>{{ formatUgx(Number(cost)) }}</strong></div></section><section><h3>Outputs and lots</h3><ul class="detail-list"><li v-for="output in selectedBatch.outputs" :key="output.product_id"><strong>{{ output.product_name }}</strong><span>{{ formatQuantity(output.quantity) }} · Lot #{{ output.lot_id ?? 'pending' }}</span><span>Remaining {{ output.remaining_quantity == null ? '—' : formatQuantity(output.remaining_quantity) }} · Expiry {{ output.expiry_date ?? selectedBatch.expiry_date ?? '—' }}</span></li></ul></section><section v-if="selectedBatch.inputs?.length"><h3>Actual inputs</h3><ul class="detail-list compact"><li v-for="input in selectedBatch.inputs" :key="input.product_id"><strong>{{ input.product_name }}</strong><span>{{ formatQuantity(input.actual_quantity ?? input.planned_quantity ?? 0) }} {{ input.unit }}</span></li></ul></section></div>
    </BaseModal>
  </main>
</template>

<style scoped>
.production-page { gap: 1.25rem; }
.production-intro { max-width: 44rem; margin-top: .45rem; color: var(--color-ink-soft); }
.production-tabs { display: flex; gap: .5rem; flex-wrap: wrap; border-bottom: 1px solid var(--color-border); }
.production-tabs button { padding: .7rem 1rem; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--color-ink-soft); font: inherit; font-size: .875rem; font-weight: 600; cursor: pointer; }
.production-tabs button.active { border-color: var(--color-primary); color: var(--color-primary); }
.link-button { border: 0; background: transparent; color: var(--color-primary); font: inherit; font-weight: 600; cursor: pointer; }
.unit-card, .trace-help, .report-card { padding: 1.25rem; }
.unit-card, .trace-help { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.unit-card h2, .trace-help h2, .report-card h2 { font-size: 1rem; }
.unit-card p, .trace-help p, .section-head p { margin-top: .25rem; color: var(--color-ink-soft); font-size: .875rem; }
.unit-actions { display: flex; align-items: center; justify-content: flex-end; gap: .75rem; flex-wrap: wrap; }
.unit-list { display: flex; justify-content: flex-end; gap: .4rem; flex-wrap: wrap; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
.metric { padding: 1.15rem 1.25rem; }
.metric p, .metric span { color: var(--color-ink-soft); font-size: .8125rem; }
.metric strong { display: block; margin: .35rem 0; font-size: 1.45rem; }
.section-head { margin-bottom: .75rem; }
.production-form { display: flex; flex-direction: column; gap: 1.25rem; }
.form-section { display: flex; flex-direction: column; gap: .75rem; padding-top: 1.15rem; border-top: 1px solid var(--color-border); }
.form-section:first-child { padding-top: 0; border-top: 0; }
.form-section h3 { font-size: .9375rem; }
.form-section > p, .inline-heading p, .form-copy { color: var(--color-ink-soft); font-size: .8125rem; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; }
.form-grid .grow { grid-column: span 2; }
.production-form .field { gap: .375rem; }
.production-form label { color: var(--color-ink-soft); font-size: .8125rem; font-weight: 600; }
.production-form input, .production-form select, .production-form textarea { width: 100%; padding: .625rem .75rem; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-ink); font: inherit; }
.production-form textarea { resize: vertical; }
.inline-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: .75rem; }
.line-editor { display: grid; grid-template-columns: minmax(0, 2fr) minmax(100px, 1fr) minmax(0, 1.25fr) 36px; align-items: end; gap: .625rem; padding: .75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-canvas); }
.output-editor { grid-template-columns: minmax(0, 1.7fr) repeat(3, minmax(100px, 1fr)) 36px; }
.expense-editor { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.5fr) minmax(110px, 1fr) 36px; }
.icon-remove { width: 36px; height: 36px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-danger); font-size: 1.25rem; cursor: pointer; }
.modal-actions { display: flex; justify-content: flex-end; gap: .625rem; padding-top: .25rem; }
.split-actions { justify-content: space-between; }
.split-actions > div { display: flex; gap: .625rem; }
.batch-form { max-width: 900px; }
.detail-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.detail-heading p { margin-top: .5rem; color: var(--color-ink-soft); font-size: .875rem; }
.danger-button { background: var(--color-danger); color: var(--color-on-danger); }
.batch-detail { display: flex; flex-direction: column; gap: 1.25rem; }
.batch-detail h3 { margin-bottom: .6rem; font-size: .9375rem; }
.detail-costs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .5rem; }
.detail-costs div { display: flex; justify-content: space-between; gap: .75rem; padding: .65rem .75rem; border-radius: var(--radius-sm); background: var(--color-canvas); text-transform: capitalize; font-size: .8125rem; }
.detail-list { display: flex; flex-direction: column; gap: .5rem; list-style: none; }
.detail-list li { display: grid; gap: .2rem; padding: .75rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.detail-list span { color: var(--color-ink-soft); font-size: .8125rem; }
.detail-list.compact li { display: flex; justify-content: space-between; }
@media (max-width: 760px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .unit-card, .trace-help { align-items: stretch; flex-direction: column; } .unit-actions, .unit-list { justify-content: flex-start; } .line-editor, .output-editor, .expense-editor { grid-template-columns: 1fr; } .icon-remove { width: 44px; height: 40px; } .form-grid { grid-template-columns: 1fr; } .form-grid .grow { grid-column: auto; } .split-actions, .split-actions > div { flex-direction: column-reverse; } .split-actions .btn { width: 100%; } }
@media (max-width: 480px) { .metric-grid { grid-template-columns: 1fr; } .inline-heading, .detail-heading { align-items: stretch; flex-direction: column; } .inline-heading .btn, .danger-button { width: 100%; } .modal-actions { flex-direction: column-reverse; } .modal-actions .btn { width: 100%; } }
</style>
