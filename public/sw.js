/**
 * BUNKKER E.C.O.S. ERP — Service Worker Soberano PWA (v2.0)
 * Diseñado bajo primeros principios industriales:
 * 1. CERO interferencia en peticiones a /api/* (viajan directo por la red sin caché).
 * 2. CERO caché de peticiones de mutación (POST, PUT, DELETE, PATCH).
 * 3. Purga inmediata de cachés heredados obsoletos (Workbox antiguo / APIs cacheadas).
 * 4. Soporte offline para rutas de choferes/repartidores y recursos estáticos.
 */

const STATIC_CACHE_NAME = 'bunkker-ecos-static-v2';

self.addEventListener('install', (event) => {
  // Tomar el control inmediatamente sin esperar a que se cierren las pestañas
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Purgar todos los cachés antiguos (Workbox legado, apis, páginas viejas)
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== STATIC_CACHE_NAME) {
            console.log('🧹 [BUNKKER SW] Purgando caché obsoleto:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. REGLA INVIOLABLE: NUNCA interceptar peticiones a la API ni métodos de mutación
  // Deben viajar en crudo por la red para garantizar ACID y datos vivos de inventario/ventas
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return; // El Service Worker NO toca esta petición; el navegador la envía directo
  }

  // 2. Navegación de páginas HTML: Network-First con fallback seguro
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return caches.match('/');
      })
    );
    return;
  }

  // 3. Recursos multimedia e iconos estáticos (PWA assets)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Para el resto (scripts de Next.js, etc.): dejar que el navegador resuelva por red
});
