import {
  findProductByBarcodeOrCode,
  matchesProductSearch,
  normalizeBarcodeToken,
} from '@/lib/barcodeLookup';

export interface LookupProduct {
  id: string;
  name: string;
  price?: number;
  stock?: number;
  reservedStock?: number;
  minStock?: number;
  category?: string | null;
  barcode?: string | null;
  description?: string | null;
  image?: string | null;
  estante?: string | null;
  fila?: string | null;
  location?: { estante?: string; fila?: string } | null;
  unitType?: string | null;
}

export type InventoryStockLevel = 'out_of_stock' | 'low_stock' | 'in_stock';

export interface InventoryLookupItem<T extends LookupProduct = LookupProduct> {
  product: T;
  availableStock: number;
  physicalStock: number;
  reservedStock: number;
  unitPrice: number;
  totalValue: number;
  shelfLocation: string;
  stockLevel: InventoryStockLevel;
}

export interface InventoryScanLookupResult<T extends LookupProduct = LookupProduct> {
  query: string;
  found: boolean;
  matchType: 'exact' | 'partial' | 'none';
  primaryMatch: InventoryLookupItem<T> | null;
  matches: InventoryLookupItem<T>[];
}

function toSafeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

export function buildInventoryLookupItem<T extends LookupProduct>(
  product: T
): InventoryLookupItem<T> {
  const physicalStock = toSafeNumber(product.stock);
  const reservedStock = toSafeNumber(product.reservedStock);
  const availableStock = Math.max(0, physicalStock - reservedStock);
  const unitPrice = toSafeNumber(product.price);
  const totalValue = Math.round((physicalStock * unitPrice + Number.EPSILON) * 100) / 100;

  const estante = String(product.location?.estante || product.estante || '').trim();
  const fila = String(product.location?.fila || product.fila || '').trim();
  const shelfLocation =
    estante && fila
      ? `${estante} / ${fila}`
      : estante || fila || 'Sin ubicación asignada';

  const threshold =
    typeof product.minStock === 'number' && Number.isFinite(product.minStock)
      ? Math.max(1, product.minStock)
      : 5;

  const stockLevel: InventoryStockLevel =
    physicalStock <= 0
      ? 'out_of_stock'
      : physicalStock <= threshold
        ? 'low_stock'
        : 'in_stock';

  return {
    product,
    availableStock,
    physicalStock,
    reservedStock,
    unitPrice,
    totalValue,
    shelfLocation,
    stockLevel,
  };
}

export function lookupInventoryByScan<T extends LookupProduct>(
  products: ReadonlyArray<T>,
  rawQuery: unknown
): InventoryScanLookupResult<T> {
  const query = typeof rawQuery === 'string' || typeof rawQuery === 'number'
    ? String(rawQuery).trim()
    : '';

  if (!query || !Array.isArray(products) || products.length === 0) {
    return {
      query,
      found: false,
      matchType: 'none',
      primaryMatch: null,
      matches: [],
    };
  }

  const mutableProducts = [...products];
  const exact = findProductByBarcodeOrCode(mutableProducts, query);
  if (exact) {
    const exactItem = buildInventoryLookupItem(exact);
    return {
      query,
      found: true,
      matchType: 'exact',
      primaryMatch: exactItem,
      matches: [exactItem],
    };
  }

  const cleanToken = normalizeBarcodeToken(query);
  if (!cleanToken) {
    return {
      query,
      found: false,
      matchType: 'none',
      primaryMatch: null,
      matches: [],
    };
  }

  const partialProducts = mutableProducts
    .filter((p) => matchesProductSearch(p, query))
    .slice(0, 8);

  if (partialProducts.length === 0) {
    return {
      query,
      found: false,
      matchType: 'none',
      primaryMatch: null,
      matches: [],
    };
  }

  const matches = partialProducts.map((p) => buildInventoryLookupItem(p));
  return {
    query,
    found: true,
    matchType: 'partial',
    primaryMatch: matches[0],
    matches,
  };
}
