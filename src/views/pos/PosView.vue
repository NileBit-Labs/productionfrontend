<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import BaseModal from '@/components/BaseModal.vue'
import CustomerPicker from '@/components/customers/CustomerPicker.vue'
import CheckoutDialog from '@/components/pos/CheckoutDialog.vue'
import ReceiptView from '@/components/pos/ReceiptView.vue'
import ShiftBar from '@/components/pos/ShiftBar.vue'
import { formatQuantity, formatUgx } from '@/lib/format'
import { useCartStore } from '@/stores/cart'
import { useCatalogStore } from '@/stores/catalog'
import { useShopStore } from '@/stores/shop'
import { useSyncStore } from '@/stores/sync'
import type { PosProduct, Sale } from '@/types/sales'

const catalog = useCatalogStore()
const cart = useCartStore()
const shopStore = useShopStore()
const sync = useSyncStore()

const search = ref('')
const category = ref<string | null>(null)
const showCheckout = ref(false)
const showPicker = ref(false)
const cartOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const cartDrawer = ref<HTMLElement | null>(null)
const cartTrigger = ref<HTMLButtonElement | null>(null)
const receipt = ref<{ sale: Sale; tendered: number; change: number } | null>(null)

const isMobileDrawer = ref(false)
let drawerMediaQuery: MediaQueryList | undefined
let previousBodyOverflow: string | null = null

function lockPageScroll() {
  if (previousBodyOverflow !== null) return
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockPageScroll() {
  if (previousBodyOverflow === null) return
  document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = null
}

function updateDrawerMode(event?: MediaQueryListEvent) {
  const nextIsMobile = event?.matches ?? drawerMediaQuery?.matches ?? false

  if (!nextIsMobile && isMobileDrawer.value) {
    unlockPageScroll()
    cartOpen.value = false
  }

  isMobileDrawer.value = nextIsMobile
}

function openCart() {
  cartOpen.value = true
}

function closeCart() {
  cartOpen.value = false
}

function onDrawerKeydown(event: KeyboardEvent) {
  if (!isMobileDrawer.value || !cartOpen.value) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeCart()
    return
  }

  if (event.key !== 'Tab') return

  const focusable = [...(cartDrawer.value?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
  ) ?? [])].filter((element) => element.offsetParent !== null)

  if (!focusable.length) {
    event.preventDefault()
    cartDrawer.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(async () => {
  drawerMediaQuery = window.matchMedia('(max-width: 900px)')
  updateDrawerMode()
  drawerMediaQuery.addEventListener('change', updateDrawerMode)

  if (shopStore.currentShop) await catalog.load(shopStore.currentShop.id)
  searchInput.value?.focus()
})

onUnmounted(() => {
  drawerMediaQuery?.removeEventListener('change', updateDrawerMode)
  unlockPageScroll()
})

watch(cartOpen, (isOpen) => {
  if (!isMobileDrawer.value) return

  if (isOpen) {
    lockPageScroll()
    void nextTick(() => cartDrawer.value?.focus())
    return
  }

  unlockPageScroll()
  void nextTick(() => {
    if (!showCheckout.value && !receipt.value) cartTrigger.value?.focus()
  })
})

const categories = computed(() => [
  ...new Set(catalog.products.map((p) => p.category).filter((c): c is string => !!c)),
])

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return catalog.products.filter(
    (p) =>
      (!category.value || p.category === category.value) &&
      (!q ||
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.includes(q)),
  )
})

// A scanner types the code and presses Enter, so an exact barcode/SKU match
// (or a single remaining result) is added straight to the cart.
function onSearchEnter() {
  const q = search.value.trim()
  if (!q) return
  const exact = catalog.products.find(
    (p) => p.barcode === q || p.sku?.toLowerCase() === q.toLowerCase(),
  )
  const match = exact ?? (visible.value.length === 1 ? visible.value[0] : undefined)
  if (match) {
    addToCart(match)
    search.value = ''
  }
}

function addToCart(product: PosProduct) {
  if (product.stock <= 0) return
  cart.add(product)
}

function stockLabel(product: PosProduct) {
  if (product.stock <= 0) return 'Out of stock'
  return `${formatQuantity(product.stock)} ${product.base_unit}`
}

function isLow(product: PosProduct) {
  return product.stock > 0 && product.stock <= product.low_stock_threshold
}

function onPaid(sale: Sale, tendered: number, change: number) {
  showCheckout.value = false
  cartOpen.value = false
  receipt.value = { sale, tendered, change }
}

function newSale() {
  receipt.value = null
  searchInput.value?.focus()
}

function print() {
  window.print()
}

