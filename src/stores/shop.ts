import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '@/lib/api'

export interface Shop {
  id: number
  organization_id: number
  name: string
  business_type: string
  phone: string | null
  address: string | null
  status: string
}

export const useShopStore = defineStore('shop', () => {
  const currentShop = ref<Shop | null>(JSON.parse(localStorage.getItem('current_shop') ?? 'null'))

  function setCurrentShop(shop: Shop) {
    currentShop.value = shop
    localStorage.setItem('current_shop', JSON.stringify(shop))
  }

  function clearCurrentShop() {
    currentShop.value = null
    localStorage.removeItem('current_shop')
  }

  async function createShop(payload: {
    name: string
    business_type: string
    phone?: string
    address?: string
  }) {
    const shop = await apiFetch<Shop>('/shops', { method: 'POST', body: payload })
    setCurrentShop(shop)
    return shop
  }

  return { currentShop, setCurrentShop, clearCurrentShop, createShop }
})
