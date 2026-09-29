import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch, apiErrorMessage } from '@/lib/api'
import type { PosProduct } from '@/types/sales'

interface PullResponse {
  cursor: string
  full: boolean
  products: PosProduct[]
}

const cacheKey = (shopId: number) => `pos_catalog_${shopId}`
const cursorKey = (shopId: number) => `pos_catalog_cursor_${shopId}`
const round = (n: number) => Math.round(n * 1000) / 1000

export const useCatalogStore = defineStore('catalog', () => {
  const products = ref<PosProduct[]>([])
  const loading = ref(false)
  const notice = ref('')
  // Base-unit quantities of sales recorded on this device but not yet synced.
  let reserved: Record<number, number> = {}

  function withServerStock(product: PosProduct): PosProduct {
    return { ...product, server_stock: product.stock }
  }

  function applyReserved(map: Record<number, number>) {
    reserved = map
    for (const product of products.value) {
      product.stock = round((product.server_stock ?? product.stock) - (map[product.id] ?? 0))
    }
  }

  function persist(shopId: number) {
    const serverView = products.value.map((p) => ({ ...p, stock: p.server_stock ?? p.stock }))
    localStorage.setItem(cacheKey(shopId), JSON.stringify(serverView))
  }

  function merge(response: PullResponse) {
    if (response.full) {
      products.value = response.products
        .map(withServerStock)
        .sort((a, b) => a.name.localeCompare(b.name))
      return
    }
    const byId = new Map(products.value.map((p) => [p.id, p]))
    for (const product of response.products) {
      if (product.status && product.status !== 'active') byId.delete(product.id)
      else byId.set(product.id, withServerStock(product))
    }
    products.value = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  // Shows the saved catalogue immediately, then asks the server only for what
  // changed since last time - small on a slow connection, and if the network
  // is down the till keeps working from what was saved.
  async function load(shopId: number) {
    loading.value = true
    notice.value = ''

    const saved = localStorage.getItem(cacheKey(shopId))
    const cursor = localStorage.getItem(cursorKey(shopId))
    if (saved) {
      products.value = (JSON.parse(saved) as PosProduct[]).map(withServerStock)
      applyReserved(reserved)
    }

    try {
      const query = saved && cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
      const response = await apiFetch<PullResponse>(`/sync/pull${query}`)
      merge(response)
      localStorage.setItem(cursorKey(shopId), response.cursor)
      applyReserved(reserved)
      persist(shopId)
    } catch (e) {
      notice.value = saved
        ? 'Showing your saved products — could not refresh them just now.'
        : apiErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  // After an online sale: the server's stock dropped, and so did what we show.
  function adjustStock(productId: number, baseDelta: number, shopId: number) {
    const product = products.value.find((p) => p.id === productId)
    if (!product) return
    product.server_stock = round((product.server_stock ?? product.stock) + baseDelta)
    product.stock = round(product.stock + baseDelta)
    persist(shopId)
  }

  return { products, loading, notice, load, adjustStock, applyReserved }
})
