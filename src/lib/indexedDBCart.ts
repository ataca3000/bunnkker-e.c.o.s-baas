/**
 * Motor de Persistencia Offline con IndexedDB para el Carrito y Cola de Pedidos (BUNKKER E.C.O.S.)
 *
 * Garantiza que:
 * 1. El estado del carrito (tanto de clientes como del POS en caja) persista en IndexedDB
 *    incluso si el navegador se cierra abruptamente o la red es inestable.
 * 2. Los pedidos creados durante desconexiones o caídas de red se guarden en una cola
 *    transaccional en IndexedDB (`offline_orders_queue`) y se sincronicen automáticamente
 *    con `/api/orders` cuando la conexión se restablezca o al reabrir el navegador.
 */

import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'bunkker_ecos_offline_db';
const DB_VERSION = 2;
const STORE_KV = 'cart_kv_store';
const STORE_ORDERS_QUEUE = 'offline_orders_queue';

export interface QueuedOfflineOrder {
    orderId: string;
    payload: Record<string, any>;
    deliveryPin?: string;
    createdAt: string;
    attempts: number;
    lastError?: string;
    source: 'storefront' | 'pos';
}

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openOfflineDB(): Promise<IDBDatabase> {
    if (!isBrowser()) {
        return Promise.reject(new Error('IndexedDB no está disponible en el servidor'));
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        try {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_KV)) {
                    db.createObjectStore(STORE_KV);
                }
                if (!db.objectStoreNames.contains(STORE_ORDERS_QUEUE)) {
                    const queueStore = db.createObjectStore(STORE_ORDERS_QUEUE, { keyPath: 'orderId' });
                    queueStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                db.onversionchange = () => {
                    db.close();
                    dbPromise = null;
                };
                resolve(db);
            };

            request.onerror = () => {
                dbPromise = null;
                reject(request.error);
            };
        } catch (err) {
            dbPromise = null;
            reject(err);
        }
    });

    return dbPromise;
}

/**
 * Lee un valor del almacén KV de IndexedDB (con fallback instantáneo a localStorage)
 */
export async function idbGetItem(key: string): Promise<string | null> {
    if (!isBrowser()) return null;
    try {
        const db = await openOfflineDB();
        const val = await new Promise<string | null>((resolve, reject) => {
            const tx = db.transaction(STORE_KV, 'readonly');
            const store = tx.objectStore(STORE_KV);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });

        if (val !== null && val !== undefined) {
            return typeof val === 'string' ? val : JSON.stringify(val);
        }

        // Migración automática si existe en localStorage pero aún no en IndexedDB
        const localFallback = window.localStorage.getItem(key);
        if (localFallback) {
            await idbSetItem(key, localFallback);
            return localFallback;
        }
        return null;
    } catch {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null;
        }
    }
}

/**
 * Escribe un valor en IndexedDB y mantiene espejo en localStorage para recuperación síncrona
 */
export async function idbSetItem(key: string, value: string): Promise<void> {
    if (!isBrowser()) return;
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Ignorar errores de cuota de localStorage
    }

    try {
        const db = await openOfflineDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_KV, 'readwrite');
            const store = tx.objectStore(STORE_KV);
            store.put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.warn('[IndexedDB] No se pudo guardar en IndexedDB, usando respaldo local:', err);
    }
}

/**
 * Elimina una clave de IndexedDB y de localStorage
 */
export async function idbRemoveItem(key: string): Promise<void> {
    if (!isBrowser()) return;
    try {
        window.localStorage.removeItem(key);
    } catch {}

    try {
        const db = await openOfflineDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_KV, 'readwrite');
            const store = tx.objectStore(STORE_KV);
            store.delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {}
}

/**
 * Adaptador oficial para Zustand `persist` usando IndexedDB
 */
export const indexedDBCartStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return await idbGetItem(name);
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await idbSetItem(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await idbRemoveItem(name);
    },
};

// ─── Persistencia de Carrito POS y Borrador de Checkout en IndexedDB ─────────

const POS_CART_KEY = 'bunkker_idb_pos_cart_v1';
const CHECKOUT_DRAFT_KEY = 'bunkker_idb_checkout_draft_v1';

export async function savePosCartToIDB(items: any[]): Promise<void> {
    await idbSetItem(POS_CART_KEY, JSON.stringify({ items, updatedAt: Date.now() }));
}

export async function loadPosCartFromIDB(): Promise<any[]> {
    const raw = await idbGetItem(POS_CART_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch {
        return [];
    }
}

export async function saveCheckoutDraftToIDB(draft: Record<string, any>): Promise<void> {
    await idbSetItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }));
}

