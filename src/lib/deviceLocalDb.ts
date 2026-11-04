export type DeviceLocalBucket = 'catalog' | 'orders' | 'settings' | 'sync' | 'ui';

const DEVICE_ID_KEY = 'bunkker_device_id';
const DEVICE_DB_NAME = 'bunkker_device_local_db';
const DEVICE_DB_VERSION = 1;
const STORE_NAME = 'device_kv';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB;
}

function safeStorageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {
    // El navegador puede bloquear almacenamiento si la cuota está llena; la base IndexedDB es la fuente canónica.
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDeviceDb(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB no está disponible en este entorno.'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DEVICE_DB_NAME, DEVICE_DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
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
        reject(request.error || new Error('No se pudo abrir la base local del dispositivo.'));
      };
    } catch (error) {
      dbPromise = null;
      reject(error);
    }
  });

  return dbPromise;
}

export async function resolveDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'server';

  const existing = safeStorageGet(DEVICE_ID_KEY);
  if (existing) return existing;

  const nextId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `android-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  safeStorageSet(DEVICE_ID_KEY, nextId);
  return nextId;
}

export async function loadDeviceLocalData<T>(bucket: DeviceLocalBucket, fallback?: T): Promise<T | null> {
  if (typeof window === 'undefined') {
    return fallback ?? null;
  }

  const key = `bunkker_${bucket}`;

  try {
    if (isBrowser()) {
      const db = await openDeviceDb();
      const record = await new Promise<{ value: T } | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as { value: T } | undefined) ?? null);
        req.onerror = () => reject(req.error || new Error('No se pudo leer la base local del dispositivo.'));
      });

      if (record && typeof record.value !== 'undefined') {
        return record.value as T;
      }
    }
  } catch {
    // Caer a localStorage como fallback robusto.
  }

  const raw = safeStorageGet(key);
  if (!raw) return fallback ?? null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback ?? null;
  }
}

export async function saveDeviceLocalData<T>(bucket: DeviceLocalBucket, value: T): Promise<void> {
  if (typeof window === 'undefined') return;

  const key = `bunkker_${bucket}`;
  const payload = { key, value, updatedAt: Date.now() };

  safeStorageSet(key, JSON.stringify(value));

  if (!isBrowser()) return;

  try {
    const db = await openDeviceDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(payload);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('No se pudo guardar la base local del dispositivo.'));
    });
  } catch {
    // La escritura a localStorage ya quedó persistida. No romper la app por un fallo de IndexedDB.
  }
}

export async function clearDeviceLocalData(bucket?: DeviceLocalBucket): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (bucket) {
      safeStorageSet(`bunkker_${bucket}`, '');
      if (isBrowser()) {
        const db = await openDeviceDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.delete(`bunkker_${bucket}`);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error('No se pudo limpiar la base local.'));
        });
      }
      return;
    }

    const keys = Object.keys(window.localStorage).filter((key) => key.startsWith('bunkker_'));
    keys.forEach((key) => window.localStorage.removeItem(key));

    if (isBrowser()) {
      const db = await openDeviceDb();
      const all = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error || new Error('No se pudo consultar la base local.'));
      });

      if (all.length > 0) {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        all.forEach((item) => store.delete(item.key));
      }
    }
  } catch {
    // Fallback seguro: no bloquear la sesión.
  }
}

export async function ensureDeviceLocalProfile(): Promise<{ deviceId: string; isAndroid: boolean }> {
  const deviceId = await resolveDeviceId();
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  await saveDeviceLocalData('settings', {
    deviceId,
    lastSeenAt: Date.now(),
    isAndroid,
    mode: 'local-first',
  });

  return { deviceId, isAndroid };
}

export async function loadLocalCatalogSnapshot<T = unknown>(): Promise<T | null> {
  return loadDeviceLocalData<T>('catalog');
}

export async function saveLocalCatalogSnapshot<T>(value: T): Promise<void> {
  return saveDeviceLocalData('catalog', value);
}

export async function loadLocalOrdersSnapshot<T = unknown>(): Promise<T | null> {
  return loadDeviceLocalData<T>('orders');
}

export async function saveLocalOrdersSnapshot<T>(value: T): Promise<void> {
  return saveDeviceLocalData('orders', value);
}

export async function loadLocalSettingsSnapshot<T = unknown>(): Promise<T | null> {
  return loadDeviceLocalData<T>('settings');
}

export async function saveLocalSettingsSnapshot<T>(value: T): Promise<void> {
  return saveDeviceLocalData('settings', value);
}
