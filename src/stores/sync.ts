import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { apiErrorMessage, apiFetch, apiReachable, isNetworkFailure } from '@/lib/api'
import { uuid } from '@/lib/format'
import {
  outboxAll,
  outboxPut,
  outboxRemove,
  type OutboxEvent,
  type OutboxStatus,
} from '@/lib/outbox'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { useShopStore } from '@/stores/shop'

interface SyncResult {
  local_event_id: string
  status: 'processed' | 'conflict' | 'rejected'
  message?: string
  server_total?: number
}

const TICK_MS = 30000
let started = false

export const useSyncStore = defineStore('sync', () => {
  const auth = useAuthStore()
  const shopStore = useShopStore()
  const catalog = useCatalogStore()

  const events = ref<OutboxEvent[]>([])
  const syncing = ref(false)
  const lastSyncedAt = ref<string | null>(localStorage.getItem('last_synced_at'))
  const lastError = ref('')
  const browserOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

  const online = computed(() => browserOnline.value && apiReachable.value)
  const shopEvents = computed(() =>
    events.value.filter((e) => e.shopId === shopStore.currentShop?.id),
  )
  const pendingCount = computed(() => shopEvents.value.filter((e) => e.status === 'pending').length)
  const attentionCount = computed(
    () => shopEvents.value.filter((e) => e.status !== 'pending').length,
  )
  const unsyncedCount = computed(() => shopEvents.value.length)

  // Goods that left the shop in sales the server hasn't heard about yet.
  const reserved = computed(() => {
    const map: Record<number, number> = {}
    for (const event of shopEvents.value) {
      for (const line of event.summary.lines) {
        map[line.productId] = (map[line.productId] ?? 0) + line.quantity * line.conversion
      }
    }
    return map
  })
  watch(reserved, (map) => catalog.applyReserved(map), { immediate: true })

  function deviceId(): string {
    let id = localStorage.getItem('device_id')
    if (!id) {
      id = uuid()
      localStorage.setItem('device_id', id)
    }
    return id
  }

  async function load() {
    events.value = await outboxAll()
  }

  async function queueSale(input: {
    localEventId: string
    shopId: number
    payload: Record<string, unknown>
    summary: OutboxEvent['summary']
  }): Promise<OutboxEvent> {
    const event: OutboxEvent = {
      localEventId: input.localEventId,
      shopId: input.shopId,
      userId: auth.user!.id,
      cashierName: auth.user!.name,
      status: 'pending',
      attempts: 0,
      clientCreatedAt: new Date().toISOString(),
      payload: input.payload,
      summary: input.summary,
    }
    await outboxPut(event)
    events.value = [...events.value, event]
    return event
  }

  // Your own sales, and - for owners/managers - everyone's in this shop.
  function flushable(): OutboxEvent[] {
    return shopEvents.value.filter(
      (e) => e.status === 'pending' && (e.userId === auth.user?.id || auth.canManage),
    )
  }

  async function settle(
    event: OutboxEvent,
    status: OutboxStatus,
    message?: string,
    serverTotal?: number,
  ) {
    Object.assign(event, { status, message, serverTotal, attempts: event.attempts + 1 })
    await outboxPut(event)
  }

  async function flush(): Promise<void> {
    if (syncing.value || !auth.isAuthenticated || !shopStore.currentShop) return
    const batch = flushable().slice(0, 20)
    if (!batch.length) return

    syncing.value = true
    lastError.value = ''
    let processed = 0

    try {
      const response = await apiFetch<{ results: SyncResult[] }>('/sync/push', {
        method: 'POST',
        body: {
          device_id: deviceId(),
          events: batch.map((e) => ({
            local_event_id: e.localEventId,
            entity_type: 'sale',
            operation: 'create',
            client_created_at: e.clientCreatedAt,
            cashier_id: e.userId === auth.user?.id ? undefined : e.userId,
            accept_agreed_prices: e.approved || undefined,
            payload: e.payload,
          })),
        },
      })

      for (const result of response.results) {
        const event = events.value.find((e) => e.localEventId === result.local_event_id)
        if (!event) continue
        if (result.status === 'processed') {
          await outboxRemove(event.localEventId)
          events.value = events.value.filter((e) => e.localEventId !== event.localEventId)
          processed++
        } else {
          await settle(event, result.status, result.message, result.server_total)
        }
      }
    } catch (e) {
      lastError.value = isNetworkFailure(e)
        ? "Can't reach the server — your sales are safe and will sync automatically."
        : apiErrorMessage(e)
    } finally {
      syncing.value = false
    }

    if (processed) {
      lastSyncedAt.value = new Date().toISOString()
      localStorage.setItem('last_synced_at', lastSyncedAt.value)
      await catalog.load(shopStore.currentShop.id)
    }
    if (processed && flushable().length) await flush()
  }

  async function retry(event: OutboxEvent) {
    event.status = 'pending'
    event.message = undefined
    await outboxPut(event)
    await flush()
  }

  // An owner/manager accepts a sale at the price the customer was charged
  // when prices have changed since it was rung up offline.
  async function approve(event: OutboxEvent) {
    if (!auth.canManage) return
    event.approved = true
    await retry(event)
  }

  async function discard(event: OutboxEvent) {
    await outboxRemove(event.localEventId)
    events.value = events.value.filter((e) => e.localEventId !== event.localEventId)
  }

  async function tick() {
    if (flushable().length) await flush()
    else if (!apiReachable.value && shopStore.currentShop)
      await catalog.load(shopStore.currentShop.id)
  }

  async function init() {
    if (started) return
    started = true
    await load()
    window.addEventListener('online', () => {
      browserOnline.value = true
      void flush()
    })
    window.addEventListener('offline', () => {
      browserOnline.value = false
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void tick()
    })
    setInterval(() => void tick(), TICK_MS)
    void flush()
  }

  return {
    events,
    shopEvents,
    syncing,
    online,
    lastSyncedAt,
    lastError,
    pendingCount,
    attentionCount,
    unsyncedCount,
    init,
    load,
    queueSale,
    flush,
    retry,
    approve,
    discard,
  }
})
