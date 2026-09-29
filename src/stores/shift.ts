import { ref } from 'vue'
import { defineStore } from 'pinia'
import { apiFetch } from '@/lib/api'
import type { Shift } from '@/types/shifts'

const KEY = 'shift_current'

// Shifts are optional and need the server to open or close, but the open
// shift is remembered so the till still shows it while offline.
export const useShiftStore = defineStore('shift', () => {
  const current = ref<Shift | null>(JSON.parse(localStorage.getItem(KEY) ?? 'null'))

  function set(shift: Shift | null) {
    current.value = shift
    if (shift) localStorage.setItem(KEY, JSON.stringify(shift))
    else localStorage.removeItem(KEY)
  }

  async function load() {
    try {
      set((await apiFetch<{ shift: Shift | null }>('/shifts/current')).shift)
    } catch {
      // offline: keep what we last knew
    }
  }

  async function open(openingCash: number) {
    set(
      await apiFetch<Shift>('/shifts/open', {
        method: 'POST',
        body: { opening_cash: openingCash },
      }),
    )
  }

  async function close(actualCash: number, note: string) {
    const closed = await apiFetch<Shift>(`/shifts/${current.value!.id}/close`, {
      method: 'POST',
      body: { actual_cash: actualCash, note: note || undefined },
    })
    set(null)
    return closed
  }

  function reset() {
    set(null)
  }

  return { current, load, open, close, reset }
})
