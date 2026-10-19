import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { productsService } from '@/features/products/services/products-service';
import type { Product, ProductsQuery, ProductPayload, ProductStockStatus } from '@/features/products/types/product';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const PRODUCTS_KEY = 'products';

/** Paginated, filtered, sorted products list. */
export function useProductsQuery(params: ProductsQuery, options?: { enabled?: boolean }) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, PRODUCTS_KEY, params],
    queryFn: () => productsService.list(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateProduct() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductPayload) => productsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCTS_KEY] }),
  });
}

export function useUpdateProduct() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProductPayload }) =>
      productsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCTS_KEY] }),
  });
}

export function useDeleteProduct() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCTS_KEY] }),
  });
}

export function useToggleProductStatus() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (product: Product) =>
      productsService.update(product.id, {
        sku: product.sku,
        name: product.name,
        description: product.description ?? null,
        category_id: product.category_id,
        product_type: product.product_type,
        is_active: !product.is_active,
        image_url: product.image_url,
        regular_price: product.regular_price,
        sale_price: product.sale_price,
        long_description: product.long_description,
        stock_status: product.stock_status,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCTS_KEY] }),
  });
}

export function usePatchProduct() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof productsService.patch>[1] }) =>
      productsService.patch(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCTS_KEY] }),
  });
}

export function useBulkUpdateStockStatus() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: ProductStockStatus }) =>
      Promise.all(ids.map((id) => productsService.patch(id, { stock_status: status }))),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCTS_KEY] }),
  });
}

export function useImportProducts() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => productsService.importCsv(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, PRODUCTS_KEY] }),
  });
}

export function useNextSku(prefix: string = 'FG', enabled: boolean = true) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'next-sku', prefix],
    queryFn: () => productsService.nextSku(prefix),
    enabled,
    staleTime: 0,
  });
}
