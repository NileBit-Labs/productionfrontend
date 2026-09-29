<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import '@/assets/charts.css'
import '@/assets/reports.css'
import { DEFAULT_TIMEZONE, todayIn } from '@/lib/dates'
import { apiDownload, apiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import DebtTab from './DebtTab.vue'
import ProfitTab from './ProfitTab.vue'
import SalesTab from './SalesTab.vue'
import StockTab from './StockTab.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const today = computed(() => todayIn(auth.user?.organization?.timezone ?? DEFAULT_TIMEZONE))
const range = ref({
  from: todayIn(auth.user?.organization?.timezone ?? DEFAULT_TIMEZONE).slice(0, 8) + '01',
  to: today.value,
})
const exportOpen = ref(false)
const exporting = ref(false)
const exportError = ref('')

const tabs = computed(() => [
  { key: 'sales', label: 'Sales' },
  // Cost and profit are the owner's alone; the server refuses everyone else too.
  ...(auth.isOwner ? [{ key: 'profit', label: 'Profit' }] : []),
  { key: 'stock', label: 'Stock' },
  { key: 'debt', label: 'Customer debt' },
])

const active = computed(() => {
  const asked = String(route.query.tab ?? 'sales')
  return tabs.value.some((t) => t.key === asked) ? asked : 'sales'
})

function open(key: string) {
  void router.replace({ query: { tab: key } })
}

function closeExport() {
  exportOpen.value = false
}

async function download(kind: 'pdf' | 'csv') {
  exporting.value = true
  exportError.value = ''
  try {
    const params = new URLSearchParams({ from: range.value.from, to: range.value.to })
    if (kind === 'csv') params.set('report', active.value)
    await apiDownload(`/reports/export/${kind}?${params}`, `nilebit-pos-${active.value}.${kind}`)
    closeExport()
  } catch (e) {
    exportError.value = apiErrorMessage(e)
  } finally {
    exporting.value = false
  }
}

function onDocumentPointer(event: PointerEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('.export-wrap')) closeExport()
}

document.addEventListener('pointerdown', onDocumentPointer)
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointer))
</script>

<template>
  <main class="page">
    <header>
      <p class="eyebrow">Finance</p>
      <h1>Reports</h1>
    </header>

    <div class="report-toolbar">
      <nav class="tabs" role="tablist" aria-label="Reports">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          role="tab"
          class="tab"
          :class="{ on: active === t.key }"
          :aria-selected="active === t.key"
          @click="open(t.key)"
        >
          {{ t.label }}
        </button>
      </nav>
      <div class="export-wrap" @keydown.esc="closeExport">
        <button
          type="button"
          class="export-button"
          :aria-expanded="exportOpen"
          aria-haspopup="menu"
          @click="exportOpen = !exportOpen"
        >
          Export <span aria-hidden="true">▾</span>
        </button>
        <div v-if="exportOpen" class="export-menu" role="menu" aria-label="Export report">
          <button type="button" role="menuitem" :disabled="exporting" @click="download('pdf')">
            Download summary PDF
          </button>
          <button type="button" role="menuitem" :disabled="exporting" @click="download('csv')">
            Download CSV
          </button>
        </div>
      </div>
    </div>
    <p v-if="exportError" class="alert-danger" role="alert">{{ exportError }}</p>

    <SalesTab v-if="active === 'sales'" v-model="range" :today="today" />
    <ProfitTab v-else-if="active === 'profit'" v-model="range" :today="today" />
    <StockTab v-else-if="active === 'stock'" />
    <DebtTab v-else-if="active === 'debt'" />
  </main>
</template>

<style scoped>
.page {
  flex: 1;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
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

.tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
}

.report-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 0.75rem;
}

.export-wrap {
  position: relative;
  flex-shrink: 0;
}
.export-button {
  min-height: 40px;
  padding: 0 0.875rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font-weight: 600;
  cursor: pointer;
}
.export-menu {
  position: absolute;
  z-index: 10;
  right: 0;
  top: calc(100% + 0.5rem);
  display: grid;
  min-width: 190px;
  padding: 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.export-menu button {
  min-height: 40px;
  padding: 0 0.625rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
}
.export-menu button:hover:not(:disabled) {
  background: var(--color-canvas);
}

.tab {
  padding: 0.625rem 1rem;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: none;
  color: var(--color-ink-soft);
  font-size: 0.9375rem;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.tab:hover {
  color: var(--color-ink);
}

.tab.on {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

@media (max-width: 720px) {
  .page {
    padding: 1.25rem 1rem;
  }
  .report-toolbar {
    align-items: center;
  }
  .tabs {
    flex: 1;
  }
}
</style>
