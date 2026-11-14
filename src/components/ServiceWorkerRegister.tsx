"use client";

import { useEffect } from 'react';

const CHUNK_RELOAD_GUARD_KEY = '_bunkker_chunk_reload_at';

function isChunkLoadFailure(reasonOrError: unknown): boolean {
  if (!reasonOrError) return false;
  const err = reasonOrError as { name?: string; message?: string };
  const name = String(err?.name || '');
  const message = String(err?.message || reasonOrError || '');
  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError|Loading chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      message
    )
  );
}

async function recoverFromStaleChunk(): Promise<void> {
  try {
    const lastAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) || '0');
    if (Date.now() - lastAttempt < 15000) return;
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    // Continuar aunque sessionStorage no esté disponible
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.includes('static') || key.includes('next') || key.includes('workbox') || key.includes('pages'))
          .map((key) => caches.delete(key))
      );
    }
  } catch {}

  window.location.reload();
}

/**
 * Componente centinela para registrar el Service Worker (PWA) de BUNKKER E.C.O.S.
 * Permite que los dispositivos satélite (celulares, tablets, choferes) descarguen
 * y ejecuten la aplicación incluso sin conexión a red o Wi-Fi.
 * Además, purga cachés obsoletos (APIs/Workbox) y recupera automáticamente errores de ChunkLoadError.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleWindowError = (event: ErrorEvent) => {
      if (isChunkLoadFailure(event.error || event.message)) {
        void recoverFromStaleChunk();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadFailure(event.reason)) {
        void recoverFromStaleChunk();
      }
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Purga proactiva únicamente de cachés heredados obsoletos (preservando medios de tienda y app shell v3)
    const ACTIVE_CACHES = new Set(['bunkker-ecos-static-v3', 'bunkker-ecos-storefront-media-v1']);
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (ACTIVE_CACHES.has(key)) return;
          if (
            key.includes('workbox') ||
            key.includes('next-data') ||
            key.includes('next-static-js-assets') ||
            key.includes('start-url') ||
            key.includes('pages') ||
            key === 'bunkker-ecos-static-v2'
          ) {
            caches.delete(key);
          }
        });
      }).catch(() => {});
    }

    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('error', handleWindowError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }

    const isDevRuntime = process.env.NODE_ENV === 'development';

    const manageServiceWorker = async () => {
      if (isDevRuntime) {
        // En desarrollo, evitar cachés SW de rutas HTML que chocan con hashes nuevos de Next dev
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((reg) => reg.unregister()));
        } catch {}
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        registration.update().catch(() => {});

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      } catch (error) {
        console.warn('[BUNKKER PWA] Error al registrar Service Worker:', error);
      }
    };

    if (document.readyState === 'complete') {
      void manageServiceWorker();
    } else {
      const onLoad = () => {
        void manageServiceWorker();
      };
      window.addEventListener('load', onLoad);
      return () => {
        window.removeEventListener('load', onLoad);
        window.removeEventListener('error', handleWindowError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
