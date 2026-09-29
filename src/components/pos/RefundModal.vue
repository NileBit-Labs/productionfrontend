<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatQuantity, formatUgx, uuid } from '@/lib/format'
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type RefundPlan,
  type Refundable,
  type Sale,
} from '@/types/sales'

const props = defineProps<{ sale: Sale }>()
const emit = defineEmits<{ close: []; done: [] }>()

interface Info {
  items: Refundable[]
  customer: { name: string; balance: number; owed_on_this_sale: number } | null
}

const info = ref<Info | null>(null)
const quantity = reactive<Record<number, number>>({})
const restock = reactive<Record<number, boolean>>({})
const method = ref<PaymentMethod>('CASH')
const reason = ref('')
const plan = ref<RefundPlan | null>(null)
const loading = ref(true)
const submitting = ref(false)
const error = ref('')
// One key per open modal: a retried submit can never pay out twice.
const key = uuid()

const lines = computed(() =>
  Object.entries(quantity)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => ({
      sale_item_id: Number(id),
      quantity: q,
      restock: restock[Number(id)] ?? true,
    })),
)

let timer: ReturnType<typeof setTimeout> | undefined
watch(
  [quantity, restock],
  () => {
    clearTimeout(timer)
    plan.value = null
    if (!lines.value.length) return
    // The server is the only place that prices a refund, so preview asks it.
    timer = setTimeout(async () => {
      try {
        error.value = ''
        plan.value = await apiFetch<RefundPlan>(`/sales/${props.sale.id}/refund`, {
          method: 'POST',
          body: { dry_run: true, lines: lines.value },
        })
      } catch (e) {
        error.value = apiErrorMessage(e)
      }
    }, 250)
  },
  { deep: true },
)

onMounted(async () => {
  try {
    info.value = await apiFetch<Info>(`/sales/${props.sale.id}/refundable`)
    for (const item of info.value.items) {
      quantity[item.sale_item_id] = 0
      restock[item.sale_item_id] = true
    }
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
})

const canSubmit = computed(
  () =>
    !!plan.value &&
    plan.value.total_refund > 0 &&
    reason.value.trim().length >= 3 &&
    !submitting.value,
)

function setAll() {
  for (const item of info.value?.items ?? []) quantity[item.sale_item_id] = item.remaining
}

async function submit() {
  submitting.value = true
  error.value = ''
  try {
    await apiFetch(`/sales/${props.sale.id}/refund`, {
      method: 'POST',
      body: {
        idempotency_key: key,
        lines: lines.value,
        method: plan.value && plan.value.cash_refund > 0 ? method.value : undefined,
        reason: reason.value,
      },
    })
    emit('done')
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal title="Refund items" @close="emit('close')">
    <p v-if="loading" class="muted">Loading…</p>

    <template v-else-if="info">
      <p v-if="error" class="alert-danger">{{ error }}</p>

      <div class="head-row">
        <p class="muted">Choose what is coming back.</p>
        <button type="button" class="link all" @click="setAll">Refund everything</button>
      </div>

      <ul class="items">
        <li
          v-for="item in info.items"
          :key="item.sale_item_id"
          :class="{ done: item.remaining <= 0 }"
        >
          <div class="item-top">
            <span class="name">{{ item.product_name }}</span>
            <span class="muted">
              {{ formatQuantity(item.remaining) }} of {{ formatQuantity(item.sold) }}
              {{ item.unit }} left
            </span>
          </div>
          <div v-if="item.remaining > 0" class="item-controls">
            <input
              v-model.number="quantity[item.sale_item_id]"
              type="number"
              step="any"
              min="0"
              :max="item.remaining"
              :aria-label="`${item.product_name} quantity to refund`"
            />
            <label class="check">
              <input v-model="restock[item.sale_item_id]" type="checkbox" />
              Put back in stock
            </label>
          </div>
          <p
            v-if="
              item.remaining > 0 &&
              restock[item.sale_item_id] === false &&
              (quantity[item.sale_item_id] ?? 0) > 0
            "
            class="hint"
          >
            Damaged or unsellable — refunded, but stock is not increased.
          </p>
        </li>
      </ul>

      <div v-if="plan" class="plan">
        <div class="plan-row total">
          <span>Refund value</span><strong>{{ formatUgx(plan.total_refund) }}</strong>
        </div>
        <div v-if="plan.balance_credit > 0" class="plan-row">
          <span>Taken off {{ sale.customer?.name ?? 'the customer' }}'s balance</span>
          <strong>{{ formatUgx(plan.balance_credit) }}</strong>
        </div>
        <div v-if="plan.cash_refund > 0" class="plan-row">
          <span>Money to give back</span><strong>{{ formatUgx(plan.cash_refund) }}</strong>
        </div>
      </div>

      <div
        v-if="plan && plan.cash_refund > 0"
        class="methods"
        role="radiogroup"
        aria-label="Pay back by"
      >
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
        <label for="refund-reason">Reason</label>
        <input
          id="refund-reason"
          v-model="reason"
          type="text"
          maxlength="255"
          placeholder="e.g. Item was faulty"
        />
      </div>

      <button
        type="button"
        class="btn btn-primary btn-block confirm"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ submitting ? 'Refunding…' : 'Confirm refund' }}
      </button>
    </template>

    <p v-else-if="error" class="alert-danger">{{ error }}</p>
  </BaseModal>
</template>

<style scoped>
.muted {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.all {
  border: none;
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  cursor: pointer;
}

.items {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
}

.items li {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border);
}

.items li.done {
  opacity: 0.5;
}

.item-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
}

.name {
  font-weight: 600;
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.item-controls > input[type='number'] {
  width: 90px;
  height: 38px;
  padding: 0 0.625rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.9375rem;
  outline: none;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.hint {
  margin-top: 0.375rem;
  color: #b45309;
  font-size: 0.75rem;
}

.plan {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  background: var(--color-canvas);
}

.plan-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.25rem 0;
  font-size: 0.875rem;
}

.plan-row.total {
  font-size: 1rem;
}

.methods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.method {
  min-height: 38px;
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

.confirm {
  margin-top: 1rem;
  min-height: 46px;
}
</style>
