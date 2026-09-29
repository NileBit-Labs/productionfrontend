<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import ReceiptView from '@/components/pos/ReceiptView.vue'
import { formatDateTime, formatUgx } from '@/lib/format'
import type { OutboxEvent } from '@/lib/outbox'
import { useAuthStore } from '@/stores/auth'
import { provisionalSale } from '@/stores/cart'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()
const auth = useAuthStore()

const viewing = ref<OutboxEvent | null>(null)
const discarding = ref<OutboxEvent | null>(null)

function label(event: OutboxEvent) {
  if (event.status === 'conflict') return 'Needs a manager'
  if (event.status === 'rejected') return 'Not accepted'
  return sync.online ? 'Waiting' : 'Saved offline'
}

async function confirmDiscard() {
  if (!discarding.value) return
  await sync.discard(discarding.value)
  discarding.value = null
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Sales</p>
        <h1>Sync</h1>
      </div>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="sync.syncing || !sync.pendingCount"
        @click="sync.flush()"
      >
        {{ sync.syncing ? 'Syncing…' : 'Sync now' }}
      </button>
    </header>

    <div class="card status">
      <p>
        <strong>{{ sync.online ? 'Connected' : 'Offline' }}</strong>
        <span v-if="!sync.online">
          — sales are saved on this device and sync automatically when the connection returns.
        </span>
      </p>
      <p v-if="sync.lastSyncedAt" class="muted">
        Last synced {{ formatDateTime(sync.lastSyncedAt) }}
      </p>
      <p v-if="sync.lastError" class="alert-danger">{{ sync.lastError }}</p>
    </div>

    <div v-if="!sync.shopEvents.length" class="card empty">
      <p>Everything is synced. No sales are waiting on this device.</p>
    </div>

    <ul v-else class="events">
      <li v-for="event in sync.shopEvents" :key="event.localEventId" class="card event">
        <div class="event-top">
          <div>
            <p class="event-total">{{ formatUgx(event.summary.total) }}</p>
            <p class="muted">
              {{ event.summary.lines.length }} item{{
                event.summary.lines.length === 1 ? '' : 's'
              }}
              · {{ formatDateTime(event.clientCreatedAt) }} · {{ event.cashierName }}
            </p>
          </div>
          <span class="badge" :class="event.status">{{ label(event) }}</span>
        </div>

        <p v-if="event.message" class="event-message">
          {{ event.message }}
          <template v-if="event.status === 'conflict' && event.serverTotal">
            The shop's price now makes it {{ formatUgx(event.serverTotal) }}; the customer was
            charged {{ formatUgx(event.summary.total) }}.
          </template>
        </p>

        <div class="event-actions">
          <button type="button" class="btn" @click="viewing = event">View receipt</button>
          <button
            v-if="event.status === 'rejected'"
            type="button"
            class="btn"
            @click="sync.retry(event)"
          >
            Try again
          </button>
          <button
            v-if="event.status === 'conflict' && auth.canManage"
            type="button"
            class="btn btn-primary"
            @click="sync.approve(event)"
          >
            Record at the price charged
          </button>
          <button
            v-if="event.status !== 'pending' && auth.canManage"
            type="button"
            class="btn danger"
            @click="discarding = event"
          >
            Remove
          </button>
        </div>
      </li>
    </ul>

    <BaseModal v-if="viewing" title="Saved sale" @close="viewing = null">
      <ReceiptView :sale="provisionalSale(viewing)" />
    </BaseModal>

    <BaseModal v-if="discarding" title="Remove this sale?" @close="discarding = null">
      <p class="discard-note">
        It will be deleted from this device and will
        <strong>never reach the shop's records</strong>. Only do this if you have already dealt with
        it another way.
      </p>
      <div class="modal-actions">
        <button type="button" class="btn" @click="discarding = null">Keep it</button>
        <button type="button" class="btn danger-solid" @click="confirmDiscard">Remove sale</button>
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
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-primary);
}

h1 {
  margin-top: 0.25rem;
  font-size: 1.5rem;
}

.status,
.empty {
  padding: 1.25rem 1.5rem;
  font-size: 0.9375rem;
}

.status p + p {
  margin-top: 0.5rem;
}

.empty {
  text-align: center;
  color: var(--color-ink-faint);
}

.muted {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.events {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.event {
  padding: 1.25rem 1.5rem;
}

.event-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.event-total {
  font-size: 1.125rem;
  font-weight: 700;
}

.badge {
  align-self: flex-start;
  padding: 0.125rem 0.625rem;
  border-radius: 999px;
  background: var(--color-canvas);
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge.conflict,
.badge.rejected {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.event-message {
  margin-top: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.875rem;
}

.event-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn:not(.btn-primary):not(.danger-solid) {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
}

.btn.danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.discard-note {
  color: var(--color-ink-soft);
  font-size: 0.9375rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.danger-solid {
  border-color: transparent;
  background: var(--color-danger);
  color: var(--color-on-danger);
}
</style>
