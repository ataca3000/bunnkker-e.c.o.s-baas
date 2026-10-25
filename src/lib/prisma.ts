import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { atomicWriteFileSync } from './atomicFs';
import fs from 'fs';
import path from 'path';

// Prisma Client inicializado de forma segura y compatible con SQLite local, PostgreSQL cloud y modo en memoria (AI Studio)

if (process.env.DATABASE_URL) {
  if (process.env.DATABASE_URL.includes('neon.tech') && !process.env.DATABASE_URL.includes('sslmode=')) {
    const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
    process.env.DATABASE_URL = `${process.env.DATABASE_URL}${sep}sslmode=require`;
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL.includes('-pooler')
      ? process.env.DATABASE_URL.replace('-pooler', '')
      : process.env.DATABASE_URL;
  }
  if (process.env.DIRECT_URL && process.env.DIRECT_URL.includes('neon.tech') && !process.env.DIRECT_URL.includes('sslmode=')) {
    const sep = process.env.DIRECT_URL.includes('?') ? '&' : '?';
    process.env.DIRECT_URL = `${process.env.DIRECT_URL}${sep}sslmode=require`;
  }
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

const PERSISTENCE_FILE = path.join(process.cwd(), '.prisma_memory_store.json');

const initialMemoryStore: Record<string, any[]> = {
  product: [],
  user: [
    { id: 'demo-superadmin', tenantId: 'default', name: 'Dueño (Superadmin)', email: 'superadmin@bunnkker.local', role: 'superadmin', pin: hashPin('0000'), active: true, createdAt: new Date() },
    { id: 'demo-admin', tenantId: 'default', name: 'Gerente (Admin)', email: 'admin@bunnkker.local', role: 'admin', pin: hashPin('1111'), active: true, createdAt: new Date() },
    { id: 'demo-sales', tenantId: 'default', name: 'Cajero / Ventas', email: 'sales@bunnkker.local', role: 'sales', pin: hashPin('2222'), active: true, createdAt: new Date() },
    { id: 'demo-inventory', tenantId: 'default', name: 'Bodeguero / Inventario', email: 'inventory@bunnkker.local', role: 'inventory', pin: hashPin('3333'), active: true, createdAt: new Date() },
    { id: 'demo-marketing', tenantId: 'default', name: 'Diseñador / Marketing', email: 'marketing@bunnkker.local', role: 'marketing', pin: hashPin('4444'), active: true, createdAt: new Date() },
    { id: 'demo-driver', tenantId: 'default', name: 'Chofer / Repartidor', email: 'driver@bunnkker.local', role: 'driver', pin: hashPin('5555'), active: true, createdAt: new Date() },
    { id: 'demo-carga_descarga', tenantId: 'default', name: 'Patio / Carga y Descarga', email: 'patio@bunnkker.local', role: 'carga_descarga', pin: hashPin('6666'), active: true, createdAt: new Date() },
    { id: 'demo-pickup', tenantId: 'default', name: 'Mostrador / Pick Up', email: 'pickup@bunnkker.local', role: 'pickup', pin: hashPin('7777'), active: true, createdAt: new Date() },
  ],
  customer: [],
  order: [],
  orderItem: [],
  orderEvent: [],
  syncQueue: [],
  auditLog: [],
  supportTicket: [],
  purchase: [],
  cashRegisterLog: [],
  shrinkageLog: [],
  appConfig: [{ id: 'global', licenseType: 'TRIAL', tenantId: 'default', updatedAt: new Date() }],
  swarmTransaction: [],
};

function matchesWhere(record: any, where?: any): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === 'OR' && Array.isArray(cond)) {
      if (!cond.some((sub) => matchesWhere(record, sub))) return false;
      continue;
    }
    if (key === 'AND' && Array.isArray(cond)) {
      if (!cond.every((sub) => matchesWhere(record, sub))) return false;
      continue;
    }
    const val = record[key];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as Record<string, any>;
      if ('in' in c && Array.isArray(c.in) && !c.in.includes(val)) return false;
      if ('notIn' in c && Array.isArray(c.notIn) && c.notIn.includes(val)) return false;
      if ('not' in c) {
        if (c.not === null ? val === null || val === undefined : val === c.not) return false;
      }
      if ('contains' in c) {
        if (typeof val !== 'string' || !val.toLowerCase().includes(String(c.contains).toLowerCase())) return false;
      }
      if ('gt' in c && !(val > c.gt)) return false;
      if ('gte' in c && !(val >= c.gte)) return false;
      if ('lt' in c && !(val < c.lt)) return false;
      if ('lte' in c && !(val <= c.lte)) return false;
    } else {
      if (cond === null) {
        if (val !== null && val !== undefined) return false;
      } else if (val !== cond) {
        return false;
      }
    }
  }
  return true;
}

