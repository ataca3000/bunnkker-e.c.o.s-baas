/**
 * BUNKKER — Store Identity
 * Genera y persiste la identidad única de cada tienda.
 * El storeId es el namespace de aislamiento en IndexedDB.
 * El QR de acceso contiene la URL con el storeId embebido.
 */

export interface StoreIdentity {
    storeId: string;      // UUID único por tienda
    storeName: string;    // Nombre de la tienda
    storeSlug: string;    // URL-safe slug del nombre
    createdAt: number;    // timestamp de creación
    machineId: string;    // ID del dispositivo principal
}

const IDB_DB_NAME = 'bunkker-store-v1';
const IDB_STORE   = 'storeConfig';
const STORE_RECORD_KEY = 'identity';

// ─── Helpers IndexedDB ────────────────────────────────────────────────────────

function openIdentityDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

async function idbGet<T>(storeName: string, key: string): Promise<T | null> {
    const db = await openIdentityDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result?.value ?? null);
        req.onerror   = () => reject(req.error);
    });
}

async function idbSet(storeName: string, key: string, value: any): Promise<void> {
    const db = await openIdentityDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put({ key, value });
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

// ─── Local IP detection ───────────────────────────────────────────────────────

/**
 * Detecta la IP local del dispositivo usando WebRTC.
 * Funciona en Chrome, Edge y Firefox sin permisos adicionales.
 */
export async function getLocalIP(): Promise<string> {
    if (typeof window === 'undefined') return '127.0.0.1';
    try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        return new Promise((resolve) => {
            pc.onicecandidate = (ice) => {
                if (!ice.candidate) { resolve('127.0.0.1'); return; }
                const m = ice.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
                if (m && m[1] !== '127.0.0.1') {
                    pc.close();
                    resolve(m[1]);
                }
            };
            setTimeout(() => { pc.close(); resolve(window.location.hostname); }, 1000);
        });
    } catch {
        return window.location.hostname || '127.0.0.1';
    }
}

// ─── Store ID desde URL (cuando llegan via QR) ───────────────────────────────

/**
 * Lee el storeId desde el parametro ?s= de la URL.
 * El QR siempre contiene http://[IP]:3005/?s=[storeId]
 */
export function getStoreIdFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const s = params.get('s');
    return s && s.length > 8 ? s : null;
}

// ─── Generacion y persistencia de identidad ──────────────────────────────────

/**
 * Genera la URL que va dentro del QR de acceso.
 */
export function buildQrUrl(storeId: string, localIp: string, port = 3005): string {
    const ip = localIp !== '127.0.0.1' ? localIp : window.location.hostname;
    return `http://${ip}:${port}/?s=${storeId}`;
}

function toSlug(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

export async function createStoreIdentity(
    storeName: string,
    machineId: string
): Promise<StoreIdentity> {
    const identity: StoreIdentity = {
        storeId:   generateUUID(),
        storeName,
        storeSlug: toSlug(storeName),
        createdAt: Date.now(),
        machineId,
    };
    await idbSet(IDB_STORE, STORE_RECORD_KEY, identity);
    return identity;
}

export async function loadStoreIdentity(): Promise<StoreIdentity | null> {
    if (typeof window === 'undefined') return null;
    try {
        return await idbGet<StoreIdentity>(IDB_STORE, STORE_RECORD_KEY);
    } catch {
        return null;
    }
}

export async function resolveStoreId(): Promise<{
    storeId: string;
    isOwner: boolean;
    isFirstRun: boolean;
}> {
    const fromUrl = getStoreIdFromUrl();
    if (fromUrl) {
        return { storeId: fromUrl, isOwner: false, isFirstRun: false };
    }
    let identity = await loadStoreIdentity();
    if (!identity) {
        // Crear identidad de tienda automaticamente sin bloquear la pantalla
        try {
            identity = await createStoreIdentity("Mi Tienda Demo", generateUUID().slice(0, 8));
        } catch {
            identity = {
                storeId: "demo-store-main",
                storeName: "Mi Tienda Demo",
                storeSlug: "mi-tienda-demo",
                createdAt: Date.now(),
                machineId: "master-01",
            };
        }
    }
    return { storeId: identity.storeId, isOwner: true, isFirstRun: false };
}
