import { api } from '@/lib/axios';
import type {
  SuppliersQuery,
  SuppliersResult,
  Supplier,
  SupplierPayload,
} from '@/features/suppliers/types/supplier';
import type { ApiResponse } from '@/types';

/**
 * Suppliers API client. Unwraps the standardized ApiResponse envelope.
 */
export const suppliersService = {
  async list(params: SuppliersQuery): Promise<SuppliersResult> {
    const { data } = await api.get<ApiResponse<SuppliersResult>>('/suppliers', { params });
    return data.data;
  },

  async get(id: string): Promise<Supplier> {
    const { data } = await api.get<ApiResponse<Supplier>>(`/suppliers/${id}`);
    return data.data;
  },

  async create(payload: SupplierPayload): Promise<Supplier> {
    const { data } = await api.post<ApiResponse<Supplier>>('/suppliers', payload);
    return data.data;
  },

  async update(id: string, payload: SupplierPayload): Promise<Supplier> {
    const { data } = await api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/suppliers/${id}`);
  },
};
