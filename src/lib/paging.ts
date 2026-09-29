import { computed, ref, watch, type Ref } from 'vue'

export const PAGE_SIZES = [10, 25, 50, 100]

// The chosen "rows per page" is remembered per list, so a shop that likes 50 doesn't have to say so
// every visit.
export function usePerPage(key: string, fallback = 25) {
  let start = fallback
  try {
    const stored = Number(localStorage.getItem(`per_page_${key}`))
    if (PAGE_SIZES.includes(stored)) start = stored
  } catch {
    // Storage blocked: use the default.
  }

  const perPage = ref(start)
  watch(perPage, (n) => {
    try {
      localStorage.setItem(`per_page_${key}`, String(n))
    } catch {
      // Not remembered; the choice still applies for this visit.
    }
  })
  return perPage
}

// For lists the server sends whole (customers, one month of expenses): the same controls, cut
// up on the device.
export function useClientPage<T>(items: Ref<T[]>, key: string, fallback = 25) {
  const perPage = usePerPage(key, fallback)
  const page = ref(1)
  const total = computed(() => items.value.length)
  const lastPage = computed(() => Math.max(1, Math.ceil(total.value / perPage.value)))
  const rows = computed(() =>
    items.value.slice((page.value - 1) * perPage.value, page.value * perPage.value),
  )

  // Fewer rows after a search or a new size: never sit on a page that no longer exists.
  watch([perPage, total], () => {
    if (page.value > lastPage.value) page.value = lastPage.value
  })

  return { page, perPage, total, lastPage, rows }
}
