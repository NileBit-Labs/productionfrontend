<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, fieldErrors } from '@/lib/api'
import { formatQuantity, formatUgx, localDate, uuid } from '@/lib/format'
import { productionApi } from '@/lib/production'
import type { ProductionProduct, WastageRecord } from '@/types/production'

const records = ref<WastageRecord[]>([])
const products = ref<ProductionProduct[]>([])
const totalCost = ref(0)
const loading = ref(false)
const error = ref('')
const showForm = ref(false)
const saving = ref(false)
const errors = ref<Record<string, string>>({})
const form = reactive({ product_id: '', quantity: 0, reason: '', stage: '', wastage_date: localDate() })

async function load() {
  loading.value = true; error.value = ''
  try {
    const [wastage, productPage] = await Promise.all([productionApi.wastage.list(), productionApi.products.list('raw_material,packaging,finished_good')])
    records.value = wastage.records.data
    totalCost.value = wastage.total_cost
    products.value = productPage.data
  } catch (e) { error.value = apiErrorMessage(e) } finally { loading.value = false }
}
async function save() {
  saving.value = true; errors.value = {}
  try {
    await productionApi.wastage.create({ product_id: Number(form.product_id), quantity: Number(form.quantity), reason: form.reason, stage: form.stage || null, wastage_date: form.wastage_date, idempotency_key: uuid() })
    showForm.value = false; await load()
  } catch (e) { errors.value = fieldErrors(e); error.value = Object.keys(errors.value).length ? 'Please fix the highlighted fields.' : apiErrorMessage(e) } finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <main class="ui-page">
    <header class="ui-head"><div><p class="ui-eyebrow">Production inventory</p><h1>Wastage</h1></div><button type="button" class="btn btn-primary" @click="showForm = true">Record wastage</button></header>
    <p v-if="error" class="alert-danger">{{ error }}</p>
    <section class="card total"><span>Wastage cost</span><strong>{{ formatUgx(totalCost) }}</strong></section>
    <section class="card ui-table-card"><p v-if="loading" class="ui-state">Loading…</p><p v-else-if="!records.length" class="ui-state">No wastage recorded.</p><div v-else class="ui-table-scroll"><table class="ui-table"><thead><tr><th>Date</th><th>Product</th><th>Stage</th><th>Reason</th><th class="num">Quantity</th></tr></thead><tbody><tr v-for="record in records" :key="record.id"><td>{{ record.wastage_date }}</td><td>{{ record.product_name }}</td><td>{{ record.stage }}</td><td>{{ record.reason }}</td><td class="num">{{ formatQuantity(record.quantity) }}</td></tr></tbody></table></div></section>
    <BaseModal v-if="showForm" title="Record wastage" @close="showForm = false"><form class="form" @submit.prevent="save"><p v-if="error" class="alert-danger">{{ error }}</p><div class="field"><label>Product</label><select v-model="form.product_id" required autofocus><option value="" disabled>Select product</option><option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }} ({{ product.base_unit }})</option></select><span v-if="errors.product_id" class="field-error">{{ errors.product_id }}</span></div><div class="row"><div class="field"><label>Quantity</label><input v-model.number="form.quantity" type="number" min="0.001" step="any" required></div><div class="field"><label>Date</label><input v-model="form.wastage_date" type="date" required></div></div><div class="field"><label>Stage</label><select v-model="form.stage"><option value="">Use product type</option><option value="raw_material">Raw material</option><option value="packaging">Packaging</option><option value="finished_goods">Finished goods</option></select></div><div class="field"><label>Reason</label><textarea v-model="form.reason" rows="3" required /></div><button type="submit" class="btn btn-primary btn-block" :disabled="saving">{{ saving ? 'Saving…' : 'Record wastage' }}</button></form></BaseModal>
  </main>
</template>

<style scoped>
.total{width:min(100%,22rem);padding:1rem}.total span{display:block;color:var(--color-ink-faint);font-size:.8125rem}.total strong{display:block;margin-top:.25rem;font-size:1.5rem}.form{display:flex;flex-direction:column;gap:1rem}.row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}textarea{width:100%;padding:.625rem .75rem;border:1px solid var(--color-border-strong);border-radius:var(--radius-sm);background:var(--color-surface);color:var(--color-ink)}@media(max-width:640px){.row{grid-template-columns:1fr}}
</style>
