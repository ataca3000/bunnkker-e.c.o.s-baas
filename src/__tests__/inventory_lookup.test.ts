import { describe, expect, it } from 'vitest';
import { lookupInventoryByScan, type LookupProduct } from '../lib/inventoryLookup';

const SAMPLE_PRODUCTS: LookupProduct[] = [
  {
    id: 'prod-1',
    name: 'Taladro Percutor 20V',
    barcode: '750100234001',
    price: 1850,
    stock: 22,
    reservedStock: 2,
    category: 'Herramientas',
    estante: 'A-1',
    fila: 'Nivel 2',
  },
  {
    id: 'prod-2',
    name: 'Cemento Portland 50kg',
    barcode: '0750100234004',
    price: 245,
    stock: 4,
    reservedStock: 0,
    minStock: 5,
    category: 'Construcción',
    location: { estante: 'Patio Sur', fila: 'Tarima 4' },
  },
  {
    id: 'prod-3',
    name: 'Generador 3500W',
    barcode: '750100234008',
    price: 8900,
    stock: 0,
    reservedStock: 0,
    category: 'Equipos',
  },
];

describe('inventoryLookup', () => {
  it('finds exact matches by barcode and computes available stock and location', () => {
    const res = lookupInventoryByScan(SAMPLE_PRODUCTS, ' 750100234001 ');
    expect(res.found).toBe(true);
    expect(res.matchType).toBe('exact');
    expect(res.primaryMatch?.product.id).toBe('prod-1');
    expect(res.primaryMatch?.physicalStock).toBe(22);
    expect(res.primaryMatch?.availableStock).toBe(20);
    expect(res.primaryMatch?.totalValue).toBe(40700);
    expect(res.primaryMatch?.shelfLocation).toBe('A-1 / Nivel 2');
    expect(res.primaryMatch?.stockLevel).toBe('in_stock');
  });

  it('supports UPC/EAN leading-zero equivalence and internal ID lookup', () => {
    const eanMatch = lookupInventoryByScan(SAMPLE_PRODUCTS, '750100234004');
    expect(eanMatch.found).toBe(true);
    expect(eanMatch.matchType).toBe('exact');
    expect(eanMatch.primaryMatch?.product.id).toBe('prod-2');
    expect(eanMatch.primaryMatch?.stockLevel).toBe('low_stock');

    const idMatch = lookupInventoryByScan(SAMPLE_PRODUCTS, 'prod-3');
    expect(idMatch.found).toBe(true);
    expect(idMatch.matchType).toBe('exact');
    expect(idMatch.primaryMatch?.stockLevel).toBe('out_of_stock');
    expect(idMatch.primaryMatch?.shelfLocation).toBe('Sin ubicación asignada');
  });

  it('falls back to partial search when code matches product name or shelf', () => {
    const res = lookupInventoryByScan(SAMPLE_PRODUCTS, 'Taladro');
    expect(res.found).toBe(true);
    expect(res.matchType).toBe('partial');
    expect(res.matches).toHaveLength(1);
    expect(res.primaryMatch?.product.id).toBe('prod-1');
  });

  it('returns not found cleanly for unknown codes or empty queries', () => {
    expect(lookupInventoryByScan(SAMPLE_PRODUCTS, 'NOEXISTE-999')).toEqual({
      query: 'NOEXISTE-999',
      found: false,
      matchType: 'none',
      primaryMatch: null,
      matches: [],
    });

    expect(lookupInventoryByScan(SAMPLE_PRODUCTS, '   ')).toEqual({
      query: '',
      found: false,
      matchType: 'none',
      primaryMatch: null,
      matches: [],
    });
  });
});
