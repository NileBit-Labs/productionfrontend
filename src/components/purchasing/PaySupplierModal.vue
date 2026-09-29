<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatUgx } from '@/lib/format'
import { PAYMENT_METHODS, type PaymentMethod } from '@/types/sales'
import type { Supplier } from '@/types/purchasing'

const props = defineProps<{ supplier: Supplier }>()
const emit = defineEmits<{ close: []; paid: [supplier: Supplier] }>()

const amount = ref(props.supplier.balance)
const method = ref<PaymentMethod>('CASH')
const reference = ref('')
const saving = ref(false)
const error = ref('')

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const updated = await apiFetch<Supplier>(`/suppliers/${props.supplier.id}/payments`, {
      method: 'POST',
      body: {
        amount: Math.round(Number(amount.value)),
        method: method.value,
        reference: reference.value || undefined,
      },
    })
    emit('paid', updated)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal title="Pay supplier" @close="emit('close')">
    <p class="who">You owe {{ supplier.name }}</p>
    <p class="owed">{{ formatUgx(supplier.balance) }}</p>

    <form class="form" @submit.prevent="submit">
      <p v-if="error" class="alert-danger">{{ error }}</p>

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
        <label for="sp-amount">Amount paid</label>
        <input
          id="sp-amount"
          v-model.number="amount"
          type="number"
          inputmode="numeric"
          min="1"
          :max="supplier.balance"
          required
        />
      </div>

      <div class="field">
        <label for="sp-ref">Reference <span class="optional">(optional)</span></label>
        <input
          id="sp-ref"
          v-model="reference"
          type="text"
          maxlength="100"
          placeholder="Receipt or transaction number"
        />
      </div>

      <p v-if="amount > 0 && amount <= supplier.balance" class="after">
        Still owed after this: <strong>{{ formatUgx(supplier.balance - amount) }}</strong
        >. Applied to the oldest purchases first.
      </p>

      <button
        type="submit"
        class="btn btn-primary btn-block"
        :disabled="saving || !(amount > 0) || amount > supplier.balance"
      >
        {{ saving ? 'Recording…' : 'Record payment' }}
      </button>
    </form>
  </BaseModal>
</template>

<style scoped>
.who {
  font-size: 0.75rem;
  color: var(--color-ink-faint);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.owed {
  margin: 0.125rem 0 1rem;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-danger);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.methods {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.method {
  min-height: 40px;
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

.optional {
  font-weight: 400;
  color: var(--color-ink-faint);
}

.after {
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}
</style>
