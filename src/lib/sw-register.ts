/**
 * BUNKKER — Service Worker Registration
 * Registra el SW en el cliente. Importar en el layout root.
 * Maneja actualizaciones sin forzar recargas bruscas.
 */

let _registered = false;

export function registerServiceWorker(): void {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) {
        console.warn('[SW] Service Workers no soportados en este navegador.');
        return;
    }
    if (_registered) return;
    _registered = true;

    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then((registration) => {
                console.log('[SW] Registrado. Scope:', registration.scope);

                // Detectar nueva version disponible
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (
                            newWorker.state === 'installed' &&
                            navigator.serviceWorker.controller
                        ) {
                            // Nueva version lista — notificar al usuario suavemente
                            console.info('[SW] Nueva version disponible. Recarga para actualizar.');
                            window.dispatchEvent(new CustomEvent('sw-update-available'));
                        }
                    });
                });
            })
            .catch((err) => {
                console.error('[SW] Error al registrar:', err);
            });

        // Escuchar control change (nueva version tomando control)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[SW] Nuevo SW tomando control.');
        });
    });
}

/** Fuerza al SW en espera a activarse inmediatamente */
export async function skipWaitingUpdate(): Promise<void> {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
}
