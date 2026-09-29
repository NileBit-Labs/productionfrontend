<script setup lang="ts">
import { computed } from 'vue'
import { formatDateTime, formatQuantity, formatUgx } from '@/lib/format'
import { paymentLabel, type Sale } from '@/types/sales'

const props = defineProps<{ sale: Sale; tendered?: number; change?: number }>()

const paidIn = computed(() => (props.sale.payments ?? []).filter((p) => p.direction === 'in'))
</script>

<template>
  <div class="receipt">
    <div v-if="sale.status === 'voided'" class="voided">VOIDED</div>
    <p v-if="sale.id === 0" class="offline-note">
      Saved on this device — it gets its receipt number once it syncs.
    </p>

    <header class="receipt-head">
      <h2>{{ sale.shop?.name }}</h2>
      <p v-if="sale.shop?.address">{{ sale.shop.address }}</p>
      <p v-if="sale.shop?.phone">{{ sale.shop.phone }}</p>
    </header>

    <dl class="meta">
      <div>
        <dt>Receipt</dt>
        <dd>{{ sale.sale_number }}</dd>
      </div>
      <div>
        <dt>Date</dt>
        <dd>{{ formatDateTime(sale.created_at) }}</dd>
      </div>
      <div v-if="sale.cashier">
        <dt>Served by</dt>
        <dd>{{ sale.cashier.name }}</dd>
      </div>
      <div v-if="sale.customer">
        <dt>Customer</dt>
        <dd>{{ sale.customer.name }}</dd>
      </div>
    </dl>

    <table class="lines">
      <tbody>
        <tr v-for="item in sale.items" :key="item.id">
          <td>
            <span class="item-name">{{ item.product_name }}</span>
            <span class="item-detail">
              {{ formatQuantity(item.quantity) }} {{ item.unit }} × {{ formatUgx(item.unit_price) }}
              <template v-if="item.discount"> − {{ formatUgx(item.discount) }}</template>
            </span>
          </td>
          <td class="amount">{{ formatUgx(item.line_total) }}</td>
        </tr>
      </tbody>
    </table>

    <dl class="totals">
      <div v-if="sale.discount">
        <dt>Subtotal</dt>
        <dd>{{ formatUgx(sale.subtotal) }}</dd>
      </div>
      <div v-if="sale.discount">
        <dt>Discount</dt>
        <dd>− {{ formatUgx(sale.discount) }}</dd>
      </div>
      <div class="grand">
        <dt>Total</dt>
        <dd>{{ formatUgx(sale.total) }}</dd>
      </div>
      <div v-for="payment in paidIn" :key="payment.id">
        <dt>{{ paymentLabel(payment.method) }}</dt>
        <dd>{{ formatUgx(payment.amount) }}</dd>
      </div>
      <div v-if="tendered && tendered > sale.total">
        <dt>Cash given</dt>
        <dd>{{ formatUgx(tendered) }}</dd>
      </div>
      <div v-if="change">
        <dt>Change</dt>
        <dd>{{ formatUgx(change) }}</dd>
      </div>
      <div v-if="sale.amount_due > 0" class="due">
        <dt>On credit</dt>
        <dd>{{ formatUgx(sale.amount_due) }}</dd>
      </div>
      <div v-if="sale.amount_due > 0 && sale.due_date" class="due">
        <dt>Pay by</dt>
        <dd>{{ sale.due_date }}</dd>
      </div>
    </dl>

    <dl v-if="sale.refunds?.length" class="totals refunds">
      <div v-for="refund in sale.refunds" :key="refund.id" class="refund-row">
        <dt>Refunded (R-{{ refund.id }})</dt>
        <dd>− {{ formatUgx(refund.total_refund) }}</dd>
      </div>
    </dl>

    <p v-if="sale.status === 'voided' && sale.void_reason" class="void-reason">
      Voided: {{ sale.void_reason }}
    </p>
    <p class="thanks">Thank you for shopping with us.</p>
  </div>
</template>

<style scoped>
.receipt {
  position: relative;
  width: 100%;
  max-width: 340px;
  margin: 0 auto;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
}

.voided {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-18deg);
  padding: 0.25rem 1rem;
  border: 3px solid var(--color-danger);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  opacity: 0.5;
  pointer-events: none;
}

.offline-note {
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  text-align: center;
}

.receipt-head {
  text-align: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed var(--color-border-strong);
}

.receipt-head h2 {
  font-size: 1rem;
}

.receipt-head p {
  color: var(--color-ink-soft);
}

.meta,
.totals {
  margin: 0;
}

.meta {
  padding: 0.75rem 0;
  border-bottom: 1px dashed var(--color-border-strong);
}

.meta div,
.totals div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.125rem 0;
}

dt {
  color: var(--color-ink-soft);
}

dd {
  margin: 0;
  text-align: right;
}

.lines {
  width: 100%;
  border-collapse: collapse;
}

.lines td {
  padding: 0.5rem 0;
  vertical-align: top;
  border-bottom: 1px dashed var(--color-border);
}

.item-name {
  display: block;
  font-weight: 500;
}

.item-detail {
  display: block;
  color: var(--color-ink-faint);
}

.amount {
  text-align: right;
  white-space: nowrap;
}

.totals {
  padding-top: 0.5rem;
}

.totals .grand {
  padding: 0.375rem 0;
  font-size: 1rem;
  font-weight: 700;
}

.totals .grand dt {
  color: var(--color-ink);
}

.totals .due {
  color: var(--color-danger);
  font-weight: 600;
}

.refunds {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border-strong);
  color: var(--color-danger);
}

.void-reason {
  margin-top: 0.75rem;
  color: var(--color-danger);
}

.thanks {
  margin-top: 1rem;
  text-align: center;
  color: var(--color-ink-faint);
}
</style>
