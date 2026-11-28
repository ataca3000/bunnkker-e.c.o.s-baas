import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { shouldApplyCatalogSnapshot } from '@/lib/catalogSync';

describe('inventory persistence and catalog recovery', () => {
  const originalEnv = new Map<string, string | undefined>();
  const globalStore = globalThis as typeof globalThis & Record<string, unknown>;
  let originalGlobals: Record<string, unknown>;
  let tempDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of ['NODE_ENV', 'VITEST', 'DATABASE_URL', 'VERCEL']) {
      originalEnv.set(key, process.env[key]);
    }

    originalGlobals = {
      prisma: globalStore.prisma,
      _bunkker_memory_store: globalStore._bunkker_memory_store,
      _bunkker_memory_store_mtime: globalStore._bunkker_memory_store_mtime,
    };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunkker-stock-persistence-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    process.env.NODE_ENV = 'production';
    delete process.env.VITEST;
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL;
    delete globalStore.prisma;
    delete globalStore._bunkker_memory_store;
    delete globalStore._bunkker_memory_store_mtime;
    vi.resetModules();
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });

    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete globalStore[key];
      else globalStore[key] = value;
    }
    vi.resetModules();
  });

  it('persists restocked and low-stock products across a cold module reload and returns them from the catalog API', async () => {
    const firstBoot = await import('@/lib/prisma');
    const restockedId = 'persisted-restock-check';
    const lowStockId = 'persisted-low-stock-check';

    await firstBoot.prisma.product.create({
      data: {
        id: restockedId,
        tenantId: 'default',
        name: 'Producto restock prueba',
        price: 120,
        stock: 2,
        reservedStock: 0,
        minStock: 5,
        category: 'Prueba',
        deletedAt: null,
      },
    });
    await firstBoot.prisma.product.update({
      where: { id: restockedId, tenantId: 'default' },
      data: { stock: { increment: 10 } },
    });
    await firstBoot.prisma.product.create({
      data: {
        id: lowStockId,
        tenantId: 'default',
        name: 'Producto stock bajo prueba',
        price: 85,
        stock: 1,
        reservedStock: 0,
        minStock: 5,
        category: 'Prueba',
        deletedAt: null,
      },
    });
    firstBoot.flushPersistedStore();

    const persistenceFile = path.join(tempDir, '.prisma_memory_store.json');
    expect(fs.existsSync(persistenceFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(persistenceFile, 'utf8')).product).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: restockedId, stock: 12 }),
        expect.objectContaining({ id: lowStockId, stock: 1 }),
      ])
    );

    delete globalStore.prisma;
    delete globalStore._bunkker_memory_store;
    delete globalStore._bunkker_memory_store_mtime;
    vi.resetModules();

    const secondBoot = await import('@/lib/prisma');
    const { GET } = await import('@/app/api/products/route');
    const response = await GET(new NextRequest('http://localhost/api/products', {
      headers: { 'x-tenant-id': 'default' },
    }));
    const catalog = await response.json();

    expect(catalog.success).toBe(true);
    expect(catalog.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: restockedId, stock: 12 }),
        expect.objectContaining({ id: lowStockId, stock: 1 }),
      ])
    );
    expect(await secondBoot.prisma.product.findUnique({ where: { id: restockedId } })).toMatchObject({
      stock: 12,
      deletedAt: null,
    });
  });

  it('rejects a stale catalog response after a local inventory mutation', () => {
    const initialList = [{ id: 'prod-5', stock: 2 }];
    const updatedList = [{ id: 'prod-5', stock: 12 }];

    expect(shouldApplyCatalogSnapshot(initialList, initialList, 1)).toBe(false);
    expect(shouldApplyCatalogSnapshot(initialList, updatedList, 0)).toBe(false);
    expect(shouldApplyCatalogSnapshot(updatedList, updatedList, 0)).toBe(true);
  });
});
