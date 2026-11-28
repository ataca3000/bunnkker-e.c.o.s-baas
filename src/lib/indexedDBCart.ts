/**
 * Motor de Persistencia Offline con IndexedDB para el Carrito, Catálogo Snapshot,
 * Vínculo Host LAN y Cola Transaccional de Pedidos (BUNKKER E.C.O.S. Local-First v3)
 *
 * Garantiza que:
 * 1. El estado del carrito (tanto de clientes como del POS en caja) persista en IndexedDB
 *    incluso si el navegador se cierra abruptamente o la red es inestable.
 * 2. Los pedidos creados durante desconexiones o caídas de red se guarden en una cola
 *    transaccional en IndexedDB (`offline_orders_queue`) y se sincronicen automáticamente.
 * 3. El catálogo operativo (`local_products_snapshot`) y la configuración del Host LAN
 *    (`local_host_config`) permanezcan disponibles 100% offline para consultas y cobro local.
 */

import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'bunkker_ecos_offline_db';
const DB_VERSION = 3;
const STORE_KV = 'cart_kv_store';
const STORE_ORDERS_QUEUE = 'offline_orders_queue';
const STORE_PRODUCTS_SNAPSHOT = 'local_products_snapshot';
const STORE_HOST_CONFIG = 'local_host_config';

export interface QueuedOfflineOrder {
    orderId: string;
    payload: Record<string, any>;
    deliveryPin?: string;
    createdAt: string;
    attempts: number;
    lastError?: string;
    source: 'storefront' | 'pos';
}

export interface OfflineCatalogProduct {
    id: string;
    sku?: string;
    barcode?: string;
    name: string;
    price: number;
    stock: number;
    category?: string;
    estante?: string;
    fila?: string;
    updatedAt: string;
}

export interface OfflineCatalogSnapshotMeta {
    snapshotId: 'active';
    branchId: string;
    roomCode?: string;
    hostEpoch: number;
    source: 'lan_host' | 'cloud' | 'local';
    updatedAt: string;
    products: OfflineCatalogProduct[];
}

