import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import { shouldApplyCatalogSnapshot } from '@/lib/catalogSync';

describe('Low-Stock Restock Persistence & Sync Race Protection', () => {
  it('increments stock and retains the updated value across subsequent reads without reverting', async () => {
    const prodId = `test-stock-${Date.now()}`;
    await prisma.product.create({
      data: {
        id: prodId,
        tenantId: 'default',
        name: 'Válvula Check Prueba',
        price: 120,
        stock: 2,
        reservedStock: 0,
        category: 'Plomería',
        deletedAt: null,
      },
    });

    const updated = await prisma.product.update({
      where: { id: prodId, tenantId: 'default' },
      data: { stock: { increment: 10 } },
    });

    expect(updated.stock).toBe(12);

    const refetched = await prisma.product.findUnique({
      where: { id: prodId, tenantId: 'default' },
    });
    expect(refetched?.stock).toBe(12);

    const list = await prisma.product.findMany({
      where: { tenantId: 'default', deletedAt: null },
    });
    const inList = list.find((p: any) => p.id === prodId);
    expect(inList?.stock).toBe(12);

    await prisma.product.delete({ where: { id: prodId, tenantId: 'default' } });
  });

  it('blocks stale background poll snapshot from reverting stock while mutation lock or optimistic update happened', () => {
    const initialList = [{ id: 'prod-5', stock: 2 }];
    const updatedList = [{ id: 'prod-5', stock: 12 }];

    expect(shouldApplyCatalogSnapshot(initialList, initialList, 1)).toBe(false);
    expect(shouldApplyCatalogSnapshot(initialList, updatedList, 0)).toBe(false);
    expect(shouldApplyCatalogSnapshot(updatedList, updatedList, 0)).toBe(true);
  });
});