export async function loadCheckoutDraftFromIDB(): Promise<Record<string, any> | null> {
    const raw = await idbGetItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// ─── Cola Transaccional de Pedidos Offline en IndexedDB ──────────────────────

/**
 * Guarda un pedido en IndexedDB cuando hay una conexión inestable o sin red.
 * Si el navegador se cierra, el pedido permanece intacto en IndexedDB hasta ser sincronizado.
 */
export async function enqueueOfflineOrder(order: Omit<QueuedOfflineOrder, 'createdAt' | 'attempts'>): Promise<QueuedOfflineOrder> {
    const record: QueuedOfflineOrder = {
        ...order,
        createdAt: new Date().toISOString(),
        attempts: 0,
    };

    if (!isBrowser()) return record;

    try {
        const db = await openOfflineDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_ORDERS_QUEUE, 'readwrite');
            const store = tx.objectStore(STORE_ORDERS_QUEUE);
            store.put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (err) {
        console.warn('[IndexedDB Queue] Fallback a localStorage para pedido offline:', err);
        try {
            const fallbackRaw = window.localStorage.getItem('bunkker_offline_orders_fallback');
            const list: QueuedOfflineOrder[] = fallbackRaw ? JSON.parse(fallbackRaw) : [];
            const filtered = list.filter(o => o.orderId !== record.orderId);
            filtered.push(record);
            window.localStorage.setItem('bunkker_offline_orders_fallback', JSON.stringify(filtered));
        } catch {}
    }

    return record;
}

/**
 * Obtiene todos los pedidos pendientes de sincronizar almacenados en IndexedDB
 */
export async function getQueuedOfflineOrders(): Promise<QueuedOfflineOrder[]> {
    if (!isBrowser()) return [];
    try {
        const db = await openOfflineDB();
        const records = await new Promise<QueuedOfflineOrder[]>((resolve, reject) => {
            const tx = db.transaction(STORE_ORDERS_QUEUE, 'readonly');
            const store = tx.objectStore(STORE_ORDERS_QUEUE);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });

        // Combinar si hubiera alguno en fallback de localStorage
        const fallbackRaw = window.localStorage.getItem('bunkker_offline_orders_fallback');
        if (fallbackRaw) {
            try {
                const fallbackList: QueuedOfflineOrder[] = JSON.parse(fallbackRaw);
                for (const item of fallbackList) {
                    if (!records.some(r => r.orderId === item.orderId)) {
                        records.push(item);
                    }
                }
            } catch {}
        }

        return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch {
        try {
            const fallbackRaw = window.localStorage.getItem('bunkker_offline_orders_fallback');
            return fallbackRaw ? JSON.parse(fallbackRaw) : [];
        } catch {
            return [];
        }
    }
}

/**
 * Elimina un pedido de la cola de IndexedDB una vez que el servidor confirmó su guardado
 */
export async function removeQueuedOfflineOrder(orderId: string): Promise<void> {
    if (!isBrowser()) return;
    try {
        const db = await openOfflineDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_ORDERS_QUEUE, 'readwrite');
            const store = tx.objectStore(STORE_ORDERS_QUEUE);
            store.delete(orderId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {}

    try {
        const fallbackRaw = window.localStorage.getItem('bunkker_offline_orders_fallback');
        if (fallbackRaw) {
            const list: QueuedOfflineOrder[] = JSON.parse(fallbackRaw);
            const next = list.filter(o => o.orderId !== orderId);
            if (next.length === 0) {
                window.localStorage.removeItem('bunkker_offline_orders_fallback');
            } else {
                window.localStorage.setItem('bunkker_offline_orders_fallback', JSON.stringify(next));
            }
        }
    } catch {}
}

let isFlushingQueue = false;

/**
 * Sincroniza todos los pedidos pendientes en IndexedDB con `/api/orders`.
 * Retorna cuántos pedidos fueron sincronizados exitosamente.
 */
export async function flushOfflineOrderQueue(onOrderSynced?: (orderId: string) => void): Promise<{ synced: number; remaining: number }> {
    if (!isBrowser() || isFlushingQueue) {
        return { synced: 0, remaining: 0 };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const pending = await getQueuedOfflineOrders();
        return { synced: 0, remaining: pending.length };
    }

    isFlushingQueue = true;
    let syncedCount = 0;

    try {
        const queue = await getQueuedOfflineOrders();
        if (queue.length === 0) {
            return { synced: 0, remaining: 0 };
        }

        for (const entry of queue) {
            try {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(entry.payload),
                });

                if (res.ok) {
                    await removeQueuedOfflineOrder(entry.orderId);
                    syncedCount++;
                    if (onOrderSynced) onOrderSynced(entry.orderId);
                } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
                    // Si es un error de validación definitivo o duplicado ya procesado, verificar si es idempotente
                    const errData = await res.json().catch(() => ({}));
                    if (errData?.duplicated) {
                        await removeQueuedOfflineOrder(entry.orderId);
                        syncedCount++;
                    }
                }
            } catch {
                // Error de red: cortar el ciclo y reintentar en el siguiente pulso
                break;
            }
        }

        const remainingQueue = await getQueuedOfflineOrders();
        return { synced: syncedCount, remaining: remainingQueue.length };
    } finally {
        isFlushingQueue = false;
    }
}
