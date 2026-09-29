import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch, isNetworkFailure } from '@/lib/api'
import { uuid } from '@/lib/format'
import { useCatalogStore } from '@/stores/catalog'
import { useShopStore } from '@/stores/shop'
import { useSyncStore } from '@/stores/sync'
import type { OutboxEvent } from '@/lib/outbox'
import type { PaymentMethod, PosProduct, ProductUnit, Sale } from '@/types/sales'

export interface CartLine {
  id: string
  productId: number
  name: string
  baseUnit: string
  unit: string
  conversion: number
  unitPrice: number
  quantity: number
  discount: number
  units: ProductUnit[]
  stock: number
}

export interface PaymentInput {
  method: PaymentMethod
  amount: number
  reference?: string
}

// A receipt for a sale that only exists on this device so far (id 0).
export function provisionalSale(event: OutboxEvent): Sale {
  const shop = useShopStore().currentShop
  const { lines, subtotal, discount, total, payments, amountDue, customer } = event.summary
  return {
    id: 0,
    sale_number: 'Not synced yet',
    status: 'completed',
    subtotal,
    discount,
    total,
    amount_paid: payments.reduce((sum, p) => sum + p.amount, 0),
    amount_due: amountDue ?? 0,
    customer: customer ?? null,
    created_at: event.clientCreatedAt,
    void_reason: null,
    cashier: { id: event.userId, name: event.cashierName },
    shop: shop
      ? { id: shop.id, name: shop.name, phone: shop.phone, address: shop.address }
      : undefined,
    items: lines.map((l, i) => ({
      id: i,
      product_id: l.productId,
      product_name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      unit_price: l.unitPrice,
      discount: l.discount,
      line_total: l.lineTotal,
    })),
    payments: payments.map((p, i) => ({
      id: i,
      method: p.method,
      amount: p.amount,
      reference: null,
      direction: 'in',
    })),
  }
}