async function share() {
  if (!receipt.value) return
  const { sale } = receipt.value
  const text = `${sale.shop?.name} — receipt ${sale.sale_number}\nTotal: ${formatUgx(sale.total)}`
  if (navigator.share) {
    await navigator.share({ title: `Receipt ${sale.sale_number}`, text }).catch(() => {})
  } else {
    await navigator.clipboard?.writeText(text)
  }
}
</script>

<template>
  <main class="pos">
    <section class="catalog">
      <div class="catalog-top">
        <ShiftBar />
        <input
          ref="searchInput"
          v-model="search"
          class="search"
          type="search"
          placeholder="Search products, or scan a barcode…"
          autocomplete="off"
          @keydown.enter.prevent="onSearchEnter"
        />

        <div v-if="categories.length" class="chips">
          <button
            type="button"
            class="chip"
            :class="{ active: category === null }"
            @click="category = null"
          >
            All
          </button>
          <button
            v-for="name in categories"
            :key="name"
            type="button"
            class="chip"
            :class="{ active: category === name }"
            @click="category = name"
          >
            {{ name }}
          </button>
        </div>

        <p v-if="!sync.online" class="notice offline">
          You're offline — keep selling. Sales are saved on this device and sync automatically.
        </p>
        <p v-else-if="catalog.notice" class="notice">{{ catalog.notice }}</p>
      </div>

      <div class="grid-wrap">
        <p v-if="catalog.loading && !catalog.products.length" class="state">Loading products…</p>
        <p v-else-if="!catalog.products.length" class="state">
          No products in this shop yet. They'll appear here once they're added on the Products
          screen.
        </p>
        <p v-else-if="!visible.length" class="state">Nothing matches “{{ search }}”.</p>

        <div v-else class="grid">
          <button
            v-for="product in visible"
            :key="product.id"
            type="button"
            class="tile"
            :disabled="product.stock <= 0"
            @click="addToCart(product)"
          >
            <span class="tile-name">{{ product.name }}</span>
            <span class="tile-price">{{ formatUgx(product.selling_price) }}</span>
            <span class="tile-stock" :class="{ out: product.stock <= 0, low: isLow(product) }">
              {{ stockLabel(product) }}
            </span>
          </button>
        </div>
      </div>
    </section>

    <button
      v-if="cart.itemCount && !cartOpen"
      ref="cartTrigger"
      type="button"
      class="cart-bar"
      aria-haspopup="dialog"
      :aria-expanded="cartOpen"
      aria-controls="pos-cart-drawer"
      @click="openCart"
    >
      <span>{{ cart.itemCount }} item{{ cart.itemCount === 1 ? '' : 's' }} in cart</span>
      <strong>{{ formatUgx(cart.total) }}</strong>
    </button>

    <div
      v-if="isMobileDrawer && cartOpen"
      class="cart-scrim"
      aria-hidden="true"
      @click="closeCart"
      @touchmove.prevent
      @wheel.prevent
    />

    <aside
      id="pos-cart-drawer"
      ref="cartDrawer"
      class="cart card"
      :class="{ open: cartOpen }"
      :role="isMobileDrawer ? 'dialog' : undefined"
      :aria-modal="isMobileDrawer && cartOpen ? 'true' : undefined"
      :aria-hidden="isMobileDrawer ? !cartOpen : undefined"
      :aria-labelledby="isMobileDrawer ? 'pos-cart-title' : undefined"
      :tabindex="isMobileDrawer ? -1 : undefined"
      aria-label="Cart"
      @keydown="onDrawerKeydown"
    >
      <header class="cart-head">
        <h2 id="pos-cart-title">Current sale</h2>
        <div class="cart-head-actions">
          <button v-if="cart.itemCount" type="button" class="text-btn" @click="cart.clear()">
            Clear
          </button>
          <button type="button" class="text-btn mobile-only" @click="closeCart">
            Close
          </button>
        </div>
      </header>

      <div class="cart-body">
        <p v-if="!cart.itemCount" class="state">Tap a product to add it to the sale.</p>

        <ul v-else class="lines">
          <li v-for="line in cart.lines" :key="line.id" class="line">
            <div class="line-top">
              <span class="line-name">{{ line.name }}</span>
              <span class="line-amount">{{ formatUgx(cart.lineTotal(line)) }}</span>
            </div>

            <div class="line-controls">
              <div class="stepper">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  @click="cart.setQuantity(line, line.quantity - 1)"
                >
                  −
                </button>
                <input
                  :value="line.quantity"
                  type="number"
                  inputmode="decimal"
                  step="any"
                  min="0"
                  :max="cart.maxQuantity(line)"
                  :aria-label="`${line.name} quantity`"
                  @change="
                    cart.setQuantity(line, Number(($event.target as HTMLInputElement).value))
                  "
                />
                <button
                  type="button"
                  aria-label="Increase quantity"
                  :disabled="line.quantity >= cart.maxQuantity(line)"
                  @click="cart.setQuantity(line, line.quantity + 1)"
                >
                  +
                </button>
              </div>

              <select
                v-if="line.units.length"
                class="unit-select"
                :value="line.unit"
                :aria-label="`${line.name} unit`"
                @change="cart.setUnit(line, ($event.target as HTMLSelectElement).value)"
              >
                <option :value="line.baseUnit">{{ line.baseUnit }}</option>
                <option v-for="unit in line.units" :key="unit.unit_name" :value="unit.unit_name">
                  {{ unit.unit_name }}
                </option>
              </select>
              <span v-else class="unit-label">{{ line.unit }}</span>

              <span class="line-price">@ {{ formatUgx(line.unitPrice) }}</span>

              <button
                type="button"
                class="line-remove"
                :aria-label="`Remove ${line.name}`"
                @click="cart.remove(line)"
              >
                ×
              </button>
            </div>
          </li>
        </ul>
      </div>

      <footer v-if="cart.itemCount" class="cart-foot">
        <div class="customer-row">
          <button type="button" class="customer-btn" @click="showPicker = true">
            <span class="customer-name">{{ cart.customer?.name ?? 'Walk-in customer' }}</span>
            <small>{{ cart.customer ? 'Change' : 'Add customer' }}</small>
          </button>
          <button
            v-if="cart.customer"
            type="button"
            class="line-remove"
            aria-label="Remove customer"
            @click="cart.setCustomer(null)"
          >
            ×
          </button>
        </div>

        <dl class="sums">
          <div>
            <dt>Subtotal</dt>
            <dd>{{ formatUgx(cart.subtotal) }}</dd>
          </div>
          <div class="discount-row">
            <dt><label for="order-discount">Discount</label></dt>
            <dd>
              <input
                id="order-discount"
                :value="cart.orderDiscount || ''"
                type="number"
                inputmode="numeric"
                min="0"
                placeholder="0"
                @change="cart.setOrderDiscount(Number(($event.target as HTMLInputElement).value))"
              />
            </dd>
          </div>
          <div class="grand">
            <dt>Total</dt>
            <dd>{{ formatUgx(cart.total) }}</dd>
          </div>
        </dl>

        <button
          type="button"
          class="btn btn-primary btn-block charge"
          :disabled="cart.total <= 0"
          @click="showCheckout = true"
        >
          Charge {{ formatUgx(cart.total) }}
        </button>
      </footer>
    </aside>

    <CustomerPicker
      v-if="showPicker"
      @close="showPicker = false"
      @pick="
        (c) => {
          cart.setCustomer(c)
          showPicker = false
        }
      "
    />

    <CheckoutDialog
      v-if="showCheckout"
      :total="cart.total"
      @close="showCheckout = false"
      @paid="onPaid"
    />

    <BaseModal v-if="receipt" title="Sale complete" @close="newSale">
      <div class="receipt-print">
        <ReceiptView :sale="receipt.sale" :tendered="receipt.tendered" :change="receipt.change" />
      </div>
      <div class="receipt-actions">
        <button type="button" class="btn" @click="print">Print</button>
        <button type="button" class="btn" @click="share">Share</button>
        <RouterLink class="btn" :to="`/sales/${receipt.sale.id}`" @click="newSale"
          >Details</RouterLink
        >
        <button type="button" class="btn btn-primary grow" @click="newSale">New sale</button>
      </div>
    </BaseModal>
  </main>
