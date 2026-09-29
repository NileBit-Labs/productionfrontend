<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { apiErrorMessage, apiFetch, fieldErrors } from '@/lib/api'
import { formatQuantity, formatUgx, localDate, uuid } from '@/lib/format'
import type { ManagedProduct, Paginated } from '@/types/inventory'
import type { Supplier } from '@/types/purchasing'
import { PAYMENT_METHODS, type PaymentMethod } from '@/types/sales'

interface Line {
  key: number
  product: ManagedProduct
  quantity: number | null
  unit: string
  unitCost: number | null
}

const route = useRoute()
const router = useRouter()

const suppliers = ref<Supplier[]>([])
const supplierId = ref(typeof route.query.supplier === 'string' ? route.query.supplier : '')
const purchaseDate = ref(localDate())
const reference = ref('')
const note = ref('')
const lines = ref<Line[]>([])
const amountPaid = ref<number | null>(null)
const method = ref<PaymentMethod>('CASH')
const paymentReference = ref('')

const query = ref('')
const results = ref<ManagedProduct[]>([])
const searching = ref(false)

const saving = ref(false)
const error = ref('')
const errors = ref<Record<string, string>>({})

// One key for this form: pressing Save twice, or retrying after a dropped
// connection, records the purchase once.
const idempotencyKey = uuid()
let nextKey = 1

const today = localDate()

const lineTotal = (l: Line) => Math.round((l.quantity ?? 0) * (l.unitCost ?? 0))
const total = computed(() => lines.value.reduce((sum, l) => sum + lineTotal(l), 0))
const paid = computed(() => Math.round(Number(amountPaid.value ?? 0)))
const onCredit = computed(() => Math.max(total.value - paid.value, 0))

const conversion = (l: Line) =>
  l.unit === l.product.base_unit
    ? 1
    : (l.product.units.find((u) => u.unit_name === l.unit)?.conversion_to_base_unit ?? 1)

const baseQuantity = (l: Line) => Math.round((l.quantity ?? 0) * conversion(l) * 1000) / 1000
const baseCost = (l: Line) => {
  const q = baseQuantity(l)
  return q > 0 ? Math.round(lineTotal(l) / q) : 0
}

const valid = computed(
  () =>
    !!supplierId.value &&
    lines.value.length > 0 &&
    lines.value.every((l) => (l.quantity ?? 0) > 0 && l.unitCost !== null && l.unitCost >= 0) &&
    paid.value >= 0 &&
    paid.value <= total.value,
)

let timer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(timer)
  if (!query.value.trim()) {
    results.value = []
    return
  }
  timer = setTimeout(search, 250)
})
onUnmounted(() => clearTimeout(timer))

async function search() {
  searching.value = true
  try {
    const params = new URLSearchParams({ status: 'active', search: query.value.trim() })
    const res = await apiFetch<Paginated<ManagedProduct>>(`/products?${params}`)
    results.value = res.data.slice(0, 8)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    searching.value = false
  }
}

function add(product: ManagedProduct) {
  const existing = lines.value.find(
    (l) => l.product.id === product.id && l.unit === product.base_unit,
  )
  if (existing) {
    existing.quantity = (existing.quantity ?? 0) + 1
  } else {
    lines.value.push({
      key: nextKey++,
      product,
      quantity: 1,
      unit: product.base_unit,
      unitCost: product.current_cost,
    })
  }
  query.value = ''
  results.value = []
}

function changeUnit(line: Line) {
  // Start from what this unit would cost at the current per-piece cost; the price on the invoice replaces it.
  line.unitCost = Math.round(line.product.current_cost * conversion(line))
}

function remove(line: Line) {
  lines.value = lines.value.filter((l) => l.key !== line.key)
}

async function save() {
  saving.value = true
  error.value = ''
  errors.value = {}
  try {
    const purchase = await apiFetch<{ id: number }>('/purchases', {
      method: 'POST',
      body: {
        supplier_id: Number(supplierId.value),
        purchase_date: purchaseDate.value,
        reference: reference.value.trim() || null,
        note: note.value.trim() || null,
        items: lines.value.map((l) => ({
          product_id: l.product.id,
          quantity: l.quantity,
          unit_cost: Math.round(l.unitCost ?? 0),
          unit_name: l.unit === l.product.base_unit ? null : l.unit,
        })),
        amount_paid: paid.value,
        ...(paid.value > 0
          ? {
              payment_method: method.value,
              payment_reference: paymentReference.value.trim() || null,
            }
          : {}),
        idempotency_key: idempotencyKey,
      },
    })
    await router.push(`/purchases/${purchase.id}`)
  } catch (e) {
    errors.value = fieldErrors(e)
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const res = await apiFetch<{ suppliers: Paginated<Supplier> }>('/suppliers?status=active')
    suppliers.value = res.suppliers.data
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
})
</script>

