// The app shell service worker. Built by the appShell plugin in vite.config.ts, which fills in
// VERSION and PRECACHE. It only ever handles requests for this app's own files: the API is never
// cached here, because the app already keeps its own queue of unsent sales and its own catalogue.
const VERSION = '__VERSION__'
const CACHE = `nilebit-shell-${VERSION}`
const PRECACHE = __PRECACHE__
const PRECACHED = new Set(PRECACHE)

// A new version installs quietly and waits, so a cashier in the middle of a sale is never
// reloaded under them. The page asks for it to take over when they choose to reload.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('nilebit-shell-') && key !== CACHE) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return

  if (request.mode === 'navigate') {
    event.respondWith(openPage(request))
  } else if (url.pathname.startsWith('/assets/') || PRECACHED.has(url.pathname)) {
    event.respondWith(fromCache(request))
  }
})

// Network first, so a fresh deploy is picked up as soon as there is a connection, but not for
// long: on a weak connection the saved app opens instead of a spinner.
async function openPage(request) {
  try {
    return await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 4000)),
    ])
  } catch {
    return (await caches.match('/index.html')) || Response.error()
  }
}

async function fromCache(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
  return response
}
