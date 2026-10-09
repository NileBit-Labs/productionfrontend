<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime, formatQuantity, formatUgx } from '@/lib/format'
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONE, type PurchaseDetail } from '@/types/purchasing'
import { PAYMENT_METHODS, paymentLabel } from '@/types/sales'

const route = useRoute()

const purchase = ref<PurchaseDetail | null>(null)
const error = ref('')
const cancelling = ref(false)
const reason = ref('')
const saving = ref(false)
const cancelError = ref('')
const returning = ref(false)
const returnReason = ref('')
const returnQuantity = reactive<Record<number, number>>({})
const refundReceived = ref(false)
const refundMethod = ref('BANK')
let returnKey = crypto.randomUUID()
const returnLines = computed(() => Object.entries(returnQuantity).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => ({ purchase_item_id: Number(id), quantity })))
async function returnItems() {
  saving.value = true
  cancelError.value = ''
  try {
    await apiFetch(`/purchases/${route.params.id}/returns`, { method: 'POST', body: { idempotency_key: returnKey, reason: returnReason.value, lines: returnLines.value, refund_received: refundReceived.value, method: refundMethod.value } })
    returnKey = crypto.randomUUID()
    returning.value = false
    await load()
  } catch (e) { cancelError.value = apiErrorMessage(e) } finally { saving.value = false }
}

