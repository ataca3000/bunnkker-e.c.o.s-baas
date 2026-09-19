/**
 * BUNKKER — IndexedDB Service
 * API unificada para todas las operaciones CRUD en IndexedDB.
 * Todas las operaciones estan namespaciadas por storeId.
 */

import { DB_NAME, DB_VERSION, STORES } from './schema';
import type { IDBSyncQueueItem } from './schema';

// ─── Singleton de la BD ───────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
    if (_db) return Promise.resolve(_db);

    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            for (const storeDef of STORES) {
                if (!db.objectStoreNames.contains(storeDef.name)) {
                    const store = storeDef.autoIncrement
                        ? db.createObjectStore(storeDef.name, { keyPath: storeDef.keyPath, autoIncrement: true })
                        : db.createObjectStore(storeDef.name, { keyPath: storeDef.keyPath });

                    for (const idx of storeDef.indexes) {
                        store.createIndex(idx.name, idx.keyPath, { unique: idx.unique ?? false });
                    }
                }
            }
        };

        req.onsuccess = () => {
            _db = req.result;
            _db.onversionchange = () => { _db?.close(); _db = null; };
            resolve(_db);
        };

        req.onerror = () => reject(req.error);
        req.onblocked = () => console.warn('[IDB] Base de datos bloqueada. Cierra otras pestanas.');
    });
}

// ─── CRUD Genericos ───────────────────────────────────────────────────────────

/** Lee todos los registros de un store filtrados por storeId */
export async function idbGetAll<T>(storeName: string, storeId: string): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);

        // Si tiene indice by_storeId, filtrar eficientemente
        if (store.indexNames.contains('by_storeId')) {
            const idx = store.index('by_storeId');
            const req = idx.getAll(storeId);
            req.onsuccess = () => resolve((req.result as T[]).filter((r: any) => !r.deletedAt));
            req.onerror   = () => reject(req.error);
        } else {
            // storeConfig y similares: getAll directo
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result as T[]);
            req.onerror   = () => reject(req.error);
        }
    });
}

/** Lee un registro por su key primaria */
export async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result as T ?? null);
        req.onerror   = () => reject(req.error);
    });
}

import { recordOperation } from '../usage-meter';

/** Inserta o actualiza un registro (upsert atomico) */
export async function idbUpsert<T>(storeName: string, record: T): Promise<void> {
    const db = await openDB();
    if (storeName === 'orders') {
        recordOperation('sale_close');
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('bunkker_op_recorded'));
    }
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(record);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

/** Inserta o actualiza multiples registros en una sola transaccion */
export async function idbBulkUpsert<T>(storeName: string, records: T[]): Promise<void> {
    if (records.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        let done = 0;
        for (const record of records) {
            const req = store.put(record);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => { done++; if (done === records.length) resolve(); };
        }
        tx.onerror = () => reject(tx.error);
    });
}

/** Borrado suave: marca el registro con deletedAt en lugar de eliminarlo */
export async function idbSoftDelete(storeName: string, id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const get   = store.get(id);
        get.onsuccess = () => {
            if (!get.result) { resolve(); return; }
            const updated = { ...get.result, deletedAt: Date.now() };
            const put = store.put(updated);
            put.onsuccess = () => resolve();
            put.onerror   = () => reject(put.error);
        };
        get.onerror = () => reject(get.error);
    });
}

/** Borrado fisico (solo para syncQueue y datos temporales) */
export async function idbDelete(storeName: string, key: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

// ─── SyncQueue (WAL) ──────────────────────────────────────────────────────────

/** Encola una transaccion pendiente de sincronizacion */
export async function enqueueSync(
    storeId: string,
    type: string,
    data: any
): Promise<void> {
    const item: IDBSyncQueueItem = {
        txId:      crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        storeId,
        type,
        data,
        timestamp: Date.now(),
        status:    'pending',
        retries:   0,
    };
    await idbUpsert('syncQueue', item);
}

/** Obtiene todas las transacciones pendientes para un storeId */
export async function getPendingSyncItems(storeId: string): Promise<IDBSyncQueueItem[]> {
    const all = await idbGetAll<IDBSyncQueueItem>('syncQueue', storeId);
    return all.filter(item => item.status === 'pending');
}

/** Marca un item como enviado y lo elimina de la cola */
export async function markSyncSent(txId: string): Promise<void> {
    await idbDelete('syncQueue', txId);
}

/** Marca un item como fallido e incrementa retries */
export async function markSyncFailed(txId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction('syncQueue', 'readwrite');
        const store = tx.objectStore('syncQueue');
        const get   = store.get(txId);
        get.onsuccess = () => {
            if (!get.result) { resolve(); return; }
            const updated = { ...get.result, status: 'failed', retries: (get.result.retries || 0) + 1 };
            store.put(updated).onsuccess = () => resolve();
        };
        get.onerror = () => reject(get.error);
    });
}

/** Cuenta los items pendientes (equivalente a getOfflineQueueCount en localSync.ts) */
export async function getSyncQueueCount(storeId: string): Promise<number> {
    try {
        const items = await getPendingSyncItems(storeId);
        return items.length;
    } catch {
        return 0;
    }
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Limpia todos los datos de una tienda (para reset/desinstalacion) */
export async function clearStoreData(storeId: string): Promise<void> {
    const storeNames = ['products', 'orders', 'customers', 'users', 'finance', 'syncQueue'];
    for (const storeName of storeNames) {
        const records = await idbGetAll<any>(storeName, storeId);
        for (const record of records) {
            await idbDelete(storeName, record.id || record.txId);
        }
    }
}
