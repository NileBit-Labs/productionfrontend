<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage } from '@/lib/api'
import { formatUgx, localDate } from '@/lib/format'
import { useCartStore, type PaymentInput } from '@/stores/cart'
import { PAYMENT_METHODS, type Sale } from '@/types/sales'

const props = defineProps<{ total: number }>()
const emit = defineEmits<{ close: []; paid: [sale: Sale, tendered: number, change: number] }>()

const cart = useCartStore()

const rows = ref<PaymentInput[]>([{ method: 'CASH', amount: props.total, reference: '' }])
const submitting = ref(false)
const error = ref('')

const tendered = computed(() => rows.value.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))
const remaining = computed(() => Math.max(props.total - tendered.value, 0))
const change = computed(() => Math.max(tendered.value - props.total, 0))
const canGiveChange = computed(
  () =>
    change.value === 0 || rows.value.some((r) => r.method === 'CASH' && r.amount >= change.value),
)
// A short payment is fine when there is a customer to owe the rest.
const onCredit = computed(() => remaining.value > 0 && !!cart.customer)
const canConfirm = computed(
  () =>
    !submitting.value &&
    (onCredit.value || (remaining.value === 0 && canGiveChange.value && tendered.value > 0)),
)

const isoDate = (offsetDays: number) => localDate(new Date(), offsetDays)
const today = isoDate(0)
onMounted(() => {
  if (!cart.dueDate) cart.dueDate = isoDate(14)
})

// Quick cash amounts: exact, then the next round notes up from the total.
const quickAmounts = computed(() => {
  const amounts = new Set<number>([props.total])
  for (const step of [1000, 5000, 10000, 50000]) {
    const rounded = Math.ceil(props.total / step) * step
    if (rounded >= props.total) amounts.add(rounded)
  }
  return [...amounts].sort((a, b) => a - b).slice(0, 4)
})

function addSplit() {
  rows.value.push({ method: 'MOBILE_MONEY', amount: remaining.value, reference: '' })
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
}

async function confirm() {
  error.value = ''
  submitting.value = true
  try {
    const payments = rows.value
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({ ...r, amount: Math.round(Number(r.amount)) }))
    const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0)
    // The cart (and so props.total) is cleared once the sale succeeds, so
    // change must be worked out from the amount due before submitting.
    const amountDue = props.total
    const sale = await cart.checkout(payments)
    emit('paid', sale, paidTotal, Math.max(paidTotal - amountDue, 0))
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal title="Take payment" @close="emit('close')">
    <p class="due-label">Amount due</p>
    <p class="due-amount">{{ formatUgx(total) }}</p>

    <p v-if="error" class="alert-danger">{{ error }}</p>

    <div v-for="(row, index) in rows" :key="index" class="pay-row">
      <div class="methods" role="radiogroup" aria-label="Payment method">
        <button
          v-for="method in PAYMENT_METHODS"
          :key="method.value"
          type="button"
          role="radio"
          :aria-checked="row.method === method.value"
          class="method"
          :class="{ active: row.method === method.value }"
          @click="row.method = method.value"
        >
          {{ method.label }}
        </button>
      </div>

      <div class="amount-line">
        <div class="field grow">
          <label :for="`amount-${index}`">Amount</label>
          <input
            :id="`amount-${index}`"
            v-model.number="row.amount"
            type="number"
            inputmode="numeric"
            min="0"
          />
        </div>
        <button
          v-if="rows.length > 1"
          type="button"
          class="row-remove"
          aria-label="Remove payment"
          @click="removeRow(index)"
        >
          ×
        </button>
      </div>

      <div v-if="row.method === 'CASH' && index === 0 && rows.length === 1" class="quick">
        <button
          v-for="amount in quickAmounts"
          :key="amount"
          type="button"
          class="quick-btn"
          @click="row.amount = amount"
        >
          {{ formatUgx(amount) }}
        </button>
      </div>

      <div v-if="row.method !== 'CASH'" class="field">
        <label :for="`ref-${index}`">Reference (optional)</label>
        <input :id="`ref-${index}`" v-model="row.reference" type="text" maxlength="100" />
      </div>
    </div>

    <button v-if="remaining > 0" type="button" class="link split" @click="addSplit">
      + Split payment ({{ formatUgx(remaining) }} left)
    </button>

    <div class="summary">
      <template v-if="onCredit && cart.customer">
        <div class="credit">
          <span>On {{ cart.customer.name }}'s account</span
          ><strong>{{ formatUgx(remaining) }}</strong>
        </div>
        <div class="field due-date">
          <label for="due-date">Pay by</label>
          <input id="due-date" v-model="cart.dueDate" type="date" :min="today" />
        </div>
      </template>
      <template v-else-if="remaining > 0">
        <div class="short">
          <span>Still to pay</span><strong>{{ formatUgx(remaining) }}</strong>
        </div>
        <p class="hint">Add a customer to the sale to put the rest on credit.</p>
      </template>
      <div v-else-if="change > 0" class="change">
        <span>Change to give</span><strong>{{ formatUgx(change) }}</strong>
      </div>
      <p v-if="change > 0 && !canGiveChange" class="alert-danger">
        Only cash can give change — reduce the other payments.
      </p>
    </div>

    <button
      type="button"
      class="btn btn-primary btn-block confirm"
      :disabled="!canConfirm"
      @click="confirm"
    >
      {{ submitting ? 'Recording sale…' : onCredit ? 'Confirm sale on credit' : 'Confirm sale' }}
    </button>
  </BaseModal>
</template>

<style scoped>
.due-label {
  font-size: 0.75rem;
  color: var(--color-ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.due-amount {
  margin: 0.125rem 0 1rem;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.pay-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0;
  border-top: 1px solid var(--color-border);
}

.methods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.method {
  min-height: 44px;
  padding: 0 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink-soft);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.method.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.amount-line {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.grow {
  flex: 1;
}

.row-remove {
  width: 44px;
  height: 44px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-faint);
  font-size: 1.25rem;
  cursor: pointer;
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.quick-btn {
  min-height: 44px;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-canvas);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  cursor: pointer;
}

.quick-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.split {
  align-self: flex-start;
  margin-bottom: 0.5rem;
  border: none;
  background: none;
  padding: 0;
  font-size: 0.875rem;
  cursor: pointer;
}

.summary {
  margin: 0.5rem 0 1rem;
}

.summary div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  font-size: 0.9375rem;
}

.summary .short {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.summary .credit {
  background: #fef3c7;
  color: #92400e;
}

.summary .due-date {
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0;
}

.hint {
  margin-top: 0.5rem;
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.summary .change {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.summary .alert-danger {
  margin-top: 0.5rem;
}

.confirm {
  min-height: 48px;
  font-size: 1rem;
}

@media (max-width: 480px) {
  .due-amount {
    font-size: 1.75rem;
  }

  .method {
    flex: 1 1 calc(50% - 0.25rem);
    min-width: 0;
  }

  .quick-btn {
    flex: 1 1 calc(50% - 0.25rem);
    min-width: 0;
  }

  .summary div {
    gap: 0.75rem;
  }

  .summary strong {
    white-space: nowrap;
  }
}
</style>
