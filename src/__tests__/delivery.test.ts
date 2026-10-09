import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import DeliveryView from '@/views/delivery/DeliveryView.vue'
import { apiFetch } from '@/lib/api'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), apiErrorMessage: (e: Error) => e.message }))
const order = { id: 1, outstanding: 1000, status: 'ready', fulfillment_type: 'delivery', recipient_name: 'QA recipient', recipient_phone: 'QA phone', address: 'QA location', sale: { id: 2, sale_number: 'QA-SALE', status: 'completed', total: 1000, items: [] } }
const global = { stubs: { RouterLink: true, PaginationBar: true, BaseModal: { template: '<section><slot /></section>' } } }

beforeEach(() => {
  vi.mocked(apiFetch).mockReset()
  vi.mocked(apiFetch).mockImplementation(async (path) => path.includes('?') ? { data: [order], total: 1, last_page: 1 } : order)
})

it('requires dispatch details and omits direct delivery completion before dispatch', async () => {
  const wrapper = mount(DeliveryView, { global })
  await flushPromises()
  await wrapper.get('tbody button').trigger('click')
  await flushPromises()
  expect(wrapper.get('#next-status').text()).toContain('Out for delivery')
  expect(wrapper.get('#next-status').text()).not.toContain('Delivered')
  expect(wrapper.get('#driver-name').attributes('required')).toBeDefined()
  await wrapper.get('#driver-name').setValue('QA rider')
  await wrapper.get('#driver-phone').setValue('QA contact')
  await wrapper.get('#driver-name').element.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flushPromises()
  expect(vi.mocked(apiFetch).mock.calls.some(([path, options]) => path === '/delivery/orders/1/status' && options?.body?.driver_name === 'QA rider')).toBe(true)
  wrapper.unmount()
})

it('retries collection with the same idempotency key and removes collection when paid', async () => {
  const wrapper = mount(DeliveryView, { global })
  await flushPromises()
  await wrapper.get('tbody button').trigger('click')
  await flushPromises()
  const attempts: unknown[] = []
  vi.mocked(apiFetch).mockImplementationOnce(async (_path, options) => {
    attempts.push(JSON.parse(JSON.stringify(options?.body)))
    throw new Error('Reply lost')
  })
  const paymentForm = wrapper.get('#collection-amount').element.closest('form')!
  paymentForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flushPromises()
  const first = attempts[0]
  expect(first).toMatchObject({ amount: 1000, method: 'CASH' })
  vi.mocked(apiFetch).mockImplementationOnce(async (_path, options) => {
    attempts.push(JSON.parse(JSON.stringify(options?.body)))
    return { ...order, outstanding: 0 }
  })
  paymentForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flushPromises()
  expect(attempts).toHaveLength(2)
  expect(attempts[1]).toEqual(first)
  expect(wrapper.find('#collection-amount').exists()).toBe(false)
  wrapper.unmount()
})