const roundMoney = (n: number) => Math.round(n)
const roundQty = (n: number) => Math.round(n * 1000) / 1000

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>([])
  const orderDiscount = ref(0)
  // One key per sale attempt: if the request is retried after a dropped
  // connection the server recognises it and never records the sale twice.
  const attemptKey = ref(uuid())
  const customer = ref<{ id: number; name: string; phone: string | null } | null>(null)
  const dueDate = ref('')

  const lineTotal = (line: CartLine) => roundMoney(line.quantity * line.unitPrice) - line.discount
  const subtotal = computed(() =>
    lines.value.reduce((sum, l) => sum + roundMoney(l.quantity * l.unitPrice), 0),
  )
  const discountTotal = computed(
    () => lines.value.reduce((sum, l) => sum + l.discount, 0) + orderDiscount.value,
  )
  const total = computed(() => Math.max(0, subtotal.value - discountTotal.value))
  const itemCount = computed(() => lines.value.length)

  // How much of a product (in its base unit) is already in the cart,
  // optionally leaving one line out.
  function baseInCart(productId: number, exceptLineId?: string) {
    return lines.value
      .filter((l) => l.productId === productId && l.id !== exceptLineId)
      .reduce((sum, l) => sum + l.quantity * l.conversion, 0)
  }

  function maxQuantity(line: CartLine) {
    return roundQty((line.stock - baseInCart(line.productId, line.id)) / line.conversion)
  }

  function add(product: PosProduct) {
    const existing = lines.value.find(
      (l) => l.productId === product.id && l.unit === product.base_unit,
    )
    if (existing) {
      setQuantity(existing, existing.quantity + 1)
      return
    }
    if (product.stock - baseInCart(product.id) < 1) return

    lines.value.push({
      id: uuid(),
      productId: product.id,
      name: product.name,
      baseUnit: product.base_unit,
      unit: product.base_unit,
      conversion: 1,
      unitPrice: product.selling_price,
      quantity: 1,
      discount: 0,
      units: product.units,
      stock: product.stock,
    })
  }

  function setQuantity(line: CartLine, quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      remove(line)
      return
    }
    line.quantity = Math.min(roundQty(quantity), Math.max(maxQuantity(line), 0))
    if (line.discount > roundMoney(line.quantity * line.unitPrice)) {
      line.discount = roundMoney(line.quantity * line.unitPrice)
    }
    if (line.quantity <= 0) remove(line)
  }

  function setUnit(line: CartLine, unitName: string) {
    const catalog = useCatalogStore().products.find((p) => p.id === line.productId)
    if (unitName === line.baseUnit) {
      line.unit = line.baseUnit
      line.conversion = 1
      line.unitPrice = catalog?.selling_price ?? line.unitPrice
    } else {
      const unit = line.units.find((u) => u.unit_name === unitName)
      if (!unit) return
      line.unit = unit.unit_name
      line.conversion = unit.conversion_to_base_unit
      line.unitPrice = unit.selling_price
    }
    line.discount = 0
    setQuantity(line, line.quantity)
  }

  function setLineDiscount(line: CartLine, discount: number) {
    const gross = roundMoney(line.quantity * line.unitPrice)
    line.discount = Math.min(Math.max(Math.round(discount) || 0, 0), gross)
  }

  function setOrderDiscount(discount: number) {
    const room = subtotal.value - lines.value.reduce((sum, l) => sum + l.discount, 0)
    orderDiscount.value = Math.min(Math.max(Math.round(discount) || 0, 0), Math.max(room, 0))
  }

  function setCustomer(next: { id: number; name: string; phone: string | null } | null) {
    customer.value = next
  }

  function remove(line: CartLine) {
    lines.value = lines.value.filter((l) => l.id !== line.id)
    if (!lines.value.length) orderDiscount.value = 0
  }

  function clear() {
    lines.value = []
    orderDiscount.value = 0
    customer.value = null
    dueDate.value = ''
    attemptKey.value = uuid()
  }

  async function checkout(payments: PaymentInput[]): Promise<Sale> {
    const shop = useShopStore().currentShop
    const catalog = useCatalogStore()
    // Snapshot first: the cart is cleared as soon as the sale is settled.
    const snapshot = lines.value.map((l) => ({ ...l }))
    const due = total.value
    const key = attemptKey.value
    const buyer = customer.value ? { ...customer.value } : null
    const paidNow = payments.reduce((sum, p) => sum + p.amount, 0)
    const onCredit = paidNow < due

    const body = {
      idempotency_key: key,
      // Used only when the sale is synced later, to detect a price change.
      expected_total: due,
      customer_id: buyer?.id,
      due_date: onCredit && dueDate.value ? dueDate.value : undefined,
      discount: orderDiscount.value || undefined,
      items: snapshot.map((l) => ({
        product_id: l.productId,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unitPrice,
        discount: l.discount || undefined,
      })),
      payments: payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.reference || undefined,
      })),
    }

    let sale: Sale
    try {
      sale = await apiFetch<Sale>('/sales', { method: 'POST', body })
      if (shop) {
        for (const line of snapshot) {
          catalog.adjustStock(line.productId, -roundQty(line.quantity * line.conversion), shop.id)
        }
      }
    } catch (e) {
      // The server said no (bad stock, validation...): tell the cashier.
      // If it simply couldn't be reached, keep the sale on this device.
      if (!isNetworkFailure(e) || !shop) throw e
      sale = await saveOffline(shop.id, key, body, snapshot, payments, due, buyer)
    }

    clear()
    return sale
  }

  // The same idempotency key goes with the queued sale, so if the first
  // attempt actually reached the server but the reply was lost, syncing it
  // later is recognised as the same sale and not recorded twice.
  async function saveOffline(
    shopId: number,
    localEventId: string,
    body: Record<string, unknown>,
    snapshot: CartLine[],
    payments: PaymentInput[],
    due: number,
    buyer: { id: number; name: string } | null,
  ): Promise<Sale> {
    const sync = useSyncStore()
    const summaryLines = snapshot.map((l) => ({
      productId: l.productId,
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      conversion: l.conversion,
      unitPrice: l.unitPrice,
      discount: l.discount,
      lineTotal: roundMoney(l.quantity * l.unitPrice) - l.discount,
    }))
    const gross = summaryLines.reduce((sum, l) => sum + roundMoney(l.quantity * l.unitPrice), 0)

    // Record only what was actually kept, as the server does: change comes out of cash.
    const recorded = payments.map((p) => ({ method: p.method, amount: p.amount }))
    const excess = recorded.reduce((sum, p) => sum + p.amount, 0) - due
    if (excess > 0) {
      const cash = recorded.find((p) => p.method === 'CASH' && p.amount >= excess)
      if (cash) cash.amount -= excess
    }

    const event: OutboxEvent = await sync.queueSale({
      localEventId,
      shopId,
      payload: body,
      summary: {
        lines: summaryLines,
        subtotal: gross,
        discount: gross - due,
        total: due,
        amountDue: due - recorded.reduce((sum, p) => sum + p.amount, 0),
        customer: buyer ? { id: buyer.id, name: buyer.name } : null,
        payments: recorded.filter((p) => p.amount > 0),
      },
    })

    return provisionalSale(event)
  }

  return {
    lines,
    customer,
    dueDate,
    orderDiscount,
    subtotal,
    discountTotal,
    total,
    itemCount,
    lineTotal,
    maxQuantity,
    add,
    setQuantity,
    setUnit,
    setLineDiscount,
    setOrderDiscount,
    setCustomer,
    remove,
    clear,
    checkout,
  }
})
