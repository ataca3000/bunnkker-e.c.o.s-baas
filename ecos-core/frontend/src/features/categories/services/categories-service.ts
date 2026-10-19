import { api } from '@/lib/axios';
import type {
  CategoriesQuery,
  CategoriesResult,
  Category,
  CategoryPayload,
} from '@/features/categories/types/category';
import type { ApiResponse } from '@/types';

/**
 * Categories API client. Unwraps the standardized ApiResponse envelope.
 */
export const categoriesService = {
  async list(params: CategoriesQuery): Promise<CategoriesResult> {
    const { data } = await api.get<ApiResponse<CategoriesResult>>('/categories', { params });
    return data.data;
  },

  async get(id: string): Promise<Category> {
    const { data } = await api.get<ApiResponse<Category>>(`/categories/${id}`);
    return data.data;
  },

  async create(payload: CategoryPayload): Promise<Category> {
    const { data } = await api.post<ApiResponse<Category>>('/categories', payload);
    return data.data;
  },

  async update(id: string, payload: CategoryPayload): Promise<Category> {
    const { data } = await api.put<ApiResponse<Category>>(`/categories/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/categories/${id}`);
  },
};
