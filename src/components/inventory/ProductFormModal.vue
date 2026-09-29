<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch, fieldErrors } from '@/lib/api'
import { formatUgx } from '@/lib/format'
import { useCategoriesStore } from '@/stores/categories'
import type { ManagedProduct } from '@/types/inventory'

const props = defineProps<{ product?: ManagedProduct }>()
const emit = defineEmits<{ close: []; saved: [product: ManagedProduct] }>()

const categories = useCategoriesStore()
const UNIT_SUGGESTIONS = ['piece', 'kg', 'litre', 'pack', 'dozen', 'box', 'crate', 'bag', 'metre']

interface UnitRow {
  unit_name: string
  conversion_to_base_unit: number | null
  selling_price: number | null
}

const editing = computed(() => !!props.product)

const form = reactive({
  name: props.product?.name ?? '',
  category_id: (props.product?.category_id ?? '') as number | '',
  barcode: props.product?.barcode ?? '',
  sku: props.product?.sku ?? '',
  base_unit: props.product?.base_unit ?? 'piece',
  selling_price: props.product?.selling_price ?? (null as number | null),
  current_cost: props.product?.current_cost ?? (null as number | null),
  low_stock_threshold: props.product?.low_stock_threshold ?? 0,
  opening_stock: null as number | null,
  units: (props.product?.units ?? []).map((u) => ({ ...u })) as UnitRow[],
})

const saving = ref(false)
const error = ref('')
const errors = ref<Record<string, string>>({})
const newCategory = ref('')
const addingCategory = ref(false)

onMounted(() => void categories.load())

const profit = computed(() => {
  if (form.selling_price == null || form.current_cost == null) return null
  const amount = form.selling_price - form.current_cost
  const percent = form.selling_price > 0 ? Math.round((amount / form.selling_price) * 100) : 0
  return { amount, percent }
})

function addUnit() {
  form.units.push({ unit_name: '', conversion_to_base_unit: null, selling_price: null })
}

