import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RepaymentModal from '@/components/customers/RepaymentModal.vue'
import PaySupplierModal from '@/components/purchasing/PaySupplierModal.vue'
import { apiFetch } from '@/lib/api'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), apiErrorMessage: (e: Error) => e.message }))

it('reuses the customer repayment operation after an uncertain response', async () => {
  vi.mocked(apiFetch)
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ balance: 0 })
  const wrapper = mount(RepaymentModal, {
    props: { customer: { id: 1, name: 'Sarah', phone: null, balance: 3000 } },
    global: { stubs: { BaseModal: { template: '<section><slot /></section>' } } },
  })

  await wrapper.get('form').trigger('submit')
  await flushPromises()
  await wrapper.get('form').trigger('submit')
  await flushPromises()

  const attempts = vi
    .mocked(apiFetch)
    .mock.calls.filter(([path]) => path === '/customers/1/payments')
  expect(attempts).toHaveLength(2)
  expect(attempts[0]![1]!.body).toEqual(attempts[1]![1]!.body)
  expect(attempts[0]![1]!.body).toHaveProperty('idempotency_key', expect.any(String))
  expect(wrapper.emitted('paid')).toHaveLength(1)
  wrapper.unmount()
})

it('reuses the supplier payment operation after an uncertain response', async () => {
  vi.mocked(apiFetch)
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ balance: 0 })
  const wrapper = mount(PaySupplierModal, {
    props: {
      supplier: {
        id: 2,
        name: 'Fresh Supplies',
        balance: 5000,
        is_active: true,
        phone: null,
        email: null,
        address: null,
        notes: null,
      },
    },
    global: { stubs: { BaseModal: { template: '<section><slot /></section>' } } },
  })

  await wrapper.get('form').trigger('submit')
  await flushPromises()
  await wrapper.get('form').trigger('submit')
  await flushPromises()

  const attempts = vi
    .mocked(apiFetch)
    .mock.calls.filter(([path]) => path === '/suppliers/2/payments')
  expect(attempts).toHaveLength(2)
  expect(attempts[0]![1]!.body).toEqual(attempts[1]![1]!.body)
  expect(attempts[0]![1]!.body).toHaveProperty('idempotency_key', expect.any(String))
  expect(wrapper.emitted('paid')).toHaveLength(1)
  wrapper.unmount()
})