<template>
  <main class="ui-page">
    <RouterLink class="back link" to="/purchases">← Purchases</RouterLink>

    <header class="ui-head">
      <div>
        <p class="ui-eyebrow">Purchasing</p>
        <h1>New purchase</h1>
      </div>
    </header>

    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>

    <form class="layout" @submit.prevent="save">
      <div class="main">
        <section class="card block">
          <div class="grid">
            <div class="field">
              <label for="np-supplier">Supplier</label>
              <select id="np-supplier" v-model="supplierId" required>
                <option value="" disabled>Choose a supplier</option>
                <option v-for="s in suppliers" :key="s.id" :value="String(s.id)">
                  {{ s.name }}
                </option>
              </select>
              <span v-if="errors.supplier_id" class="field-error">{{ errors.supplier_id }}</span>
              <RouterLink v-if="!suppliers.length" class="link hint" to="/suppliers">
                Add a supplier first
              </RouterLink>
            </div>
            <div class="field">
              <label for="np-date">Date received</label>
              <input id="np-date" v-model="purchaseDate" type="date" :max="today" required />
            </div>
            <div class="field">
              <label for="np-ref">Invoice number <span class="optional">(optional)</span></label>
              <input id="np-ref" v-model="reference" type="text" maxlength="100" />
            </div>
          </div>
        </section>

        <section class="card block">
          <h2>Items received</h2>

          <div class="picker">
            <input
              v-model="query"
              type="search"
              placeholder="Search a product to add…"
              aria-label="Search products to add"
              autocomplete="off"
            />
            <ul v-if="results.length" class="results">
              <li v-for="p in results" :key="p.id">
                <button type="button" @click="add(p)">
                  <span>{{ p.name }}</span>
                  <small>{{ formatQuantity(p.stock) }} {{ p.base_unit }} in stock</small>
                </button>
              </li>
            </ul>
            <p v-else-if="query.trim() && !searching" class="hint">
              No product matches "{{ query }}".
            </p>
          </div>

          <p v-if="!lines.length" class="empty">Search above to add what you received.</p>

          <div v-else class="lines">
            <div v-for="(line, i) in lines" :key="line.key" class="line">
              <div class="what">
                <strong>{{ line.product.name }}</strong>
                <small>
                  In stock {{ formatQuantity(line.product.stock) }} {{ line.product.base_unit }} ·
                  cost now
                  {{ formatUgx(line.product.current_cost) }}
                </small>
              </div>

              <div class="field qty">
                <label :for="`q-${line.key}`">Quantity</label>
                <input
                  :id="`q-${line.key}`"
                  v-model.number="line.quantity"
                  type="number"
                  inputmode="decimal"
                  step="any"
                  min="0"
                  required
                />
              </div>

              <div class="field unit">
                <label :for="`u-${line.key}`">Unit</label>
                <select :id="`u-${line.key}`" v-model="line.unit" @change="changeUnit(line)">
                  <option :value="line.product.base_unit">{{ line.product.base_unit }}</option>
                  <option v-for="u in line.product.units" :key="u.unit_name" :value="u.unit_name">
                    {{ u.unit_name }} ({{ formatQuantity(u.conversion_to_base_unit) }}
                    {{ line.product.base_unit }})
                  </option>
                </select>
                <span v-if="errors[`items.${i}.unit_name`]" class="field-error">
                  {{ errors[`items.${i}.unit_name`] }}
                </span>
              </div>

              <div class="field cost">
                <label :for="`c-${line.key}`">Cost per {{ line.unit }} (UGX)</label>
                <input
                  :id="`c-${line.key}`"
                  v-model.number="line.unitCost"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  required
                />
              </div>

              <div class="sum">
                <span class="amount">{{ formatUgx(lineTotal(line)) }}</span>
                <small v-if="line.unit !== line.product.base_unit && (line.quantity ?? 0) > 0">
                  = {{ formatQuantity(baseQuantity(line)) }} {{ line.product.base_unit }} at
                  {{ formatUgx(baseCost(line)) }} each
                </small>
              </div>

              <button
                type="button"
                class="remove"
                :aria-label="`Remove ${line.product.name}`"
                @click="remove(line)"
              >
                ×
              </button>
            </div>
          </div>
          <span v-if="errors.items" class="field-error">{{ errors.items }}</span>
        </section>

        <section class="card block">
          <div class="field">
            <label for="np-note">Note <span class="optional">(optional)</span></label>
            <input
              id="np-note"
              v-model="note"
              type="text"
              maxlength="500"
              placeholder="e.g. Delivered by boda, 2 bags damaged"
            />
          </div>
        </section>
      </div>

      <aside class="card block summary">
        <h2>Payment</h2>

        <dl>
          <div>
            <dt>Total</dt>
            <dd class="big">{{ formatUgx(total) }}</dd>
          </div>
        </dl>

        <div class="field">
          <label for="np-paid">Paid now (UGX)</label>
          <input
            id="np-paid"
            v-model.number="amountPaid"
            type="number"
            inputmode="numeric"
            min="0"
            :max="total"
            placeholder="0 — all on credit"
          />
          <span v-if="errors.amount_paid" class="field-error">{{ errors.amount_paid }}</span>
          <button v-if="total > 0" type="button" class="link small" @click="amountPaid = total">
            Paid in full
          </button>
        </div>

        <template v-if="paid > 0">
          <div class="methods" role="radiogroup" aria-label="Payment method">
            <button
              v-for="m in PAYMENT_METHODS"
              :key="m.value"
              type="button"
              role="radio"
              :aria-checked="method === m.value"
              class="method"
              :class="{ active: method === m.value }"
              @click="method = m.value"
            >
              {{ m.label }}
            </button>
          </div>
          <div class="field">
            <label for="np-payref">Reference <span class="optional">(optional)</span></label>
            <input id="np-payref" v-model="paymentReference" type="text" maxlength="100" />
          </div>
        </template>

        <p class="credit" :class="{ owes: onCredit > 0 }">
          <template v-if="total === 0">Add items to see what is owed.</template>
          <template v-else-if="onCredit > 0">
            <strong>{{ formatUgx(onCredit) }}</strong> will be added to what you owe this supplier.
          </template>
          <template v-else>Nothing left owing.</template>
        </p>

        <button type="submit" class="btn btn-primary btn-block" :disabled="saving || !valid">
          {{ saving ? 'Saving…' : 'Receive stock' }}
        </button>
        <p class="hint">
          Adds the quantities to your stock and updates each product's cost to the average of what
          you had and what you just bought.
        </p>
      </aside>
    </form>
  </main>
