import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import WhatsAppConnections from '@/components/WhatsAppConnections.vue'
import { apiFetch } from '@/lib/api'

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), apiErrorMessage: (e: Error) => e.message }))

it('only revokes the selected WhatsApp session after confirmation', async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce([
    { id: 11, created_at: '2026-11-03T10:00:00Z', expires_at: null, last_used_at: null },
    { id: 12, created_at: '2026-11-03T10:00:00Z', expires_at: null, last_used_at: null },
  ]).mockResolvedValueOnce(null)
  const wrapper = mount(WhatsAppConnections)
  await flushPromises()
  await wrapper.get('button').trigger('focus')
  const button = wrapper.findAll('button').find((entry) => entry.text() === 'Disconnect session #11')!
  await button.trigger('click')
  expect(vi.mocked(apiFetch).mock.calls.filter(([, options]) => options?.method === 'DELETE')).toHaveLength(0)
  await wrapper.findAll('button').find((entry) => entry.text() === 'Confirm disconnect')!.trigger('click')
  await flushPromises()
  expect(apiFetch).toHaveBeenCalledWith('/auth/connections/11', { method: 'DELETE' })
  expect(wrapper.text()).not.toContain('WhatsApp session #11')
  expect(wrapper.text()).toContain('WhatsApp session #12')
  expect(wrapper.text()).toContain('Your POS records and web session are unchanged')
  wrapper.unmount()
})
