// src/lib/offlineAvailability.ts
/**
 * Lógica pura de cálculo y clasificación de disponibilidad garantizada para catálogo offline.
 * Determina qué productos tienen existencias físicas confirmadas en el último corte
 * sincronizado de la base de datos local (SQLite WAL / IndexedDB).
 */

import type { Product } from './types';

export type AvailabilityLevel = 'guaranteed' | 'limited' | 'out_of_stock';

export interface ProductAvailabilityInfo {
  productId: string;
  stock: number;
  floatingHold: number;
  availableStock: number;
  level: AvailabilityLevel;
  isGuaranteed: boolean;
  badgeLabel: string;
  badgeSubtitle: string;
  badgeVariant: 'emerald' | 'amber' | 'rose';
  locationLabel: string;
  hasPhysicalLocation: boolean;
  confidenceMessage: string;
}

export interface OfflineCatalogSummary {
  total: number;
  guaranteed: number;
  limited: number;
  outOfStock: number;
  guaranteedPercentage: number;
  hasGuaranteedProducts: boolean;
}

export type AvailabilityFilterOption = 'all' | 'guaranteed' | 'in_stock' | 'limited';

/**
 * Calcula la disponibilidad física y el nivel de garantía del producto.
 */
export function getProductAvailabilityInfo(
  product: Pick<Product, 'id' | 'stock' | 'estante' | 'fila' | 'location'>,
  floatingHold: number = 0
): ProductAvailabilityInfo {
  const rawStock = Number(product?.stock) || 0;
  const hold = Math.max(0, Number(floatingHold) || 0);
  const availableStock = Math.max(0, rawStock - hold);

  const estante = product?.location?.estante || product?.estante || '';
  const fila = product?.location?.fila || product?.fila || '';
  const hasPhysicalLocation = Boolean(estante.trim() || fila.trim());
  const locationLabel = hasPhysicalLocation
    ? [estante.trim() && `Estante ${estante.trim()}`, fila.trim() && `Fila/Nivel ${fila.trim()}`]
        .filter(Boolean)
        .join(' · ')
    : 'Ubicación General';

  let level: AvailabilityLevel = 'out_of_stock';
  let badgeLabel = 'Sin Stock Garantizado';
  let badgeSubtitle = 'Agotado en último corte sincronizado';
  let badgeVariant: 'emerald' | 'amber' | 'rose' = 'rose';
  let confidenceMessage = 'No disponible en el corte sincronizado';

  if (availableStock >= 3) {
    level = 'guaranteed';
    badgeLabel = 'Disponibilidad Garantizada';
    badgeSubtitle = `${availableStock} pzas verificadas en anaquel`;
    badgeVariant = 'emerald';
    confidenceMessage = 'Stock verificado y garantizado en tienda local';
  } else if (availableStock > 0) {
    level = 'limited';
    badgeLabel = 'Disponibilidad Limitada';
    badgeSubtitle = `Últimas ${availableStock} pzas en anaquel`;
    badgeVariant = 'amber';
    confidenceMessage = 'Pocas piezas registradas en último estado';
  }

  return {
    productId: product?.id || '',
    stock: rawStock,
    floatingHold: hold,
    availableStock,
    level,
    isGuaranteed: level === 'guaranteed',
    badgeLabel,
    badgeSubtitle,
    badgeVariant,
    locationLabel,
    hasPhysicalLocation,
    confidenceMessage,
  };
}

/**
 * Filtra la lista de productos según la opción de disponibilidad seleccionada.
 */
export function filterCatalogByAvailability<T extends Pick<Product, 'id' | 'stock' | 'estante' | 'fila' | 'location'>>(
  products: T[],
  filter: AvailabilityFilterOption,
  floatingStockMap: Record<string, number> = {}
): T[] {
  if (!Array.isArray(products)) return [];
  if (filter === 'all') return products;

  return products.filter((p) => {
    const hold = floatingStockMap[p.id] || 0;
    const info = getProductAvailabilityInfo(p, hold);

    if (filter === 'guaranteed') {
      return info.isGuaranteed;
    }
    if (filter === 'in_stock') {
      return info.availableStock > 0;
    }
    if (filter === 'limited') {
      return info.level === 'limited';
    }
    return true;
  });
}

/**
 * Genera métricas de disponibilidad del catálogo local.
 */
export function getOfflineCatalogSummary(
  products: Array<Pick<Product, 'id' | 'stock' | 'estante' | 'fila' | 'location'>>,
  floatingStockMap: Record<string, number> = {}
): OfflineCatalogSummary {
  if (!Array.isArray(products) || products.length === 0) {
    return {
      total: 0,
      guaranteed: 0,
      limited: 0,
      outOfStock: 0,
      guaranteedPercentage: 0,
      hasGuaranteedProducts: false,
    };
  }

  let guaranteed = 0;
  let limited = 0;
  let outOfStock = 0;

  for (const p of products) {
    const hold = floatingStockMap[p.id] || 0;
    const info = getProductAvailabilityInfo(p, hold);
    if (info.level === 'guaranteed') guaranteed++;
    else if (info.level === 'limited') limited++;
    else outOfStock++;
  }

  const total = products.length;
  const guaranteedPercentage = total > 0 ? Math.round((guaranteed / total) * 100) : 0;

  return {
    total,
    guaranteed,
    limited,
    outOfStock,
    guaranteedPercentage,
    hasGuaranteedProducts: guaranteed > 0,
  };
}

/**
 * Formatea la marca de tiempo de la última sincronización en lenguaje legible.
 */
export function formatLastSyncTimestamp(timestamp: string | number | Date | null | undefined): string {
  if (!timestamp) {
    return 'Último corte local almacenado';
  }

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Último corte local almacenado';
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} a las ${hours}:${minutes} hrs`;
  } catch {
    return 'Último corte local almacenado';
  }
}
