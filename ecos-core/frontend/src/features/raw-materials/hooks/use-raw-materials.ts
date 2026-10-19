import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ds/use-toast';
import { rawMaterialsService } from '@/features/raw-materials/services/raw-materials-service';
import { materialCostService } from '@/features/cost-management/services/pricing-review-service';
import { stockLedgerService } from '@/features/stock-ledger/services/stock-ledger-service';
import type { RawMaterial, RawMaterialPayload, RawMaterialsQuery } from '@/features/raw-materials/types';
import type { StockMovementsQuery } from '@/features/stock-ledger/types/stock-movement';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const KEY = 'raw-materials';

export function useRawMaterialsQuery(params: RawMaterialsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, KEY, params],
    queryFn:  () => rawMaterialsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useRawMaterialStats(
  query: Pick<RawMaterialsQuery, 'material_type' | 'category_id' | 'supplier_id' | 'warehouse_id'> = {},
) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, KEY, 'stats', query],
    queryFn:  () => rawMaterialsService.stats(query),
    staleTime: 30_000,
  });
}

export function useNextMaterialSku(prefix: 'RM' | 'PM' = 'RM') {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, KEY, 'next-sku', prefix],
    queryFn:  () => rawMaterialsService.nextSku(prefix),
    staleTime: 0,
  });
}

/** @deprecated Use useNextMaterialSku('RM') */
export function useNextRawMaterialSku() {
  return useNextMaterialSku('RM');
}

export function useCreateRawMaterial() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RawMaterialPayload) => rawMaterialsService.create(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useUpdateRawMaterial() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RawMaterialPayload }) =>
      rawMaterialsService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useDeleteRawMaterial() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => rawMaterialsService.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useToggleAllowNegative() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allow_negative_stock }: { id: string; allow_negative_stock: boolean }) =>
      rawMaterialsService.patch(id, { allow_negative_stock }),
    onMutate: async ({ id, allow_negative_stock }) => {
      await qc.cancelQueries({ queryKey: ['company', companyId, KEY] });
      const snapshots = qc.getQueriesData<{ items: RawMaterial[] }>({ queryKey: ['company', companyId, KEY] });
      qc.setQueriesData<{ items: RawMaterial[]; meta?: unknown }>(
        { queryKey: ['company', companyId, KEY] },
        (old) => {
          if (!old || !Array.isArray(old.items)) return old;
          return {
            ...old,
            items: old.items.map((m) =>
              m.id === id ? { ...m, allow_negative_stock } : m,
            ),
          };
        },
      );
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          qc.setQueryData(key, data);
        }
      }
      toast.error('Failed to update inventory policy.');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useBulkUpdateRawMaterials() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      patch,
    }: {
      ids:   string[];
      patch: Partial<RawMaterialPayload>;
    }) => {
      await Promise.all(
        ids.map((id) =>
          rawMaterialsService.update(id, {
            sku:          '',
            name:         '',
            category_id:  '',
            unit_id:      '',
            product_type: 'raw_material',
            is_active:    true,
            cost_source:  'purchase',
            ...patch,
          } as RawMaterialPayload),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useAddStock() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      product_id:   string;
      warehouse_id: string;
      quantity:     number;
      unit_cost?:   number | null;
      notes?:       string | null;
    }) => rawMaterialsService.addStock(payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['company', companyId, 'stock-movements'] });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'material-cost-history', vars.product_id] });
      qc.invalidateQueries({ queryKey: ['company', companyId, KEY] });
    },
  });
}

export function useUpdateMaterialCost() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, materialCost, reason }: { id: string; materialCost: number; reason: string }) =>
      materialCostService.updateMaterialCost(id, materialCost, reason),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['company', companyId, KEY] });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'material-cost-history', vars.id] });
    },
    onError: () => {
      toast.error('Failed to update material cost.');
    },
  });
}

export function useRawMaterialCostHistory(
  productId: string | undefined,
  params: { page?: number; per_page?: number } = {},
) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'material-cost-history', productId, params],
    queryFn:  () => materialCostService.getMaterialHistory(productId!, params),
    enabled:  !!productId,
    placeholderData: keepPreviousData,
  });
}

export function useRawMaterialStockMovements(
  productId: string | undefined,
  params: Omit<StockMovementsQuery, 'product_id'> = {},
) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'stock-movements', { product_id: productId, ...params }],
    queryFn:  () => stockLedgerService.list({ product_id: productId, ...params }),
    enabled:  !!productId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Purchase history from the canonical receipt-layer source — powers the
 * rebuilt Suppliers (Supplier History) tab. No new schema/endpoint.
 */
export function useRawMaterialPurchaseHistory(productId: string | undefined) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'material-purchase-history', productId],
    queryFn:  () => rawMaterialsService.purchaseHistory(productId!),
    enabled:  !!productId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Per-warehouse stock distribution from the canonical inventory service.
 * Powers the Inventory tab's Warehouse Distribution section.
 */
export function useRawMaterialWarehouseDistribution(productId: string | undefined) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'material-warehouse-distribution', productId],
    queryFn:  () => rawMaterialsService.warehouseDistribution(productId!),
    enabled:  !!productId,
    placeholderData: keepPreviousData,
  });
}
