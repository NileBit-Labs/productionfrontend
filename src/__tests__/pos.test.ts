import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { apiFetch, isNetworkFailure } from '@/lib/api'
import { useCartStore } from '@/stores/cart'
import { isSaleable, useCatalogStore } from '@/stores/catalog'
import { useShopStore } from '@/stores/shop'
import PosView from '@/views/pos/PosView.vue'
import { navGroups } from '@/router/nav'
import type { PosProduct } from '@/types/sales'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), apiErrorMessage: (e: Error) => e.message, isNetworkFailure: vi.fn(() => false) }))
vi.mock('@/stores/sync', () => ({ useSyncStore: () => ({ pendingCount: 0 }) }))
const product: PosProduct = { id: 1, name: 'QA juice', sku: null, barcode: null, category: null, base_unit: 'pcs', stock: 7, selling_price: 7000, low_stock_threshold: 0, units: [], kind: 'finished_good', is_saleable: true }
const shop = { id: 1, organization_id: 1, name: 'QA shop', business_type: 'production', phone: null, address: null, status: 'active' }

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  useShopStore().setCurrentShop(shop)
  vi.mocked(apiFetch).mockReset()
  vi.mocked(isNetworkFailure).mockReturnValue(false)
  vi.mocked(apiFetch).mockResolvedValue({ cursor: 'now', full: true, products: [product] })
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
})

describe('POS typed input and checkout', () => {
  it('updates typed quantity and discount on input, and preserves them when payment opens', async () => {
    const cart = useCartStore()
    cart.add(product)
    const wrapper = mount(PosView, { global: { stubs: { RouterLink: true, ShiftBar: true, ReceiptView: true, CustomerPicker: true, CheckoutDialog: { props: ['total'], template: '<div data-test="payment">{{ total }}</div>' } } } })
    await flushPromises()
    const input = wrapper.get('input[aria-label="QA juice quantity"]')
    ;(input.element as HTMLInputElement).value = '2'
    await input.trigger('input')
    expect(cart.subtotal).toBe(14000)
    const discount = wrapper.get('#order-discount')
    ;(discount.element as HTMLInputElement).value = '1000'
    await discount.trigger('input')
    expect(cart.total).toBe(13000)
    await wrapper.get('button.charge').trigger('click')
    expect(wrapper.get('[data-test="payment"]').text()).toBe('13000')
    expect(cart.lines[0]?.quantity).toBe(2)
    expect(cart.orderDiscount).toBe(1000)
    wrapper.unmount()
  })

  it('keeps a line while clearing its input to type a replacement quantity', async () => {
    const cart = useCartStore()
    cart.add(product)
    const wrapper = mount(PosView, { global: { stubs: { RouterLink: true, ShiftBar: true, ReceiptView: true } } })
    await flushPromises()
    const input = wrapper.get('input[aria-label="QA juice quantity"]')
    ;(input.element as HTMLInputElement).value = ''
    await input.trigger('input')
    expect(cart.lines).toHaveLength(1)
    ;(input.element as HTMLInputElement).value = '7'
    await input.trigger('input')
    expect(cart.total).toBe(49000)
    wrapper.unmount()
  })

  it('enforces stock and finite discounts, and clamps discounts after quantities shrink', async () => {
    const cart = useCartStore()
    cart.add(product)
    const line = cart.lines[0]!
    cart.setQuantity(line, 99)
    expect(line.quantity).toBe(7)
    cart.setOrderDiscount(48000)
    cart.setQuantity(line, 1)
    expect(cart.orderDiscount).toBe(7000)
    cart.setOrderDiscount(Infinity)
    expect(cart.orderDiscount).toBe(0)
    cart.setQuantity(line, .5)
    expect(cart.total).toBe(3500)
    await nextTick()
  })

  it('sends typed values to checkout with the same attempt key when retrying', async () => {
    const cart = useCartStore()
    useCatalogStore().products = [product]
    cart.add(product)
    cart.setQuantity(cart.lines[0]!, 2)
    cart.setOrderDiscount(1000)
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Unavailable'))
    await expect(cart.checkout([{ method: 'CARD', amount: 13000 }])).rejects.toThrow()
    const first = vi.mocked(apiFetch).mock.calls[0]?.[1]?.body
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: 1, total: 13000 })
    await cart.checkout([{ method: 'CARD', amount: 13000 }])
    expect(vi.mocked(apiFetch).mock.calls[1]?.[1]?.body).toEqual(first)
    expect(first).toMatchObject({ discount: 1000, expected_total: 13000, items: [{ quantity: 2 }] })
  })

  it('hides production inputs and permits explicitly saleable raw fruit', () => {
    expect(isSaleable({ ...product, kind: 'raw_material', is_saleable: false })).toBe(false)
    expect(isSaleable({ ...product, selling_price: 0 })).toBe(false)
    expect(isSaleable({ ...product, kind: 'raw_material', is_saleable: true })).toBe(true)
    const cart = useCartStore()
    cart.add({ ...product, kind: 'packaging', is_saleable: false })
    expect(cart.lines).toHaveLength(0)
  })
})

it('does not advertise Ask NileBot in any navigation group', () => {
  expect(navGroups.flatMap((group) => group.items).some((item) => item.to === '/ask')).toBe(false)
})

it('sells intentionally saleable fractional stock and separates delivery fees from discounts', async () => {
  const cart = useCartStore()
  cart.add({ ...product, stock: .5, kind: 'raw_material', is_saleable: true })
  expect(cart.lines[0]?.quantity).toBe(.5)
  cart.setOrderDiscount(500)
  Object.assign(cart.fulfillment, { type: 'delivery', recipient_name: 'QA office', recipient_phone: 'QA phone', address: 'QA address', delivery_fee: 2000 })
  expect(cart.total).toBe(5000)
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Lost response'))
  await expect(cart.checkout([])).rejects.toThrow()
  expect(cart.total).toBe(5000)
  expect(vi.mocked(apiFetch).mock.calls[0]?.[1]?.body).toMatchObject({ expected_total: 5000, discount: 500, fulfillment: { type: 'delivery', delivery_fee: 2000 }, items: [{ quantity: .5 }] })
})

it('retains delivery details on network failure instead of creating an incomplete offline sale', async () => {
  const cart = useCartStore()
  cart.add(product)
  Object.assign(cart.fulfillment, { type: 'delivery', recipient_name: 'QA recipient', recipient_phone: 'QA phone', address: 'QA location', delivery_fee: 2000 })
  vi.mocked(isNetworkFailure).mockReturnValue(true)
  vi.mocked(apiFetch).mockRejectedValueOnce(new Error('Network lost'))
  await expect(cart.checkout([])).rejects.toThrow('Network lost')
  expect(cart.lines).toHaveLength(1)
  expect(cart.fulfillment.address).toBe('QA location')
  expect(cart.total).toBe(9000)
})
