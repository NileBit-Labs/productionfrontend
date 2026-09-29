import type { PaymentMethod } from '@/types/sales'

export type OutboxStatus = 'pending' | 'conflict' | 'rejected'

export interface OutboxSummaryLine {
  productId: number
  name: string
  quantity: number
  unit: string
  conversion: number
  unitPrice: number
  discount: number
  lineTotal: number
}

export interface OutboxEvent {
  localEventId: string
  shopId: number
  userId: number
  cashierName: string
  status: OutboxStatus
  message?: string
  serverTotal?: number
  // Set when an owner/manager approved recording it at the price charged.
  approved?: boolean
  attempts: number
  clientCreatedAt: string
  // Exactly what will be sent to the server as the sale.
  payload: Record<string, unknown>
  // Enough to draw a receipt for it while it is still only on this device.
  summary: {
    lines: OutboxSummaryLine[]
    subtotal: number
    discount: number
    total: number
    amountDue: number
    customer?: { id: number; name: string } | null
    payments: { method: PaymentMethod; amount: number }[]
  }
}

const DB_NAME = 'nilebit-retail'
const STORE = 'outbox'

// Sales must never be lost, so they go in IndexedDB (survives reloads and
// restarts). If it is unavailable (some private modes) a memory copy keeps
// the till working for the session rather than failing the sale.
const memory = new Map<string, OutboxEvent>()
let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'localEventId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
  return dbPromise
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    const request = fn(db.transaction(STORE, mode).objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function outboxPut(event: OutboxEvent): Promise<void> {
  const db = await openDb()
  if (!db) {
    memory.set(event.localEventId, event)
    return
  }
  await run(db, 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(event))))
}

export async function outboxAll(): Promise<OutboxEvent[]> {
  const db = await openDb()
  const events = db
    ? await run<OutboxEvent[]>(db, 'readonly', (s) => s.getAll())
    : [...memory.values()]
  return events.sort((a, b) => a.clientCreatedAt.localeCompare(b.clientCreatedAt))
}

export async function outboxRemove(localEventId: string): Promise<void> {
  const db = await openDb()
  if (!db) {
    memory.delete(localEventId)
    return
  }
  await run(db, 'readwrite', (s) => s.delete(localEventId))
}
