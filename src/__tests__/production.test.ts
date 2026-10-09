import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProductionWorkspaceView from '@/views/production/ProductionWorkspaceView.vue'
import { apiFetch } from '@/lib/api'

vi.mock('vue-router', () => ({ useRoute: () => ({ name: 'batches' }) }))
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), apiErrorMessage: (e: Error) => e.message }))

it('resumes an unspecified draft output allocation without submitting the stored zero to completion', async () => {
  const draft = { id: 8, batch_number: 'QA-DRAFT', name: 'QA draft', status: 'draft', production_date: '2026-10-09', total_cost: 0, output_quantity: 0, outputs: [{ product_id: 2, product_name: 'QA juice', quantity: 10, output_equivalent: 0 }], inputs: [] }
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path.startsWith('/products')) return { data: [{ id: 2, name: 'QA juice', kind: 'finished_good', base_unit: 'pcs' }] }
    if (path.startsWith('/recipes')) return { data: [] }
    if (path === '/production/batches?per_page=100') return { data: [draft] }
    if (path.startsWith('/measurement-units')) return { data: [] }
    return draft
  })
  const wrapper = mount(ProductionWorkspaceView, { global: { stubs: { BaseModal: { template: '<section><slot /></section>' } } } })
  await flushPromises()
  const click = async (text: string) => {
    const button = wrapper.findAll('button').find((b) => b.text() === text)!
    await button.trigger('click')
    await flushPromises()
  }
  await click('QA-DRAFT')
  await click('Resume draft')
  expect(wrapper.get('#batch-output-equivalent-0').element).toHaveProperty('value', '')
  await click('Complete batch')
  const completion = vi.mocked(apiFetch).mock.calls.find(([path]) => path === '/production/batches/8/complete')
  expect(completion).toBeDefined()
  expect(JSON.parse(JSON.stringify(completion?.[1]?.body)).outputs).toEqual([{ product_id: 2, quantity: 10 }])
  wrapper.unmount()
})
