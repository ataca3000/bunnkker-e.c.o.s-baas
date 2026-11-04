export type LocalRole = 'admin' | 'cashier';

export interface LocalStaffUser {
  id: string;
  name: string;
  role: LocalRole;
  salt: string;
  pinHash: string;
  createdAt: string;
}

export interface LocalProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  updatedAt: string;
}

export interface LocalOrder {
  id: string;
  createdAt: string;
  cashierName: string;
  items: Array<{ productId: string; name: string; quantity: number; unitPrice: number }>;
  total: number;
  status: 'paid';
}

export interface LocalSettings {
  key: 'settings';
  businessName: string;
  initializedAt: string;
}

const DB_NAME = 'bunkker-standalone-device';
const DB_VERSION = 1;
const STORES = { users: 'users', products: 'products', orders: 'orders', settings: 'settings' } as const;

function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('Este navegador no permite almacenamiento local.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: store === 'settings' ? 'key' : 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la base local.'));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error leyendo datos locales.'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('No se pudo guardar en el dispositivo.'));
  });
}

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.trunc(Math.random() * 1_000_000_000)}`;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

async function derivePinHash(pin: string, salt: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Se requiere HTTPS para proteger el PIN local.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' }, key, 256);
  return toBase64(new Uint8Array(bits));
}

export async function initializeLocalDevice(businessName: string, adminName: string, pin: string): Promise<void> {
  const db = await openDb();
  const users = db.transaction(STORES.users, 'readonly');
  const existing = await requestValue<LocalStaffUser[]>(users.objectStore(STORES.users).getAll());
  await transactionDone(users);
  if (existing.length) throw new Error('Este dispositivo ya está configurado.');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const user: LocalStaffUser = {
    id: makeId(), name: adminName.trim(), role: 'admin', salt: toBase64(salt),
    pinHash: await derivePinHash(pin, salt), createdAt: new Date().toISOString(),
  };
  const tx = db.transaction([STORES.users, STORES.settings], 'readwrite');
  tx.objectStore(STORES.users).add(user);
  tx.objectStore(STORES.settings).put({ key: 'settings', businessName: businessName.trim(), initializedAt: new Date().toISOString() } satisfies LocalSettings);
  await transactionDone(tx);
  try { await navigator.storage?.persist?.(); } catch { /* La persistencia depende del navegador. */ }
}

export async function getLocalSettings(): Promise<LocalSettings | null> {
  const db = await openDb();
  const tx = db.transaction(STORES.settings, 'readonly');
  const value = await requestValue<LocalSettings | undefined>(tx.objectStore(STORES.settings).get('settings'));
  await transactionDone(tx);
  return value ?? null;
}

export async function listLocalUsers(): Promise<LocalStaffUser[]> {
  const db = await openDb();
  const tx = db.transaction(STORES.users, 'readonly');
  const values = await requestValue<LocalStaffUser[]>(tx.objectStore(STORES.users).getAll());
  await transactionDone(tx);
  return values;
}

export async function authenticateLocalUser(name: string, pin: string): Promise<LocalStaffUser | null> {
  const user = (await listLocalUsers()).find(item => item.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  if (!user) return null;
  const valid = await derivePinHash(pin, Uint8Array.from(atob(user.salt), char => char.charCodeAt(0)));
  return valid === user.pinHash ? user : null;
}

export async function addLocalStaffUser(name: string, pin: string, role: LocalRole): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName || !/^\d{4,8}$/.test(pin)) throw new Error('Usa un nombre y un PIN de 4 a 8 dígitos.');
  if ((await listLocalUsers()).some(user => user.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
    throw new Error('Ya existe un usuario local con ese nombre.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const user: LocalStaffUser = { id: makeId(), name: cleanName, role, salt: toBase64(salt), pinHash: await derivePinHash(pin, salt), createdAt: new Date().toISOString() };
  const db = await openDb();
  const tx = db.transaction(STORES.users, 'readwrite');
  tx.objectStore(STORES.users).add(user);
  await transactionDone(tx);
}

export async function listLocalProducts(): Promise<LocalProduct[]> {
  const db = await openDb();
  const tx = db.transaction(STORES.products, 'readonly');
  const values = await requestValue<LocalProduct[]>(tx.objectStore(STORES.products).getAll());
  await transactionDone(tx);
  return values.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveLocalProduct(input: { id?: string; name: string; price: number; stock: number }): Promise<void> {
  const product: LocalProduct = { id: input.id || makeId(), name: input.name.trim(), price: input.price, stock: input.stock, updatedAt: new Date().toISOString() };
  if (!product.name || !Number.isFinite(product.price) || product.price < 0 || !Number.isInteger(product.stock) || product.stock < 0) {
    throw new Error('Revisa nombre, precio y existencia del producto.');
  }
  const db = await openDb();
  const tx = db.transaction(STORES.products, 'readwrite');
  tx.objectStore(STORES.products).put(product);
  await transactionDone(tx);
}

export async function listLocalOrders(): Promise<LocalOrder[]> {
  const db = await openDb();
  const tx = db.transaction(STORES.orders, 'readonly');
  const values = await requestValue<LocalOrder[]>(tx.objectStore(STORES.orders).getAll());
  await transactionDone(tx);
  return values.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Stock decrement + order insert run in a single IndexedDB transaction. No network request is made. */
export async function commitLocalSale(cashierName: string, quantities: Record<string, number>): Promise<LocalOrder> {
  const lines = Object.entries(quantities).filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0);
  if (!lines.length) throw new Error('Agrega al menos un producto a la venta.');
  const db = await openDb();
  const tx = db.transaction([STORES.products, STORES.orders], 'readwrite');
  const products = tx.objectStore(STORES.products);
  const resolved: Array<{ product: LocalProduct; quantity: number }> = [];
  await Promise.all(lines.map(([id, quantity]) => requestValue<LocalProduct | undefined>(products.get(id)).then(product => {
    if (!product) throw new Error('Un producto ya no existe en el catálogo local.');
    if (product.stock < quantity) throw new Error(`Existencia insuficiente para ${product.name} (disponible: ${product.stock}).`);
    resolved.push({ product, quantity });
  })));
  const order: LocalOrder = {
    id: makeId(), createdAt: new Date().toISOString(), cashierName,
    items: resolved.map(({ product, quantity }) => ({ productId: product.id, name: product.name, quantity, unitPrice: product.price })),
    total: resolved.reduce((total, { product, quantity }) => total + product.price * quantity, 0), status: 'paid',
  };
  for (const { product, quantity } of resolved) products.put({ ...product, stock: product.stock - quantity, updatedAt: order.createdAt });
  tx.objectStore(STORES.orders).add(order);
  await transactionDone(tx);
  return order;
}
