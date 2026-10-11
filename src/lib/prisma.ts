import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// Prisma Client inicializado de forma segura y compatible con SQLite local, PostgreSQL cloud y modo en memoria (AI Studio)

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

const initialMemoryStore: Record<string, any[]> = {
  product: [
    {
      id: 'PROD-101',
      tenantId: 'default',
      name: 'Kit de Herramientas Básico',
      price: 499.99,
      stock: 50,
      reservedStock: 0,
      category: 'Herramientas',
      image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800',
      description: 'Kit básico de herramientas para hogar y taller.',
      estante: 'A1',
      fila: '1',
      orderIndex: 0,
      deletedAt: null,
    },
    {
      id: 'PROD-102',
      tenantId: 'default',
      name: 'Taladro Inalámbrico 20V',
      price: 1299.5,
      stock: 15,
      reservedStock: 0,
      category: 'Eléctricas',
      image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800',
      description: 'Taladro inalámbrico con batería de larga duración.',
      estante: 'A1',
      fila: '2',
      orderIndex: 1,
      deletedAt: null,
    },
    {
      id: 'PROD-103',
      tenantId: 'default',
      name: 'Set de Llaves Combinadas',
      price: 850.0,
      stock: 30,
      reservedStock: 0,
      category: 'Herramientas',
      image: 'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?w=800',
      description: 'Llaves métricas e imperiales de alta resistencia.',
      estante: 'B1',
      fila: '1',
      orderIndex: 2,
      deletedAt: null,
    },
    {
      id: 'PROD-104',
      tenantId: 'default',
      name: 'Cinta Métrica 8m',
      price: 120.0,
      stock: 100,
      reservedStock: 0,
      category: 'Medición',
      image: 'https://images.unsplash.com/photo-1580870059865-fb18e8093db4?w=800',
      description: 'Cinta métrica resistente a impactos.',
      estante: 'B1',
      fila: '2',
      orderIndex: 3,
      deletedAt: null,
    },
    {
      id: 'PROD-105',
      tenantId: 'default',
      name: 'Cemento Portland 50kg',
      price: 210.0,
      stock: 200,
      reservedStock: 0,
      category: 'Materiales',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800',
      description: 'Saco de cemento Portland tipo compuesto.',
      estante: 'PATIO',
      fila: '1',
      orderIndex: 4,
      deletedAt: null,
    },
  ],
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

function createInMemoryPrisma() {
  const store: Record<string, any[]> = initialMemoryStore;

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

  const makeModel = (prop: string) => ({
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
      getTable(prop).push(newRecord);

      if (nestedItems && Array.isArray(nestedItems)) {
        for (const it of nestedItems) {
          getTable('orderItem').push({
            id: crypto.randomUUID(),
            tenantId: newRecord.tenantId,
            orderId: newRecord.id,
            productId: it.productId,
            cantidad: it.cantidad,
            precio: it.precio,
          });
        }
      }
      return attachRelations(prop, newRecord, args?.include);
    },
    update: async (args?: any) => {
      const tbl = getTable(prop);
      const idx = tbl.findIndex((r) => matchesWhere(r, args?.where));
      if (idx === -1) {
        const fallback = { id: args?.where?.id || crypto.randomUUID(), ...(args?.data ?? {}) };
        tbl.push(fallback);
        return attachRelations(prop, fallback, args?.include);
      }
      tbl[idx] = applyUpdateData(tbl[idx], args?.data);
      return attachRelations(prop, tbl[idx], args?.include);
    },
    updateMany: async (args?: any) => {
      const tbl = getTable(prop);
      let count = 0;
      for (let i = 0; i < tbl.length; i++) {
        if (matchesWhere(tbl[i], args?.where)) {
          tbl[i] = applyUpdateData(tbl[i], args?.data);
          count++;
        }
      }
      return { count };
    },
    upsert: async (args?: any) => {
      const tbl = getTable(prop);
      const idx = tbl.findIndex((r) => matchesWhere(r, args?.where));
      if (idx !== -1) {
        tbl[idx] = applyUpdateData(tbl[idx], args?.update);
        return attachRelations(prop, tbl[idx], args?.include);
      }
      const created = {
        id: args?.create?.id || args?.where?.id || crypto.randomUUID(),
        tenantId: 'default',
        createdAt: new Date(),
        ...(args?.create ?? {}),
      };
      tbl.push(created);
      return attachRelations(prop, created, args?.include);
    },
    delete: async (args?: any) => {
      const tbl = getTable(prop);
      const idx = tbl.findIndex((r) => matchesWhere(r, args?.where));
      if (idx !== -1) {
        const [removed] = tbl.splice(idx, 1);
        return removed;
      }
      return {};
    },
    deleteMany: async (args?: any) => {
      const tbl = getTable(prop);
      const before = tbl.length;
      store[prop] = tbl.filter((r) => !matchesWhere(r, args?.where));
      return { count: before - store[prop].length };
    },
  });

  const proxy: any = new Proxy(
    {},
    {
      get(_, prop: string) {
        if (prop === '$transaction') {
          return async (arg: any) => {
            if (typeof arg === 'function') return arg(proxy);
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

function createResilientPrismaClient(): PrismaClient {
  const fallback = createInMemoryPrisma();

  // Si no hay DATABASE_URL configurada o es vacía, usar directamente el modo compatible
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    return fallback;
  }

  let realPrisma: any = null;
  try {
    realPrisma = new PrismaClient();
  } catch (e: any) {
    console.warn('[AI Studio Backend] Error al instanciar PrismaClient, usando backend compatible en memoria:', e?.message);
    return fallback;
  }

  let hasFailed = false;

  return new Proxy(realPrisma, {
    get(target, prop: string) {
      if (hasFailed) {
        return (fallback as any)[prop];
      }

      if (prop === '$transaction') {
        return async (arg: any) => {
          if (hasFailed) return (fallback as any).$transaction(arg);
          try {
            return await target.$transaction(arg);
          } catch (err: any) {
            console.warn('[AI Studio Backend] $transaction falló, cambiando a backend compatible:', err?.message);
            hasFailed = true;
            return (fallback as any).$transaction(arg);
          }
        };
      }

      const originalVal = target[prop];
      if (typeof originalVal === 'function') {
        return (...args: any[]) => {
          if (hasFailed) return (fallback as any)[prop](...args);
          try {
            const res = originalVal.apply(target, args);
            if (res && typeof res.catch === 'function') {
              return res.catch((err: any) => {
                console.warn(`[AI Studio Backend] ${prop} falló, cambiando a backend compatible:`, err?.message);
                hasFailed = true;
                return (fallback as any)[prop](...args);
              });
            }
            return res;
          } catch (err: any) {
            console.warn(`[AI Studio Backend] ${prop} falló sincrónicamente, cambiando a backend compatible:`, err?.message);
            hasFailed = true;
            return (fallback as any)[prop](...args);
          }
        };
      }

      if (typeof originalVal === 'object' && originalVal !== null) {
        return new Proxy(originalVal, {
          get(modelTarget, modelProp: string) {
            if (hasFailed) {
              const fallbackModel = (fallback as any)[prop];
              return fallbackModel ? fallbackModel[modelProp] : undefined;
            }

            const modelMethod = modelTarget[modelProp];
            if (typeof modelMethod === 'function') {
              return async (...args: any[]) => {
                if (hasFailed) {
                  const fallbackModel = (fallback as any)[prop];
                  return fallbackModel ? fallbackModel[modelProp](...args) : undefined;
                }
                try {
                  return await modelMethod.apply(modelTarget, args);
                } catch (err: any) {
                  console.warn(`[AI Studio Backend] prisma.${prop}.${modelProp} falló (${err?.message}), ejecutando en backend compatible:`);
                  hasFailed = true;
                  const fallbackModel = (fallback as any)[prop];
                  if (fallbackModel && typeof fallbackModel[modelProp] === 'function') {
                    return await fallbackModel[modelProp](...args);
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


