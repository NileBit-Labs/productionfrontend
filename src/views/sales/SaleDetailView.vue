<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import BaseModal from '@/components/BaseModal.vue'
import ReceiptView from '@/components/pos/ReceiptView.vue'
import RefundModal from '@/components/pos/RefundModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatDateTime, formatUgx } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { paymentLabel, type Sale } from '@/types/sales'

const route = useRoute()
const auth = useAuthStore()

const sale = ref<Sale | null>(null)
const error = ref('')
const showVoid = ref(false)
const showRefund = ref(false)
const reason = ref('')
const voiding = ref(false)
const voidError = ref('')

async function load() {
  error.value = ''
  try {
    sale.value = await apiFetch<Sale>(`/sales/${route.params.id}`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}

async function confirmVoid() {
  voiding.value = true
  voidError.value = ''
  try {
    sale.value = await apiFetch<Sale>(`/sales/${route.params.id}/void`, {
      method: 'POST',
      body: { reason: reason.value },
    })
    showVoid.value = false
    reason.value = ''
  } catch (e) {
    voidError.value = apiErrorMessage(e)
  } finally {
    voiding.value = false
  }
}

function print() {
  window.print()
}

async function share() {
  if (!sale.value) return
  const text = `${sale.value.shop?.name} — receipt ${sale.value.sale_number}\nTotal: ${formatUgx(sale.value.total)}`
  if (navigator.share) {
    await navigator.share({ title: `Receipt ${sale.value.sale_number}`, text }).catch(() => {})
  } else {
    await navigator.clipboard?.writeText(text)
  }
}

onMounted(load)
</script>

<template>
  <main class="page">
    <RouterLink class="back" to="/sales">← Sales history</RouterLink>

    <p v-if="error" class="alert-danger">{{ error }}</p>
    <p v-else-if="!sale" class="state">Loading…</p>

    <template v-else>
      <div class="layout">
        <div class="receipt-print">
          <ReceiptView :sale="sale" />
        </div>

        <div class="side">
          <div class="actions">
            <button type="button" class="btn" @click="print">Print</button>
            <button type="button" class="btn" @click="share">Share</button>
            <button
              v-if="auth.canManage && sale.status === 'completed'"
              type="button"
              class="btn"
              @click="showRefund = true"
            >
              Refund
            </button>
            <button
              v-if="auth.canManage && sale.status === 'completed' && !sale.refunds?.length"
              type="button"
              class="btn danger"
              @click="showVoid = true"
            >
              Void sale
            </button>
          </div>

          <section class="card block">
            <h2>Sale details</h2>
            <dl class="facts">
              <div>
                <dt>Status</dt>
                <dd>
                  <span class="badge" :class="sale.status">{{ sale.status }}</span>
                </dd>
              </div>
              <div>
                <dt>Receipt</dt>
                <dd>{{ sale.sale_number }}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{{ formatDateTime(sale.created_at) }}</dd>
              </div>
              <div>
                <dt>Served by</dt>
                <dd>{{ sale.cashier?.name ?? '—' }}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>
                  <RouterLink
                    v-if="sale.customer"
                    class="link"
                    :to="`/customers/${sale.customer.id}`"
                  >
                    {{ sale.customer.name }}
                  </RouterLink>
                  <template v-else>Walk-in</template>
                </dd>
              </div>
            </dl>

            <dl class="facts money">
              <div v-if="sale.discount > 0">
                <dt>Subtotal</dt>
                <dd>{{ formatUgx(sale.subtotal) }}</dd>
              </div>
              <div v-if="sale.discount > 0">
                <dt>Discount</dt>
                <dd>−{{ formatUgx(sale.discount) }}</dd>
              </div>
              <div class="strong">
                <dt>Total</dt>
                <dd>{{ formatUgx(sale.total) }}</dd>
              </div>
              <div>
                <dt>Paid</dt>
                <dd>{{ formatUgx(sale.amount_paid) }}</dd>
              </div>
              <div v-if="sale.amount_due > 0" class="owed">
                <dt>Left on credit{{ sale.due_date ? ` (due ${sale.due_date})` : '' }}</dt>
                <dd>{{ formatUgx(sale.amount_due) }}</dd>
              </div>
            </dl>

            <p v-if="sale.status === 'voided'" class="voided-note">
              Voided{{ sale.void_reason ? `: ${sale.void_reason}` : '' }}. The items went back to
              stock and the payments were reversed.
            </p>
          </section>

          <div class="stack">
            <section v-if="sale.payments?.length" class="card block">
              <h2>Payments</h2>
              <ul class="list">
                <li v-for="p in sale.payments" :key="p.id">
                  <span>
                    {{ paymentLabel(p.method) }}
                    <small v-if="p.reference">· {{ p.reference }}</small>
                    <small v-if="p.direction === 'out'" class="out">paid back</small>
                  </span>
                  <strong>{{ p.direction === 'out' ? '−' : '' }}{{ formatUgx(p.amount) }}</strong>
                </li>
              </ul>
            </section>

            <section v-if="sale.refunds?.length" class="card block">
              <h2>Refunds</h2>
              <ul class="list">
                <li v-for="r in sale.refunds" :key="r.id" class="refund">
                  <span>
                    {{ formatDateTime(r.created_at) }}
                    <small>{{ r.reason }}</small>
                    <small>
                      {{
                        r.balance_credit > 0
                          ? `${formatUgx(r.balance_credit)} taken off what they owed`
                          : ''
                      }}
                      {{
                        r.cash_refund > 0 && r.method
                          ? `${formatUgx(r.cash_refund)} paid back by ${paymentLabel(r.method)}`
                          : ''
                      }}
                    </small>
                  </span>
                  <strong>−{{ formatUgx(r.total_refund) }}</strong>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </template>

    <RefundModal
      v-if="showRefund && sale"
      :sale="sale"
      @close="showRefund = false"
      @done="
        () => {
          showRefund = false
          load()
        }
      "
    />

    <BaseModal v-if="showVoid && sale" title="Void this sale?" @close="showVoid = false">
      <p class="void-note">
        This returns the items to stock and reverses the payments. The sale stays in the records as
        voided and this is written to the audit log.
      </p>

      <p v-if="voidError" class="alert-danger">{{ voidError }}</p>

      <div class="field">
        <label for="reason">Reason</label>
        <input
          id="reason"
          v-model="reason"
          type="text"
          maxlength="255"
          placeholder="e.g. Wrong item"
        />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn" @click="showVoid = false">Keep sale</button>
        <button
          type="button"
          class="btn danger-solid"
          :disabled="reason.trim().length < 3 || voiding"
          @click="confirmVoid"
        >
          {{ voiding ? 'Voiding…' : 'Void sale' }}
        </button>
      </div>
    </BaseModal>
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 1.75rem 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.back {
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  text-decoration: none;
}

.back:hover {
  color: var(--color-primary);
}

.state {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-ink-faint);
}

.layout {
  display: grid;
  grid-template-columns: minmax(320px, 360px) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.side {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 1.25rem;
  align-items: start;
}

.side > .actions {
  grid-column: 1 / -1;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.block {
  padding: 1.25rem 1.5rem;
}

.block h2 {
  margin-bottom: 0.875rem;
  font-size: 1rem;
}

.facts {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.facts > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.9375rem;
}

.facts dt {
  color: var(--color-ink-soft);
}

.facts dd {
  margin: 0;
  text-align: right;
}

.facts.money {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.facts .strong {
  font-weight: 700;
}

.facts .owed dd {
  color: var(--color-danger);
  font-weight: 600;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge.voided {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.voided-note {
  margin-top: 1rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.875rem;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.list li {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.9375rem;
}

.list li:last-child {
  border-bottom: none;
}

.list small {
  display: block;
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.list small.out {
  color: var(--color-danger);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .receipt-print {
    max-width: 480px;
  }
}

.actions .btn,
.modal-actions .btn {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
}

.actions .danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.void-note {
  margin-bottom: 1rem;
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.modal-actions .danger-solid {
  border-color: transparent;
  background: var(--color-danger);
  color: var(--color-on-danger);
}
</style>
