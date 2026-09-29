import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import type { Customer } from '@/types/customers'

const cacheKey = (shopId: number) => `customers_${shopId}`

// The customer list is kept on the device so a credit sale can still pick
// someone when the connection is down.
export const useCustomersStore = defineStore('customers', () => {
  const list = ref<Customer[]>([])
  const loading = ref(false)
  const error = ref('')

  async function load(shopId: number) {
    loading.value = true
    error.value = ''
    const saved = localStorage.getItem(cacheKey(shopId))
    if (saved) list.value = JSON.parse(saved)

    try {
      list.value = await apiFetch<Customer[]>('/customers?limit=500')
      localStorage.setItem(cacheKey(shopId), JSON.stringify(list.value))
    } catch (e) {
      if (!saved) error.value = apiErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function create(shopId: number, payload: { name: string; phone?: string; notes?: string }) {
    const customer = await apiFetch<Customer>('/customers', { method: 'POST', body: payload })
    list.value = [...list.value, customer].sort((a, b) => a.name.localeCompare(b.name))
    localStorage.setItem(cacheKey(shopId), JSON.stringify(list.value))
    return customer
  }

  return { list, loading, error, load, create }
})
