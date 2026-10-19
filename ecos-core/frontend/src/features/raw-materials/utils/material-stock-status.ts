export type MaterialStockStatus = 'in_stock' | 'out_of_stock';

export function resolveMaterialStockStatus(
  availableQty: number | null | undefined,
  allowNegativeStock: boolean | null | undefined,
): MaterialStockStatus {
  if ((availableQty ?? 0) > 0) return 'in_stock';
  if (allowNegativeStock) return 'in_stock';
  return 'out_of_stock';
}
