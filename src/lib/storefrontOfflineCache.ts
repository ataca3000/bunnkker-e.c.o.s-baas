/**
 * storefrontOfflineCache.ts — Persistencia offline en PC y Android (IndexedDB + PWA Cache API)
 * Guarda la fachada publicada, banners dinámicos y notifica al Service Worker
 * para mantener disponibles imágenes, GIFs y videos publicados sin conexión.
 */
import type { SiteConfig } from '@/context/CartContext';
import { extractStorefrontMediaUrls } from './storefrontBuilder';

const DB_NAME = 'bunkker-storefront-offline';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open error'));
  });
}

export async function saveOfflineSiteConfigSnapshot(config: SiteConfig, tenantId = 'default'): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = await openOfflineDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        key: `published_${tenantId}`,
        updatedAt: new Date().toISOString(),
        config,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[StorefrontOfflineCache] Snapshot local falló:', err);
  }
}

export async function loadOfflineSiteConfigSnapshot(tenantId = 'default'): Promise<SiteConfig | null> {
  if (typeof window === 'undefined') return null;
  try {
    const db = await openOfflineDB();
    const result = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(`published_${tenantId}`);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result?.config || null;
  } catch {
    return null;
  }
}

/**
 * Envía los activos visuales publicados al Service Worker PWA y los resguarda
 * directamente en Cache Storage ('bunkker-ecos-storefront-media-v1') para PC y Android.
 */
export async function syncStorefrontAssetsWithServiceWorker(config: SiteConfig): Promise<number> {
  if (typeof window === 'undefined') return 0;

  const mediaUrls = extractStorefrontMediaUrls(config);

  // 1. Resguardo directo en Cache API (funciona incluso antes de que el SW controle la pestaña)
  if ('caches' in window && mediaUrls.length > 0) {
    try {
      const cache = await caches.open('bunkker-ecos-storefront-media-v1');
      await Promise.allSettled(
        mediaUrls.map(async (url) => {
          try {
            const existing = await cache.match(url);
            if (!existing) {
              const res = await fetch(url, { mode: url.startsWith('/') ? 'same-origin' : 'cors' }).catch(() => null);
              if (res && res.ok) {
                await cache.put(url, res);
              }
            }
          } catch {
            // Ignorar CORS estrictos externos; los medios locales sí quedan 100% cacheados
          }
        })
      );
    } catch {}
  }

  // 2. Notificar al Service Worker activo para pre-cacheo en segundo plano
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const target = navigator.serviceWorker.controller || registration.active;
      target?.postMessage({
        type: 'CACHE_STOREFRONT_ASSETS',
        urls: mediaUrls,
      });
    } catch {}
  }

  return mediaUrls.length;
}
