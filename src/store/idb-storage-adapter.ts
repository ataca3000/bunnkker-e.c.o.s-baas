/**
 * BUNKKER â€” Zustand StateStorage Adapter para IndexedDB
 * Reemplaza localStorage como backend de persistencia del store.
 * Namespace por storeId para aislamiento total entre tiendas.
 */

import type { StateStorage } from 'zustand/middleware';
import { openDB } from '../lib/idb/idb-service';
import { DB_NAME } from '../lib/idb/schema';



const ZUSTAND_STORE_NAME = 'zustandState';

/** Abre la BD asegurandose de que el store zustandState existe */
function openZustandDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        // Necesitamos version mayor si el store no existe aun
        const checkReq = indexedDB.open(DB_NAME);
        checkReq.onsuccess = () => {
            const db = checkReq.result;
            const hasStore = db.objectStoreNames.contains(ZUSTAND_STORE_NAME);
            const currentVersion = db.version;
            db.close();

            if (hasStore) {
                // Ya existe: abrir con la version actual
                const req = indexedDB.open(DB_NAME, currentVersion);
                req.onsuccess = () => resolve(req.result);
                req.onerror   = () => reject(req.error);
            } else {
                // Crear el store en una nueva version
                const newVersion = currentVersion + 1;
                const req = indexedDB.open(DB_NAME, newVersion);
                req.onupgradeneeded = (e) => {
                    const upgDB = (e.target as IDBOpenDBRequest).result;
                    if (!upgDB.objectStoreNames.contains(ZUSTAND_STORE_NAME)) {
                        upgDB.createObjectStore(ZUSTAND_STORE_NAME, { keyPath: 'key' });
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror   = () => reject(req.error);
            }
        };
        checkReq.onerror = () => reject(checkReq.error);
    });
}

async function zustandGet(key: string): Promise<string | null> {
    const db = await openZustandDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(ZUSTAND_STORE_NAME, 'readonly');
        const req = tx.objectStore(ZUSTAND_STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result?.value ?? null);
        req.onerror   = () => reject(req.error);
    });
}

async function zustandSet(key: string, value: string): Promise<void> {
    const db = await openZustandDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(ZUSTAND_STORE_NAME, 'readwrite');
        const req = tx.objectStore(ZUSTAND_STORE_NAME).put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

async function zustandRemove(key: string): Promise<void> {
    const db = await openZustandDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(ZUSTAND_STORE_NAME, 'readwrite');
        const req = tx.objectStore(ZUSTAND_STORE_NAME).delete(key);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

/**
 * Crea un adapter de IndexedDB para Zustand persist.
 * @param storeId - El UUID de la tienda (namespace de aislamiento)
 */
export function createIdbStorageAdapter(storeId: string): StateStorage {
    const prefix = `bunkker:${storeId}:`;

    return {
        getItem: (name: string): Promise<string | null> => {
            return zustandGet(`${prefix}${name}`);
        },
        setItem: (name: string, value: string): Promise<void> => {
            return zustandSet(`${prefix}${name}`, value);
        },
        removeItem: (name: string): Promise<void> => {
            return zustandRemove(`${prefix}${name}`);
        },
    };
}

/**
 * Adapter de fallback que usa localStorage cuando IndexedDB no esta disponible.
 * Util durante SSR o en entornos sin soporte IDB.
 */
export function createFallbackStorageAdapter(): StateStorage {
    return {
        getItem: (name: string) => {
            if (typeof window === 'undefined') return null;
            return localStorage.getItem(name);
        },
        setItem: (name: string, value: string) => {
            if (typeof window === 'undefined') return;
            localStorage.setItem(name, value);
        },
        removeItem: (name: string) => {
            if (typeof window === 'undefined') return;
            localStorage.removeItem(name);
        },
    };
}