</template>

<style scoped>
.pos {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  gap: 1.25rem;
  padding: 1.25rem;
  min-height: 0;
}

.catalog {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.catalog-top {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 0.75rem;
}

.search {
  width: 100%;
  min-height: 48px;
  padding: 0 1rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 1rem;
  outline: none;
}

.search:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.chips {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.chip {
  flex-shrink: 0;
  min-height: 36px;
  padding: 0 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.chip.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.notice.offline {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.notice {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
}

.grid-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px;
}

.state {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-ink-faint);
  font-size: 0.9375rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  min-height: 96px;
  padding: 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.tile:hover:not(:disabled) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.tile:active:not(:disabled) {
  transform: scale(0.98);
}

.tile:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tile-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.3;
}

.tile-price {
  color: var(--color-primary);
  font-size: 0.9375rem;
  font-weight: 700;
}

.tile-stock {
  margin-top: auto;
  color: var(--color-ink-faint);
  font-size: 0.75rem;
}

.tile-stock.low {
  color: #b45309;
  font-weight: 600;
}

.tile-stock.out {
  color: var(--color-danger);
  font-weight: 600;
}

/* Cart */
.cart {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.cart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.cart-head h2 {
  font-size: 0.9375rem;
}

.cart-head-actions {
  display: flex;
  gap: 1rem;
}

.text-btn {
  border: none;
  background: none;
  padding: 0;
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.text-btn:hover {
  color: var(--color-primary);
}

.mobile-only {
  display: none;
}

.cart-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.lines {
  list-style: none;
  margin: 0;
  padding: 0;
}

.line {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
}

.line-top {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.line-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.line-amount {
  font-weight: 600;
  white-space: nowrap;
}

.line-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.stepper button {
  width: 36px;
  height: 36px;
  border: none;
  background: var(--color-canvas);
  color: var(--color-ink);
  font-size: 1.125rem;
  cursor: pointer;
}

.stepper button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.stepper input {
  width: 52px;
  height: 36px;
  border: none;
  background: var(--color-surface);
  text-align: center;
  font-size: 0.9375rem;
  outline: none;
  appearance: textfield;
  -moz-appearance: textfield;
}

.stepper input::-webkit-outer-spin-button,
.stepper input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.unit-select {
  min-width: 0;
  height: 36px;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-size: 0.8125rem;
}

.unit-label,
.line-price {
  color: var(--color-ink-faint);
  font-size: 0.8125rem;
}

.line-price {
  margin-left: auto;
}

.line-remove {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-faint);
  font-size: 1.25rem;
  cursor: pointer;
}

.line-remove:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.cart-foot {
  padding: 1rem 1.25rem 1.25rem;
  border-top: 1px solid var(--color-border);
}

.customer-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
}

.customer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 44px;
  padding: 0 0.875rem;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-canvas);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.customer-btn small {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
}

.customer-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sums {
  margin: 0 0 1rem;
}

.sums div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.875rem;
}

.sums dt {
  color: var(--color-ink-soft);
}

.sums dd {
  margin: 0;
}

.sums .grand {
  padding-top: 0.5rem;
  font-size: 1.125rem;
  font-weight: 700;
}

.sums .grand dt {
  color: var(--color-ink);
}

.discount-row input {
  width: 110px;
  height: 34px;
  padding: 0 0.5rem;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  text-align: right;
  font-size: 0.875rem;
  outline: none;
}

.charge {
  min-height: 52px;
  font-size: 1.0625rem;
}

.cart-bar {
  display: none;
}

.cart-scrim {
  display: none;
}

.receipt-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.receipt-actions .btn {
  border-color: var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-ink);
  text-decoration: none;
}