</template>

<style scoped>
.back {
  align-self: flex-start;
  font-size: 0.875rem;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 1.25rem;
  align-items: start;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

.block {
  padding: 1.25rem 1.5rem;
}

h2 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.optional {
  font-weight: 400;
  color: var(--color-ink-faint);
}

.hint {
  margin-top: 0.25rem;
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

.picker {
  position: relative;
  margin-bottom: 1rem;
}

.picker input {
  width: 100%;
  min-height: 42px;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.9375rem;
  outline: none;
}

.picker input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.results {
  position: absolute;
  z-index: 5;
  top: 100%;
  left: 0;
  right: 0;
  margin: 0.25rem 0 0;
  padding: 0.25rem;
  list-style: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.results button {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--color-ink);
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
}

.results button:hover,
.results button:focus-visible {
  background: var(--color-canvas);
}

.results small {
  color: var(--color-ink-faint);
}

.empty {
  padding: 1.5rem 0;
  color: var(--color-ink-faint);
  font-size: 0.875rem;
  text-align: center;
}

.lines {
  display: flex;
  flex-direction: column;
}

.line {
  display: grid;
  grid-template-columns:
    minmax(140px, 1.3fr) 90px minmax(170px, 1.2fr) minmax(130px, 1fr) minmax(110px, auto)
    28px;
  align-items: start;
  gap: 0.75rem;
  padding: 0.875rem 0;
  border-top: 1px solid var(--color-border);
}

.what {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-top: 1.5rem;
}

.what small,
.sum small {
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

.line .field input,
.line .field select {
  min-width: 0;
  width: 100%;
  padding: 0.5rem 0.625rem;
  font-size: 0.875rem;
}

.sum {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  padding-top: 1.5rem;
  text-align: right;
}

.amount {
  font-weight: 600;
}

.remove {
  margin-top: 1.375rem;
  border: none;
  background: none;
  color: var(--color-ink-faint);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.remove:hover {
  color: var(--color-danger);
}

.summary {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary h2 {
  margin-bottom: 0;
}

dl {
  margin: 0;
}

dt {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.big {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
}

.small {
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  cursor: pointer;
}

.methods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.method {
  min-height: 36px;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.method.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.credit {
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.credit.owes strong {
  color: var(--color-danger);
}

@media (max-width: 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .summary {
    position: static;
  }
}

@media (max-width: 720px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .line {
    grid-template-columns: 1fr 1fr;
  }

  .what,
  .sum {
    grid-column: 1 / -1;
    padding-top: 0;
    align-items: flex-start;
    text-align: left;
  }

  .remove {
    grid-column: 1 / -1;
    justify-self: end;
    margin-top: 0;
  }
}
</style>
