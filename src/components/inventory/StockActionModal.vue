<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { formatQuantity, uuid } from '@/lib/format'

type Kind = 'count' | 'change' | 'damage' | 'loss'

const props = defineProps<{
  product: { id: number; name: string; base_unit: string; stock: number }
  kind?: Kind
}>()
const emit = defineEmits<{ close: []; done: [] }>()

const KINDS: { value: Kind; label: string; hint: string }[] = [
  {
    value: 'count',
    label: 'Stock count',
    hint: 'You counted the shelf. Enter what is really there.',
  },
  {
    value: 'change',
    label: 'Add or remove',
    hint: 'Use + to add and − to remove, e.g. a correction.',
  },
  { value: 'damage', label: 'Damaged', hint: 'Goods that can no longer be sold.' },
  { value: 'loss', label: 'Lost', hint: 'Missing, stolen or expired stock.' },
]

const kind = ref<Kind>(props.kind ?? 'count')
const amount = ref<number | null>(null)
const reason = ref('')
const saving = ref(false)
const error = ref('')

// One key for this dialog: pressing Save twice, or retrying after a dropped
// connection, records the stock change once.
const key = uuid()

const hint = computed(() => KINDS.find((k) => k.value === kind.value)?.hint ?? '')

const change = computed(() => {
  if (amount.value == null) return null
  if (kind.value === 'count') return amount.value - props.product.stock
  if (kind.value === 'change') return amount.value
  return -amount.value
})

const after = computed(() => (change.value == null ? null : props.product.stock + change.value))

const valid = computed(() => {
  if (amount.value == null || reason.value.trim().length < 3) return false
  if (kind.value === 'count') return amount.value >= 0
  if (kind.value === 'change') return amount.value !== 0
  return amount.value > 0
})

const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + formatQuantity(Math.abs(n))

async function save() {
  if (amount.value == null) return
  saving.value = true
  error.value = ''
  const base = { product_id: props.product.id, reason: reason.value.trim(), idempotency_key: key }
  try {
    if (kind.value === 'count') {
      await apiFetch('/inventory/adjustments', {
        method: 'POST',
        body: { ...base, counted_quantity: amount.value },
      })
    } else if (kind.value === 'change') {
      await apiFetch('/inventory/adjustments', {
        method: 'POST',
        body: { ...base, quantity_delta: amount.value },
      })
    } else {
      await apiFetch(`/inventory/${kind.value === 'damage' ? 'damage' : 'loss'}`, {
        method: 'POST',
        body: { ...base, quantity: amount.value },
      })
    }
    emit('done')
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :title="`Update stock · ${product.name}`" @close="emit('close')">
    <form class="form" @submit.prevent="save">
      <p class="now">
        In the system now:
        <strong>{{ formatQuantity(product.stock) }} {{ product.base_unit }}</strong>
      </p>

      <p v-if="error" class="alert-danger">{{ error }}</p>

      <div class="field">
        <label for="sa-kind">What happened?</label>
        <select id="sa-kind" v-model="kind" @change="amount = null">
          <option v-for="k in KINDS" :key="k.value" :value="k.value">{{ k.label }}</option>
        </select>
        <span class="hint">{{ hint }}</span>
      </div>

      <div class="field">
        <label for="sa-amount">
          {{ kind === 'count' ? 'Counted quantity' : 'Quantity' }} ({{ product.base_unit }})
        </label>
        <input
          id="sa-amount"
          v-model.number="amount"
          type="number"
          inputmode="decimal"
          step="any"
          :min="kind === 'change' ? undefined : 0"
          required
        />
      </div>

      <p v-if="change !== null && after !== null" class="preview" :class="{ bad: after < 0 }">
        {{ signed(change) }} → {{ formatQuantity(Math.max(after, 0)) }} {{ product.base_unit }} left
        <template v-if="after < 0"> (stock can't go below zero)</template>
      </p>

      <div class="field">
        <label for="sa-reason">Reason</label>
        <input
          id="sa-reason"
          v-model="reason"
          type="text"
          maxlength="255"
          placeholder="e.g. Monthly count, box dropped"
          required
        />
        <span class="hint">Recorded in the stock history with your name.</span>
      </div>

      <button type="submit" class="btn btn-primary btn-block" :disabled="saving || !valid">
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </form>
  </BaseModal>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.now {
  color: var(--color-ink-soft);
  font-size: 0.875rem;
}

.preview {
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 500;
}

.preview.bad {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
</style>
