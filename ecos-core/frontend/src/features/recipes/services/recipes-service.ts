import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type { Recipe, RecipeCostHistoryResult, RecipePayload, RecipesQuery, RecipesResult } from '@/features/recipes/types/recipe';

// Recipes share the /boms backend endpoint — no backend changes required.
export const recipesService = {
  async list(params: RecipesQuery): Promise<RecipesResult> {
    const { data } = await api.get<ApiResponse<RecipesResult>>('/boms', { params });
    return data.data;
  },

  async get(id: string): Promise<Recipe> {
    const { data } = await api.get<ApiResponse<Recipe>>(`/boms/${id}`);
    return data.data;
  },

  async create(payload: RecipePayload): Promise<Recipe> {
    const { data } = await api.post<ApiResponse<Recipe>>('/boms', payload);
    return data.data;
  },

  async update(id: string, payload: RecipePayload): Promise<Recipe> {
    const { data } = await api.put<ApiResponse<Recipe>>(`/boms/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/boms/${id}`);
  },

  async getCostHistory(id: string, page = 1, perPage = 20): Promise<RecipeCostHistoryResult> {
    const { data } = await api.get<ApiResponse<RecipeCostHistoryResult>>(
      `/boms/${id}/cost-history`,
      { params: { page, per_page: perPage } },
    );
    return data.data;
  },

  /**
   * Activate or deactivate a recipe.
   *
   * Calls the dedicated status endpoint with the single field it accepts. It
   * MUST NOT rebuild a full RecipePayload: a list row carries no `lines`, so
   * the old implementation sent `lines: []` and the backend replaced the
   * recipe's components with nothing (BUG-BOM-DATA-LOSS-001). Accepting only
   * the id and the target state is what makes that unreachable from here.
   */
  async setStatus(id: string, isActive: boolean): Promise<Recipe> {
    const { data } = await api.patch<ApiResponse<Recipe>>(`/boms/${id}/status`, {
      is_active: isActive,
    });
    return data.data;
  },
};
