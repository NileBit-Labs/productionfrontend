import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '@/lib/api'
import type { Category } from '@/types/inventory'

export const useCategoriesStore = defineStore('categories', () => {
  const list = ref<Category[]>([])

  // Called in the background by several screens. When the connection is down the list just
  // stays as it was; the screen itself reports that its own data couldn't load.
  async function load() {
    try {
      list.value = await apiFetch<Category[]>('/categories')
    } catch {
      // Nothing to do here.
    }
  }

  return { list, load }
})
