import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { recipesService } from '@/features/recipes/services/recipes-service';
import type { RecipePayload, RecipesQuery } from '@/features/recipes/types/recipe';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const RECIPES_KEY = 'recipes';

export function useRecipesQuery(params: RecipesQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, RECIPES_KEY, params],
    queryFn: () => recipesService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useRecipeQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, RECIPES_KEY, id],
    queryFn: () => recipesService.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateRecipe() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipePayload) => recipesService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, RECIPES_KEY] }),
  });
}

export function useUpdateRecipe(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecipePayload) => recipesService.update(id, payload),
    onSuccess: (updatedRecipe) => {
      queryClient.setQueryData(['company', companyId, RECIPES_KEY, id], updatedRecipe);
      queryClient.invalidateQueries({ queryKey: ['company', companyId, RECIPES_KEY] });
    },
  });
}

export function useDeleteRecipe() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, RECIPES_KEY] }),
  });
}

/**
 * Activate or deactivate a recipe.
 *
 * Takes the id and the target state only. It deliberately does NOT accept a
 * Recipe: passing a whole row was what let a partial list DTO become a full
 * update payload and delete the recipe's components (BUG-BOM-DATA-LOSS-001).
 */
export function useSetRecipeStatus() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      recipesService.setStatus(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, RECIPES_KEY] }),
  });
}


export function useRecipeCostHistoryQuery(id: string, page = 1) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, RECIPES_KEY, id, 'cost-history', page],
    queryFn: () => recipesService.getCostHistory(id, page),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}