function applyUpdateData(target: any, data: any) {
  const updated = { ...target };
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
      const op = v as Record<string, any>;
      if (typeof op.increment === 'number') {
        updated[k] = (Number(updated[k]) || 0) + op.increment;
        continue;
      }
      if (typeof op.decrement === 'number') {
        updated[k] = (Number(updated[k]) || 0) - op.decrement;
        continue;
      }
    }
    updated[k] = v;
  }
  return updated;
}

function loadPersistedStore(): Record<string, any[]> {
  try {
    if (fs.existsSync(PERSISTENCE_FILE)) {
      const content = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        for (const [key, val] of Object.entries(initialMemoryStore)) {
          if (!parsed[key] || !Array.isArray(parsed[key]) || (val.length > 0 && parsed[key].length === 0)) {
            parsed[key] = [...val];
          }
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Prisma Store] Error loading persisted memory store:', err);
  }
  return { ...initialMemoryStore };
}

let saveTimer: any = null;
export function flushPersistedStore() {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  try {
    const g = globalThis as any;
    const store = g._bunkker_memory_store;
    if (store) {
      if (saveTimer) clearTimeout(saveTimer);
      atomicWriteFileSync(PERSISTENCE_FILE, JSON.stringify(store, null, 2), true);
    }
  } catch (err) {
    console.warn('[Prisma Store] Error flushing store to disk:', err);
  }
}

function triggerStoreSave(store: Record<string, any[]>) {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      atomicWriteFileSync(PERSISTENCE_FILE, JSON.stringify(store, null, 2), true);
    } catch (err) {
      console.warn('[Prisma Store] Error saving store to disk:', err);
    }
  }, 80);
}

if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('beforeExit', () => {
    flushPersistedStore();
  });
}

