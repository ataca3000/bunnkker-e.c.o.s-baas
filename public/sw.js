/**
 * BUNKKER — Service Worker (Cache-First)
 * Estrategia: el shell de la app se sirve desde cache.
 * Las APIs de datos (productos, ordenes) funcionan offline via IndexedDB en el cliente.
 * Cuando hay red, se actualiza el cache en segundo plano.
 */

const CACHE_NAME = 'bunkker-shell-v1';

// Recursos criticos que se cachean al instalar
const PRECACHE_URLS = [
    '/',
    '/manifest.json',
    // Next.js inyecta los hashes reales en build; en dev se cachea lo que llegue
];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Precacheando shell...');
            return cache.addAll(PRECACHE_URLS).catch((err) => {
                console.warn('[SW] Error en precache (normal en dev):', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => {
                        console.log('[SW] Limpiando cache viejo:', key);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Solo interceptar peticiones del mismo origen
    if (url.origin !== self.location.origin) return;

    // API routes — Network-first con fallback offline
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirstWithOfflineFallback(request));
        return;
    }

    // Assets y paginas — Stale-While-Revalidate
    event.respondWith(staleWhileRevalidate(request));
});

/**
 * Network-first: intenta la red, en error devuelve respuesta offline JSON.
 * Las rutas de datos reales vienen de IndexedDB en el cliente (el SW no accede a IDB).
 */
async function networkFirstWithOfflineFallback(request) {
    try {
        const networkRes = await fetch(request.clone(), { signal: AbortSignal.timeout(4000) });
        if (networkRes.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkRes.clone());
        }
        return networkRes;
    } catch {
        // Respuesta offline para que el cliente maneje via IDB
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(
            JSON.stringify({ offline: true, message: 'Sin conexion — los datos se sirven desde tu dispositivo.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

/**
 * Stale-While-Revalidate: sirve desde cache inmediatamente,
 * actualiza cache en segundo plano.
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const networkFetch = fetch(request.clone())
        .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
        })
        .catch(() => null);

    return cached ?? (await networkFetch) ?? new Response('Offline', { status: 503 });
}

// ─── Mensajes del cliente ─────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
        caches.open(CACHE_NAME).then((cache) => cache.addAll(event.data.urls));
    }
});
