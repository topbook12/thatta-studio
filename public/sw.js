/* ঠাট্টা স্টুডিও — service worker v2 (Sprint 8: self-hosted fonts, full offline) */
const CACHE = 'thatta-v9'

const FONT_FILES = [
  '/fonts/hind-siliguri-400-bengali.woff2',
  '/fonts/hind-siliguri-400-latin.woff2',
  '/fonts/hind-siliguri-400-latin-ext.woff2',
  '/fonts/hind-siliguri-500-bengali.woff2',
  '/fonts/hind-siliguri-500-latin.woff2',
  '/fonts/hind-siliguri-500-latin-ext.woff2',
  '/fonts/hind-siliguri-600-bengali.woff2',
  '/fonts/hind-siliguri-600-latin.woff2',
  '/fonts/hind-siliguri-600-latin-ext.woff2',
  '/fonts/hind-siliguri-700-bengali.woff2',
  '/fonts/hind-siliguri-700-latin.woff2',
  '/fonts/hind-siliguri-700-latin-ext.woff2',
]

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-1024.png',
  '/logo.svg',
  ...FONT_FILES,
]

// kept for older cached pages that still reference Google Fonts
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // fonts first (small, critical for Bangla), then the app shell —
        // one missing asset must not break the whole install
        Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)))
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

/** cache-first: instantly serve from cache, fill from network on miss */
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(CACHE)
    cache.put(request, response.clone())
  }
  return response
}

/** stale-while-revalidate: fast cache, silent background refresh */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  const refresh = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
      }
      return response
    })
    .catch(() => cached)
  return cached || refresh
}

/** network-first: fresh data when online, cached copy when offline */
async function networkFirst(request, cacheWhen = () => true) {
  try {
    const response = await fetch(request)
    if (response && response.ok && cacheWhen(response)) {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(request, copy))
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    throw new Error('offline and not cached')
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // cross-origin: only Google Fonts (legacy pages; fonts are self-hosted now)
  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.includes(url.hostname)) {
      event.respondWith(cacheFirst(request).catch(() => Response.error()))
    }
    return
  }

  // never touch TTS or write APIs
  if (url.pathname.startsWith('/api/tts')) return

  // project list: network-first so the Load dialog still opens offline
  if (url.pathname === '/api/projects') {
    event.respondWith(
      networkFirst(request).catch(
        () =>
          new Response(JSON.stringify({ projects: [], offline: true }), {
            headers: { 'Content-Type': 'application/json' },
          })
      )
    )
    return
  }

  if (url.pathname.startsWith('/api/')) return

  // immutable build assets: cache-first (they carry a content hash)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/logo.svg' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirst(request))
    return
  }

  // app shell navigation: fresh when online, cached '/' when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put('/', copy))
          }
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    )
    return
  }

  // everything else (rsc payloads, route chunks…): stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request))
})