async function createCategory() {
  const name = newCategory.value.trim()
  if (!name) return
  try {
    const created = await apiFetch<{ id: number }>('/categories', {
      method: 'POST',
      body: { name },
    })
    await categories.load()
    form.category_id = created.id
    newCategory.value = ''
    addingCategory.value = false
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

async function save() {
  saving.value = true
  error.value = ''
  errors.value = {}
  try {
    const body: Record<string, unknown> = {
      name: form.name,
      category_id: form.category_id === '' ? null : form.category_id,
      sku: form.sku || null,
      barcode: form.barcode || null,
      base_unit: form.base_unit,
      selling_price: Math.round(Number(form.selling_price ?? 0)),
      current_cost: Math.round(Number(form.current_cost ?? 0)),
      low_stock_threshold: Number(form.low_stock_threshold || 0),
      units: form.units
        .filter((u) => u.unit_name.trim())
        .map((u) => ({
          unit_name: u.unit_name.trim(),
          conversion_to_base_unit: Number(u.conversion_to_base_unit),
          selling_price: Math.round(Number(u.selling_price ?? 0)),
        })),
    }
    if (!editing.value && form.opening_stock) body.opening_stock = Number(form.opening_stock)

    const saved = editing.value
      ? await apiFetch<ManagedProduct>(`/products/${props.product!.id}`, { method: 'PATCH', body })
      : await apiFetch<ManagedProduct>('/products', { method: 'POST', body })
    emit('saved', saved)
  } catch (e) {
    errors.value = fieldErrors(e)
    error.value = Object.keys(errors.value).length
      ? 'Please fix the highlighted fields.'
      : apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

async function toggleArchive() {
  if (!props.product) return
  saving.value = true
  try {
    const action = props.product.status === 'active' ? 'archive' : 'restore'
    emit(
      'saved',
      await apiFetch<ManagedProduct>(`/products/${props.product.id}/${action}`, { method: 'POST' }),
    )
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :title="editing ? 'Edit product' : 'Add product'" @close="emit('close')">
    <form class="form" @submit.prevent="save">
      <p v-if="error" class="alert-danger">{{ error }}</p>

      <div class="field">
        <label for="p-name">Name</label>
        <input id="p-name" v-model="form.name" type="text" required maxlength="255" autofocus />
        <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
      </div>

      <div class="field">
        <label for="p-cat">Category</label>
        <div class="inline">
          <select id="p-cat" v-model="form.category_id">
            <option value="">No category</option>
            <option v-for="c in categories.list" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <button type="button" class="btn small" @click="addingCategory = !addingCategory">
            {{ addingCategory ? 'Cancel' : '+ New' }}
          </button>
        </div>
        <div v-if="addingCategory" class="inline">
          <input
            v-model="newCategory"
            type="text"
            placeholder="New category name"
            maxlength="100"
            @keydown.enter.prevent="createCategory"
          />
          <button type="button" class="btn btn-primary small" @click="createCategory">Add</button>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <label for="p-barcode">Barcode <span class="optional">(scan or type)</span></label>
          <input
            id="p-barcode"
            v-model="form.barcode"
            type="text"
            maxlength="100"
            @keydown.enter.prevent
          />
          <span v-if="errors.barcode" class="field-error">{{ errors.barcode }}</span>
        </div>
        <div class="field">
          <label for="p-sku">SKU <span class="optional">(optional)</span></label>
          <input id="p-sku" v-model="form.sku" type="text" maxlength="100" />
          <span v-if="errors.sku" class="field-error">{{ errors.sku }}</span>
        </div>
      </div>

      <div class="field">
        <label for="p-unit">Sold by (base unit)</label>
        <input
          id="p-unit"
          v-model="form.base_unit"
          type="text"
          list="unit-suggestions"
          required
          maxlength="50"
        />
        <datalist id="unit-suggestions">
          <option v-for="u in UNIT_SUGGESTIONS" :key="u" :value="u" />
        </datalist>
        <span v-if="errors.base_unit" class="field-error">{{ errors.base_unit }}</span>
        <span v-else class="hint"
          >Stock is counted in this unit. It can't be changed once the product has stock or
          sales.</span
        >
      </div>

      <div class="row">
        <div class="field">
          <label for="p-price">Selling price (UGX)</label>
          <input
            id="p-price"
            v-model.number="form.selling_price"
            type="number"
            inputmode="numeric"
            min="0"
            required
          />
          <span v-if="errors.selling_price" class="field-error">{{ errors.selling_price }}</span>
        </div>
        <div class="field">
          <label for="p-cost">Buying cost (UGX)</label>
          <input
            id="p-cost"
            v-model.number="form.current_cost"
            type="number"
            inputmode="numeric"
            min="0"
          />
        </div>
      </div>
      <p v-if="profit" class="profit" :class="{ neg: profit.amount < 0 }">
        Profit per {{ form.base_unit || 'unit' }}:
        <strong>{{ formatUgx(profit.amount) }}</strong> ({{ profit.percent }}%)
      </p>

      <div class="row">
        <div class="field">
          <label for="p-low">Warn me when stock falls to</label>
          <input
            id="p-low"
            v-model.number="form.low_stock_threshold"
            type="number"
            step="any"
            min="0"
          />
          <span class="hint">0 = no warning</span>
        </div>
        <div v-if="!editing" class="field">
          <label for="p-open">Opening stock</label>
          <input
            id="p-open"
            v-model.number="form.opening_stock"
            type="number"
            step="any"
            min="0"
            placeholder="0"
          />
          <span class="hint">What you have on the shelf now</span>
        </div>
      </div>

      <fieldset class="units">
        <legend>Other ways you sell it <span class="optional">(optional)</span></legend>
        <p v-if="!form.units.length" class="hint">
          e.g. a crate that holds 24 pieces, sold at its own price.
        </p>
        <div v-for="(unit, i) in form.units" :key="i" class="unit-row">
          <input
            v-model="unit.unit_name"
            type="text"
            placeholder="crate"
            maxlength="50"
            :aria-label="`Unit ${i + 1} name`"
          />
          <span class="eq">holds</span>
          <input
            v-model.number="unit.conversion_to_base_unit"
            type="number"
            step="any"
            min="0"
            placeholder="24"
            :aria-label="`Unit ${i + 1} quantity`"
          />
          <span class="eq">{{ form.base_unit }} · UGX</span>
          <input
            v-model.number="unit.selling_price"
            type="number"
            min="0"
            placeholder="33000"
            :aria-label="`Unit ${i + 1} price`"
          />
          <button
            type="button"
            class="remove"
            :aria-label="`Remove unit ${i + 1}`"
            @click="form.units.splice(i, 1)"
          >
            ×
          </button>
          <span v-if="errors[`units.${i}.unit_name`]" class="field-error full">{{
            errors[`units.${i}.unit_name`]
          }}</span>
          <span v-if="errors[`units.${i}.conversion_to_base_unit`]" class="field-error full">{{
            errors[`units.${i}.conversion_to_base_unit`]
          }}</span>
        </div>
        <button v-if="form.units.length < 10" type="button" class="link add" @click="addUnit">
          + Add another unit
        </button>
      </fieldset>

      <div class="actions">
        <button
          v-if="editing"
          type="button"
          class="btn"
          :class="product?.status === 'active' ? 'danger' : 'ui-btn-secondary'"
          :disabled="saving"
          @click="toggleArchive"
        >
          {{ product?.status === 'active' ? 'Archive' : 'Restore' }}
        </button>
        <button type="submit" class="btn btn-primary grow" :disabled="saving || !form.name.trim()">
          {{ saving ? 'Saving…' : 'Save product' }}
        </button>
      </div>
      <p v-if="editing && product?.status === 'active'" class="hint center">
        Archiving hides it from selling but keeps its history. Products are never deleted.
      </p>
    </form>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.inline {
  display: flex;
  gap: 0.5rem;
}

.inline select,
.inline input {
  flex: 1;
}

.optional {
  font-weight: 400;
  color: var(--color-ink-faint);
}

.profit {
  margin-top: -0.5rem;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.profit.neg {
  color: var(--color-danger);
}

.units {
  margin: 0;
  padding: 0.75rem 1rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.units legend {
  padding: 0 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-ink-soft);
}

.unit-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.unit-row input {
  width: 92px;
  height: 38px;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.875rem;
  outline: none;
}

.unit-row input:focus {
  border-color: var(--color-primary);
}

.eq {
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

.remove {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-faint);
  font-size: 1.125rem;
  cursor: pointer;
}

.full {
  flex-basis: 100%;
}

.add {
  margin-top: 0.75rem;
  border: none;
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  cursor: pointer;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.grow {
  flex: 1;
}

.btn.small {
  min-height: 40px;
  padding: 0 0.875rem;
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 0.8125rem;
}

.btn.small.btn-primary {
  border-color: transparent;
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn.danger {
  border-color: var(--color-danger);
  background: var(--color-surface);
  color: var(--color-danger);
}

.center {
  text-align: center;
}

@media (max-width: 520px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>