async function load() {
  error.value = ''
  try {
    purchase.value = await apiFetch<PurchaseDetail>(`/purchases/${route.params.id}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

async function cancel() {
  saving.value = true
  cancelError.value = ''
  try {
    purchase.value = await apiFetch<PurchaseDetail>(`/purchases/${route.params.id}/cancel`, {
      method: 'POST',
      body: { reason: reason.value.trim() },
    })
    cancelling.value = false
  } catch (e) {
    cancelError.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="ui-page">
    <RouterLink class="back link" to="/purchases">← Purchases</RouterLink>

    <p v-if="error" class="alert-danger">{{ error }}</p>
    <p v-else-if="!purchase" class="ui-state">Loading…</p>

    <template v-else>
      <header class="head card">
        <div>
          <p class="ui-eyebrow">Purchase</p>
          <h1>
            {{ purchase.purchase_number }}
            <span class="ui-badge" :class="PAYMENT_STATUS_TONE[purchase.payment_status]">
              {{ PAYMENT_STATUS_LABELS[purchase.payment_status] }}
            </span>
          </h1>
          <p class="meta">
            From
            <RouterLink class="link" :to="`/suppliers/${purchase.supplier.id}`">
              {{ purchase.supplier.name }}
            </RouterLink>
            · {{ purchase.purchase_date }} · received by {{ purchase.received_by }}
            <template v-if="purchase.reference"> · Invoice {{ purchase.reference }}</template>
          </p>
          <p v-if="purchase.note" class="note">{{ purchase.note }}</p>
        </div>

        <div class="actions"><button v-if="purchase.status === 'received'" class="btn ui-btn-secondary" @click="returning = true; cancelError = ''">Return to supplier</button>
          <RouterLink
            v-if="purchase.owed > 0"
            class="btn btn-primary"
            :to="`/suppliers/${purchase.supplier.id}`"
          >
            Pay supplier
          </RouterLink>
          <button
            v-if="purchase.status === 'received'"
            type="button"
            class="btn ui-btn-secondary danger"
            @click="cancelling = true"
          >
            Cancel purchase
          </button>
        </div>
      </header>

      <p v-if="purchase.status === 'cancelled'" class="cancelled">
        Cancelled{{ purchase.cancelled_at ? ` on ${formatDateTime(purchase.cancelled_at)}` : '' }}:
        {{ purchase.cancel_reason }}. The stock was taken back out and nothing is owed for it.
      </p>

      <section class="card ui-table-card">
        <div class="ui-table-scroll">
          <table class="ui-table">
            <thead>
              <tr>
                <th>Product</th>
                <th class="num">Quantity</th>
                <th class="num">Cost each</th>
                <th class="num">Total</th>
                <th class="num">Added to stock</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in purchase.items" :key="item.id">
                <td>{{ item.product_name }}</td>
                <td class="num">
                  {{ formatQuantity(item.quantity) }} {{ item.unit_name ?? item.base_unit }}
                </td>
                <td class="num">{{ formatUgx(item.unit_cost) }}</td>
                <td class="num">{{ formatUgx(item.line_total) }}</td>
                <td class="num">
                  {{ formatQuantity(item.base_quantity) }} {{ item.base_unit }}
                  <small>at {{ formatUgx(item.base_unit_cost) }} each</small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="two">
        <section class="card block">
          <h2>Payment</h2>
          <dl class="totals">
            <div>
              <dt>Total</dt>
              <dd>{{ formatUgx(purchase.total) }}</dd>
            </div>
            <div>
              <dt>Paid when received</dt>
              <dd>{{ formatUgx(purchase.amount_paid) }}</dd>
            </div>
            <div class="strong">
              <dt>Still owed</dt>
              <dd :class="{ owes: purchase.owed > 0 }">{{ formatUgx(purchase.owed) }}</dd>
            </div>
          </dl>
        </section>

        <section class="card block">
          <h2>Paid when received</h2>
          <p v-if="!purchase.payments.length" class="muted">
            Nothing was paid at the time. Later payments are recorded on the supplier's account.
          </p>
          <ul v-else class="pays">
            <li v-for="p in purchase.payments" :key="p.id">
              <span
                >{{ paymentLabel(p.method)
                }}<template v-if="p.reference"> · {{ p.reference }}</template></span
              >
              <strong>{{ formatUgx(p.amount) }}</strong>
            </li>
          </ul>
        </section>
      </div>

      <BaseModal v-if="cancelling" title="Cancel this purchase?" @close="cancelling = false">
        <form class="form" @submit.prevent="cancel">
          <p class="lead">
            The stock it added will be taken back out, and what you owe for it removed. This can't
            be done once money has been paid against it, or if some of the stock has been sold.
          </p>
          <p v-if="cancelError" class="alert-danger">{{ cancelError }}</p>
          <div class="field">
            <label for="cancel-reason">Reason</label>
            <input
              id="cancel-reason"
              v-model="reason"
              type="text"
              maxlength="255"
              required
              placeholder="e.g. Entered twice"
            />
          </div>
          <button
            type="submit"
            class="btn btn-primary btn-block"
            :disabled="saving || reason.trim().length < 3"
          >
            {{ saving ? 'Cancelling…' : 'Cancel purchase' }}
          </button>
        </form>
      </BaseModal>
    </template>
    <BaseModal v-if="returning && purchase" title="Return to supplier" @close="returning = false">
      <form @submit.prevent="returnItems"><p>Record goods actually returned. Unpaid amounts reduce supplier debt. A paid portion requires confirmation of the supplier refund.</p><p v-if="cancelError" class="alert-danger">{{ cancelError }}</p>
        <div v-for="item in purchase.items" :key="item.id" class="field"><label :for="`return-${item.id}`">{{ item.product_name }} · {{ item.unit_name ?? item.base_unit }}</label><input :id="`return-${item.id}`" v-model.number="returnQuantity[item.id]" type="number" min="0" :max="item.quantity" step=".001" /></div>
        <div class="field"><label for="supplier-return-reason">Reason</label><input id="supplier-return-reason" v-model="returnReason" required minlength="3" maxlength="500" /></div><label><input v-model="refundReceived" type="checkbox" /> Supplier refund received, if any paid amount is being returned</label><div class="field"><label for="supplier-refund-method">Refund method</label><select id="supplier-refund-method" v-model="refundMethod"><option v-for="method in PAYMENT_METHODS" :key="method.value" :value="method.value">{{ method.label }}</option></select></div><button class="btn btn-primary" :disabled="saving || !returnLines.length">Record return</button>
      </form>
    </BaseModal>
  </main>
</template>

<style scoped>
.back {
  align-self: flex-start;
  font-size: 0.875rem;
}

.head {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1.5rem;
}

.head h1 {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
  font-size: 1.5rem;
}

.meta {
  margin-top: 0.25rem;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.note {
  margin-top: 0.5rem;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.actions {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.danger {
  color: var(--color-danger);
}

.cancelled {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.875rem;
}

.two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.block {
  padding: 1.25rem 1.5rem;
}

h2 {
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.totals {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
}

.totals div {
  display: flex;
  justify-content: space-between;
  font-size: 0.9375rem;
}

.totals dd {
  margin: 0;
}

.totals .strong {
  padding-top: 0.5rem;
  border-top: 1px solid var(--color-border);
  font-weight: 700;
}

.owes {
  color: var(--color-danger);
}

.muted {
  color: var(--color-ink-faint);
  font-size: 0.875rem;
}

.pays {
  list-style: none;
  margin: 0;
  padding: 0;
}

.pays li {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.pays li:last-child {
  border-bottom: none;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lead {
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

@media (max-width: 720px) {
  .two {
    grid-template-columns: 1fr;
  }
}
</style>
