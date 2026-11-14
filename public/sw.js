/**
 * BUNKKER E.C.O.S. ERP — Service Worker Soberano PWA (v3.0)
 * 1. Mantiene /api/orders, /api/products, /api/sales y todas las mutaciones 100% libres de caché HTTP
 *    para garantizar consistencia ACID e inventario vivo.
 * 2. Resguarda en caché local persistente (PC y Android) los medios publicados de la tienda
 *    (/api/media/*, imágenes, GIFs, MP4 cortos) y el snapshot GET de /api/settings para uso cotidiano offline.
 * 3. Pre-cachea activos al recibir CACHE_STOREFRONT_ASSETS tras confirmar una publicación.
 */

const STATIC_CACHE_NAME = 'bunkker-ecos-static-v3';
const MEDIA_CACHE_NAME = 'bunkker-ecos-storefront-media-v1';
const PRESERVED_CACHES = new Set([STATIC_CACHE_NAME, MEDIA_CACHE_NAME]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/catalogo', '/servicios', '/nosotros', '/contacto', '/manifest.json']).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (!PRESERVED_CACHES.has(name)) {
            return caches.delete(name);
          }
          return Promise.resolve(false);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'CACHE_STOREFRONT_ASSETS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
        const urls = event.data.urls.filter((u) => typeof u === 'string' && u.trim().length > 0);
        await Promise.allSettled(
          urls.map(async (url) => {
            try {
              const req = new Request(url, { mode: url.startsWith('/') ? 'same-origin' : 'cors' });
              const existing = await cache.match(req);
              if (!existing) {
                const res = await fetch(req);
                if (res && res.ok) {
                  await cache.put(req, res);
                }
              }
            } catch {
              // Ignorar enlaces externos con CORS estricto; medios locales del servidor quedan siempre resguardados
            }
          })
        );
      })
    );
    return;
  }

  if (event.data.type === 'PURGE_UNUSED_CACHES') {
    event.waitUntil(
      (async () => {
        let evictedCount = 0;
        try {
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            if (!PRESERVED_CACHES.has(name)) {
              const deleted = await caches.delete(name);
              if (deleted) evictedCount++;
            }
          }

          const mediaCache = await caches.open(MEDIA_CACHE_NAME);
          const mediaRequests = await mediaCache.keys();
          if (mediaRequests.length > 50) {
            for (const req of mediaRequests.slice(0, mediaRequests.length - 50)) {
              const deleted = await mediaCache.delete(req);
              if (deleted) evictedCount++;
            }
          }

          const staticCache = await caches.open(STATIC_CACHE_NAME);
          const staticRequests = await staticCache.keys();
          if (staticRequests.length > 20) {
            for (const req of staticRequests.slice(0, staticRequests.length - 20)) {
              const deleted = await staticCache.delete(req);
              if (deleted) evictedCount++;
            }
          }
        } catch {}

        if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage({ type: 'CACHE_PURGE_COMPLETE', evictedCount });
        }
      })()
    );
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca interceptar mutaciones (POST, PUT, PATCH, DELETE)
  if (event.request.method !== 'GET') {
    return;
  }

  // Nunca interceptar chunks internos ni HMR de Next.js
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // 1. Medios propios de la tienda (/api/media/*): Cache-First para uso offline en PC y Android
  if (url.pathname.startsWith('/api/media/')) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request, { ignoreVary: true });
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response && response.status === 200) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 2. Configuración publicada de tienda (/api/settings GET): Network-First con respaldo offline
  if (url.pathname === '/api/settings') {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(JSON.stringify({ success: false, offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })
    );
    return;
  }

  // 3. REGLA INVIOLABLE PARA EL NÚCLEO ERP: Cero caché en /api/products, /api/orders, /api/auth, etc.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 4. Navegación de páginas HTML: Network-First con fallback offline seguro
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match('/');
        })
    );
    return;
  }

  // 5. Recursos multimedia, videos cortos, GIFs, iconos y fuentes estáticas
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|mp4|webm|woff|woff2|ttf|eot)$/i)) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
    return;
  }
});
