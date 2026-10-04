"use client";

import { useEffect } from 'react';

/**
 * Componente centinela para registrar el Service Worker (PWA) de BUNKKER E.C.O.S.
 * Permite que los dispositivos satélite (celulares, tablets, choferes) descarguen
 * y ejecuten la aplicación incluso sin conexión a red o Wi-Fi.
 * Además, purga cachés obsoletos (APIs/Workbox) para evitar datos residuales.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Purga proactiva de cachés huérfanos del navegador (APIs cacheadas por versiones anteriores)
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (
            key.includes('api') ||
            key.includes('workbox') ||
            key.includes('next-data') ||
            key.includes('next-static-js-assets') ||
            key.includes('start-url') ||
            key.includes('pages')
          ) {
            console.log('🧹 [BUNKKER PWA] Eliminando caché residual del cliente:', key);
            caches.delete(key);
          }
        });
      }).catch(() => {});
    }

    if (!('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        // Forzar actualización inmediata del Service Worker para no quedar atrapado en versiones viejas
        registration.update().catch(() => {});

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 [BUNKKER PWA] Nueva versión de Service Worker disponible.');
              }
            });
          }
        });

        console.log('🦁 [BUNKKER PWA] Service Worker registrado con éxito en scope:', registration.scope);
      } catch (error) {
        console.warn('⚠️ [BUNKKER PWA] Error al registrar Service Worker:', error);
      }
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, []);

  return null;
}
