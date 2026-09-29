import { ref } from 'vue'

// true once a newer version of the app has been downloaded and is waiting to take over.
export const updateReady = ref(false)

const WORKER_URL = `${import.meta.env.BASE_URL}sw.js`

function watch(worker: ServiceWorker | null) {
  worker?.addEventListener('statechange', () => {
    // "installed" with a controller already present means this is an update, not the first install.
    if (worker.state === 'installed' && navigator.serviceWorker.controller) updateReady.value = true
  })
}

// Production builds only: in development a cached app would hide every change being made.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(WORKER_URL)

      if (registration.waiting && navigator.serviceWorker.controller) updateReady.value = true
      watch(registration.installing)
      registration.addEventListener('updatefound', () => watch(registration.installing))

      // Shops leave the app open all day, so look for a new version now and then.
      setInterval(() => void registration.update().catch(() => {}), 60 * 60 * 1000)
    } catch {
      // No service worker (private window, blocked): the app still works online as before.
    }
  })
}

export async function applyUpdate() {
  const registration = await navigator.serviceWorker.getRegistration()
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
    once: true,
  })
  registration?.waiting?.postMessage('SKIP_WAITING')
}