.receipt-actions .btn-primary {
  border-color: transparent;
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.grow {
  flex: 1;
}

@media (max-width: 900px) {
  .pos {
    grid-template-columns: 1fr;
    padding: 0.875rem;
    padding-bottom: calc(5.75rem + env(safe-area-inset-bottom));
  }

  .cart-scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: block;
    background: rgba(15, 20, 25, 0.48);
  }

  .cart {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 50;
    max-height: min(85dvh, calc(100dvh - 1rem));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    transform: translateY(105%);
    transition: transform 0.2s ease;
  }

  .cart.open {
    transform: translateY(0);
  }

  .mobile-only {
    display: inline;
  }

  .text-btn.mobile-only {
    min-height: 44px;
    padding: 0 0.5rem;
  }

  .line {
    padding: 1rem;
  }

  .line-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'quantity remove'
      'unit price';
    align-items: center;
  }

  .stepper {
    grid-area: quantity;
    justify-self: start;
  }

  .stepper button,
  .stepper input {
    height: 44px;
  }

  .stepper button {
    width: 44px;
  }

  .unit-select,
  .unit-label {
    grid-area: unit;
    min-width: 0;
    max-width: 100%;
    min-height: 44px;
  }

  .unit-select {
    width: fit-content;
  }

  .unit-label {
    display: flex;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .line-price {
    grid-area: price;
    margin-left: 0;
    justify-self: end;
    white-space: nowrap;
  }

  .line-remove {
    width: 44px;
    height: 44px;
  }

  .discount-row input {
    min-height: 44px;
  }

  .cart-foot {
    padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
  }

  .cart-bar {
    position: fixed;
    inset: auto 0.875rem calc(0.875rem + env(safe-area-inset-bottom)) 0.875rem;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 52px;
    padding: 0 1.25rem;
    border: none;
    border-radius: var(--radius-md);
    background: var(--color-primary);
    color: var(--color-on-primary);
    font-size: 0.9375rem;
    box-shadow: var(--shadow-card);
    cursor: pointer;
  }
}
</style>
