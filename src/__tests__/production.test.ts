import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProductionWorkspaceView from '@/views/production/ProductionWorkspaceView.vue'
import { apiFetch } from '@/lib/api'

vi.mock('vue-router', () => ({ useRoute: () => ({ name: 'batches' }) }))
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(), apiErrorMessage: (e: Error) => e.message }))

it('resumes an unspecified draft output allocation without submitting the stored zero to completion', async () => {
  const draft = {
    id: 8,
    batch_number: 'QA-DRAFT',
    name: 'QA draft',
    status: 'draft',
    production_date: '2026-10-09',
    total_cost: 0,
    output_quantity: 0,
    outputs: [{ product_id: 2, product_name: 'QA juice', quantity: 10, output_equivalent: 0 }],
    inputs: [],
  }
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path.startsWith('/products'))
      return { data: [{ id: 2, name: 'QA juice', kind: 'finished_good', base_unit: 'pcs' }] }
    if (path.startsWith('/recipes')) return { data: [] }
    if (path.startsWith('/production/batches?')) return { data: [draft] }
    if (path.startsWith('/measurement-units')) return { data: [] }
    return draft
  })
  const wrapper = mount(ProductionWorkspaceView, {
    global: { stubs: { BaseModal: { template: '<section><slot /></section>' } } },
  })
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
  const completion = vi
    .mocked(apiFetch)
    .mock.calls.find(([path]) => path === '/production/batches/8/complete')
  expect(completion).toBeDefined()
  expect(JSON.parse(JSON.stringify(completion?.[1]?.body)).outputs).toEqual([
    { product_id: 2, quantity: 10 },
  ])
  wrapper.unmount()
})

it('keeps batches beyond the first page available to the operator', async () => {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path.startsWith('/products') || path.startsWith('/recipes')) return { data: [] }
    if (path.startsWith('/measurement-units')) return []
    if (path === '/production/batches?per_page=100&page=1')
      return { data: [], next_page_url: '/api/production/batches?page=2' }
    if (path === '/production/batches?per_page=100&page=2')
      return {
        data: [
          {
            id: 101,
            batch_number: 'B-000101',
            name: 'Second page batch',
            status: 'draft',
            production_date: '2026-11-03',
            total_cost: 0,
            output_quantity: 0,
            outputs: [],
          },
        ],
        next_page_url: null,
      }
    throw new Error(`Unexpected API call ${path}`)
  })

  const wrapper = mount(ProductionWorkspaceView)
  await flushPromises()

  expect(wrapper.text()).toContain('B-000101')
  expect(apiFetch).toHaveBeenCalledWith('/production/batches?per_page=100&page=2')
  wrapper.unmount()
})
