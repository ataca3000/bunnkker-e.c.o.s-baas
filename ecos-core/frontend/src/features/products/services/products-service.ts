import { api } from '@/lib/axios';
import type {
  ProductsQuery,
  ProductsResult,
  Product,
  ProductPayload,
  ProductStockStatus,
} from '@/features/products/types/product';
import type { ApiResponse } from '@/types';

/**
 * Products API client. Unwraps the standardized ApiResponse envelope.
 */
export const productsService = {
  async list(params: ProductsQuery): Promise<ProductsResult> {
    const { data } = await api.get<ApiResponse<ProductsResult>>('/products', { params });
    return data.data;
  },

  async get(id: string): Promise<Product> {
    const { data } = await api.get<ApiResponse<Product>>(`/products/${id}`);
    return data.data;
  },

  async create(payload: ProductPayload): Promise<Product> {
    const { data } = await api.post<ApiResponse<Product>>('/products', payload);
    return data.data;
  },

  async update(id: string, payload: ProductPayload): Promise<Product> {
    const { data } = await api.put<ApiResponse<Product>>(`/products/${id}`, payload);
    return data.data;
  },

  async patch(id: string, data: { stock_status?: ProductStockStatus; is_active?: boolean; allow_negative_stock?: boolean; manual_cost?: number | null; regular_price?: number | null; sale_price?: number | null }): Promise<Product> {
    const { data: res } = await api.patch<ApiResponse<Product>>(`/products/${id}`, data);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  async nextSku(prefix: string = 'FG'): Promise<string> {
    const { data } = await api.get<{ success: boolean; data: { sku: string } }>('/products/next-sku', {
      params: { prefix },
    });
    return data.data.sku;
  },

  async stats(params: { product_type?: string; product_types?: string; warehouse_id?: string } = {}): Promise<{
    total_count: number;
    total_on_hand: number;
    total_reserved: number;
    total_available: number;
    total_inventory_value: number;
  }> {
    const { data } = await api.get<ApiResponse<{
      total_count: number;
      total_on_hand: number;
      total_reserved: number;
      total_available: number;
      total_inventory_value: number;
    }>>('/products/stats', { params });
    return data.data;
  },

  async importCsv(file: File): Promise<{ success: number; errors: Array<{ row: number; message: string }> }> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ApiResponse<{ success: number; errors: Array<{ row: number; message: string }> }>>(
      '/products/import',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },
};
