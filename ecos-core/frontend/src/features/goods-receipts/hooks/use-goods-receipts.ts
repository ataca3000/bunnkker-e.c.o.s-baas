import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { goodsReceiptsService } from '@/features/goods-receipts/services/goods-receipts-service';
import type { GoodsReceiptPayload, GoodsReceiptsQuery } from '@/features/goods-receipts/types/goods-receipt';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export const GR_KEY = 'goods-receipts';

export function useGoodsReceiptsQuery(params: GoodsReceiptsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, GR_KEY, params],
    queryFn: () => goodsReceiptsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useGoodsReceiptQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, GR_KEY, id],
    queryFn: () => goodsReceiptsService.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateGoodsReceipt() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FormData | GoodsReceiptPayload) => goodsReceiptsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, GR_KEY] }),
  });
}

export function useUpdateGoodsReceipt() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FormData | GoodsReceiptPayload }) =>
      goodsReceiptsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, GR_KEY] }),
  });
}

export function useDeleteGoodsReceipt() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goodsReceiptsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, GR_KEY] }),
  });
}

export function usePostGoodsReceipt() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goodsReceiptsService.post(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, GR_KEY] }),
  });
}
