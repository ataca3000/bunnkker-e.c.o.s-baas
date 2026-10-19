import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseMaterialsService } from '../services/purchase-materials-service';
import type {
  PurchaseMaterialsQuery,
  CreatePurchaseMaterialPayload,
  UpdatePurchaseMaterialPayload,
} from '../types/purchase-material';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const KEY = 'purchase-materials';

function useKeys() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return {
    list: (params: PurchaseMaterialsQuery) => ['company', companyId, KEY, params] as const,
    detail: (id: string) => ['company', companyId, KEY, id] as const,
    root: ['company', companyId, KEY] as const,
  };
}

export function usePurchaseMaterialsQuery(params: PurchaseMaterialsQuery = {}) {
  const KEYS = useKeys();
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => purchaseMaterialsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function usePurchaseMaterialQuery(id: string) {
  const KEYS = useKeys();
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => purchaseMaterialsService.get(id),
    enabled: !!id,
  });
}

export function useCreatePurchaseMaterial() {
  const KEYS = useKeys();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePurchaseMaterialPayload) => purchaseMaterialsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.root }),
  });
}

export function useUpdatePurchaseMaterial(id: string) {
  const KEYS = useKeys();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePurchaseMaterialPayload) => purchaseMaterialsService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.root });
    },
  });
}

export function useDeletePurchaseMaterial() {
  const KEYS = useKeys();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseMaterialsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.root }),
  });
}

function usePmAction(action: (id: string, ...args: unknown[]) => Promise<unknown>) {
  const KEYS = useKeys();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.root });
    },
  });
}

export function useSubmitPurchaseMaterial() {
  return usePmAction((id) => purchaseMaterialsService.submit(id));
}

export function useApprovePurchaseMaterial() {
  return usePmAction((id) => purchaseMaterialsService.approve(id));
}

export function useRejectPurchaseMaterial() {
  const KEYS = useKeys();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      purchaseMaterialsService.reject(id, reason),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.root });
    },
  });
}

export function useHoldPurchaseMaterial() {
  return usePmAction((id) => purchaseMaterialsService.hold(id));
}

export function useCancelPurchaseMaterial() {
  return usePmAction((id) => purchaseMaterialsService.cancel(id));
}

export function useAssignBuyer(materialId: string) {
  const KEYS = useKeys();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (buyerName: string) => purchaseMaterialsService.assignBuyer(materialId, buyerName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(materialId) });
      qc.invalidateQueries({ queryKey: KEYS.root });
    },
  });
}

export function useSelectLineSupplier(materialId: string) {
  const KEYS = useKeys();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { lineId: string; supplier_id: string; agreed_price?: number | null; agreed_qty?: number | null; lead_time_days?: number | null }) =>
      purchaseMaterialsService.selectLineSupplier(materialId, payload.lineId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(materialId) });
      qc.invalidateQueries({ queryKey: KEYS.root });
    },
  });
}

export function usePurchaseMaterialStats(params: { company_id?: string; warehouse_id?: string } = {}) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, KEY, 'stats', params],
    queryFn: () => purchaseMaterialsService.getStats(params),
    staleTime: 30_000,
  });
}

export function useProductProcurementPanel(
  productId: string | null,
  params: { warehouse_id?: string; requested_qty?: number; required_date?: string } = {},
) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, KEY, 'procurement-panel', productId, params],
    queryFn: () => purchaseMaterialsService.getProcurementPanel(productId!, params),
    enabled: !!productId,
    staleTime: 60_000,
  });
}

export function useProductDemandAnalysis(
  productId: string | null,
  params: { warehouse_id?: string } = {},
) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, KEY, 'demand-analysis', productId, params],
    queryFn: () => purchaseMaterialsService.getDemandAnalysis(productId!, params),
    enabled: !!productId,
    staleTime: 120_000,
  });
}
