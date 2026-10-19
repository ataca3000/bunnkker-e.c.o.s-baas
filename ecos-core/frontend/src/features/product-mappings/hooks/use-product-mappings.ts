import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { productMappingsService } from '@/features/product-mappings/services/product-mappings-service';
import type { ProductMappingPayload, ProductMappingsQuery } from '@/features/product-mappings/types/product-mapping';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export const PRODUCT_MAPPINGS_KEY = 'product-mappings';

export function useProductMappingsQuery(params: ProductMappingsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, PRODUCT_MAPPINGS_KEY, params],
    queryFn: () => productMappingsService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateProductMapping() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductMappingPayload) => productMappingsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCT_MAPPINGS_KEY] }),
  });
}

export function useUpdateProductMapping() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductMappingPayload }) =>
      productMappingsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCT_MAPPINGS_KEY] }),
  });
}

export function useDeleteProductMapping() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productMappingsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCT_MAPPINGS_KEY] }),
  });
}