function createInMemoryPrisma() {
  const g = globalThis as any;
  if (!g._bunkker_memory_store) {
    g._bunkker_memory_store = loadPersistedStore();
  }
  const store: Record<string, any[]> = g._bunkker_memory_store;

  const getTable = (prop: string): any[] => {
    if (!store[prop]) store[prop] = [];
    return store[prop];
  };

  const attachRelations = (prop: string, item: any, include?: any) => {
    if (!item || !include) return item;
    const copy = { ...item };
    if (prop === 'order') {
      if (include.items) {
        const rawItems = getTable('orderItem').filter((oi) => oi.orderId === item.id);
        copy.items = rawItems.map((oi) => {
          if (typeof include.items === 'object' && include.items?.include?.product) {
            return {
              ...oi,
              product: getTable('product').find((p) => p.id === oi.productId) || null,
            };
          }
          return oi;
        });
      }
      if (include.customer) {
        copy.customer = getTable('customer').find((c) => c.id === item.customerId) || null;
      }
      if (include.events) {
        copy.events = getTable('orderEvent').filter((ev) => ev.orderId === item.id);
      }
    }
    if (prop === 'customer' && include.orders) {
      const rawOrders = getTable('order').filter((o) => o.customerId === item.id);
      copy.orders = rawOrders.map((o) => attachRelations('order', o, { items: { include: { product: true } }, events: true }));
    }
    return copy;
  };

  const makeModel = (prop: string, undoLog?: Array<() => void>) => ({
    findMany: async (args?: any) => {
      let rows = getTable(prop).filter((r) => matchesWhere(r, args?.where));
      if (args?.orderBy) {
        const [field, dir] = Object.entries(args.orderBy)[0] || [];
        if (field) {
          rows = [...rows].sort((a, b) => {
            const va = a[field] ?? 0;
            const vb = b[field] ?? 0;
            return dir === 'desc' ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
          });
        }
      }
      if (typeof args?.take === 'number') {
        rows = rows.slice(0, args.take);
      }
      return rows.map((r) => attachRelations(prop, r, args?.include));
    },
    findFirst: async (args?: any) => {
      const found = getTable(prop).find((r) => matchesWhere(r, args?.where)) ?? null;
      return found ? attachRelations(prop, found, args?.include) : null;
    },
    findUnique: async (args?: any) => {
      const found = getTable(prop).find((r) => matchesWhere(r, args?.where)) ?? null;
      return found ? attachRelations(prop, found, args?.include) : null;
    },
    count: async (args?: any) => {
      return getTable(prop).filter((r) => matchesWhere(r, args?.where)).length;
    },
    create: async (args?: any) => {
      const data = { ...(args?.data ?? {}) };
      const nestedItems = prop === 'order' && data.items?.create ? data.items.create : null;
      if (nestedItems) delete data.items;

      const newRecord: any = {
        id: data.id || crypto.randomUUID(),
        tenantId: data.tenantId || 'default',
        createdAt: data.createdAt || new Date(),
        ...(prop === 'product' ? { stock: 0, reservedStock: 0, orderIndex: 0, deletedAt: null } : {}),
        ...(prop === 'order' ? { date: new Date(), status: 'paid', deliveryType: 'LOCAL', offline: true, synced: false, isLoaded: false } : {}),
        ...data,
      };
      const tbl = getTable(prop);
      tbl.push(newRecord);

      const createdOrderItemIds: string[] = [];
      if (nestedItems && Array.isArray(nestedItems)) {
        const oiTable = getTable('orderItem');
        for (const it of nestedItems) {
          const oiId = crypto.randomUUID();
          createdOrderItemIds.push(oiId);
          oiTable.push({
            id: oiId,
            tenantId: newRecord.tenantId,
            orderId: newRecord.id,
            productId: it.productId,
            cantidad: it.cantidad,
            precio: it.precio,
          });
        }
      }
      if (undoLog) {
        undoLog.push(() => {
          const idx = tbl.indexOf(newRecord);
          if (idx !== -1) tbl.splice(idx, 1);
          if (createdOrderItemIds.length > 0) {
            store['orderItem'] = getTable('orderItem').filter((oi) => !createdOrderItemIds.includes(oi.id));
          }
        });
      }
      triggerStoreSave(store);
      return attachRelations(prop, newRecord, args?.include);
    },
    update: async (args?: any) => {
      const tbl = getTable(prop);
      const idx = tbl.findIndex((r) => matchesWhere(r, args?.where));
      if (idx === -1) {
        const fallback = { id: args?.where?.id || crypto.randomUUID(), ...(args?.data ?? {}) };
        tbl.push(fallback);
        if (undoLog) {
          undoLog.push(() => {
            const fIdx = tbl.indexOf(fallback);
            if (fIdx !== -1) tbl.splice(fIdx, 1);
          });
        }
        triggerStoreSave(store);
        return attachRelations(prop, fallback, args?.include);
      }
      const prevRecord = { ...tbl[idx] };
      tbl[idx] = applyUpdateData(tbl[idx], args?.data);
      const updatedRef = tbl[idx];
      if (undoLog) {
        undoLog.push(() => {
          const curIdx = tbl.indexOf(updatedRef);
          if (curIdx !== -1) tbl[curIdx] = prevRecord;
          else {
            const byIdIdx = tbl.findIndex((r) => r.id === prevRecord.id);
            if (byIdIdx !== -1) tbl[byIdIdx] = prevRecord;
          }
        });
      }
      triggerStoreSave(store);
      return attachRelations(prop, tbl[idx], args?.include);
    },
    updateMany: async (args?: any) => {
      const tbl = getTable(prop);
      let count = 0;
      const previousStates: Array<{ updatedRef: any; prevRecord: any }> = [];
      for (let i = 0; i < tbl.length; i++) {
        if (matchesWhere(tbl[i], args?.where)) {
          const prevRecord = { ...tbl[i] };
          tbl[i] = applyUpdateData(tbl[i], args?.data);
          previousStates.push({ updatedRef: tbl[i], prevRecord });
          count++;
        }
      }
      if (count > 0) {
        if (undoLog) {
          undoLog.push(() => {
            for (const { updatedRef, prevRecord } of previousStates) {
              const curIdx = tbl.indexOf(updatedRef);
              if (curIdx !== -1) tbl[curIdx] = prevRecord;
              else {
                const byIdIdx = tbl.findIndex((r) => r.id === prevRecord.id);
                if (byIdIdx !== -1) tbl[byIdIdx] = prevRecord;
              }
            }
          });
        }
        triggerStoreSave(store);
      }
      return { count };
    },
    upsert: async (args?: any) => {
      const tbl = getTable(prop);
      const idx = tbl.findIndex((r) => matchesWhere(r, args?.where));
      if (idx !== -1) {
        const prevRecord = { ...tbl[idx] };
        tbl[idx] = applyUpdateData(tbl[idx], args?.update);
        const updatedRef = tbl[idx];
        if (undoLog) {
          undoLog.push(() => {
            const curIdx = tbl.indexOf(updatedRef);
            if (curIdx !== -1) tbl[curIdx] = prevRecord;
          });
        }
        triggerStoreSave(store);
        return attachRelations(prop, tbl[idx], args?.include);
      }
      const created = {
        id: args?.create?.id || args?.where?.id || crypto.randomUUID(),
        tenantId: 'default',
        createdAt: new Date(),
        ...(args?.create ?? {}),
      };
      tbl.push(created);
      if (undoLog) {
        undoLog.push(() => {
          const cIdx = tbl.indexOf(created);
          if (cIdx !== -1) tbl.splice(cIdx, 1);
        });
      }
      triggerStoreSave(store);
      return attachRelations(prop, created, args?.include);
    },
    delete: async (args?: any) => {
      const tbl = getTable(prop);
      const idx = tbl.findIndex((r) => matchesWhere(r, args?.where));
      if (idx !== -1) {
        const [removed] = tbl.splice(idx, 1);
        if (undoLog) {
          undoLog.push(() => {
            tbl.splice(Math.min(idx, tbl.length), 0, removed);
          });
        }
        triggerStoreSave(store);
        return removed;
      }
      return {};
    },
    deleteMany: async (args?: any) => {
      const tbl = getTable(prop);
      const before = tbl.length;
      const removedItems: Array<{ index: number; item: any }> = [];
      store[prop] = tbl.filter((r, idx) => {
        if (matchesWhere(r, args?.where)) {
          removedItems.push({ index: idx, item: r });
          return false;
        }
        return true;
      });
      if (removedItems.length > 0 && undoLog) {
        undoLog.push(() => {
          const curTbl = getTable(prop);
          for (const { index, item } of removedItems) {
            curTbl.splice(Math.min(index, curTbl.length), 0, item);
          }
        });
      }
      triggerStoreSave(store);
      return { count: before - store[prop].length };
    },
  });

  const createTxProxy = (undoLog: Array<() => void>): any =>
    new Proxy(
      {},
      {
        get(_, prop: string) {
          if (prop === '$executeRawUnsafe' || prop === '$executeRaw') return async () => 0;
          if (prop === '$queryRawUnsafe' || prop === '$queryRaw') return async () => [];
          return makeModel(prop, undoLog);
        },
      }
    );

  const proxy: any = new Proxy(
    {},
    {
      get(_, prop: string) {
        if (prop === '$transaction') {
          return async (arg: any) => {
            if (typeof arg === 'function') {
              const undoLog: Array<() => void> = [];
              const txProxy = createTxProxy(undoLog);
              try {
                return await arg(txProxy);
              } catch (txErr) {
                for (let i = undoLog.length - 1; i >= 0; i--) {
                  try {
                    undoLog[i]();
                  } catch {}
                }
                if (undoLog.length > 0) triggerStoreSave(store);
                throw txErr;
              }
            }
            if (Array.isArray(arg)) return Promise.all(arg);
            return arg;
          };
        }
        if (prop === '$executeRawUnsafe' || prop === '$executeRaw') return async () => 0;
        if (prop === '$queryRawUnsafe' || prop === '$queryRaw') return async () => [];
        if (prop === '$connect' || prop === '$disconnect') return async () => {};
        return makeModel(prop);
      },
    }
  );

  return proxy as PrismaClient;
}

