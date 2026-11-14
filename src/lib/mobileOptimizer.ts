'use client';

import { pruneStaleOperationDrafts } from './operationGuard';

export interface MobileOptimizationReport {
    success: boolean;
    prunedLocalDrafts: number;
    swCacheEvicted: number;
    serverFreedKb: number;
    serverRemovedFiles: number;
    heapBeforeMb?: number;
    heapAfterMb?: number;
}

export async function runMobileOptimization(): Promise<MobileOptimizationReport> {
    const prunedLocalDrafts = pruneStaleOperationDrafts();

    let swCacheEvicted = 0;
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const sw = registration.active || navigator.serviceWorker.controller;
            if (sw) {
                swCacheEvicted = await new Promise<number>((resolve) => {
                    const timeout = window.setTimeout(() => resolve(0), 2500);
                    const onMsg = (ev: MessageEvent) => {
                        if (ev.data?.type === 'CACHE_PURGE_COMPLETE') {
                            window.clearTimeout(timeout);
                            navigator.serviceWorker.removeEventListener('message', onMsg);
                            resolve(Number(ev.data.evictedCount || 0));
                        }
                    };
                    navigator.serviceWorker.addEventListener('message', onMsg);
                    sw.postMessage({ type: 'PURGE_UNUSED_CACHES' });
                });
            }
        } catch {}
    }

    let serverFreedKb = 0;
    let serverRemovedFiles = 0;
    let heapBeforeMb: number | undefined;
    let heapAfterMb: number | undefined;

    try {
        const res = await fetch('/api/system/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
            serverFreedKb = Number(data.freedKb || 0);
            serverRemovedFiles = Number(data.removedTempFiles || 0);
            heapBeforeMb = data.memory?.heapBeforeMb;
            heapAfterMb = data.memory?.heapAfterMb;
        }
    } catch {}

    return {
        success: true,
        prunedLocalDrafts,
        swCacheEvicted,
        serverFreedKb,
        serverRemovedFiles,
        heapBeforeMb,
        heapAfterMb,
    };
}
