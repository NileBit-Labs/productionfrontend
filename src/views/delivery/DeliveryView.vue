<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BaseModal from '@/components/BaseModal.vue'
import PaginationBar from '@/components/PaginationBar.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime, formatUgx } from '@/lib/format'
import { PAYMENT_METHODS, type Sale } from '@/types/sales'

type Status = 'pending' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'failed' | 'cancelled'
type Order = { outstanding: number; id: number; status: Status; fulfillment_type: string; recipient_name: string; recipient_phone: string; address: string | null; location_notes: string | null; instructions: string | null; notes: string | null; requested_at: string | null; driver_name: string | null; driver_phone: string | null; dispatched_at: string | null; completed_at: string | null; proof_of_delivery: string | null; failure_reason: string | null; sale: Sale }
const labels: Record<Status, string> = { pending: 'Pending', preparing: 'Preparing', ready: 'Ready for dispatch / pickup', out_for_delivery: 'Out for delivery', delivered: 'Delivered / collected', failed: 'Failed', cancelled: 'Cancelled' }
const transitions: Record<Status, Status[]> = { pending: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['out_for_delivery', 'delivered', 'cancelled'], out_for_delivery: ['delivered', 'failed'], failed: ['ready', 'cancelled'], delivered: [], cancelled: [] }
const page = ref(1)
const perPage = ref(25)
const lastPage = ref(1)
const total = ref(0)
const orders = ref<Order[]>([])
const status = ref('')
const search = ref('')
const selected = ref<Order | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const form = reactive({ status: 'preparing' as Status, driver_name: '', driver_phone: '', proof_of_delivery: '', failure_reason: '' })
const payment = reactive({ amount: 0, method: 'CASH', reference: '', idempotency_key: crypto.randomUUID() })
function choices(order: Order) { return transitions[order.status].filter((s) => order.fulfillment_type === 'delivery' ? !(s === 'delivered' && order.status === 'ready') : s !== 'out_for_delivery') }
async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({ page: String(page.value), per_page: String(perPage.value), status: status.value, search: search.value })
    const data = await apiFetch<{ data: Order[]; last_page: number; total: number }>(`/delivery/orders?${params}`)
    orders.value = data.data
    lastPage.value = data.last_page
    total.value = data.total
  } catch (e) { error.value = apiErrorMessage(e) } finally { loading.value = false }
}
async function open(order: Order) {
  error.value = ''
  try {
    selected.value = await apiFetch<Order>(`/delivery/orders/${order.id}`)
    Object.assign(form, { status: choices(selected.value)[0] ?? selected.value.status, driver_name: selected.value.driver_name ?? '', driver_phone: selected.value.driver_phone ?? '', proof_of_delivery: '', failure_reason: '' })
    Object.assign(payment, { amount: selected.value.outstanding, method: 'CASH', reference: '', idempotency_key: crypto.randomUUID() })
  } catch (e) { error.value = apiErrorMessage(e) }
}
async function changeStatus() {
  if (!selected.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    selected.value = await apiFetch<Order>(`/delivery/orders/${selected.value.id}/status`, { method: 'POST', body: form })
    notice.value = 'Fulfillment updated.'
    form.status = choices(selected.value)[0] ?? selected.value.status
    await load()
  } catch (e) { error.value = apiErrorMessage(e) } finally { saving.value = false }
}
async function collect() {
  if (!selected.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    selected.value = await apiFetch<Order>(`/delivery/orders/${selected.value.id}/payments`, { method: 'POST', body: payment })
    notice.value = 'Payment recorded.'
    payment.idempotency_key = crypto.randomUUID()
    payment.amount = selected.value.outstanding
    await load()
  } catch (e) { error.value = apiErrorMessage(e) } finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <main class="fulfillment">
    <header><div><p class="eyebrow">Customer orders</p><h1>Order fulfillment</h1><p>Prepare pickups and deliveries, dispatch them and record recipient confirmation.</p></div><RouterLink class="btn btn-primary" to="/pos">New order</RouterLink></header>
    <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <form class="filters" @submit.prevent="page = 1; load()"><input v-model="search" aria-label="Search recipient" placeholder="Search recipient" /><select v-model="status" aria-label="Fulfillment status"><option value="">All statuses</option><option v-for="(label, value) in labels" :key="value" :value="value">{{ label }}</option></select><button class="btn ui-btn-secondary">Filter</button></form>
    <p v-if="loading">Loading orders…</p><p v-else-if="!orders.length">No matching orders. Choose Pickup or Delivery when creating a sale.</p>
    <div v-else class="card table-wrap"><table><thead><tr><th>Sale / recipient</th><th>Type / status</th><th>Requested</th><th>Total / unpaid</th><th /></tr></thead><tbody><tr v-for="order in orders" :key="order.id"><td><strong>{{ order.sale.sale_number }}</strong><br />{{ order.recipient_name }}<br />{{ order.recipient_phone }}</td><td>{{ order.fulfillment_type }}<br />{{ labels[order.status] }}</td><td>{{ order.requested_at ? formatDateTime(order.requested_at) : 'Not scheduled' }}</td><td>{{ formatUgx(order.sale.total) }}<br />{{ formatUgx(order.outstanding) }} unpaid</td><td><button class="btn ui-btn-secondary" @click="open(order)">Manage</button></td></tr></tbody></table></div>
    <PaginationBar :page="page" :last-page="lastPage" :total="total" :per-page="perPage" @update:page="page = $event; load()" @update:per-page="perPage = $event; page = 1; load()" />
    <BaseModal v-if="selected" :title="`${selected.sale.sale_number} · ${labels[selected.status]}`" @close="selected = null">
      <p v-if="error" class="alert-danger" role="alert">{{ error }}</p>
      <p>{{ selected.recipient_name }} · {{ selected.recipient_phone }}</p><p>{{ selected.address }} {{ selected.location_notes }}</p><p>{{ selected.instructions }} {{ selected.notes }}</p>
      <p v-if="selected.dispatched_at">Dispatched: {{ formatDateTime(selected.dispatched_at) }} · {{ selected.driver_name }} · {{ selected.driver_phone }}</p><p v-if="selected.completed_at">Completed: {{ formatDateTime(selected.completed_at) }} · {{ selected.proof_of_delivery }}</p><p v-if="selected.failure_reason">{{ selected.failure_reason }}</p>
      <ul><li v-for="item in selected.sale.items" :key="item.id">{{ item.quantity }} {{ item.unit }} · {{ item.product_name }}</li></ul>
      <p>Delivery fee: {{ formatUgx(selected.sale.delivery_fee ?? 0) }} · Unpaid: {{ formatUgx(selected.outstanding) }}</p>
      <form v-if="choices(selected).length && selected.sale.status === 'completed'" @submit.prevent="changeStatus">
        <div class="field"><label for="next-status">Next status</label><select id="next-status" v-model="form.status"><option v-for="value in choices(selected)" :key="value" :value="value">{{ labels[value] }}</option></select></div>
        <template v-if="form.status === 'out_for_delivery'"><div class="field"><label for="driver-name">Delivery person</label><input id="driver-name" v-model="form.driver_name" required maxlength="255" /></div><div class="field"><label for="driver-phone">Delivery person contact</label><input id="driver-phone" v-model="form.driver_phone" type="tel" required maxlength="100" /></div></template>
        <div v-if="form.status === 'delivered'" class="field"><label for="delivery-proof">Recipient confirmation / delivery note</label><input id="delivery-proof" v-model="form.proof_of_delivery" required maxlength="1000" /></div>
        <div v-if="form.status === 'failed' || form.status === 'cancelled'" class="field"><label for="failure-reason">Reason</label><input id="failure-reason" v-model="form.failure_reason" required maxlength="500" /></div>
        <button class="btn btn-primary" :disabled="saving">Update status</button>
      </form>
      <form v-if="selected.outstanding > 0 && selected.status !== 'cancelled' && selected.sale.status === 'completed'" @submit.prevent="collect"><h3>Collect payment</h3><div class="field"><label for="collection-amount">Amount (UGX)</label><input id="collection-amount" v-model.number="payment.amount" type="number" min="1" :max="selected.outstanding" required /></div><div class="field"><label for="collection-method">Method</label><select id="collection-method" v-model="payment.method"><option v-for="method in PAYMENT_METHODS" :key="method.value" :value="method.value">{{ method.label }}</option></select></div><div class="field"><label for="collection-reference">Reference</label><input id="collection-reference" v-model="payment.reference" maxlength="100" /></div><button class="btn btn-primary" :disabled="saving">Record payment</button></form>
      <p>Failed or cancelled fulfillment does not refund payments or return stock. Use the sale’s return workflow to record what actually came back. Delivery fees can be refunded explicitly from the sale.</p><RouterLink :to="`/sales/${selected.sale.id}`">View sale, returns and receipt</RouterLink><RouterLink to="/expenses">Record delivery expense</RouterLink>
    </BaseModal>
  </main>
</template>

<style scoped>
.fulfillment { display: grid; gap: 1.25rem; max-width: 1200px; margin: auto; }
header, .filters { display: flex; gap: 1rem; align-items: center; justify-content: space-between; flex-wrap: wrap; }
h1 { margin: .25rem 0; }
.eyebrow { color: var(--text-muted); }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 1rem; border-bottom: 1px solid var(--border); }
form { display: grid; gap: .75rem; }
.filters { display: flex; }
</style>
