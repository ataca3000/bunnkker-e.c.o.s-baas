// src/lib/productVisibilityStore.ts
import { loadPersistentSiteConfig, savePersistentSiteConfig } from './persistentSettings';

export interface ProductVisibilityFlags {
  hidePublicStock?: boolean;
  hideFromPublic?: boolean;
}

export type ProductVisibilityMap = Record<string, ProductVisibilityFlags>;

export function getProductVisibilityMap(tenantId: string = 'default'): ProductVisibilityMap {
  const cfg = loadPersistentSiteConfig(tenantId);
  const raw = cfg?.productVisibilityMap;
  if (!raw || typeof raw !== 'object') return {};

  const cleaned: ProductVisibilityMap = {};
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const item = val as Record<string, unknown>;
    cleaned[id] = {
      hidePublicStock: Boolean(item.hidePublicStock),
      hideFromPublic: Boolean(item.hideFromPublic),
    };
  }
  return cleaned;
}

export function saveBatchProductVisibility(
  tenantId: string = 'default',
  productIds: string[],
  updates: ProductVisibilityFlags
): ProductVisibilityMap {
  const cfg = loadPersistentSiteConfig(tenantId);
  const currentMap = getProductVisibilityMap(tenantId);
  const nextMap: ProductVisibilityMap = { ...currentMap };

  for (const rawId of productIds) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id) continue;
    const existing = nextMap[id] || {};
    nextMap[id] = {
      hidePublicStock:
        typeof updates.hidePublicStock === 'boolean'
          ? updates.hidePublicStock
          : Boolean(existing.hidePublicStock),
      hideFromPublic:
        typeof updates.hideFromPublic === 'boolean'
          ? updates.hideFromPublic
          : Boolean(existing.hideFromPublic),
    };
  }

  savePersistentSiteConfig(tenantId, {
    ...cfg,
    productVisibilityMap: nextMap,
  });

  return nextMap;
}