export function isDatabaseConnectivityFailure(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const name = String(err.name || '');
  const msg = String(err.message || '');

  // Errores de reglas de negocio o colisiones de concurrencia NUNCA son caídas de base de datos
  if (
    msg.startsWith('INSUFFICIENT_STOCK:') ||
    msg.startsWith('ORDER_CONFLICT:') ||
    msg.startsWith('ORDER_NOT_FOUND:') ||
    msg.startsWith('VENTA_CERRADA') ||
    code === 'P2002' ||
    code === 'P2003' ||
    code === 'P2025' ||
    code === 'P2034'
  ) {
    return false;
  }

  return (
    name.includes('PrismaClientInitializationError') ||
    name.includes('PrismaClientRustPanicError') ||
    /^P10\d\d$/.test(code) ||
    msg.includes("Can't reach database server") ||
    msg.includes('Environment variable not found') ||
    msg.includes('Unable to open the database file') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    (msg.includes('Invalid `prisma.') && msg.includes('invocation') && msg.includes('datasource'))
  );
}

function createResilientPrismaClient(): PrismaClient {
  const fallback = createInMemoryPrisma();

  // Si no hay DATABASE_URL configurada o es vacía, usar directamente el modo compatible
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    return fallback;
  }

  let realPrisma: any = null;
  try {
    realPrisma = new PrismaClient();
    // 🛡️ PRAGMA WAL & synchronous=FULL: Máxima resiliencia contra apagones
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.includes('file:') || dbUrl.includes('.db') || dbUrl.includes('sqlite')) {
      realPrisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;').catch(() => {});
      realPrisma.$executeRawUnsafe('PRAGMA synchronous = FULL;').catch(() => {});
      realPrisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {});
    }
  } catch (e: any) {
    console.warn('[AI Studio Backend] Error al instanciar PrismaClient, usando backend compatible en memoria:', e?.message);
    return fallback;
  }

  let hasFailed = false;
  let lastFailTime = 0;
  const RECONNECT_INTERVAL_MS = 20000;

  function shouldUseFallback(): boolean {
    if (!hasFailed) return false;
    if (Date.now() - lastFailTime > RECONNECT_INTERVAL_MS) {
      hasFailed = false;
      console.log('🔄 [Prisma Resilience] Reintentando conexión con la base de datos física...');
      return false;
    }
    return true;
  }

  return new Proxy(realPrisma, {
    get(target, prop: string) {
      if (shouldUseFallback()) {
        return (fallback as any)[prop];
      }

      if (prop === '$transaction') {
        return async (arg: any) => {
          if (shouldUseFallback()) return (fallback as any).$transaction(arg);
          try {
            return await target.$transaction(arg);
          } catch (err: any) {
            if (isDatabaseConnectivityFailure(err)) {
              console.warn('[AI Studio Backend] $transaction detectó caída de BD, cambiando a backend compatible:', err?.message);
              hasFailed = true; lastFailTime = Date.now();
              return (fallback as any).$transaction(arg);
            }
            throw err;
          }
        };
      }

      const originalVal = target[prop];
      if (typeof originalVal === 'function') {
        return (...args: any[]) => {
          if (shouldUseFallback()) return (fallback as any)[prop](...args);
          try {
            const res = originalVal.apply(target, args);
            if (res && typeof res.catch === 'function') {
              return res.catch((err: any) => {
                if (isDatabaseConnectivityFailure(err)) {
                  console.warn(`[AI Studio Backend] ${prop} detectó caída de BD, cambiando a backend compatible:`, err?.message);
                  hasFailed = true; lastFailTime = Date.now();
                  return (fallback as any)[prop](...args);
                }
                throw err;
              });
            }
            return res;
          } catch (err: any) {
            if (isDatabaseConnectivityFailure(err)) {
              console.warn(`[AI Studio Backend] ${prop} falló sincrónicamente por BD, cambiando a backend compatible:`, err?.message);
              hasFailed = true; lastFailTime = Date.now();
              return (fallback as any)[prop](...args);
            }
            throw err;
          }
        };
      }

      if (typeof originalVal === 'object' && originalVal !== null) {
        return new Proxy(originalVal, {
          get(modelTarget, modelProp: string) {
            if (shouldUseFallback()) {
              const fallbackModel = (fallback as any)[prop];
              return fallbackModel ? fallbackModel[modelProp] : undefined;
            }

            const modelMethod = modelTarget[modelProp];
            if (typeof modelMethod === 'function') {
              return async (...args: any[]) => {
                if (shouldUseFallback()) {
                  const fallbackModel = (fallback as any)[prop];
                  return fallbackModel ? fallbackModel[modelProp](...args) : undefined;
                }
                try {
                  return await modelMethod.apply(modelTarget, args);
                } catch (err: any) {
                  if (isDatabaseConnectivityFailure(err)) {
                    console.warn(`[AI Studio Backend] prisma.${prop}.${modelProp} detectó caída de BD (${err?.message}), ejecutando en backend compatible:`);
                    hasFailed = true; lastFailTime = Date.now();
                    const fallbackModel = (fallback as any)[prop];
                    if (fallbackModel && typeof fallbackModel[modelProp] === 'function') {
                      return await fallbackModel[modelProp](...args);
                    }
                  }
                  throw err;
                }
              };
            }
            return modelMethod;
          }
        });
      }

      return originalVal;
    }
  }) as PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient = globalForPrisma.prisma || createResilientPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}


