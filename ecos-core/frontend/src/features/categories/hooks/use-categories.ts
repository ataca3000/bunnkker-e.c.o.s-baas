import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { categoriesService } from '@/features/categories/services/categories-service';
import type { CategoriesQuery, CategoryPayload } from '@/features/categories/types/category';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const CATEGORIES_KEY = 'categories';

/** Paginated, filtered, sorted categories list. */
export function useCategoriesQuery(params: CategoriesQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, CATEGORIES_KEY, params],
    queryFn: () => categoriesService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCategory() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryPayload) => categoriesService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, CATEGORIES_KEY] }),
  });
}

export function useUpdateCategory() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CategoryPayload }) =>
      categoriesService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, CATEGORIES_KEY] }),
  });
}

export function useDeleteCategory() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, CATEGORIES_KEY] }),
  });
}
