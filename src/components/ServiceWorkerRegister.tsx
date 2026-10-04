"use client";

import { useEffect } from 'react';

/**
 * Componente centinela para registrar el Service Worker (PWA) de BUNKKER E.C.O.S.
 * Permite que los dispositivos satélite (celulares, tablets, choferes) descarguen
 * y ejecuten la aplicación incluso sin conexión a red o Wi-Fi.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
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
