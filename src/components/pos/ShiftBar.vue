<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import { apiErrorMessage } from '@/lib/api'
import { formatUgx } from '@/lib/format'
import { useShiftStore } from '@/stores/shift'
import type { Shift } from '@/types/shifts'

const shift = useShiftStore()

const opening = ref(false)
const closing = ref(false)
const cash = ref(0)
const note = ref('')
const busy = ref(false)
const error = ref('')
const result = ref<Shift | null>(null)

onMounted(() => void shift.load())

const since = computed(() =>
  shift.current
    ? new Date(shift.current.opened_at).toLocaleTimeString('en-UG', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
)

function openDialog(kind: 'open' | 'close') {
  cash.value = 0
  note.value = ''
  error.value = ''
  result.value = null
  if (kind === 'open') opening.value = true
  else closing.value = true
}

async function start() {
  busy.value = true
  error.value = ''
  try {
    await shift.open(Math.round(Number(cash.value)))
    opening.value = false
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function finish() {
  busy.value = true
  error.value = ''
  try {
    result.value = await shift.close(Math.round(Number(cash.value)), note.value)
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

function done() {
  closing.value = false
  result.value = null
}
</script>

<template>
  <div class="shift-bar">
    <template v-if="shift.current">
      <span class="dot" />
      <span>Shift open since {{ since }}</span>
      <button type="button" class="text-btn" @click="openDialog('close')">Close shift</button>
    </template>
    <button v-else type="button" class="text-btn" @click="openDialog('open')">Start shift</button>

    <BaseModal v-if="opening" title="Start your shift" @close="opening = false">
      <form class="form" @submit.prevent="start">
        <p v-if="error" class="alert-danger">{{ error }}</p>
        <p class="muted">Count the cash already in the drawer — this is your starting float.</p>
        <div class="field">
          <label for="float">Cash in the drawer (UGX)</label>
          <input
            id="float"
            v-model.number="cash"
            type="number"
            inputmode="numeric"
            min="0"
            autofocus
          />
        </div>
        <button type="submit" class="btn btn-primary btn-block" :disabled="busy">
          {{ busy ? 'Starting…' : 'Start shift' }}
        </button>
      </form>
    </BaseModal>

    <BaseModal
      v-if="closing"
      :title="result ? 'Shift closed' : 'Close your shift'"
      @close="result ? done() : (closing = false)"
    >
      <template v-if="!result">
        <form class="form" @submit.prevent="finish">
          <p v-if="error" class="alert-danger">{{ error }}</p>
          <p class="muted">Count all the cash in the drawer now, before looking at any totals.</p>
          <div class="field">
            <label for="counted">Cash counted (UGX)</label>
            <input
              id="counted"
              v-model.number="cash"
              type="number"
              inputmode="numeric"
              min="0"
              autofocus
            />
          </div>
          <div class="field">
            <label for="close-note">Note <span class="optional">(optional)</span></label>
            <input id="close-note" v-model="note" type="text" maxlength="255" />
          </div>
          <button type="submit" class="btn btn-primary btn-block" :disabled="busy">
            {{ busy ? 'Closing…' : 'Close shift' }}
          </button>
        </form>
      </template>

      <template v-else>
        <div class="result" :class="{ ok: result.variance === 0, off: result.variance !== 0 }">
          <p v-if="result.variance === 0" class="verdict">Balanced — the drawer matches.</p>
          <p v-else-if="(result.variance ?? 0) < 0" class="verdict">
            Short by {{ formatUgx(Math.abs(result.variance ?? 0)) }}
          </p>
          <p v-else class="verdict">Over by {{ formatUgx(result.variance ?? 0) }}</p>
        </div>
        <dl class="figures">
          <div>
            <dt>Starting float</dt>
            <dd>{{ formatUgx(result.opening_cash) }}</dd>
          </div>
          <div>
            <dt>Cash sales</dt>
            <dd>{{ formatUgx(result.summary?.cash_sales ?? 0) }}</dd>
          </div>
          <div v-if="result.summary?.cash_repayments">
            <dt>Customer repayments</dt>
            <dd>{{ formatUgx(result.summary.cash_repayments) }}</dd>
          </div>
          <div v-if="result.summary?.cash_refunds">
            <dt>Cash paid out</dt>
            <dd>− {{ formatUgx(result.summary.cash_refunds) }}</dd>
          </div>
          <div class="strong">
            <dt>Expected in drawer</dt>
            <dd>{{ formatUgx(result.expected_cash ?? 0) }}</dd>
          </div>
          <div class="strong">
            <dt>You counted</dt>
            <dd>{{ formatUgx(result.actual_cash ?? 0) }}</dd>
          </div>
        </dl>
        <button type="button" class="btn btn-primary btn-block" @click="done">Done</button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.shift-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 24px;
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
}

.text-btn {
  border: none;
  background: none;
  padding: 0;
  color: var(--color-primary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.text-btn:hover {
  text-decoration: underline;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.muted {
  color: var(--color-ink-faint);
  font-size: 0.875rem;
}

.optional {
  font-weight: 400;
  color: var(--color-ink-faint);
}

.result {
  margin-bottom: 1rem;
  padding: 0.875rem 1rem;
  border-radius: var(--radius-sm);
  text-align: center;
}

.result.ok {
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.result.off {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.verdict {
  font-size: 1.125rem;
  font-weight: 700;
}

.figures {
  margin: 0 0 1.25rem;
}

.figures div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.875rem;
}

.figures dt {
  color: var(--color-ink-soft);
}

.figures dd {
  margin: 0;
}

.figures .strong {
  font-weight: 700;
}
</style>
