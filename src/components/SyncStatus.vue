<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()

const state = computed(() => {
  const attention = sync.attentionCount
  const waiting = sync.pendingCount
  if (attention) {
    return { tone: 'warn', label: `${attention} sale${attention === 1 ? '' : 's'} need attention` }
  }
  if (sync.syncing) return { tone: 'busy', label: 'Syncing…' }
  if (!sync.online)
    return { tone: 'off', label: waiting ? `Offline · ${waiting} waiting` : 'Offline' }
  if (waiting) return { tone: 'busy', label: `${waiting} waiting to sync` }
  return { tone: 'ok', label: 'All synced' }
})
</script>

<template>
  <RouterLink
    to="/sync"
    class="sync-status"
    :class="state.tone"
    :title="sync.lastError || state.label"
  >
    <span class="dot" />
    <span class="label">{{ state.label }}</span>
  </RouterLink>
</template>

<style scoped>
.sync-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 100%;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-canvas);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
}

.sync-status:hover {
  border-color: var(--color-border-strong);
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-ink-faint);
}

.ok .dot {
  background: #16a34a;
}

.busy .dot {
  background: #d97706;
}

.off .dot,
.warn .dot {
  background: var(--color-danger);
}

.warn {
  border-color: var(--color-danger);
  color: var(--color-danger);
}
</style>
