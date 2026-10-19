import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { brandsService } from '@/features/brands/services/brands-service';
import type { BrandsQuery, BrandPayload, BrandTransferPayload, TransferAnalyzePayload } from '@/features/brands/types/brand';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const BRANDS_KEY = 'brands';

export function useBrandsQuery(params: BrandsQuery, options?: { enabled?: boolean }) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, BRANDS_KEY, params],
    queryFn: () => brandsService.list(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useBrandQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, BRANDS_KEY, id],
    queryFn: () => brandsService.get(id),
    enabled: !!id,
  });
}

export function useCreateBrand() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BrandPayload) => brandsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BRANDS_KEY] }),
  });
}

export function useUpdateBrand() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<BrandPayload, 'company_id'> }) =>
      brandsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BRANDS_KEY] }),
  });
}

export function useDeleteBrand() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BRANDS_KEY] }),
  });
}

export function useTransferBrand() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BrandTransferPayload }) =>
      brandsService.transfer(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, BRANDS_KEY] }),
  });
}

export function useAnalyzeTransferBrand() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TransferAnalyzePayload }) =>
      brandsService.analyzeTransfer(id, payload),
  });
}
