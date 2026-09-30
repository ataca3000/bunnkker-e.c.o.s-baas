/**
 * BUNKKER E.C.O.S. - Memory Optimizer & Resource Trimmer
 * Alineado con las directrices de Google Play:
 * "Reducción del uso de memoria de la aplicación y optimización del código"
 * https://support.google.com/googleplay/android-developer/answer/17492799
 */

export interface MemoryReport {
    heapUsedMB: number | null;
    heapTotalMB: number | null;
    heapLimitMB: number | null;
    storageUsedKB: number;
    storageItemCount: number;
    offlineQueueSize: number;
    deviceMemoryGB: number | null;
    status: 'optimal' | 'warning' | 'critical';
}

/**
 * Obtiene el reporte del estado de memoria del dispositivo/app
 */
export function getMemoryReport(): MemoryReport {
    let heapUsedMB: number | null = null;
    let heapTotalMB: number | null = null;
    let heapLimitMB: number | null = null;

    if (typeof window !== 'undefined' && (performance as any).memory) {
        const mem = (performance as any).memory;
        heapUsedMB = +(mem.usedJSHeapSize / (1024 * 1024)).toFixed(2);
        heapTotalMB = +(mem.totalJSHeapSize / (1024 * 1024)).toFixed(2);
        heapLimitMB = +(mem.jsHeapSizeLimit / (1024 * 1024)).toFixed(2);
    }

    let storageUsedKB = 0;
    let storageItemCount = 0;
    let offlineQueueSize = 0;

    if (typeof window !== 'undefined' && window.localStorage) {
        storageItemCount = localStorage.length;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const val = localStorage.getItem(key) || '';
                storageUsedKB += (key.length + val.length) * 2 / 1024;
            }
        }
        storageUsedKB = +storageUsedKB.toFixed(2);

        try {
            const queue = JSON.parse(localStorage.getItem('pending_sales_queue') || '[]');
            offlineQueueSize = Array.isArray(queue) ? queue.length : 0;
        } catch {
            offlineQueueSize = 0;
        }
    }

    const deviceMemoryGB = typeof navigator !== 'undefined' && (navigator as any).deviceMemory
        ? (navigator as any).deviceMemory
        : null;

    let status: 'optimal' | 'warning' | 'critical' = 'optimal';
    if (heapUsedMB && heapLimitMB) {
        const ratio = heapUsedMB / heapLimitMB;
        if (ratio > 0.8) status = 'critical';
        else if (ratio > 0.5) status = 'warning';
    } else if (storageUsedKB > 4000) {
        status = 'warning';
    }

    return {
        heapUsedMB,
        heapTotalMB,
        heapLimitMB,
        storageUsedKB,
        storageItemCount,
        offlineQueueSize,
        deviceMemoryGB,
        status
    };
}

/**
 * Optimiza la memoria de la aplicación purgando caches obsoletos,
 * logs viejos y datos temporales no críticos.
 */
export async function optimizeAppMemory(): Promise<{ freedKB: number; itemsRemoved: number }> {
    if (typeof window === 'undefined') return { freedKB: 0, itemsRemoved: 0 };

    let itemsRemoved = 0;
    let initialSize = 0;

    // Medir tamaño inicial
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) initialSize += (localStorage.getItem(key) || '').length;
    }

    const keysToRemove: string[] = [];
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Limpiar logs temporales antiguos
        if (key.startsWith('debug_') || key.startsWith('tmp_') || key.startsWith('analytics_temp_')) {
            keysToRemove.push(key);
            continue;
        }

        // Purgar caches con timestamp expirado (> 7 días)
        if (key.includes('_cache_ts')) {
            const ts = Number(localStorage.getItem(key));
            if (ts && now - ts > 7 * 24 * 60 * 60 * 1000) {
                const baseKey = key.replace('_cache_ts', '');
                keysToRemove.push(key);
                keysToRemove.push(baseKey);
            }
        }
    }

    keysToRemove.forEach(k => {
        localStorage.removeItem(k);
        itemsRemoved++;
    });

    // Purgar caches del navegador (Service Worker Cache API) si existen
    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                // Si hay cachés antiguos o de versiones previas, purgarlos
                if (name.includes('v0') || name.includes('old') || name.includes('temp')) {
                    await caches.delete(name);
                    itemsRemoved++;
                }
            }
        } catch (e) {
            console.warn('[MemoryOptimizer] Error purgando CacheStorage:', e);
        }
    }

    // Forzar garbage collection si está habilitado en entorno Electron o runtime Node
    if ((window as any).gc) {
        try {
            (window as any).gc();
        } catch { /* noop */ }
    }

    let finalSize = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) finalSize += (localStorage.getItem(key) || '').length;
    }

    const freedKB = Math.max(0, +((initialSize - finalSize) * 2 / 1024).toFixed(2));
    console.log(`[MemoryOptimizer] Optimización finalizada: ${freedKB} KB liberados, ${itemsRemoved} items eliminados.`);

    return { freedKB, itemsRemoved };
}

/**
 * Escucha eventos del ciclo de vida del dispositivo móvil (Android onTrimMemory equivalente en Web)
 * para recortar memoria cuando la app pasa a segundo plano.
 */
export function initBackgroundMemoryTrimmer(): () => void {
    if (typeof window === 'undefined') return () => {};

    const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
            // App pasó a segundo plano en Android/PWA
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => {
                    optimizeAppMemory();
                });
            } else {
                setTimeout(optimizeAppMemory, 1000);
            }
        }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
    };
}
