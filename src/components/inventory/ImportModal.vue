<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { ApiError, apiErrorMessage, apiFetch } from '@/lib/api'
import { parseCsv } from '@/lib/csv'
import { formatUgx } from '@/lib/format'

const emit = defineEmits<{ close: []; imported: [count: number] }>()

const TEMPLATE = [
  'name,category,unit,price,cost,stock,low_stock,sku,barcode',
  'Sugar 1kg,Groceries,kg,4500,3800,60,15,SUG-001,6001001',
  'Soda 500ml,Beverages,piece,1500,1100,96,24,,6002001',
].join('\n')

// Header names people actually use in spreadsheets -> the field the server expects.
const ALIASES: Record<string, string> = {
  name: 'name',
  product: 'name',
  'product name': 'name',
  item: 'name',
  category: 'category',
  unit: 'base_unit',
  'base unit': 'base_unit',
  base_unit: 'base_unit',
  'sold by': 'base_unit',
  price: 'selling_price',
  'selling price': 'selling_price',
  selling_price: 'selling_price',
  'sell price': 'selling_price',
  cost: 'current_cost',
  'buying cost': 'current_cost',
  'buying price': 'current_cost',
  current_cost: 'current_cost',
  stock: 'opening_stock',
  'opening stock': 'opening_stock',
  opening_stock: 'opening_stock',
  quantity: 'opening_stock',
  qty: 'opening_stock',
  low_stock: 'low_stock_threshold',
  'low stock': 'low_stock_threshold',
  low_stock_threshold: 'low_stock_threshold',
  'reorder level': 'low_stock_threshold',
  sku: 'sku',
  barcode: 'barcode',
}

const NUMERIC = new Set(['selling_price', 'current_cost', 'opening_stock', 'low_stock_threshold'])

const text = ref('')
const step = ref<'input' | 'review'>('input')
const busy = ref(false)
const error = ref('')
const problems = ref<{ row: number; messages: Record<string, string[]> }[]>([])
const rows = ref<Record<string, string>[]>([])

const templateUrl = computed(() => URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' })))

function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => (text.value = String(reader.result ?? ''))
  reader.readAsText(file)
}

function clean(field: string, value: string): string {
  const v = value.trim()
  if (!NUMERIC.has(field)) return v
  // "UGX 4,500" -> "4500"; blanks stay blank so optional columns can be empty.
  return v.replace(/[^0-9.-]/g, '')
}

function build(): Record<string, string>[] | null {
  const table = parseCsv(text.value)
  if (table.length < 2) {
    error.value = 'Add a header row and at least one product.'
    return null
  }

  const header = (table[0] ?? []).map((h) => ALIASES[h.trim().toLowerCase()] ?? null)
  if (!header.includes('name') || !header.includes('selling_price')) {
    error.value = 'The first row must have at least a "name" and a "price" column.'
    return null
  }

  return table.slice(1).map((cells) => {
    const row: Record<string, string> = {}
    header.forEach((field, i) => {
      if (field) row[field] = clean(field, cells[i] ?? '')
    })
    return row
  })
}

async function check() {
  error.value = ''
  problems.value = []
  const built = build()
  if (!built) return

  busy.value = true
  try {
    await apiFetch('/products/import', { method: 'POST', body: { rows: built, dry_run: true } })
    rows.value = built
    step.value = 'review'
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) {
      const body = e.body as { message?: string; errors?: unknown }
      if (Array.isArray(body.errors)) {
        problems.value = body.errors as typeof problems.value
        error.value = body.message ?? 'Some rows need fixing.'
      } else {
        error.value = apiErrorMessage(e)
      }
    } else {
      error.value = apiErrorMessage(e)
    }
  } finally {
    busy.value = false
  }
}

async function run() {
  busy.value = true
  error.value = ''
  try {
    await apiFetch('/products/import', { method: 'POST', body: { rows: rows.value } })
    emit('imported', rows.value.length)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

function fieldText(messages: Record<string, string[]>) {
  return Object.entries(messages)
    .map(([field, list]) => `${field.replace('_', ' ')}: ${list[0]}`)
    .join(' · ')
}
</script>

<template>
  <BaseModal title="Import products" @close="emit('close')">
    <template v-if="step === 'input'">
      <p class="lead">
        Bring your product list in from a spreadsheet. Save it as CSV, or paste the rows below. The
        first row holds the column names.
      </p>
      <a class="link tpl" :href="templateUrl" download="products-template.csv"
        >Download a template</a
      >

      <input
        type="file"
        accept=".csv,text/csv"
        class="file"
        aria-label="Choose a CSV file"
        @change="onFile"
      />
      <textarea
        v-model="text"
        rows="7"
        placeholder="name,category,unit,price,cost,stock&#10;Sugar 1kg,Groceries,kg,4500,3800,60"
        aria-label="Paste CSV"
      />

      <p v-if="error" class="alert-danger">{{ error }}</p>

      <div v-if="problems.length" class="problems">
        <p v-for="p in problems.slice(0, 20)" :key="p.row">
          <strong>Line {{ p.row + 1 }}</strong> — {{ fieldText(p.messages) }}
        </p>
        <p v-if="problems.length > 20" class="more">…and {{ problems.length - 20 }} more.</p>
      </div>

      <button
        type="button"
        class="btn btn-primary btn-block"
        :disabled="busy || !text.trim()"
        @click="check"
      >
        {{ busy ? 'Checking…' : 'Check file' }}
      </button>
    </template>

    <template v-else>
      <p class="ok">
        <strong>{{ rows.length }} product{{ rows.length === 1 ? '' : 's' }}</strong> are ready to
        import. Nothing has been added yet.
      </p>

      <div class="preview">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th class="num">Price</th>
              <th class="num">Stock</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rows.slice(0, 8)" :key="i">
              <td>{{ row.name }}</td>
              <td>{{ row.category || '—' }}</td>
              <td class="num">{{ formatUgx(Number(row.selling_price || 0)) }}</td>
              <td class="num">{{ row.opening_stock || 0 }} {{ row.base_unit || 'piece' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="rows.length > 8" class="more">…and {{ rows.length - 8 }} more.</p>
      </div>

      <p v-if="error" class="alert-danger">{{ error }}</p>

      <div class="actions">
        <button type="button" class="btn ui-btn-secondary" :disabled="busy" @click="step = 'input'">
          Back
        </button>
        <button type="button" class="btn btn-primary grow" :disabled="busy" @click="run">
          {{ busy ? 'Importing…' : `Import ${rows.length} product${rows.length === 1 ? '' : 's'}` }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.lead {
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.tpl {
  display: inline-block;
  margin: 0.5rem 0 1rem;
  font-size: 0.8125rem;
}

.file {
  display: block;
  margin-bottom: 0.75rem;
  font-size: 0.8125rem;
}

textarea {
  width: 100%;
  margin-bottom: 1rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem;
  resize: vertical;
  outline: none;
}

textarea:focus {
  border-color: var(--color-primary);
}

.problems {
  max-height: 180px;
  margin-bottom: 1rem;
  padding: 0.75rem;
  overflow-y: auto;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
}

.problems p + p {
  margin-top: 0.375rem;
}

.more {
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

.ok {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.875rem;
}

.preview {
  margin-bottom: 1rem;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

th {
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-ink-faint);
  font-size: 0.6875rem;
  text-align: left;
  text-transform: uppercase;
}

td {
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.num {
  text-align: right;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.grow {
  flex: 1;
}
</style>
