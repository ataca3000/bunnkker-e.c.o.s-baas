// src/lib/publicProductVisibility.ts
import type { Product } from './types';

/**
 * Filtra los productos visibles para el público general.
 * Cualquier producto con `hideFromPublic: true` permanece disponible en POS y Almacén,
 * pero no se muestra ni busca en la tienda pública.
 */
export function filterPublicCatalogProducts<T extends Pick<Product, 'hideFromPublic'>>(
  products: T[]
): T[] {
  if (!Array.isArray(products)) return [];
  return products.filter((product) => !product?.hideFromPublic);
}

/**
 * Indica si un producto debe ocultar la cantidad numérica exacta de piezas al público,
 * mostrando únicamente el precio oficial y un estado genérico ("Disponible" / "Agotado").
 */
export function shouldHidePublicStock(product: Pick<Product, 'hidePublicStock'> | null | undefined): boolean {
  return Boolean(product?.hidePublicStock);
}

/**
 * Etiqueta segura para disponibilidad en el catálogo público.
 * Cuando `hidePublicStock` está activo, jamás expone cifras de existencias.
 */
export function formatPublicAvailabilityLabel(
  product: Pick<Product, 'hidePublicStock'> | null | undefined,
  availableStock: number,
  variant: 'card' | 'drawer' | 'toast' = 'card'
): string {
  const safeStock = Math.max(0, Number(availableStock) || 0);
  if (safeStock <= 0) {
    return variant === 'drawer' ? 'Agotado en anaquel' : 'Sin stock';
  }

  if (shouldHidePublicStock(product)) {
    if (variant === 'drawer') return '✓ Disponible en tienda';
    return 'Disponible';
  }

  if (variant === 'drawer') {
    return `✓ ${safeStock} unidades disponibles`;
  }
  if (variant === 'toast') {
    return `${safeStock} disp.`;
  }
  return safeStock >= 3 ? `${safeStock} disp.` : `Últ. ${safeStock}`;
}
