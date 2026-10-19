import { api } from '@/lib/axios';
import type {
  ProductMapping,
  ProductMappingPayload,
  ProductMappingsQuery,
  ProductMappingsResult,
} from '@/features/product-mappings/types/product-mapping';
import type { ApiResponse } from '@/types';

export const productMappingsService = {
  async list(params: ProductMappingsQuery): Promise<ProductMappingsResult> {
    const { data } = await api.get<ApiResponse<ProductMappingsResult>>('/product-mappings', { params });
    return data.data;
  },

  async get(id: string): Promise<ProductMapping> {
    const { data } = await api.get<ApiResponse<ProductMapping>>(`/product-mappings/${id}`);
    return data.data;
  },

  async create(payload: ProductMappingPayload): Promise<ProductMapping> {
    const { data } = await api.post<ApiResponse<ProductMapping>>('/product-mappings', payload);
    return data.data;
  },

  async update(id: string, payload: ProductMappingPayload): Promise<ProductMapping> {
    const { data } = await api.put<ApiResponse<ProductMapping>>(`/product-mappings/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/product-mappings/${id}`);
  },
};