export interface LanHostLinkConfig {
    configId: 'active_host';
    roomCode: string;
    hostUrl: string;
    wsUrl: string;
    branchId: string;
    branchName: string;
    hostEpoch: number;
    role: string;
    deviceName: string;
    connectedAt: string;
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
                if (!db.objectStoreNames.contains(STORE_PRODUCTS_SNAPSHOT)) {
                    db.createObjectStore(STORE_PRODUCTS_SNAPSHOT, { keyPath: 'snapshotId' });
                }
                if (!db.objectStoreNames.contains(STORE_HOST_CONFIG)) {
                    db.createObjectStore(STORE_HOST_CONFIG, { keyPath: 'configId' });
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

// ─── Snapshot Local-First de Catálogo e Información del Host LAN ─────────────

const FALLBACK_CATALOG_KEY = 'bunkker_offline_catalog_snapshot_v1';
const FALLBACK_HOST_KEY = 'bunkker_lan_host_link_v1';

export async function saveOfflineCatalogSnapshot(
    snapshot: Omit<OfflineCatalogSnapshotMeta, 'snapshotId' | 'updatedAt'> & { updatedAt?: string }
): Promise<OfflineCatalogSnapshotMeta> {
    const record: OfflineCatalogSnapshotMeta = {
        snapshotId: 'active',
        branchId: snapshot.branchId || 'default',
        roomCode: snapshot.roomCode,
        hostEpoch: Number.isFinite(snapshot.hostEpoch) ? snapshot.hostEpoch : 1,
        source: snapshot.source,
        updatedAt: snapshot.updatedAt || new Date().toISOString(),
        products: Array.isArray(snapshot.products) ? snapshot.products : [],
    };

    if (!isBrowser()) return record;

    try {
        const db = await openOfflineDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_PRODUCTS_SNAPSHOT, 'readwrite');
            const store = tx.objectStore(STORE_PRODUCTS_SNAPSHOT);
            store.put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {
        try {
            window.localStorage.setItem(FALLBACK_CATALOG_KEY, JSON.stringify(record));
        } catch {}
    }

    return record;
}

export async function loadOfflineCatalogSnapshot(): Promise<OfflineCatalogSnapshotMeta | null> {
    if (!isBrowser()) return null;
    try {
        const db = await openOfflineDB();
        const record = await new Promise<OfflineCatalogSnapshotMeta | null>((resolve, reject) => {
            const tx = db.transaction(STORE_PRODUCTS_SNAPSHOT, 'readonly');
            const store = tx.objectStore(STORE_PRODUCTS_SNAPSHOT);
            const req = store.get('active');
            req.onsuccess = () => resolve((req.result as OfflineCatalogSnapshotMeta) ?? null);
            req.onerror = () => reject(req.error);
        });
        if (record) return record;
    } catch {}

    try {
        const raw = window.localStorage.getItem(FALLBACK_CATALOG_KEY);
        return raw ? (JSON.parse(raw) as OfflineCatalogSnapshotMeta) : null;
    } catch {
        return null;
    }
}

export async function applyLocalStockDeltaToIDB(
    deltas: Array<{ productId: string; delta: number }>
): Promise<OfflineCatalogSnapshotMeta | null> {
    const current = await loadOfflineCatalogSnapshot();
    if (!current) return null;

    const deltaMap = new Map<string, number>();
    for (const entry of deltas) {
        if (!entry?.productId || !Number.isFinite(entry.delta)) continue;
        deltaMap.set(entry.productId, (deltaMap.get(entry.productId) || 0) + entry.delta);
    }

    const updatedProducts = current.products.map((product) => {
        const change = deltaMap.get(product.id);
        if (change === undefined) return product;
        return {
            ...product,
            stock: Math.max(0, Number(product.stock || 0) + change),
            updatedAt: new Date().toISOString(),
        };
    });

    return await saveOfflineCatalogSnapshot({
        branchId: current.branchId,
        roomCode: current.roomCode,
        hostEpoch: current.hostEpoch,
        source: current.source,
        products: updatedProducts,
    });
}

export async function saveLanHostLink(
    config: Omit<LanHostLinkConfig, 'configId' | 'connectedAt'> & { connectedAt?: string }
): Promise<LanHostLinkConfig> {
    const record: LanHostLinkConfig = {
        ...config,
        configId: 'active_host',
        connectedAt: config.connectedAt || new Date().toISOString(),
    };

    if (!isBrowser()) return record;

    try {
        const db = await openOfflineDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_HOST_CONFIG, 'readwrite');
            const store = tx.objectStore(STORE_HOST_CONFIG);
            store.put(record);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {}

    try {
        window.localStorage.setItem(FALLBACK_HOST_KEY, JSON.stringify(record));
    } catch {}

    return record;
}

export async function loadLanHostLink(): Promise<LanHostLinkConfig | null> {
    if (!isBrowser()) return null;
    try {
        const db = await openOfflineDB();
        const record = await new Promise<LanHostLinkConfig | null>((resolve, reject) => {
            const tx = db.transaction(STORE_HOST_CONFIG, 'readonly');
            const store = tx.objectStore(STORE_HOST_CONFIG);
            const req = store.get('active_host');
            req.onsuccess = () => resolve((req.result as LanHostLinkConfig) ?? null);
            req.onerror = () => reject(req.error);
        });
        if (record) return record;
    } catch {}

    try {
        const raw = window.localStorage.getItem(FALLBACK_HOST_KEY);
        return raw ? (JSON.parse(raw) as LanHostLinkConfig) : null;
    } catch {
        return null;
    }
}

export async function clearLanHostLink(): Promise<void> {
    if (!isBrowser()) return;
    try {
        const db = await openOfflineDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_HOST_CONFIG, 'readwrite');
            const store = tx.objectStore(STORE_HOST_CONFIG);
            store.delete('active_host');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch {}
    try {
        window.localStorage.removeItem(FALLBACK_HOST_KEY);
    } catch {}
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
 * Sincroniza todos los pedidos pendientes en IndexedDB con `/api/orders`
 * o hacia el Host LAN activo si la aplicación está vinculada en modo local-first.
 */
export async function flushOfflineOrderQueue(onOrderSynced?: (orderId: string) => void): Promise<{ synced: number; remaining: number }> {
    if (!isBrowser() || isFlushingQueue) {
        return { synced: 0, remaining: 0 };
    }

    const activeHost = await loadLanHostLink().catch(() => null);
    const hasInternet = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (!hasInternet && !activeHost?.hostUrl) {
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
                const { getCustomerAuthHeaders } = await import('@/lib/customerAuth');
                const authHeaders = getCustomerAuthHeaders();
                const targetEndpoint =
                    !hasInternet && activeHost?.hostUrl && window.location.protocol !== 'https:'
                        ? `${activeHost.hostUrl.replace(/\/+$/, '')}/api/host/sale`
                        : '/api/orders';

                const res = await fetch(targetEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                    credentials: targetEndpoint === '/api/orders' ? 'include' : 'omit',
                    body: JSON.stringify(entry.payload),
                });

                if (res.ok) {
                    await removeQueuedOfflineOrder(entry.orderId);
                    syncedCount++;
                    if (onOrderSynced) onOrderSynced(entry.orderId);
                } else if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
                    const errData = await res.json().catch(() => ({}));
                    if (errData?.duplicated || res.status === 400) {
                        await removeQueuedOfflineOrder(entry.orderId);
                        if (errData?.duplicated) syncedCount++;
                    }
                }
            } catch {
                break;
            }
        }

        const remainingQueue = await getQueuedOfflineOrders();
        return { synced: syncedCount, remaining: remainingQueue.length };
    } finally {
        isFlushingQueue = false;
    }
}
